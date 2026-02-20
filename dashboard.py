import json
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory

from models import Activity, Endpoint, Finding, Project, Session, Target, TestStatus, Recommendation, db

VALID_TEST_STATUSES = {"tested", "planned", "recommended", "finding"}


def create_app():
    app = Flask(__name__, static_folder="static", static_url_path="/static")
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(400)
    def bad_request(_):
        return jsonify({"error": "Bad request"}), 400

    @app.route("/")
    def index():
        return send_from_directory("static", "index.html")

    def body():
        return request.get_json(silent=True) or {}

    def utcnow():
        return datetime.now(timezone.utc)

    def get_or_404(model, obj_id):
        obj = db.session.get(model, obj_id)
        if not obj:
            return None
        return obj

    def normalize_test_status(raw_status):
        status = (raw_status or "tested").strip().lower()
        return status if status in VALID_TEST_STATUSES else "tested"

    # Projects
    @app.get("/api/projects")
    def list_projects():
        rows = Project.query.filter(Project.deleted_at.is_(None)).order_by(Project.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.get("/api/projects/tree")
    def projects_tree():
        projects = (
            Project.query.filter(Project.deleted_at.is_(None))
            .order_by(Project.created_at.asc())
            .all()
        )
        tree = []
        for project in projects:
            targets = (
                Target.query.filter_by(project_id=project.id)
                .filter(Target.deleted_at.is_(None))
                .order_by(Target.created_at.asc())
                .all()
            )
            target_nodes = []
            for target in targets:
                endpoints = (
                    Endpoint.query.filter_by(target_id=target.id)
                    .order_by(Endpoint.created_at.asc())
                    .all()
                )
                target_nodes.append(
                    {
                        **target.to_dict(),
                        "endpoints": [e.to_dict() for e in endpoints],
                    }
                )
            tree.append({**project.to_dict(), "targets": target_nodes})
        return jsonify(tree)

    @app.get("/api/projects/<int:project_id>/visual-map")
    def project_visual_map(project_id):
        project = get_or_404(Project, project_id)
        if not project or project.deleted_at:
            return jsonify({"error": "Project not found"}), 404

        targets = (
            Target.query.filter_by(project_id=project_id)
            .filter(Target.deleted_at.is_(None))
            .order_by(Target.created_at.asc())
            .all()
        )
        target_ids = [t.id for t in targets]
        if not target_ids:
            return jsonify(
                {
                    "project": project.to_dict(),
                    "targets": [],
                    "stats": {"targets": 0, "urls": 0, "endpoints": 0, "findings": 0},
                }
            )

        endpoints = (
            Endpoint.query.filter(Endpoint.target_id.in_(target_ids))
            .order_by(Endpoint.created_at.asc())
            .all()
        )
        endpoint_ids = [e.id for e in endpoints]

        statuses_by_endpoint = {}
        findings_by_endpoint = {}
        if endpoint_ids:
            status_rows = (
                TestStatus.query.filter(TestStatus.endpoint_id.in_(endpoint_ids))
                .order_by(TestStatus.updated_at.desc())
                .all()
            )
            for row in status_rows:
                statuses_by_endpoint.setdefault(row.endpoint_id, []).append(row.to_dict())

            finding_rows = (
                Finding.query.filter(Finding.endpoint_id.in_(endpoint_ids))
                .filter(Finding.status != "resolved")
                .order_by(Finding.created_at.desc())
                .all()
            )
            for row in finding_rows:
                findings_by_endpoint.setdefault(row.endpoint_id, []).append(row.to_dict())

        recommendations_by_target = {}
        rec_rows = (
            Recommendation.query.filter(Recommendation.target_id.in_(target_ids))
            .order_by(Recommendation.priority.desc(), Recommendation.created_at.desc())
            .all()
        )
        for row in rec_rows:
            recommendations_by_target.setdefault(row.target_id, []).append(row.to_dict())

        endpoints_by_target = {}
        for endpoint in endpoints:
            endpoint_data = endpoint.to_dict()
            endpoint_statuses = list(statuses_by_endpoint.get(endpoint.id, []))
            endpoint_findings = findings_by_endpoint.get(endpoint.id, [])
            if endpoint_findings and not any(s.get("status") == "finding" for s in endpoint_statuses):
                endpoint_statuses.insert(
                    0,
                    {
                        "id": f"finding-{endpoint.id}",
                        "endpoint_id": endpoint.id,
                        "status": "finding",
                        "test_type": "active finding",
                        "notes": "",
                        "created_at": endpoint.updated_at.isoformat(),
                        "updated_at": endpoint.updated_at.isoformat(),
                    },
                )
            endpoint_data["statuses"] = endpoint_statuses
            endpoint_data["findings"] = endpoint_findings
            endpoints_by_target.setdefault(endpoint.target_id, []).append(endpoint_data)

        total_urls = set()
        serialized_targets = []
        for target in targets:
            target_endpoints = endpoints_by_target.get(target.id, [])
            urls = {}
            for endpoint in target_endpoints:
                url_key = endpoint["url"]
                total_urls.add((target.id, url_key))
                urls.setdefault(url_key, []).append(endpoint)

            serialized_targets.append(
                {
                    **target.to_dict(),
                    "recommendations": recommendations_by_target.get(target.id, []),
                    "urls": [
                        {
                            "url": url_key,
                            "endpoints": rows,
                        }
                        for url_key, rows in urls.items()
                    ],
                    "endpoints": target_endpoints,
                }
            )

        total_findings = sum(len(findings_by_endpoint.get(endpoint_id, [])) for endpoint_id in endpoint_ids)
        return jsonify(
            {
                "project": project.to_dict(),
                "targets": serialized_targets,
                "stats": {
                    "targets": len(targets),
                    "urls": len(total_urls),
                    "endpoints": len(endpoints),
                    "findings": total_findings,
                },
            }
        )

    @app.post("/api/projects")
    def create_project():
        data = body()
        if not data.get("name"):
            return jsonify({"error": "`name` is required"}), 400
        row = Project(name=data["name"].strip(), description=data.get("description"))
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    @app.get("/api/projects/<int:project_id>")
    def get_project(project_id):
        row = get_or_404(Project, project_id)
        if not row or row.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(row.to_dict())

    @app.put("/api/projects/<int:project_id>")
    def update_project(project_id):
        row = get_or_404(Project, project_id)
        if not row or row.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        data = body()
        if "name" in data and not data["name"]:
            return jsonify({"error": "`name` cannot be empty"}), 400
        row.name = data.get("name", row.name)
        row.description = data.get("description", row.description)
        db.session.commit()
        return jsonify(row.to_dict())

    @app.delete("/api/projects/<int:project_id>")
    def delete_project(project_id):
        row = get_or_404(Project, project_id)
        if not row or row.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        row.deleted_at = utcnow()
        db.session.commit()
        return jsonify({"message": "Project soft-deleted", "id": row.id})

    # Targets
    @app.get("/api/projects/<int:project_id>/targets")
    def list_targets(project_id):
        project = get_or_404(Project, project_id)
        if not project or project.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        rows = Target.query.filter_by(project_id=project_id).filter(Target.deleted_at.is_(None)).order_by(Target.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.post("/api/projects/<int:project_id>/targets")
    def create_target(project_id):
        project = get_or_404(Project, project_id)
        if not project or project.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        data = body()
        if not data.get("name") or not data.get("hostname"):
            return jsonify({"error": "`name` and `hostname` are required"}), 400
        row = Target(project_id=project_id, name=data["name"], hostname=data["hostname"], notes=data.get("notes"))
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    @app.get("/api/targets/<int:target_id>")
    def get_target(target_id):
        row = get_or_404(Target, target_id)
        if not row or row.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        return jsonify(row.to_dict())

    @app.put("/api/targets/<int:target_id>")
    def update_target(target_id):
        row = get_or_404(Target, target_id)
        if not row or row.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        data = body()
        row.name = data.get("name", row.name)
        row.hostname = data.get("hostname", row.hostname)
        row.notes = data.get("notes", row.notes)
        db.session.commit()
        return jsonify(row.to_dict())

    @app.delete("/api/targets/<int:target_id>")
    def delete_target(target_id):
        row = get_or_404(Target, target_id)
        if not row or row.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        row.deleted_at = utcnow()
        db.session.commit()
        return jsonify({"message": "Target deleted", "id": row.id})

    # Endpoints
    @app.get("/api/targets/<int:target_id>/endpoints")
    def list_endpoints(target_id):
        target = get_or_404(Target, target_id)
        if not target or target.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        rows = Endpoint.query.filter_by(target_id=target_id).order_by(Endpoint.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.post("/api/targets/<int:target_id>/endpoints")
    def create_endpoint(target_id):
        target = get_or_404(Target, target_id)
        if not target or target.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        data = body()
        if not data.get("url"):
            return jsonify({"error": "`url` is required"}), 400
        row = Endpoint(
            target_id=target_id,
            method=(data.get("method") or "GET").upper(),
            url=data["url"],
            notes=data.get("notes"),
        )
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    # Findings
    @app.get("/api/targets/<int:target_id>/findings")
    def list_findings(target_id):
        target = get_or_404(Target, target_id)
        if not target or target.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        rows = Finding.query.filter_by(target_id=target_id).order_by(Finding.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.post("/api/findings")
    def create_finding():
        data = body()
        if not data.get("target_id") or not data.get("title"):
            return jsonify({"error": "`target_id` and `title` are required"}), 400
        target = get_or_404(Target, int(data["target_id"]))
        if not target or target.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        endpoint_id = data.get("endpoint_id")
        if endpoint_id:
            ep = get_or_404(Endpoint, int(endpoint_id))
            if not ep or ep.target_id != target.id:
                return jsonify({"error": "Invalid endpoint_id for target"}), 400

        row = Finding(
            target_id=target.id,
            endpoint_id=endpoint_id,
            title=data["title"],
            severity=data.get("severity", "medium"),
            status=data.get("status", "open"),
            description=data.get("description"),
        )
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    # Sessions
    @app.get("/api/projects/<int:project_id>/sessions")
    def list_sessions(project_id):
        project = get_or_404(Project, project_id)
        if not project or project.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        rows = Session.query.filter_by(project_id=project_id).order_by(Session.started_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.post("/api/sessions")
    def create_session():
        data = body()
        if not data.get("project_id"):
            return jsonify({"error": "`project_id` is required"}), 400
        project = get_or_404(Project, int(data["project_id"]))
        if not project or project.deleted_at:
            return jsonify({"error": "Project not found"}), 404
        row = Session(project_id=project.id, label=data.get("label"))
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    @app.put("/api/sessions/<int:session_id>")
    def end_session(session_id):
        row = get_or_404(Session, session_id)
        if not row:
            return jsonify({"error": "Session not found"}), 404
        data = body()
        if data.get("ended_at"):
            try:
                row.ended_at = datetime.fromisoformat(data["ended_at"])
            except ValueError:
                return jsonify({"error": "Invalid `ended_at` format"}), 400
        else:
            row.ended_at = utcnow()
        if "label" in data:
            row.label = data["label"]
        db.session.commit()
        return jsonify(row.to_dict())

    # Activities
    @app.get("/api/sessions/<int:session_id>/activities")
    def list_activities(session_id):
        session = get_or_404(Session, session_id)
        if not session:
            return jsonify({"error": "Session not found"}), 404
        rows = Activity.query.filter_by(session_id=session_id).order_by(Activity.created_at.asc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.get("/api/sessions/<int:session_id>/timeline")
    def session_timeline(session_id):
        session = get_or_404(Session, session_id)
        if not session:
            return jsonify({"error": "Session not found"}), 404

        rows = Activity.query.filter_by(session_id=session_id).order_by(Activity.created_at.asc()).all()
        timeline = []
        for idx, row in enumerate(rows, start=1):
            metadata = {}
            if row.metadata_json:
                try:
                    parsed = json.loads(row.metadata_json)
                    if isinstance(parsed, dict):
                        metadata = parsed
                except (TypeError, json.JSONDecodeError):
                    metadata = {}

            action = metadata.get("action") or row.event_type
            result = metadata.get("result") or row.message
            severity = metadata.get("severity")
            tools = metadata.get("tools") or []
            if not isinstance(tools, list):
                tools = [str(tools)]
            result_text = f"{result} {metadata.get('status', '')}".lower()
            is_finding = (
                bool(severity and str(severity).lower() not in ("none", "info", "informational"))
                or "finding" in result_text
                or "vuln" in result_text
            )

            timeline.append(
                {
                    "id": row.id,
                    "order": idx,
                    "timestamp": row.created_at.isoformat(),
                    "event_type": row.event_type,
                    "message": row.message,
                    "target_id": metadata.get("target_id"),
                    "endpoint_id": metadata.get("endpoint_id"),
                    "action": action,
                    "approach": metadata.get("approach"),
                    "tools": tools,
                    "result": result,
                    "severity": severity,
                    "is_finding": is_finding,
                    "metadata": metadata,
                }
            )

        return jsonify({"session": session.to_dict(), "activities": timeline, "total": len(timeline)})

    @app.post("/api/activities")
    def create_activity():
        data = body()
        if not data.get("session_id") or not data.get("message"):
            return jsonify({"error": "`session_id` and `message` are required"}), 400
        session = get_or_404(Session, int(data["session_id"]))
        if not session:
            return jsonify({"error": "Session not found"}), 404
        metadata_payload = data.get("metadata_json")
        if metadata_payload is not None and not isinstance(metadata_payload, str):
            metadata_payload = json.dumps(metadata_payload)

        row = Activity(
            session_id=session.id,
            event_type=data.get("event_type", "note"),
            message=data["message"],
            metadata_json=metadata_payload,
        )
        db.session.add(row)
        db.session.commit()
        return jsonify(row.to_dict()), 201

    @app.get("/api/activities/recent")
    def recent_activities():
        try:
            limit = min(max(int(request.args.get("limit", 20)), 1), 200)
        except ValueError:
            return jsonify({"error": "Invalid `limit`"}), 400
        rows = Activity.query.order_by(Activity.created_at.desc()).limit(limit).all()
        return jsonify([r.to_dict() for r in rows])


    # Test Status endpoints
    @app.get("/api/status")
    def list_status():
        endpoint_id = request.args.get("endpoint_id", type=int)
        target_id = request.args.get("target_id", type=int)
        project_id = request.args.get("project_id", type=int)
        query = TestStatus.query.join(Endpoint, TestStatus.endpoint_id == Endpoint.id).join(Target, Endpoint.target_id == Target.id)
        if endpoint_id:
            query = query.filter(TestStatus.endpoint_id == endpoint_id)
        if target_id:
            query = query.filter(Endpoint.target_id == target_id)
        if project_id:
            query = query.filter(Target.project_id == project_id)
        rows = query.order_by(TestStatus.updated_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.post("/api/status")
    def create_status():
        data = body()
        endpoint_id = data.get("endpoint_id")
        if not endpoint_id:
            return jsonify({"error": "`endpoint_id` is required"}), 400
        endpoint = get_or_404(Endpoint, int(endpoint_id))
        if not endpoint:
            return jsonify({"error": "Endpoint not found"}), 404
        status = TestStatus(
            endpoint_id=endpoint.id,
            status=normalize_test_status(data.get("status")),
            test_type=data.get("test_type"),
            notes=data.get("notes"),
        )
        db.session.add(status)
        db.session.commit()
        return jsonify(status.to_dict()), 201

    @app.get("/api/endpoints/<int:endpoint_id>/status")
    def get_endpoint_status(endpoint_id):
        endpoint = get_or_404(Endpoint, endpoint_id)
        if not endpoint:
            return jsonify({"error": "Endpoint not found"}), 404
        statuses = TestStatus.query.filter_by(endpoint_id=endpoint_id).order_by(TestStatus.updated_at.desc()).all()
        return jsonify([s.to_dict() for s in statuses])

    @app.post("/api/endpoints/<int:endpoint_id>/status")
    def create_endpoint_status(endpoint_id):
        endpoint = get_or_404(Endpoint, endpoint_id)
        if not endpoint:
            return jsonify({"error": "Endpoint not found"}), 404
        data = body()
        status = TestStatus(
            endpoint_id=endpoint_id,
            status=normalize_test_status(data.get("status")),
            test_type=data.get("test_type"),
            notes=data.get("notes"),
        )
        db.session.add(status)
        db.session.commit()
        return jsonify(status.to_dict()), 201

    @app.put("/api/status/<int:status_id>")
    def update_test_status(status_id):
        status = get_or_404(TestStatus, status_id)
        if not status:
            return jsonify({"error": "Status not found"}), 404
        data = body()
        status.status = normalize_test_status(data.get("status", status.status))
        status.test_type = data.get("test_type", status.test_type)
        status.notes = data.get("notes", status.notes)
        db.session.commit()
        return jsonify(status.to_dict())

    @app.delete("/api/status/<int:status_id>")
    def delete_test_status(status_id):
        status = get_or_404(TestStatus, status_id)
        if not status:
            return jsonify({"error": "Status not found"}), 404
        db.session.delete(status)
        db.session.commit()
        return jsonify({"message": "Status deleted", "id": status_id})

    # Recommendations endpoints
    @app.get("/api/recommendations")
    def list_recommendations():
        target_id = request.args.get("target_id", type=int)
        project_id = request.args.get("project_id", type=int)
        query = Recommendation.query.join(Target, Recommendation.target_id == Target.id)
        if target_id:
            query = query.filter(Recommendation.target_id == target_id)
        if project_id:
            query = query.filter(Target.project_id == project_id)
        rows = query.order_by(Recommendation.priority.desc(), Recommendation.created_at.desc()).all()
        return jsonify([r.to_dict() for r in rows])

    @app.post("/api/recommendations")
    def create_recommendation_generic():
        data = body()
        target_id = data.get("target_id")
        if not target_id:
            return jsonify({"error": "`target_id` is required"}), 400
        target = get_or_404(Target, int(target_id))
        if not target:
            return jsonify({"error": "Target not found"}), 404
        text = (data.get("recommendation_text") or "").strip()
        if not text:
            return jsonify({"error": "`recommendation_text` is required"}), 400
        rec = Recommendation(
            target_id=target.id,
            recommendation_text=text,
            priority=int(data.get("priority", 5)),
            is_completed=bool(data.get("is_completed", False)),
        )
        db.session.add(rec)
        db.session.commit()
        return jsonify(rec.to_dict()), 201

    @app.get("/api/targets/<int:target_id>/recommendations")
    def get_recommendations(target_id):
        target = get_or_404(Target, target_id)
        if not target or target.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        recs = Recommendation.query.filter_by(target_id=target_id).order_by(Recommendation.priority.desc(), Recommendation.created_at.desc()).all()
        return jsonify([r.to_dict() for r in recs])

    @app.post("/api/targets/<int:target_id>/recommendations")
    def create_recommendation(target_id):
        target = get_or_404(Target, target_id)
        if not target or target.deleted_at:
            return jsonify({"error": "Target not found"}), 404
        data = body()
        text = (data.get("recommendation_text") or "").strip()
        if not text:
            return jsonify({"error": "`recommendation_text` is required"}), 400
        rec = Recommendation(
            target_id=target_id,
            recommendation_text=text,
            priority=int(data.get("priority", 5)),
            is_completed=bool(data.get("is_completed", False)),
        )
        db.session.add(rec)
        db.session.commit()
        return jsonify(rec.to_dict()), 201

    @app.put("/api/recommendations/<int:recommendation_id>")
    def update_recommendation(recommendation_id):
        rec = get_or_404(Recommendation, recommendation_id)
        if not rec:
            return jsonify({"error": "Recommendation not found"}), 404
        data = body()
        if "recommendation_text" in data:
            text = (data.get("recommendation_text") or "").strip()
            if not text:
                return jsonify({"error": "`recommendation_text` cannot be empty"}), 400
            rec.recommendation_text = text
        if "priority" in data:
            rec.priority = int(data["priority"])
        if "is_completed" in data:
            rec.is_completed = bool(data["is_completed"])
        db.session.commit()
        return jsonify(rec.to_dict())

    @app.delete("/api/recommendations/<int:recommendation_id>")
    def delete_recommendation(recommendation_id):
        rec = get_or_404(Recommendation, recommendation_id)
        if not rec:
            return jsonify({"error": "Recommendation not found"}), 404
        db.session.delete(rec)
        db.session.commit()
        return jsonify({"message": "Recommendation deleted", "id": recommendation_id})

    # Page routes
    @app.route("/tree")
    def tree_page():
        return send_from_directory("static", "tree.html")

    @app.route("/visual")
    def visual_page():
        return send_from_directory("static", "visual.html")

    @app.route("/list")
    def list_page():
        return send_from_directory("static", "list.html")

    @app.route("/replay")
    def replay_page():
        return send_from_directory("static", "replay.html")
    return app


app = create_app()

if __name__ == "__main__":
    with app.app_context():
        db.create_all()
    app.run(debug=True)
