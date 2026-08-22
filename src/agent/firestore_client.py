"""Firestore access for the agent's tools.

On Cloud Run this authenticates automatically via the attached service
account (Application Default Credentials) -- no config needed. For local
dev, set GOOGLE_APPLICATION_CREDENTIALS to a service account key file, or
run `gcloud auth application-default login` once.
"""

from __future__ import annotations

import os

import firebase_admin
from firebase_admin import firestore

_app: firebase_admin.App | None = None


def _ensure_app() -> firebase_admin.App:
    global _app
    if _app is None:
        project_id = os.environ.get("FIREBASE_PROJECT_ID") or os.environ.get("GOOGLE_CLOUD_PROJECT")
        options = {"projectId": project_id} if project_id else None
        _app = firebase_admin.initialize_app(options=options)
    return _app


def db():
    """The Firestore client, initialized lazily on first use."""
    _ensure_app()
    return firestore.client()
