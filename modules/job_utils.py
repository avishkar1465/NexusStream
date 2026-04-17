import json
import math


def dumps_json(payload):
    return json.dumps(payload) if payload is not None else None


def loads_json(payload, default=None):
    if not payload:
        return default
    try:
        return json.loads(payload)
    except (TypeError, json.JSONDecodeError):
        return default


def normalize_item_status(status):
    text = str(status or "").strip().lower()
    if text in {"accepted", "validated", "success"}:
        return "validated"
    if text in {"rejected", "failed", "failure"}:
        return "rejected"
    if text in {"queued", "processing", "started"}:
        return "processing"
    return text or "processing"


def status_label(status):
    mapping = {
        "queued": "Queued",
        "processing": "Processing",
        "validated": "Validated",
        "rejected": "Rejected",
        "failed": "Failed",
    }
    normalized = normalize_item_status(status)
    return mapping.get(normalized, normalized.replace("_", " ").title())


def job_state(status):
    normalized = normalize_item_status(status)
    if normalized == "queued":
        return "PENDING"
    if normalized == "processing":
        return "STARTED"
    if normalized in {"validated", "rejected"}:
        return "SUCCESS"
    if normalized == "failed":
        return "FAILURE"
    return normalized.upper()


def compute_quality_percent(modality, score):
    if score is None:
        return 0.0

    modality = modality or ""
    value = float(score)
    if modality == "text":
        quality = (120.0 - value) / 120.0 * 100.0
    elif modality == "image_batch":
        quality = (100.0 - value) / 100.0 * 100.0
    elif modality == "audio_batch":
        quality = ((value - 1.0) / 4.0) * 100.0
    elif modality == "video_batch":
        quality = (15.0 - value) / 15.0 * 100.0
    else:
        quality = 0.0
    return round(max(0.0, min(100.0, quality)), 2)


def compute_marketplace_price(modality, quality_percent, source_count):
    count = max(1, int(source_count or 1))
    modality_multiplier = {
        "text": 0.95,
        "image_batch": 1.1,
        "audio_batch": 1.08,
        "video_batch": 1.18,
    }.get(modality, 1.0)

    base_price = 15 + (quality_percent * 1.35)
    size_bonus = math.log2(count + 1) * 7.5
    return round(max(15.0, (base_price + size_bonus) * modality_multiplier), 2)


def listing_delivery_type(modality, source_count):
    batch_modalities = {"image_batch", "audio_batch", "video_batch"}
    if modality in batch_modalities or int(source_count or 0) > 1:
        return "folder"
    return "file"
