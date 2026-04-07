from celery_app import celery
from modules.perplexity import perplexity
from modules.brisque import brisque
from modules.dnsmos import DNSMOS
from modules.niqe import VideoNIQEValidator
from modules.models import db, DataItem, User
import numpy as np
import os

@celery.task(bind=True)
def validate_text_task(self, filepath, filename, user_id):
    from app import app
    from celery import group
    import uuid
    import torch
    
    # 1. Chunk the text file
    chunk_dir = f"{filepath}_chunks"
    os.makedirs(chunk_dir, exist_ok=True)
    
    chunks = []
    lines_per_chunk = 5000
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as infile:
        chunk_idx = 0
        current_chunk_lines = []
        for line in infile:
            current_chunk_lines.append(line)
            if len(current_chunk_lines) >= lines_per_chunk:
                chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_idx:03d}.txt")
                with open(chunk_path, 'w', encoding='utf-8') as outfile:
                    outfile.writelines(current_chunk_lines)
                chunks.append(chunk_path)
                current_chunk_lines = []
                chunk_idx += 1
                
        if current_chunk_lines:
            chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_idx:03d}.txt")
            with open(chunk_path, 'w', encoding='utf-8') as outfile:
                outfile.writelines(current_chunk_lines)
            chunks.append(chunk_path)

    # 2. Fire celery group
    if not chunks:
        chunks = [filepath] # Fallback if empty
        
    job = group(process_text_chunk_task.s(chunk) for chunk in chunks)()
    
    # 3. Wait for all chunks to finish
    chunk_results = job.get()
    
    # 4. Aggregate
    total_nll = 0.0
    total_tokens = 0
    for res in chunk_results:
        if isinstance(res, tuple) or isinstance(res, list):
            total_nll += float(res[0])
            total_tokens += int(res[1])
            
    # Cleanup physical chunk files
    for chunk in chunks:
        if chunk != filepath and os.path.exists(chunk):
            os.remove(chunk)
    if os.path.exists(chunk_dir):
        try: os.rmdir(chunk_dir)
        except: pass
        
    with app.app_context():
        try:
            if total_tokens == 0:
                raise Exception("No readable text frames found.")
                
            ppl = float(torch.exp(torch.tensor(total_nll) / total_tokens).item())
            score = round(ppl, 2)
            status = 'validated' if score < 100 else 'rejected'
            
            user = User.query.get(user_id)
            new_item = DataItem(
                filename=filename,
                modality='text',
                validation_score=score,
                validation_metric='perplexity',
                status=status,
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()
            
            return {
                'status': status,
                'perplexity': score,
                'item_id': new_item.id
            }
        except Exception as e:
            self.update_state(state='FAILURE', meta={'error': str(e)})
            raise e
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

@celery.task
def process_text_chunk_task(filepath):
    from modules.perplexity import perplexity_raw
    with open(filepath, 'rb') as f:
        nll_sum, n_tokens = perplexity_raw(f)
    return nll_sum, n_tokens

@celery.task(bind=True)
def validate_image_task(self, filepaths, batch_filename, user_id):
    from app import app
    from celery import group
    
    # 1. Fire celery group on each individual image instead of entirely evaluating loop linearly
    job = group(process_image_chunk_task.s(filepath) for filepath in filepaths)()
    
    # 2. Wait for chunks
    chunk_results = job.get()
    
    # 3. Aggregate
    scores = []
    for res in chunk_results:
        if isinstance(res, dict) and 'brisque_score' in res:
            scores.append(res['brisque_score'])
            
    with app.app_context():
        try:
            if not scores:
                raise Exception("No valid image frames found.")
                
            dataset_mean = round(float(np.mean(scores)), 4)
            status = 'validated' if dataset_mean < 50 else 'rejected'
            
            user = User.query.get(user_id)
            new_item = DataItem(
                filename=batch_filename,
                modality='image_batch',
                validation_score=dataset_mean,
                validation_metric='brisque_mean',
                status=status,
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()

            aggregation = {
                "dataset_mean": dataset_mean,
                "dataset_median": round(float(np.median(scores)), 4),
                "dataset_std": round(float(np.std(scores)), 4),
                "best_score": round(float(np.min(scores)), 4),
                "worst_score": round(float(np.max(scores)), 4),
                "total_images": len(scores),
                "status": status,
                "item_id": new_item.id
            }
            return {
                'status': status,
                'results': aggregation
            }
        except Exception as e:
            self.update_state(state='FAILURE', meta={'error': str(e)})
            raise e
        finally:
            for filepath in filepaths:
                if os.path.exists(filepath):
                    os.remove(filepath)

@celery.task
def process_image_chunk_task(filepath):
    # brisque method returns a list of dictionaries. Passing 1 image = list of 1.
    res_list = brisque([filepath]) 
    return res_list[0] if res_list else {}

@celery.task(bind=True)
def validate_audio_task(self, filepath, filename, user_id):
    from app import app
    import subprocess
    import glob
    from celery import group
    
    # 1. Chunk audio with ffmpeg into 60-second clips
    chunk_dir = f"{filepath}_chunks"
    os.makedirs(chunk_dir, exist_ok=True)
    chunk_pattern = os.path.join(chunk_dir, "chunk_%03d.wav")
    
    cmd = [
        "ffmpeg", "-i", filepath,
        "-f", "segment",
        "-segment_time", "60",
        "-c", "copy",
        chunk_pattern
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    chunks = sorted(glob.glob(os.path.join(chunk_dir, "chunk_*.wav")))
    if not chunks:
        chunks = [filepath] # fallback
        
    # 2. Fire proxy celery group
    job = group(process_audio_chunk_task.s(chunk) for chunk in chunks)()
    
    # 3. Wait for all chunks
    chunk_results_list = job.get()
    
    # 4. Aggregate
    sig_scores = []
    bak_scores = []
    ovr_scores = []
    
    for scores in chunk_results_list:
        if isinstance(scores, dict) and 'overall_quality' in scores:
            sig_scores.append(scores['speech_quality'])
            bak_scores.append(scores['background_noise'])
            ovr_scores.append(scores['overall_quality'])
            
    # Cleanup physical audio chunks
    for chunk in chunks:
        if chunk != filepath and os.path.exists(chunk):
            os.remove(chunk)
    if os.path.exists(chunk_dir):
        try: os.rmdir(chunk_dir)
        except: pass

    with app.app_context():
        try:
            if not ovr_scores:
                raise Exception("Failed to extract valid audio DNSMOS metrics.")
                
            sig_score = round(float(np.mean(sig_scores)), 2)
            bak_score = round(float(np.mean(bak_scores)), 2)
            ovr_score = round(float(np.mean(ovr_scores)), 2)

            passed = ovr_score >= 3.0 and bak_score >= 3.5
            
            user = User.query.get(user_id)
            new_item = DataItem(
                filename=filename,
                modality='audio',
                validation_score=ovr_score,
                validation_metric='dnsmos_overall',
                status='Accepted' if passed else 'Rejected',
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()
            
            return {
                'status': passed,
                'scores': {
                    'speech_quality': sig_score,
                    'background_noise': bak_score,
                    'overall_quality': ovr_score
                }, 
                'result': 'Accepted' if passed else 'Rejected',
                'item_id': new_item.id
            }
        except Exception as e:
            db.session.rollback()
            self.update_state(state='FAILURE', meta={'error': str(e)})
            raise e
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

@celery.task
def process_audio_chunk_task(filepath):
    dnsmos_validator = DNSMOS()
    with open(filepath, 'rb') as f:
        file_data = f.read()
    result = dnsmos_validator.validate(file_data)
    return result['scores']

@celery.task(bind=True)
def validate_video_task(self, filepath, filename, user_id):
    from app import app
    import subprocess
    import glob
    from celery import group
    
    # 1. Chunk video with ffmpeg into 60-second clips
    chunk_dir = f"{filepath}_chunks"
    os.makedirs(chunk_dir, exist_ok=True)
    chunk_pattern = os.path.join(chunk_dir, "chunk_%03d.mp4")
    
    cmd = [
        "ffmpeg", "-i", filepath,
        "-c", "copy",
        "-map", "0",
        "-segment_time", "60",
        "-f", "segment",
        "-reset_timestamps", "1",
        chunk_pattern
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    chunks = sorted(glob.glob(os.path.join(chunk_dir, "chunk_*.mp4")))
    if not chunks:
        chunks = [filepath] # fallback
        
    # 2. Fire celery group
    job = group(process_video_chunk_task.s(chunk) for chunk in chunks)()
    
    # 3. Wait for all chunks to finish
    chunk_scores_list = job.get()
    
    # 4. Aggregate
    all_scores = []
    for scores in chunk_scores_list:
        if isinstance(scores, list):
            all_scores.extend(scores)
            
    # Cleanup physical chunk files
    for chunk in chunks:
        if chunk != filepath and os.path.exists(chunk):
            os.remove(chunk)
    if os.path.exists(chunk_dir):
        try: os.rmdir(chunk_dir)
        except: pass
        
    with app.app_context():
        try:
            if not all_scores:
                raise Exception("No frames validated or file unreadable.")
                
            mean_score = round(float(np.mean(all_scores)), 2)
            worst_score = round(float(np.max(all_scores)), 2)
            p85_score = round(float(np.percentile(all_scores, 85)), 2)
            passed = p85_score <= 7.5
            
            user = User.query.get(user_id)    
            new_item = DataItem(
                filename=filename,
                modality='video',
                validation_score=p85_score,
                validation_metric='niqe_p85',
                status='Accepted' if passed else 'Rejected',
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()
            
            return {
                'status': passed,
                'scores': {
                    'niqe_mean': mean_score,
                    'niqe_worst': worst_score,
                    'niqe_p85': p85_score,
                    'frames_analyzed': len(all_scores)
                },
                'result': 'Accepted' if passed else 'Rejected: Video contains significant blur or compression artifacts.',
                'item_id': new_item.id
            }
        except Exception as e:
            db.session.rollback()
            self.update_state(state='FAILURE', meta={'error': str(e)})
            raise e
        finally:
            if os.path.exists(filepath):
                os.remove(filepath)

@celery.task
def process_video_chunk_task(filepath):
    # Map task for a single video chunk
    niqe_validator = VideoNIQEValidator()
    with open(filepath, 'rb') as f:
        file_bytes = f.read()
    
    # Extract native raw scores directly without statistical reduction
    scores = niqe_validator.get_raw_scores(file_bytes)
    return scores
