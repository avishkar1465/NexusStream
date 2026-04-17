import os
from celery import Celery

def make_celery(app_name):
    celery = Celery(
        app_name,
        broker='redis://localhost:6379/0',
        backend='redis://localhost:6379/0',
        include=['tasks', 'job_tasks']
    )
    # Optional configs
    celery.conf.update(
        result_expires=3600,
    )
    return celery

celery = make_celery('nexus_tasks')
