from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
import numpy as np

from modules.niqe import VideoNIQEValidator
from modules.perplexity import perplexity
from modules.brisque import brisque
from modules.models import db, User, DataItem
from modules.dnsmos import DNSMOS

import os
import uuid
from werkzeug.utils import secure_filename
from celery.result import AsyncResult
from tasks import (
    validate_text_task,
    validate_image_task,
    validate_audio_task,
    validate_video_task
)

app = Flask(__name__)
# Enable CORS; in production restrict strictly. Supports credentials for cookies/session mapping.
CORS(app, supports_credentials=True)

# Ensure uploads directory exists
UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

app.config['SECRET_KEY'] = 'super-secret-nexus-key-for-dev' # Change in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///nexus.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Unauthorized. Please login."}), 401

# Create tables before first request
with app.app_context():
    db.create_all()

@app.route('/')
def home():
    return jsonify({"message": "Welcome to NexusStream API"})

# --- AUTHENTICATION ROUTES ---

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({"error": "Missing username or password"}), 400
    
    existing_user = User.query.filter_by(username=data['username']).first()
    if existing_user:
        return jsonify({"error": "Username already exists"}), 400

    hashed_password = generate_password_hash(data['password'], method='pbkdf2:sha256')
    new_user = User(username=data['username'], password_hash=hashed_password)
    
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"message": "User registered successfully"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    if not data or not data.get('username') or not data.get('password'):
         return jsonify({"error": "Missing credentials"}), 400
         
    user = User.query.filter_by(username=data['username']).first()
    if not user or not check_password_hash(user.password_hash, data['password']):
        return jsonify({"error": "Invalid credentials"}), 401
    
    login_user(user)
    return jsonify({"message": "Logged in successfully", "username": user.username}), 200

@app.route('/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"}), 200

@app.route('/me', methods=['GET'])
@login_required
def me():
    return jsonify({"username": current_user.username, "id": current_user.id})

# --- VALIDATION ROUTES ---

@app.route('/validate-text', methods=['POST'])
@login_required
def validate_text():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    try:
        filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        task = validate_text_task.delay(filepath, filename, current_user.id)
        
        return jsonify({
            'status': 'processing',
            'task_id': task.id
        }), 202
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
@app.route('/validate-image', methods=['POST'])
@login_required
def validate_image():
    images = request.files.getlist('images')

    if not images or images[0].filename == '':
        return jsonify({"error": "No images provided"}), 400

    try:
        filepaths = []
        for image in images:
            filename = f"{uuid.uuid4().hex}_{secure_filename(image.filename)}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image.save(filepath)
            filepaths.append(filepath)

        batch_filename = f"batch_{images[0].filename}_and_{len(images)-1}_more" if len(images) > 1 else images[0].filename
        
        task = validate_image_task.delay(filepaths, batch_filename, current_user.id)

        return jsonify({
            'status': 'processing',
            'task_id': task.id
        }), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/validate-audio', methods=['POST'])
@login_required
def validate_audio():
    audio_file = request.files.get('audio')

    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    try:
        filename = f"{uuid.uuid4().hex}_{secure_filename(audio_file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        audio_file.save(filepath)
        
        task = validate_audio_task.delay(filepath, filename, current_user.id)
        
        return jsonify({
            'status': 'processing',
            'task_id': task.id
        }), 202
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/validate-video', methods=['POST'])
@login_required
def validate_video():
    video_file = request.files.get('video')

    if not video_file:
        return jsonify({"error": "No video file provided"}), 400

    try:
        filename = f"{uuid.uuid4().hex}_{secure_filename(video_file.filename)}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        video_file.save(filepath)
        
        task = validate_video_task.delay(filepath, filename, current_user.id)
        
        return jsonify({
            'status': 'processing',
            'task_id': task.id
        }), 202
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
        
@app.route('/task-status/<task_id>', methods=['GET'])
@login_required
def get_task_status(task_id):
    task_result = AsyncResult(task_id)
    
    if task_result.state == 'PENDING':
        response = {
            'state': task_result.state,
            'status': 'processing'
        }
    elif task_result.state == 'SUCCESS':
        response = {
            'state': task_result.state,
            'result': task_result.result,
        }
    elif task_result.state == 'FAILURE':
        response = {
            'state': task_result.state,
            'error': str(task_result.info)
        }
    else:
        response = {
            'state': task_result.state,
            'status': str(task_result.info)
        }
        
    return jsonify(response)

if __name__ == '__main__':
    app.run(debug=True)