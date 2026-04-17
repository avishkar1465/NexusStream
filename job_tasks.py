import os
import shutil
from datetime import datetime

import numpy as np

from celery_app import celery
from flask_app import app
from modules.job_utils import compute_quality_percent, dumps_json, normalize_item_status
from modules.models import DataItem, ValidationJob, db
import tasks as base_tasks


DATASET_ROOT = os.path.join(os.getcwd(), "marketplace_datasets")
os.makedirs(DATASET_ROOT, exist_ok=True)


def _job_dir(job_id):
    path = os.path.join(DATASET_ROOT, f"job_{job_id}")
    os.makedirs(path, exist_ok=True)
    return path


def _persist_dataset_copy(job_id, filepaths):
    target_dir = _job_dir(job_id)
    saved_files = []
    for path in filepaths:
        if not os.path.exists(path):
            continue
        destination = os.path.join(target_dir, os.path.basename(path))
        shutil.copy2(path, destination)
        saved_files.append(destination)
    return target_dir, saved_files


def _update_job(job_id, **updates):
    with app.app_context():
        job = ValidationJob.query.get(job_id)
        if not job:
            return
        for key, value in updates.items():
            setattr(job, key, value)
        db.session.commit()


def _mark_processing(job_id, message):
    _update_job(job_id, status="processing", error_message=None, result_json=dumps_json({"status": "processing", "message": message}))


def _mark_failed(job_id, error_message):
    _update_job(
        job_id,
        status="failed",
        error_message=error_message,
        completed_at=datetime.utcnow(),
        result_json=dumps_json({"status": "failed", "error": error_message}),
    )


def _store_final_result(job_id, payload, item_ids, dataset_path):
    _update_job(
        job_id,
        status=normalize_item_status(payload.get("status")),
        result_json=dumps_json(payload),
        item_ids_json=dumps_json(item_ids),
        dataset_path=dataset_path,
        completed_at=datetime.utcnow(),
        error_message=None,
    )


def _serialize_item(item_id, fallback_name=None):
    item = DataItem.query.get(item_id)
    if not item:
        return None
    score = item.validation_score
    status = normalize_item_status(item.status)
    return {
        "item_id": item.id,
        "filename": fallback_name or item.filename,
        "status": status,
        "metric": item.validation_metric,
        "score": score,
        "quality_percent": compute_quality_percent(item.modality if item.modality in {"text", "image_batch"} else f"{item.modality}_batch", score),
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


@celery.task(bind=True, name="job_tasks.run_text_validation_job")
def run_text_validation_job(self, job_id, filepath, filename, user_id):
    dataset_path, _ = _persist_dataset_copy(job_id, [filepath])
    _mark_processing(job_id, "Running text validation.")

    try:
        result = base_tasks.validate_text_task.run(filepath, filename, user_id)
        payload = {
            "status": normalize_item_status(result.get("status")),
            "mode": "single",
            "result": result,
        }
        _store_final_result(job_id, payload, [result.get("item_id")], dataset_path)
        return payload
    except Exception as exc:
        _mark_failed(job_id, str(exc))
        raise


@celery.task(bind=True, name="job_tasks.run_image_validation_job")
def run_image_validation_job(self, job_id, filepaths, batch_filename, user_id):
    dataset_path, _ = _persist_dataset_copy(job_id, filepaths)
    _mark_processing(job_id, "Running image batch validation.")

    try:
        result = base_tasks.validate_image_task.run(filepaths, batch_filename, user_id)
        payload = {
            "status": normalize_item_status(result.get("status")),
            "mode": "batch",
            "result": result,
        }
        _store_final_result(job_id, payload, [result.get("results", {}).get("item_id")], dataset_path)
        return payload
    except Exception as exc:
        _mark_failed(job_id, str(exc))
        raise


@celery.task(bind=True, name="job_tasks.run_audio_validation_job")
def run_audio_validation_job(self, job_id, filepaths, filenames, user_id):
    dataset_path, _ = _persist_dataset_copy(job_id, filepaths)
    _mark_processing(job_id, "Running audio validation.")

    try:
        per_file = []
        item_ids = []
        for filepath, filename in zip(filepaths, filenames):
            result = base_tasks.validate_audio_task.run(filepath, filename, user_id)
            item_ids.append(result.get("item_id"))
            per_file.append({
                "filename": filename,
                "status": "validated" if result.get("status") else "rejected",
                "scores": result.get("scores", {}),
                "result": result.get("result"),
                "item_id": result.get("item_id"),
            })

        overall_values = [entry["scores"].get("overall_quality", 0) for entry in per_file]
        background_values = [entry["scores"].get("background_noise", 0) for entry in per_file]
        speech_values = [entry["scores"].get("speech_quality", 0) for entry in per_file]

        avg_overall = round(float(np.mean(overall_values)), 2) if overall_values else 0.0
        avg_background = round(float(np.mean(background_values)), 2) if background_values else 0.0
        avg_speech = round(float(np.mean(speech_values)), 2) if speech_values else 0.0
        status = "validated" if avg_overall >= 2.0 else "rejected"

        payload = {
            "status": status,
            "mode": "batch" if len(per_file) > 1 else "single",
            "summary": {
                "average_overall_quality": avg_overall,
                "average_background_noise": avg_background,
                "average_speech_quality": avg_speech,
                "accepted_files": sum(1 for entry in per_file if entry["status"] == "validated"),
                "total_files": len(per_file),
            },
            "files": per_file,
        }

        _store_final_result(job_id, payload, item_ids, dataset_path)
        return payload
    except Exception as exc:
        _mark_failed(job_id, str(exc))
        raise


@celery.task(bind=True, name="job_tasks.run_video_validation_job")
def run_video_validation_job(self, job_id, filepaths, filenames, user_id):
    dataset_path, _ = _persist_dataset_copy(job_id, filepaths)
    _mark_processing(job_id, "Running video validation.")

    try:
        per_file = []
        item_ids = []
        for filepath, filename in zip(filepaths, filenames):
            result = base_tasks.validate_video_task.run(filepath, filename, user_id)
            item_ids.append(result.get("item_id"))
            scores = result.get("scores", {})
            per_file.append({
                "filename": filename,
                "status": "validated" if result.get("status") else "rejected",
                "scores": scores,
                "result": result.get("result"),
                "item_id": result.get("item_id"),
            })

        p85_values = [entry["scores"].get("niqe_p85", 0) for entry in per_file]
        mean_values = [entry["scores"].get("niqe_mean", 0) for entry in per_file]
        worst_values = [entry["scores"].get("niqe_worst", 0) for entry in per_file]
        frames_values = [entry["scores"].get("frames_analyzed", 0) for entry in per_file]

        avg_p85 = round(float(np.mean(p85_values)), 2) if p85_values else 0.0
        avg_mean = round(float(np.mean(mean_values)), 2) if mean_values else 0.0
        worst_peak = round(float(np.max(worst_values)), 2) if worst_values else 0.0
        status = "validated" if avg_p85 <= 7.5 else "rejected"

        payload = {
            "status": status,
            "mode": "batch" if len(per_file) > 1 else "single",
            "summary": {
                "average_niqe_mean": avg_mean,
                "average_niqe_p85": avg_p85,
                "worst_peak_distortion": worst_peak,
                "frames_analyzed": int(sum(frames_values)),
                "accepted_files": sum(1 for entry in per_file if entry["status"] == "validated"),
                "total_files": len(per_file),
            },
            "files": per_file,
        }

        _store_final_result(job_id, payload, item_ids, dataset_path)
        return payload
    except Exception as exc:
        _mark_failed(job_id, str(exc))
        raise
