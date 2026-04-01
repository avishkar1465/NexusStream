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

app = Flask(__name__)
# Enable CORS; in production restrict strictly. Supports credentials for cookies/session mapping.
CORS(app, supports_credentials=True)

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
        # Pass file object securely mapping perplexity algorithm 
        ppl = perplexity(file)
        score = round(ppl, 2)
        
        # Determine status. Assuming perplexity < 100 is valid.
        status = 'validated' if score < 100 else 'rejected'
        
        # Save record of the item
        new_item = DataItem(
            filename=file.filename,
            modality='text',
            validation_score=score,
            validation_metric='perplexity',
            status=status,
            owner=current_user
        )
        db.session.add(new_item)
        db.session.commit()
        
        return jsonify({
            'status': status,
            'perplexity': score,
            'item_id': new_item.id
        }), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    
@app.route('/validate-image', methods=['POST'])
@login_required
def validate_image():
    images = request.files.getlist('images')

    if not images or images[0].filename == '':
        return jsonify({"error": "No images provided"}), 400

    try:
        results = brisque(images)
        scores = [res['brisque_score'] for res in results]
        
        dataset_mean = round(np.mean(scores), 4)
        
        # Example validation check. Lower brisque is better. < 50 is a common threshold for acceptable.
        status = 'validated' if dataset_mean < 50 else 'rejected'

        # Optional: Save a batch record, or individual items.
        # For simplicity, we record a single database entry representing the batch of validated images.
        batch_filename = f"batch_{images[0].filename}_and_{len(images)-1}_more" if len(images) > 1 else images[0].filename
        
        new_item = DataItem(
            filename=batch_filename,
            modality='image_batch',
            validation_score=dataset_mean,
            validation_metric='brisque_mean',
            status=status,
            owner=current_user
        )
        db.session.add(new_item)
        db.session.commit()

        aggregation = {
            "dataset_mean": dataset_mean,
            "dataset_median": round(np.median(scores), 4),
            "dataset_std": round(np.std(scores), 4),
            "best_score": round(np.min(scores), 4),
            "worst_score": round(np.max(scores), 4),
            "total_images": len(scores),
            "status": status,
            "item_id": new_item.id
        }

        return jsonify({
            'status': status,
            'results': aggregation
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/validate-audio', methods=['POST'])
@login_required
def validate_audio():
    audio_file = request.files.get('audio')

    if not audio_file:
        return jsonify({"error": "No audio file provided"}), 400

    try:
        # Initialize DNSMOS
        dnsmos_validator = DNSMOS()
        
        # Read the file once
        file_data = audio_file.read()
        
        # Validate audio
        result = dnsmos_validator.validate(file_data)
        
        # Save record of the item using corrected key names
        new_item = DataItem(
            filename=audio_file.filename,
            modality='audio',
            validation_score=result['scores']['overall_quality'],
            validation_metric='dnsmos_overall',
            status='Accepted' if result['status'] else 'Rejected',
            owner=current_user
        )
        db.session.add(new_item)
        db.session.commit()
        
        return jsonify({
            'status': result['status'],
            'scores': result['scores'],
            'result': result['result'],
            'item_id': new_item.id
        }), 200
        
    except Exception as e:
        db.session.rollback() # Ensure DB state is safe on error
        return jsonify({"error": str(e)}), 500

@app.route('/validate-video', methods=['POST'])
@login_required
def validate_video():
    video_file = request.files.get('video')

    if not video_file:
        return jsonify({"error": "No video file provided"}), 400

    try:
        niqe_validator = VideoNIQEValidator()
        
        file_data = video_file.read()
        result = niqe_validator.validate(file_data)
        
        if "error" in result:
            return jsonify(result), 400
            
        new_item = DataItem(
            filename=video_file.filename,
            modality='video',
            validation_score=result['scores']['niqe_p85'], # Storing the P85 score
            validation_metric='niqe_p85',
            status='Accepted' if result['status'] else 'Rejected',
            owner=current_user
        )
        db.session.add(new_item)
        db.session.commit()
        
        return jsonify({
            'status': result['status'],
            'scores': result['scores'],
            'result': result['result'],
            'item_id': new_item.id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)