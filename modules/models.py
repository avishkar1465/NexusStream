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
    validation_jobs = db.relationship('ValidationJob', backref='owner', lazy=True)
    marketplace_listings = db.relationship('MarketplaceListing', backref='seller', lazy=True)
    purchases = db.relationship('MarketplacePurchase', backref='buyer', lazy=True)

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


class ValidationJob(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    celery_task_id = db.Column(db.String(100), unique=True, nullable=True)
    display_name = db.Column(db.String(255), nullable=False)
    modality = db.Column(db.String(50), nullable=False)
    queue_name = db.Column(db.String(50), nullable=False)
    status = db.Column(db.String(50), default='queued')
    error_message = db.Column(db.Text, nullable=True)
    result_json = db.Column(db.Text, nullable=True)
    item_ids_json = db.Column(db.Text, nullable=True)
    dataset_path = db.Column(db.String(500), nullable=True)
    source_count = db.Column(db.Integer, default=1)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)


class MarketplaceListing(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    modality = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='USD')
    status = db.Column(db.String(50), default='active')
    score_snapshot = db.Column(db.Float, nullable=True)
    metric_snapshot = db.Column(db.String(50), nullable=True)
    quality_percent = db.Column(db.Float, nullable=True)
    # Legacy columns still present in existing SQLite databases.
    seller_id = db.Column(db.Integer, nullable=True)
    data_item_id = db.Column(db.Integer, nullable=True)
    validation_job_id = db.Column(db.Integer, db.ForeignKey('validation_job.id'), nullable=False, unique=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=True)

    validation_job = db.relationship('ValidationJob', backref=db.backref('marketplace_listing', uselist=False))


class MarketplacePurchase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    listing_id = db.Column(db.Integer, db.ForeignKey('marketplace_listing.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    purchased_at = db.Column(db.DateTime, default=datetime.utcnow)

    listing = db.relationship('MarketplaceListing', backref=db.backref('purchases', lazy=True))
