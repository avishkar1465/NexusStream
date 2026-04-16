from flask import request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, login_required, logout_user, current_user
from werkzeug.utils import secure_filename
import uuid
import os

from flask_app import app, login_manager
from celery_app import celery
from modules.models import db, User


TEXT_QUEUE = "text"
GPU_QUEUE = "gpu"
MEDIA_QUEUE = "media"

TASK_NAMES = {
    "text": "tasks.validate_text_task",
    "image": "tasks.validate_image_task",
    "audio": "tasks.validate_audio_task",
    "video": "tasks.validate_video_task",
}

# Ensure uploads directory exists
UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


def _json_error(message, status_code=400):
    return jsonify({"error": message}), status_code


def _safe_filename(file_storage):
    """
    Return a safe, non-empty filename or raise ValueError.
    """
    safe_name = secure_filename(file_storage.filename or "")
    if not safe_name:
        raise ValueError("Invalid or empty filename.")
    return safe_name


def _save_single_upload(file_storage):
    """
    Save one uploaded file to disk and return:
    (saved_path, stored_filename, original_safe_filename)
    """
    original_name = _safe_filename(file_storage)
    stored_filename = f"{uuid.uuid4().hex}_{original_name}"
    saved_path = os.path.join(app.config["UPLOAD_FOLDER"], stored_filename)
    file_storage.save(saved_path)
    return saved_path, stored_filename, original_name


def _cleanup_paths(paths):
    """
    Best-effort cleanup for files saved before a task was dispatched.
    """
    for path in paths:
        try:
            if path and os.path.exists(path):
                os.remove(path)
        except Exception:
            pass


def _dispatch_task(task_name, args, queue, cleanup_paths=None):
    """
    Send a task by name so the Flask app does not need to import task objects
    directly. If dispatch fails, clean up any already-saved files.
    """
    cleanup_paths = cleanup_paths or []
    try:
        return celery.send_task(task_name, args=args, queue=queue)
    except Exception:
        _cleanup_paths(cleanup_paths)
        raise


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized. Please login."}), 401


# Create tables before first request
with app.app_context():
    db.create_all()


@app.route("/")
def home():
    return jsonify({"message": "Welcome to NexusStream API"})


# --- AUTHENTICATION ROUTES ---

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
    except Exception as e:
        db.session.rollback()
        return _json_error(str(e), 500)


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


# --- VALIDATION ROUTES ---

@app.route("/validate-text", methods=["POST"])
@login_required
def validate_text():
    file = request.files.get("file")
    if not file:
        return _json_error("No file part", 400)
    if not file.filename:
        return _json_error("No selected file", 400)

    try:
        filepath, stored_filename, _ = _save_single_upload(file)

        task = _dispatch_task(
            task_name=TASK_NAMES["text"],
            args=[filepath, stored_filename, current_user.id],
            queue=TEXT_QUEUE,
            cleanup_paths=[filepath],
        )

        return jsonify({
            "status": "processing",
            "task_id": task.id,
            "queue": TEXT_QUEUE,
        }), 202

    except ValueError as e:
        return _json_error(str(e), 400)
    except Exception as e:
        return _json_error(str(e), 500)


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

        if len(original_names) == 1:
            batch_filename = original_names[0]
        else:
            batch_filename = f"batch_{original_names[0]}_and_{len(original_names)-1}_more"

        task = _dispatch_task(
            task_name=TASK_NAMES["image"],
            args=[saved_paths, batch_filename, current_user.id],
            queue=GPU_QUEUE,
            cleanup_paths=saved_paths,
        )

        return jsonify({
            "status": "processing",
            "task_id": task.id,
            "queue": GPU_QUEUE,
        }), 202

    except ValueError as e:
        _cleanup_paths(saved_paths)
        return _json_error(str(e), 400)
    except Exception as e:
        _cleanup_paths(saved_paths)
        return _json_error(str(e), 500)


@app.route("/validate-audio", methods=["POST"])
@login_required
def validate_audio():
    audio_file = request.files.get("audio")
    if not audio_file:
        return _json_error("No audio file provided", 400)
    if not audio_file.filename:
        return _json_error("No selected audio file", 400)

    try:
        filepath, stored_filename, _ = _save_single_upload(audio_file)

        # Route audio to GPU-safe queue because DNSMOS / Torch-based pipelines
        # may fail under prefork if they touch CUDA.
        task = _dispatch_task(
            task_name=TASK_NAMES["audio"],
            args=[filepath, stored_filename, current_user.id],
            queue=GPU_QUEUE,
            cleanup_paths=[filepath],
        )

        return jsonify({
            "status": "processing",
            "task_id": task.id,
            "queue": GPU_QUEUE,
        }), 202

    except ValueError as e:
        return _json_error(str(e), 400)
    except Exception as e:
        return _json_error(str(e), 500)


@app.route("/validate-video", methods=["POST"])
@login_required
def validate_video():
    video_file = request.files.get("video")
    if not video_file:
        return _json_error("No video file provided", 400)
    if not video_file.filename:
        return _json_error("No selected video file", 400)

    try:
        filepath, stored_filename, _ = _save_single_upload(video_file)

        # Route video to GPU-safe queue because NIQE / Torch-based pipelines
        # may fail under prefork if they touch CUDA.
        task = _dispatch_task(
            task_name=TASK_NAMES["video"],
            args=[filepath, stored_filename, current_user.id],
            queue=GPU_QUEUE,
            cleanup_paths=[filepath],
        )

        return jsonify({
            "status": "processing",
            "task_id": task.id,
            "queue": GPU_QUEUE,
        }), 202

    except ValueError as e:
        return _json_error(str(e), 400)
    except Exception as e:
        return _json_error(str(e), 500)


@app.route("/task-status/<task_id>", methods=["GET"])
@login_required
def get_task_status(task_id):
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
        if isinstance(info, dict):
            response["meta"] = info

    elif state == "RETRY":
        response["status"] = "retrying"
        response["error"] = str(info)
        if isinstance(info, dict):
            response["meta"] = info

    elif state == "REVOKED":
        response["status"] = "revoked"

    else:
        if isinstance(info, dict):
            response["meta"] = info
            response["status"] = info.get("status", state.lower())
        else:
            response["status"] = str(info) if info else state.lower()

    return jsonify(response), 200


if __name__ == "__main__":
    app.run(debug=True)