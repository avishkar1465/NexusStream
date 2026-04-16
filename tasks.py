from celery_app import celery
from flask_app import app
from modules.brisque import brisque
from modules.dnsmos import DNSMOS
from modules.niqe import VideoNIQEValidator
from modules.models import db, DataItem, User
import numpy as np
import os
import glob
import subprocess
import torch


def _split_text_file(filepath, max_chars=3000):
    chunk_dir = f"{filepath}_chunks"
    os.makedirs(chunk_dir, exist_ok=True)

    chunks = []
    chunk_idx = 0
    current = []
    current_len = 0

    with open(filepath, "r", encoding="utf-8", errors="ignore") as infile:
        for line in infile:
            while len(line) > max_chars:
                part = line[:max_chars]
                line = line[max_chars:]

                if current:
                    chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_idx:03d}.txt")
                    with open(chunk_path, "w", encoding="utf-8") as out:
                        out.writelines(current)
                    chunks.append(chunk_path)
                    current = []
                    current_len = 0
                    chunk_idx += 1

                chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_idx:03d}.txt")
                with open(chunk_path, "w", encoding="utf-8") as out:
                    out.write(part)
                chunks.append(chunk_path)
                chunk_idx += 1

            if current_len + len(line) > max_chars and current:
                chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_idx:03d}.txt")
                with open(chunk_path, "w", encoding="utf-8") as out:
                    out.writelines(current)
                chunks.append(chunk_path)
                current = []
                current_len = 0
                chunk_idx += 1

            current.append(line)
            current_len += len(line)

    if current:
        chunk_path = os.path.join(chunk_dir, f"chunk_{chunk_idx:03d}.txt")
        with open(chunk_path, "w", encoding="utf-8") as out:
            out.writelines(current)
        chunks.append(chunk_path)

    return chunk_dir, chunks


@celery.task(bind=True)
def validate_text_task(self, filepath, filename, user_id):
    from modules.perplexity import perplexity_raw

    chunk_dir = None
    chunks = []

    try:
        chunk_dir, chunks = _split_text_file(filepath, max_chars=3000)
        if not chunks:
            raise Exception("No readable text found.")

        total_nll = 0.0
        total_tokens = 0

        for chunk in chunks:
            with open(chunk, "rb") as f:
                nll_sum, n_tokens = perplexity_raw(f)
            total_nll += float(nll_sum)
            total_tokens += int(n_tokens)

        if total_tokens == 0:
            raise Exception("No readable text found.")

        ppl = float(torch.exp(torch.tensor(total_nll) / total_tokens).item())
        score = round(ppl, 2)
        status = "validated" if score < 100 else "rejected"

        with app.app_context():
            user = User.query.get(user_id)
            new_item = DataItem(
                filename=filename,
                modality="text",
                validation_score=score,
                validation_metric="perplexity",
                status=status,
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()

            return {
                "status": status,
                "perplexity": score,
                "item_id": new_item.id
            }

    except Exception:
        raise

    finally:
        for chunk in chunks:
            if os.path.exists(chunk):
                os.remove(chunk)
        if chunk_dir and os.path.exists(chunk_dir):
            try:
                os.rmdir(chunk_dir)
            except Exception:
                pass
        if os.path.exists(filepath):
            os.remove(filepath)


@celery.task(bind=True)
def validate_image_task(self, filepaths, batch_filename, user_id):
    scores = []
    errors = []

    try:
        for filepath in filepaths:
            try:
                res_list = brisque([filepath])

                if not res_list:
                    errors.append(f"{os.path.basename(filepath)} -> empty BRISQUE result")
                    continue

                first = res_list[0]

                if not isinstance(first, dict):
                    errors.append(f"{os.path.basename(filepath)} -> unexpected result type: {type(first)}")
                    continue

                if "brisque_score" not in first:
                    errors.append(f"{os.path.basename(filepath)} -> missing brisque_score: {first}")
                    continue

                scores.append(float(first["brisque_score"]))

            except Exception as e:
                errors.append(f"{os.path.basename(filepath)} -> {e}")

        with app.app_context():
            if not scores:
                first_error = errors[0] if errors else "Unknown BRISQUE failure"
                raise Exception(f"No valid image frames found. First error: {first_error}")

            dataset_mean = round(float(np.mean(scores)), 4)
            status = "validated" if dataset_mean < 50 else "rejected"

            user = User.query.get(user_id)
            new_item = DataItem(
                filename=batch_filename,
                modality="image_batch",
                validation_score=dataset_mean,
                validation_metric="brisque_mean",
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
                "failed_images": len(errors),
                "status": status,
                "item_id": new_item.id
            }

            if errors:
                aggregation["sample_error"] = errors[0]

            return {
                "status": status,
                "results": aggregation
            }

    except Exception:
        db.session.rollback()
        raise

    finally:
        for filepath in filepaths:
            if os.path.exists(filepath):
                os.remove(filepath)


@celery.task(bind=True)
def validate_audio_task(self, filepath, filename, user_id):
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
    ffmpeg_result = subprocess.run(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True
    )
    if ffmpeg_result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed for audio chunking: {ffmpeg_result.stderr}")

    chunks = sorted(glob.glob(os.path.join(chunk_dir, "chunk_*.wav")))
    if not chunks:
        chunks = [filepath]

    sig_scores = []
    bak_scores = []
    ovr_scores = []

    dnsmos_validator = DNSMOS()
    for chunk in chunks:
        try:
            with open(chunk, 'rb') as f:
                file_data = f.read()

            result = dnsmos_validator.validate(file_data)

            if isinstance(result, dict) and "scores" in result and isinstance(result["scores"], dict):
                result = result["scores"]

            if isinstance(result, dict) and all(
                key in result for key in ["speech_quality", "background_noise", "overall_quality"]
            ):
                sig_scores.append(float(result["speech_quality"]))
                bak_scores.append(float(result["background_noise"]))
                ovr_scores.append(float(result["overall_quality"]))
            else:
                print(f"Unexpected DNSMOS result for {chunk}: {result}")

        except Exception as e:
            print(f"Audio chunk failed: {chunk} -> {e}")

    for chunk in chunks:
        if chunk != filepath and os.path.exists(chunk):
            os.remove(chunk)
    if os.path.exists(chunk_dir):
        try:
            os.rmdir(chunk_dir)
        except Exception:
            pass

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
                modality="audio",
                validation_score=ovr_score,
                validation_metric="dnsmos_overall",
                status="Accepted" if passed else "Rejected",
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()

            return {
                "status": passed,
                "scores": {
                    "speech_quality": sig_score,
                    "background_noise": bak_score,
                    "overall_quality": ovr_score
                },
                "result": "Accepted" if passed else "Rejected",
                "item_id": new_item.id
            }

        except Exception:
            db.session.rollback()
            raise

        finally:
            if os.path.exists(filepath):
                os.remove(filepath)


@celery.task(bind=True)
def validate_video_task(self, filepath, filename, user_id):
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
        chunks = [filepath]

    all_scores = []
    niqe_validator = VideoNIQEValidator()
    for chunk in chunks:
        try:
            with open(chunk, 'rb') as f:
                file_bytes = f.read()
            scores = niqe_validator.get_raw_scores(file_bytes)
            if isinstance(scores, list):
                all_scores.extend(scores)
        except Exception:
            pass

    for chunk in chunks:
        if chunk != filepath and os.path.exists(chunk):
            os.remove(chunk)
    if os.path.exists(chunk_dir):
        try:
            os.rmdir(chunk_dir)
        except Exception:
            pass

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
                modality="video",
                validation_score=p85_score,
                validation_metric="niqe_p85",
                status="Accepted" if passed else "Rejected",
                owner=user
            )
            db.session.add(new_item)
            db.session.commit()

            return {
                "status": passed,
                "scores": {
                    "niqe_mean": mean_score,
                    "niqe_worst": worst_score,
                    "niqe_p85": p85_score,
                    "frames_analyzed": len(all_scores)
                },
                "result": "Accepted" if passed else "Rejected: Video contains significant blur or compression artifacts.",
                "item_id": new_item.id
            }

        except Exception:
            db.session.rollback()
            raise

        finally:
            if os.path.exists(filepath):
                os.remove(filepath)
