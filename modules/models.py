from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime

db = SQLAlchemy()

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    # Relationship to uploaded data items
    data_items = db.relationship('DataItem', backref='owner', lazy=True)

class DataItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    modality = db.Column(db.String(50), nullable=False)  # e.g., 'text' or 'image'
    s3_key = db.Column(db.String(255), nullable=True)     # For future AWS S3 use
    validation_score = db.Column(db.Float, nullable=True)
    validation_metric = db.Column(db.String(50), nullable=True) # e.g., 'perplexity', 'brisque'
    status = db.Column(db.String(50), default='pending')  # 'pending', 'validated', 'rejected'
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
