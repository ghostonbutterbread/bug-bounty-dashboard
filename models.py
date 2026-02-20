from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utcnow():
    return datetime.now(timezone.utc)


class Project(db.Model):
    __tablename__ = "projects"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(160), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    targets = db.relationship("Target", back_populates="project", cascade="all, delete-orphan")
    sessions = db.relationship("Session", back_populates="project", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Target(db.Model):
    __tablename__ = "targets"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    name = db.Column(db.String(160), nullable=False)
    hostname = db.Column(db.String(255), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    deleted_at = db.Column(db.DateTime(timezone=True), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    project = db.relationship("Project", back_populates="targets")
    endpoints = db.relationship("Endpoint", back_populates="target", cascade="all, delete-orphan")
    findings = db.relationship("Finding", back_populates="target", cascade="all, delete-orphan")
    recommendations = db.relationship("Recommendation", back_populates="target", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "hostname": self.hostname,
            "notes": self.notes,
            "deleted_at": self.deleted_at.isoformat() if self.deleted_at else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Endpoint(db.Model):
    __tablename__ = "endpoints"

    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey("targets.id"), nullable=False, index=True)
    method = db.Column(db.String(10), nullable=False, default="GET")
    url = db.Column(db.String(2048), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    target = db.relationship("Target", back_populates="endpoints")
    findings = db.relationship("Finding", back_populates="endpoint")
    test_statuses = db.relationship("TestStatus", back_populates="endpoint", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "method": self.method,
            "url": self.url,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Finding(db.Model):
    __tablename__ = "findings"

    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey("targets.id"), nullable=False, index=True)
    endpoint_id = db.Column(db.Integer, db.ForeignKey("endpoints.id"), nullable=True, index=True)
    title = db.Column(db.String(255), nullable=False)
    severity = db.Column(db.String(32), nullable=False, default="medium")
    status = db.Column(db.String(32), nullable=False, default="open")
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    target = db.relationship("Target", back_populates="findings")
    endpoint = db.relationship("Endpoint", back_populates="findings")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "endpoint_id": self.endpoint_id,
            "title": self.title,
            "severity": self.severity,
            "status": self.status,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Session(db.Model):
    __tablename__ = "sessions"

    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey("projects.id"), nullable=False, index=True)
    label = db.Column(db.String(255), nullable=True)
    started_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    ended_at = db.Column(db.DateTime(timezone=True), nullable=True)

    project = db.relationship("Project", back_populates="sessions")
    activities = db.relationship("Activity", back_populates="session", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "label": self.label,
            "started_at": self.started_at.isoformat(),
            "ended_at": self.ended_at.isoformat() if self.ended_at else None,
        }


class Activity(db.Model):
    __tablename__ = "activities"

    id = db.Column(db.Integer, primary_key=True)
    session_id = db.Column(db.Integer, db.ForeignKey("sessions.id"), nullable=False, index=True)
    event_type = db.Column(db.String(64), nullable=False, default="note")
    message = db.Column(db.Text, nullable=False)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    session = db.relationship("Session", back_populates="activities")

    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "event_type": self.event_type,
            "message": self.message,
            "metadata_json": self.metadata_json,
            "created_at": self.created_at.isoformat(),
        }


class TestStatus(db.Model):
    """Tracks testing status for endpoints"""
    __tablename__ = "test_status"

    id = db.Column(db.Integer, primary_key=True)
    endpoint_id = db.Column(db.Integer, db.ForeignKey("endpoints.id"), nullable=False, index=True)
    status = db.Column(db.String(32), nullable=False, default="untested")  # tested, planned, recommended, finding
    test_type = db.Column(db.String(64), nullable=True)  # xss, idor, ssrf, etc
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow)

    endpoint = db.relationship("Endpoint", back_populates="test_statuses")

    def to_dict(self):
        return {
            "id": self.id,
            "endpoint_id": self.endpoint_id,
            "status": self.status,
            "test_type": self.test_type,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class Recommendation(db.Model):
    """AI-generated recommendations for what to test next"""
    __tablename__ = "recommendations"

    id = db.Column(db.Integer, primary_key=True)
    target_id = db.Column(db.Integer, db.ForeignKey("targets.id"), nullable=False, index=True)
    recommendation_text = db.Column(db.Text, nullable=False)
    priority = db.Column(db.Integer, default=5)  # 1-10, 10 highest
    is_completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    target = db.relationship("Target", back_populates="recommendations")

    def to_dict(self):
        return {
            "id": self.id,
            "target_id": self.target_id,
            "recommendation_text": self.recommendation_text,
            "priority": self.priority,
            "is_completed": self.is_completed,
            "created_at": self.created_at.isoformat(),
        }
