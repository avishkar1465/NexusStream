import os
import uuid
import io
import zipfile
from datetime import timezone

from flask import jsonify, request, send_file
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy.exc import OperationalError
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.utils import secure_filename

from celery_app import celery
from flask_app import app, login_manager
from modules.job_utils import (
    compute_marketplace_price,
    compute_quality_percent,
    dumps_json,
    job_state,
    listing_delivery_type,
    loads_json,
    normalize_item_status,
    status_label,
)
from modules.models import DataItem, MarketplaceListing, User, ValidationJob, db
from modules.models import MarketplacePurchase


TEXT_QUEUE = "text"
GPU_QUEUE = "gpu"

TASK_NAMES = {
    "text": "job_tasks.run_text_validation_job",
    "image": "job_tasks.run_image_validation_job",
    "audio": "job_tasks.run_audio_validation_job",
    "video": "job_tasks.run_video_validation_job",
}

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


def _json_error(message, status_code=400):
    return jsonify({"error": message}), status_code


def _isoformat_utc(dt_value):
    if not dt_value:
        return None
    if dt_value.tzinfo is None:
        dt_value = dt_value.replace(tzinfo=timezone.utc)
    else:
        dt_value = dt_value.astimezone(timezone.utc)
    return dt_value.isoformat().replace("+00:00", "Z")


def _safe_filename(file_storage):
    safe_name = secure_filename(file_storage.filename or "")
    if not safe_name:
        raise ValueError("Invalid or empty filename.")
    return safe_name


def _save_single_upload(file_storage):
    original_name = _safe_filename(file_storage)
    stored_filename = f"{uuid.uuid4().hex}_{original_name}"
    saved_path = os.path.join(app.config["UPLOAD_FOLDER"], stored_filename)
    file_storage.save(saved_path)
    return saved_path, stored_filename, original_name


def _cleanup_paths(paths):
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


def _dispatch_task(task_name, args, queue, cleanup_paths=None):
    cleanup_paths = cleanup_paths or []
    try:
        return celery.send_task(task_name, args=args, queue=queue)
    except Exception:
        _cleanup_paths(cleanup_paths)
        raise


def _create_job(display_name, modality, queue_name, source_count):
    job = ValidationJob(
        display_name=display_name,
        modality=modality,
        queue_name=queue_name,
        source_count=source_count,
        user_id=current_user.id,
        status="queued",
    )
    db.session.add(job)
    db.session.commit()
    return job


def _serialize_data_item(item):
    if not item:
        return None
    normalized_status = normalize_item_status(item.status)
    modality_for_quality = item.modality if item.modality in {"text", "image_batch"} else f"{item.modality}_batch"
    return {
        "id": item.id,
        "filename": item.filename,
        "modality": item.modality,
        "validation_score": item.validation_score,
        "validation_metric": item.validation_metric,
        "status": normalized_status,
        "status_label": status_label(normalized_status),
        "created_at": _isoformat_utc(item.created_at),
        "quality_percent": compute_quality_percent(modality_for_quality, item.validation_score),
    }


def _extract_job_score(job):
    result = loads_json(job.result_json, {}) or {}
    modality = job.modality

    if modality == "text":
        return result.get("result", {}).get("perplexity"), "perplexity"
    if modality == "image_batch":
        return result.get("result", {}).get("results", {}).get("dataset_mean"), "brisque_mean"
    if modality == "audio_batch":
        return result.get("summary", {}).get("average_overall_quality"), "dnsmos_overall_mean"
    if modality == "video_batch":
        return result.get("summary", {}).get("average_niqe_p85"), "niqe_p85_mean"
    return None, None


def _serialize_job(job):
    result = loads_json(job.result_json, {})
    item_ids = loads_json(job.item_ids_json, []) or []
    items = []
    if item_ids:
        found_items = {item.id: item for item in DataItem.query.filter(DataItem.id.in_(item_ids)).all()}
        items = [_serialize_data_item(found_items.get(item_id)) for item_id in item_ids if found_items.get(item_id)]

    score_snapshot, metric_snapshot = _extract_job_score(job)
    quality_percent = compute_quality_percent(job.modality, score_snapshot) if score_snapshot is not None else 0.0
    return {
        "id": job.id,
        "task_id": job.celery_task_id,
        "display_name": job.display_name,
        "modality": job.modality,
        "queue_name": job.queue_name,
        "status": normalize_item_status(job.status),
        "status_label": status_label(job.status),
        "error": job.error_message,
        "result": result,
        "item_ids": item_ids,
        "items": items,
        "source_count": job.source_count,
        "dataset_path": job.dataset_path,
        "created_at": _isoformat_utc(job.created_at),
        "completed_at": _isoformat_utc(job.completed_at),
        "score_snapshot": score_snapshot,
        "metric_snapshot": metric_snapshot,
        "quality_percent": quality_percent,
        "suggested_price": compute_marketplace_price(job.modality, quality_percent, job.source_count) if score_snapshot is not None else None,
        "listing": _serialize_listing(job.marketplace_listing) if job.marketplace_listing else None,
    }


def _listing_owner_id(listing):
    return listing.user_id or getattr(listing, "seller_id", None)


def _primary_item_id_for_job(job):
    item_ids = loads_json(job.item_ids_json, []) or []
    if item_ids:
        return item_ids[0]
    return None


def _parse_listing_price(raw_price, fallback_price):
    if raw_price in (None, ""):
        return fallback_price
    try:
        price = round(float(raw_price), 2)
    except (TypeError, ValueError):
        raise ValueError("Price must be a valid number.")
    if price <= 0:
        raise ValueError("Price must be greater than 0.")
    return price


def _serialize_listing(listing):
    if not listing:
        return None
    job = listing.validation_job
    source_count = job.source_count if job else 1
    delivery_type = listing_delivery_type(listing.modality, source_count)
    return {
        "id": listing.id,
        "title": listing.title,
        "description": listing.description,
        "modality": listing.modality,
        "price": listing.price,
        "currency": listing.currency,
        "status": listing.status,
        "score_snapshot": listing.score_snapshot,
        "metric_snapshot": listing.metric_snapshot,
        "quality_percent": listing.quality_percent,
        "seller": listing.seller.username if listing.seller else None,
        "seller_id": _listing_owner_id(listing),
        "validation_job_id": listing.validation_job_id,
        "source_count": source_count,
        "delivery_type": delivery_type,
        "dataset_path": job.dataset_path if job else None,
        "purchases_count": len(listing.purchases) if listing.purchases else 0,
        "created_at": _isoformat_utc(listing.created_at),
    }


def _serialize_dataset_access(listing, relation, purchased_at=None):
    serialized = _serialize_listing(listing)
    if not serialized:
        return None
    dataset_path = serialized.get("dataset_path")
    download_name, download_kind = _resolve_download_metadata(dataset_path, listing.title, serialized.get("source_count", 1))
    serialized["relation"] = relation
    serialized["purchased_at"] = _isoformat_utc(purchased_at)
    serialized["download_url"] = f"/marketplace/download/{listing.id}"
    serialized["download_name"] = download_name
    serialized["download_kind"] = download_kind
    return serialized


def _resolve_accessible_listing_for_user(listing_id, user_id):
    listing = MarketplaceListing.query.filter_by(id=listing_id, status="active").first()
    if not listing:
        return None

    if _listing_owner_id(listing) == user_id:
        return listing

    purchase = MarketplacePurchase.query.filter_by(listing_id=listing.id, user_id=user_id).first()
    if purchase:
        return listing
    return None


def _list_dataset_files(dataset_path):
    if not dataset_path or not os.path.exists(dataset_path):
        return []

    if os.path.isfile(dataset_path):
        return [dataset_path]

    dataset_files = []
    for root, _, files in os.walk(dataset_path):
        for filename in files:
            dataset_files.append(os.path.join(root, filename))
    return sorted(dataset_files)


def _resolve_download_metadata(dataset_path, fallback_name, source_count):
    dataset_files = _list_dataset_files(dataset_path)
    if len(dataset_files) == 1 and source_count == 1:
        return os.path.basename(dataset_files[0]), "file"

    safe_name = secure_filename(fallback_name) or "dataset"
    return f"{safe_name}.zip", "zip"


def _build_dataset_download_response(dataset_path, download_name, source_count):
    if not dataset_path or not os.path.exists(dataset_path):
        raise FileNotFoundError("Dataset files are no longer available.")

    if os.path.isfile(dataset_path):
        return send_file(dataset_path, as_attachment=True, download_name=os.path.basename(dataset_path))

    dataset_files = _list_dataset_files(dataset_path)
    if len(dataset_files) == 1 and source_count == 1:
        single_file = dataset_files[0]
        return send_file(single_file, as_attachment=True, download_name=os.path.basename(single_file))

    archive_stream = io.BytesIO()
    with zipfile.ZipFile(archive_stream, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in dataset_files:
            arcname = os.path.relpath(file_path, dataset_path)
            archive.write(file_path, arcname)

    archive_stream.seek(0)
    safe_name = secure_filename(download_name) or "dataset"
    return send_file(
        archive_stream,
        as_attachment=True,
        download_name=f"{safe_name}.zip",
        mimetype="application/zip",
    )


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized. Please login."}), 401


with app.app_context():
    db.create_all()


def _sync_schema():
    inspector = inspect(db.engine)
    tables = set(inspector.get_table_names())

    desired_columns = {
        "validation_job": {
            "item_ids_json": "ALTER TABLE validation_job ADD COLUMN item_ids_json TEXT",
            "dataset_path": "ALTER TABLE validation_job ADD COLUMN dataset_path VARCHAR(500)",
        },
        "marketplace_listing": {
            "validation_job_id": "ALTER TABLE marketplace_listing ADD COLUMN validation_job_id INTEGER",
            "user_id": "ALTER TABLE marketplace_listing ADD COLUMN user_id INTEGER",
        },
    }

    for table_name, updates in desired_columns.items():
        if table_name not in tables:
            continue
        existing_columns = {col["name"] for col in inspector.get_columns(table_name)}
        for column_name, ddl in updates.items():
            if column_name not in existing_columns:
                db.session.execute(text(ddl))
        db.session.commit()


def _ensure_new_tables():
    try:
        db.create_all()
        _sync_schema()
    except Exception:
        pass


with app.app_context():
    _ensure_new_tables()


@app.route("/")
def home():
    return jsonify({"message": "Welcome to NexusStream API"})


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return _json_error("Missing username or password", 400)

    existing_user = User.query.filter_by(username=username).first()
    if existing_user:
        return _json_error("Username already exists", 400)

    hashed_password = generate_password_hash(password, method="pbkdf2:sha256")
    new_user = User(username=username, password_hash=hashed_password)

    try:
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except Exception as exc:
        db.session.rollback()
        return _json_error(str(exc), 500)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return _json_error("Missing credentials", 400)

    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password_hash, password):
        return _json_error("Invalid credentials", 401)

    login_user(user)
    return jsonify({"message": "Logged in successfully", "username": user.username}), 200


@app.route("/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200


@app.route("/me", methods=["GET"])
@login_required
def me():
    return jsonify({"username": current_user.username, "id": current_user.id})


@app.route("/validate-text", methods=["POST"])
@login_required
def validate_text():
    file = request.files.get("file")
    if not file:
        return _json_error("No file part", 400)
    if not file.filename:
        return _json_error("No selected file", 400)

    try:
        filepath, stored_filename, original_name = _save_single_upload(file)
        job = _create_job(original_name, "text", TEXT_QUEUE, 1)
        task = _dispatch_task(
            task_name=TASK_NAMES["text"],
            args=[job.id, filepath, stored_filename, current_user.id],
            queue=TEXT_QUEUE,
            cleanup_paths=[filepath],
        )
        job.celery_task_id = task.id
        db.session.commit()
        return jsonify({"status": "processing", "task_id": task.id, "queue": TEXT_QUEUE, "job_id": job.id}), 202
    except ValueError as exc:
        return _json_error(str(exc), 400)
    except Exception as exc:
        return _json_error(str(exc), 500)


@app.route("/validate-image", methods=["POST"])
@login_required
def validate_image():
    images = request.files.getlist("images")
    valid_images = [img for img in images if img and img.filename]

    if not valid_images:
        return _json_error("No images provided", 400)

    saved_paths = []
    original_names = []

    try:
        for image in valid_images:
            filepath, _, original_name = _save_single_upload(image)
            saved_paths.append(filepath)
            original_names.append(original_name)

        batch_filename = original_names[0] if len(original_names) == 1 else f"batch_{original_names[0]}_and_{len(original_names) - 1}_more"
        job = _create_job(batch_filename, "image_batch", GPU_QUEUE, len(original_names))
        task = _dispatch_task(
            task_name=TASK_NAMES["image"],
            args=[job.id, saved_paths, batch_filename, current_user.id],
            queue=GPU_QUEUE,
            cleanup_paths=saved_paths,
        )
        job.celery_task_id = task.id
        db.session.commit()
        return jsonify({"status": "processing", "task_id": task.id, "queue": GPU_QUEUE, "job_id": job.id}), 202
    except ValueError as exc:
        _cleanup_paths(saved_paths)
        return _json_error(str(exc), 400)
    except Exception as exc:
        _cleanup_paths(saved_paths)
        return _json_error(str(exc), 500)


@app.route("/validate-audio", methods=["POST"])
@login_required
def validate_audio():
    audio_files = request.files.getlist("audio")
    valid_audio = [audio for audio in audio_files if audio and audio.filename]

    if not valid_audio:
        return _json_error("No audio file provided", 400)

    saved_paths = []
    original_names = []

    try:
        for audio_file in valid_audio:
            filepath, _, original_name = _save_single_upload(audio_file)
            saved_paths.append(filepath)
            original_names.append(original_name)

        display_name = original_names[0] if len(original_names) == 1 else f"audio_batch_{len(original_names)}_files"
        job = _create_job(display_name, "audio_batch", GPU_QUEUE, len(original_names))
        task = _dispatch_task(
            task_name=TASK_NAMES["audio"],
            args=[job.id, saved_paths, original_names, current_user.id],
            queue=GPU_QUEUE,
            cleanup_paths=saved_paths,
        )
        job.celery_task_id = task.id
        db.session.commit()
        return jsonify({"status": "processing", "task_id": task.id, "queue": GPU_QUEUE, "job_id": job.id}), 202
    except ValueError as exc:
        _cleanup_paths(saved_paths)
        return _json_error(str(exc), 400)
    except Exception as exc:
        _cleanup_paths(saved_paths)
        return _json_error(str(exc), 500)


@app.route("/validate-video", methods=["POST"])
@login_required
def validate_video():
    video_files = request.files.getlist("video")
    valid_videos = [video for video in video_files if video and video.filename]

    if not valid_videos:
        return _json_error("No video file provided", 400)

    saved_paths = []
    original_names = []

    try:
        for video_file in valid_videos:
            filepath, _, original_name = _save_single_upload(video_file)
            saved_paths.append(filepath)
            original_names.append(original_name)

        display_name = original_names[0] if len(original_names) == 1 else f"video_batch_{len(original_names)}_files"
        job = _create_job(display_name, "video_batch", GPU_QUEUE, len(original_names))
        task = _dispatch_task(
            task_name=TASK_NAMES["video"],
            args=[job.id, saved_paths, original_names, current_user.id],
            queue=GPU_QUEUE,
            cleanup_paths=saved_paths,
        )
        job.celery_task_id = task.id
        db.session.commit()
        return jsonify({"status": "processing", "task_id": task.id, "queue": GPU_QUEUE, "job_id": job.id}), 202
    except ValueError as exc:
        _cleanup_paths(saved_paths)
        return _json_error(str(exc), 400)
    except Exception as exc:
        _cleanup_paths(saved_paths)
        return _json_error(str(exc), 500)


@app.route("/task-status/<task_id>", methods=["GET"])
@login_required
def get_task_status(task_id):
    job = ValidationJob.query.filter_by(celery_task_id=task_id, user_id=current_user.id).first()
    if job:
        response = {
            "state": job_state(job.status),
            "status": normalize_item_status(job.status),
            "job": _serialize_job(job),
        }
        result = loads_json(job.result_json, {})
        if normalize_item_status(job.status) in {"validated", "rejected"}:
            response["result"] = result
        elif normalize_item_status(job.status) == "failed":
            response["error"] = job.error_message or "Validation failed."
        return jsonify(response), 200

    task_result = celery.AsyncResult(task_id)
    state = task_result.state
    info = task_result.info
    response = {"state": state}

    if state == "PENDING":
        response["status"] = "processing"
    elif state == "STARTED":
        response["status"] = "started"
        if isinstance(info, dict):
            response["meta"] = info
    elif state == "SUCCESS":
        response["result"] = task_result.result
    elif state == "FAILURE":
        response["error"] = str(info)
    else:
        response["status"] = str(info) if info else state.lower()
    return jsonify(response), 200


@app.route("/dashboard", methods=["GET"])
@login_required
def dashboard():
    try:
        jobs = ValidationJob.query.filter_by(user_id=current_user.id).order_by(ValidationJob.created_at.desc()).all()
        listings = MarketplaceListing.query.order_by(MarketplaceListing.created_at.desc()).all()
    except OperationalError:
        _ensure_new_tables()
        jobs = ValidationJob.query.filter_by(user_id=current_user.id).order_by(ValidationJob.created_at.desc()).all()
        listings = MarketplaceListing.query.order_by(MarketplaceListing.created_at.desc()).all()
    return jsonify({
        "summary": {
            "total_jobs": len(jobs),
            "validated_jobs": sum(1 for job in jobs if normalize_item_status(job.status) == "validated"),
            "processing_jobs": sum(1 for job in jobs if normalize_item_status(job.status) in {"queued", "processing"}),
            "listed_jobs": sum(1 for job in jobs if job.marketplace_listing),
        },
        "jobs": [_serialize_job(job) for job in jobs],
        "marketplace": [_serialize_listing(listing) for listing in listings],
    }), 200


@app.route("/marketplace/listings", methods=["GET"])
@login_required
def marketplace_listings():
    try:
        search = (request.args.get("q") or "").strip().lower()
        listings = MarketplaceListing.query.filter_by(status="active").order_by(MarketplaceListing.created_at.desc()).all()
    except OperationalError:
        _ensure_new_tables()
        search = (request.args.get("q") or "").strip().lower()
        listings = MarketplaceListing.query.filter_by(status="active").order_by(MarketplaceListing.created_at.desc()).all()

    if search:
        listings = [
            listing for listing in listings
            if search in (listing.title or "").lower()
            or search in (listing.description or "").lower()
            or search in (listing.modality or "").lower()
            or search in (listing.seller.username.lower() if listing.seller else "")
        ]

    purchased_listing_ids = {
        purchase.listing_id for purchase in MarketplacePurchase.query.filter_by(user_id=current_user.id).all()
    }
    payload = []
    for listing in listings:
        serialized = _serialize_listing(listing)
        serialized["is_owner"] = _listing_owner_id(listing) == current_user.id
        serialized["is_purchased"] = listing.id in purchased_listing_ids
        payload.append(serialized)
    return jsonify({"listings": payload}), 200


@app.route("/marketplace/publish", methods=["POST"])
@login_required
def publish_marketplace():
    _ensure_new_tables()
    data = request.get_json(silent=True) or {}
    job_id = data.get("job_id")
    if not job_id:
        return _json_error("Missing job_id.", 400)

    job = ValidationJob.query.filter_by(id=job_id, user_id=current_user.id).first()
    if not job:
        return _json_error("Validation job not found.", 404)

    if normalize_item_status(job.status) != "validated":
        return _json_error("Only validated datasets can be published.", 400)

    if job.marketplace_listing:
        return _json_error("This dataset is already listed on the marketplace.", 400)

    score_snapshot, metric_snapshot = _extract_job_score(job)
    quality_percent = compute_quality_percent(job.modality, score_snapshot)
    suggested_price = compute_marketplace_price(job.modality, quality_percent, job.source_count)
    try:
        price = _parse_listing_price(data.get("price"), suggested_price)
    except ValueError as exc:
        return _json_error(str(exc), 400)
    primary_item_id = _primary_item_id_for_job(job)
    delivery_type = listing_delivery_type(job.modality, job.source_count)
    default_description = (
        f"Validated {job.modality} dataset published as a {delivery_type} from "
        f"{job.source_count} uploaded file{'s' if job.source_count > 1 else ''}."
    )

    title = (data.get("title") or job.display_name).strip()
    if not title:
        return _json_error("Dataset name is required.", 400)

    description = (data.get("description") or default_description).strip()

    listing = MarketplaceListing(
        title=title,
        description=description,
        modality=job.modality,
        price=price,
        currency="USD",
        status="active",
        score_snapshot=score_snapshot,
        metric_snapshot=metric_snapshot,
        quality_percent=quality_percent,
        seller_id=current_user.id,
        data_item_id=primary_item_id,
        validation_job_id=job.id,
        user_id=current_user.id,
    )
    try:
        db.session.add(listing)
        db.session.commit()
    except Exception as exc:
        db.session.rollback()
        return _json_error(f"Unable to publish dataset: {exc}", 500)

    return jsonify({"message": "Dataset published successfully.", "listing": _serialize_listing(listing)}), 201


@app.route("/marketplace/purchase", methods=["POST"])
@login_required
def purchase_marketplace():
    _ensure_new_tables()
    data = request.get_json(silent=True) or {}
    listing_id = data.get("listing_id")
    if not listing_id:
        return _json_error("Missing listing_id.", 400)

    listing = MarketplaceListing.query.filter_by(id=listing_id, status="active").first()
    if not listing:
        return _json_error("Marketplace listing not found.", 404)

    if _listing_owner_id(listing) == current_user.id:
        return _json_error("You cannot purchase your own listing.", 400)

    existing_purchase = MarketplacePurchase.query.filter_by(listing_id=listing.id, user_id=current_user.id).first()
    if existing_purchase:
        return jsonify({"message": "Dataset already purchased."}), 200

    purchase = MarketplacePurchase(
        listing_id=listing.id,
        user_id=current_user.id,
    )
    db.session.add(purchase)
    db.session.commit()

    return jsonify({
        "message": "Dataset purchased successfully.",
        "listing": {
            **_serialize_listing(listing),
            "is_owner": False,
            "is_purchased": True,
        },
    }), 201


@app.route("/marketplace/my-datasets", methods=["GET"])
@login_required
def my_datasets():
    _ensure_new_tables()

    published_listings = MarketplaceListing.query.filter_by(user_id=current_user.id).order_by(MarketplaceListing.created_at.desc()).all()
    purchases = (
        MarketplacePurchase.query
        .filter_by(user_id=current_user.id)
        .order_by(MarketplacePurchase.purchased_at.desc())
        .all()
    )

    purchased_listings = []
    seen_listing_ids = set()
    for purchase in purchases:
        listing = purchase.listing
        if not listing or listing.id in seen_listing_ids:
            continue
        seen_listing_ids.add(listing.id)
        purchased_listings.append(_serialize_dataset_access(listing, "purchased", purchase.purchased_at))

    return jsonify({
        "published": [_serialize_dataset_access(listing, "published") for listing in published_listings],
        "purchased": purchased_listings,
    }), 200


@app.route("/marketplace/download/<int:listing_id>", methods=["GET"])
@login_required
def download_marketplace_dataset(listing_id):
    _ensure_new_tables()

    listing = _resolve_accessible_listing_for_user(listing_id, current_user.id)
    if not listing:
        return _json_error("Dataset not found or access denied.", 404)

    job = listing.validation_job
    dataset_path = job.dataset_path if job else None

    try:
        return _build_dataset_download_response(dataset_path, listing.title, job.source_count if job else 1)
    except FileNotFoundError as exc:
        return _json_error(str(exc), 404)


if __name__ == "__main__":
    app.run(debug=True)
