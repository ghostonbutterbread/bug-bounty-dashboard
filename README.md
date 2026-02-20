# Bug Bounty Dashboard

Simple Flask + SQLite dashboard to track:
- Targets
- Findings
- Hunting activity logs

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python dashboard.py
```

This starts Flask and auto-creates `database.db` at runtime.

Open: `http://127.0.0.1:5000`

## CLI

Initialize DB:
```bash
python dashboard.py init-db
```

Add a target:
```bash
python dashboard.py add-target --domain example.com --program HackerOne
```

Add a finding:
```bash
python dashboard.py add-finding --target-id 1 --type XSS --severity High --reporter ryushe --status open
```

## API Endpoints

### Targets
- `GET /api/targets`
- `GET /api/targets/<id>`
- `POST /api/targets`
- `PUT /api/targets/<id>`
- `DELETE /api/targets/<id>`

### Findings
- `GET /api/findings`
- `GET /api/findings/<id>`
- `POST /api/findings`
- `PUT /api/findings/<id>`
- `DELETE /api/findings/<id>`

### Activities
- `GET /api/activities`
- `GET /api/activities/<id>`
- `POST /api/activities`
- `PUT /api/activities/<id>`
- `DELETE /api/activities/<id>`
