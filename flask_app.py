from flask import Flask
from flask_cors import CORS
from flask_login import LoginManager
from modules.models import db, User
import os

app = Flask(__name__)
CORS(app, supports_credentials=True, expose_headers=["Content-Disposition", "Content-Type"])

UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
DATASET_FOLDER = os.path.join(os.getcwd(), "marketplace_datasets")
os.makedirs(DATASET_FOLDER, exist_ok=True)
app.config["DATASET_FOLDER"] = DATASET_FOLDER

app.config["SECRET_KEY"] = "super-secret-nexus-key-for-dev"
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///nexus.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))
