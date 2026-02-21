# 🦋 Bug Bounty Dashboard

A beautiful, functional bug bounty reconnaissance and tracking dashboard built with React Flow, Flask, and ❤️

![Dashboard Preview](https://via.placeholder.com/800x400?text=Bug+Bounty+Dashboard)

---

## ✨ Features

### Visual Reconnaissance
- **Interactive Visual Map** - See your targets, URLs, and endpoints as a beautiful node graph
- **Drag & Drop** - Rearrange nodes to organize your workflow
- **Zoom & Pan** - Navigate large reconnaissance data easily

### Ghost Activity Tracking 👻
Your very own AI assistant that works alongside you!

- **Live Activity Display** - Watch Ghost (👻) move to the endpoint you're testing
- **Emotion Switching** - Ghost changes expressions based on activity:
  - 🛠️ `working` - Building/coding
  - 🔍 `scanning` - Recon mode
  - 📚 `researching` - Reading docs
  - 💻 `exploiting` - Active exploitation
  - 🎯 `finding` - Found vulnerability!
  - 🎉 `celebrating` - Success!
  - 💭 `idle` - Thinking
  - 😴 `resting` - Break time

- **Speech Bubble** - Hover over Ghost to see what you're currently working on

### Search & Filter
- **Global Search** - Find any target, URL, or endpoint instantly (Ctrl/Cmd+K)
- **Inline Filters** - Filter by target, method (GET/POST/PUT/DELETE), and status
- **Smart Filtering** - Search matches URL, method, and status text

### Detailed Endpoint View
- **Modal Popup** - Click any endpoint for full details
- **Testing Coverage** - See what's tested, planned, and recommended
- **Findings** - View vulnerabilities discovered
- **History** - Track all status changes
- **Request/Response** - See raw HTTP data

### Multi-View Options
- **⚛️ Visual (React)** - Modern React Flow visual map
- **📊 List View** - Tabular data with search/filter
- **📈 D3 Visual** - D3.js horizontal tree view

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- SQLite

### Installation

```bash
# Clone the repository
git clone https://github.com/ghostonbutterbread/bug-bounty-dashboard.git
cd bug-bounty-dashboard/dashboard

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate  # Windows

# Install Python dependencies
pip install -r requirements.txt

# Build React app
cd react-visual-map
npm install
npm run build
cd ..

# Initialize database
python -c "from models import db, create_app; app = create_app(); app.app_context().db.create_all()"

# Run the dashboard
python dashboard.py
```

Open http://127.0.0.1:5000 in your browser!

---

## 🎮 How to Use

### Adding Projects
1. Click the project dropdown
2. Enter a new project name
3. Start adding targets

### Recon Workflow
1. **Add Target** - Enter a domain (e.g., `api.example.com`)
2. **Add URLs** - Add specific URLs to test
3. **Add Endpoints** - Define endpoints with methods (GET, POST, etc.)
4. **Track Status** - Mark as tested, planned, recommended, or finding

### Using Ghost 👻

Ghost follows your work! Update the activity file:

```bash
# Tell Ghost what you're working on
echo '{"activity": "Testing login endpoint", "target": "/api/login", "status": "scanning"}' > ~/.openclaw/workspace/ghost_activity.json
```

Ghost will:
- Jump to the endpoint you're testing
- Change to the matching emotion
- Show your activity in a speech bubble

---

## 📁 Project Structure

```
dashboard/
├── dashboard.py          # Flask backend with API endpoints
├── models.py             # SQLite database models
├── requirements.txt      # Python dependencies
├── static/               # Legacy static files
│   ├── index.html
│   ├── app.js
│   ├── list.js
│   ├── visual.js
│   └── visual.css
├── react-visual-map/     # Modern React app
│   ├── src/
│   │   ├── App.jsx       # Main React component
│   │   ├── App.css       # Styling
│   │   ├── emotionMap.js # Ghost emotion mapping
│   │   ├── components/
│   │   │   ├── VisualMap.jsx    # React Flow visualization
│   │   │   ├── GhostMascot.jsx  # Ghost avatar component
│   │   │   └── ...
│   │   └── assets/
│   │       └── emotions/ # Ghost emotion images
│   ├── package.json
│   └── vite.config.js
├── templates/
│   └── index.html        # Flask template
└── database.db           # SQLite database (auto-created)
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/projects` | GET | List all projects |
| `/api/projects` | POST | Create new project |
| `/api/projects/<id>/visual-map` | GET | Get visual map data |
| `/api/search` | GET | Global search |
| `/api/endpoints/<id>/status` | PUT | Update endpoint status |
| `/api/ghost-activity` | GET | Get Ghost activity |
| `/api/ghost-activity` | POST | Update Ghost activity |

---

## 🖼️ Ghost Emotions

Ghost has **16 different emotions**!

| Emotion | Image | Use When |
|---------|-------|----------|
| Default | 👻 default | Waiting |
| Working | 🛠️ working | Building/coding |
| Scanning | 🔍 testing_endpoint | Recon/scanning |
| Researching | 📚 reading_docs | Reading docs |
| Exploiting | 💻 writing_exploit | Active exploitation |
| Finding | 🎯 found_vulnerability | Found a bug! |
| Celebrating | 🎉 celebratory | Success! |
| Idle | 💭 deepthinking | Thinking/paused |
| Resting | 😴 taking_break | Break |
| Happy | 😊 happy | Feeling good |
| Angry | 😠 angry | Frustrated |
| Sad | 😢 sad | Disappointed |
| Nervous | 🤏 nervous | Anxious |
| Sleepy | 😴 sleepy | Tired |
| Questioning | ❓ questioning | Unsure |
| Bread | 🍞 bread | Just vibing |

---

## 🛠️ Tech Stack

- **Frontend:** React 18, React Flow, Vite, CSS3
- **Backend:** Flask, SQLAlchemy
- **Database:** SQLite
- **Visualization:** React Flow, D3.js
- **Icons:** Custom ghost emotions (AI-generated)

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- **[@ryushe](https://github.com/ryushe)** - Project creator and mentor
- **Ghost 👻** - The AI assistant that makes this project special
- **[React Flow](https://reactflow.dev/)** - Beautiful node-based visualizations
- **[PortSwigger Web Security Academy](https://portswigger.net/web-security)** - Security learning resources

---

## 📧 Contact

**Ryushe** - [@ryushe](https://github.com/ryushe)

Project Link: [https://github.com/ghostonbutterbread/bug-bounty-dashboard](https://github.com/ghostonbutterbread/bug-bounty-dashboard)

---

Made with ❤️ by **[@ryushe](https://github.com/ryushe)** and **Ghost 👻**

*Happy hunting! 🎯*