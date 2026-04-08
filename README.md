# IKS Healthcare AI Dashboard

> **The Agentic AI Platform That Connects the Entire Care Journey**

A unified dashboard for IKS Health combining Agentic AI Swarms and MLOps monitoring into a single commanding interface for healthcare operations.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.11+
- Docker (for production)

### Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd dash_v3

# Install frontend dependencies
npm install

# Start development server
npm run dev
```

### Production (Docker)

```bash
# Build the image
docker build -t iks-dashboard:v3 .

# Run the container (with LDAP/AD access)
sudo docker run -d -p 8510:8510 \
  --add-host=iksad.local:10.7.2.50 \
  --name iks-container iks-dashboard:v3

# Access at http://localhost:8510
```

> **Note:** The `--add-host` flag is required for LDAP authentication to connect to IKS Active Directory.

---

## 🔐 Authentication

### LDAP (Corporate Login)
On IKS network, use your Windows/AD credentials:
- **Username**: Your AD username (e.g., `shivani`)
- **Password**: Your Windows password
- **MFA Code**: `123456`

### Demo Credentials (Fallback)
If LDAP is unavailable, these demo accounts work:

| Username | Password | Role | Access |
|----------|----------|------|--------|
| `shivani` | `password` | Admin | Full + Write |
| `argha` | `password` | Admin | Full + Write |
| `bhavin` | `password` | MLOps | MLOps Dashboard |
| `dinesh` | `password` | MLOps | MLOps Dashboard |
| `sail` | `password` | MLOps | MLOps Dashboard |
| `akshay` | `password` | Agentic | Agent Tools |
| `prathamesh` | `password` | Agentic | Agent Tools |
| `hrishav` | `password` | Agentic | Agent Tools |
| `amey` | `password` | Agentic | Agent Tools |
| `athul` | `password` | Agentic | Agent Tools |
| `admin` | `admin` | Admin | Full access |
| `developer` | `developer` | Developer | Dev Tools |
| `user` | `user` | User | Read-only |

### MFA Code
All logins require MFA verification. Demo code: **`123456`**

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Recharts |
| Backend | Flask, Python 3.11 |
| Styling | CSS Variables, Glassmorphism |
| Container | Docker, Multi-stage build |
| State | React Query, Context API |

---

## 📁 Project Structure

```
dash_v3/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── Navbar.jsx  # Main navigation + modals
│   │   └── ...
│   ├── context/        # React contexts
│   │   ├── AuthContext.jsx  # User auth & roles
│   │   └── ThemeContext.jsx # Dark/light mode
│   ├── pages/          # Route pages
│   │   ├── Dashboard.jsx
│   │   ├── About.jsx   # Company info
│   │   └── ...
│   ├── mlops/          # MLOps-specific components
│   └── data/           # Static data files
├── mlops-feature-dev_react@*/
│   └── frontend/app.py  # Flask backend
├── public/             # Static assets
├── Dockerfile          # Multi-stage build
└── package.json
```

---

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/models` | GET | ML model list |
| `/api/alerts` | GET | System alerts |
| `/api/metrics` | GET | Performance metrics |

---

## 🎨 Features

### Dashboard Views
- **Agentic AI**: Agent swarms, task execution, payer interactions
- **MLOps**: Model health, drift detection, inference metrics

### Key Pages
- **Dashboard**: Dual-mode console (Agentic/MLOps toggle)
- **AI Agents**: Browse and interact with agents
- **Projects**: Project overview and status
- **Sandbox**: Developer testing environment
- **Release Notes**: Searchable release feed
- **About IKS**: Company information

### Profile Menu
- Profile Settings
- Preferences (theme, notifications)
- Help & Support (FAQ, contacts)

---

## 🔧 Configuration

### User Management
Edit `src/context/AuthContext.jsx` to add/modify users:

```javascript
{
    username: 'newuser',
    password: 'password',
    role: 'mlops',  // admin, mlops, agentic, developer, user
    displayName: 'New User',
    email: 'new.user@ikshealth.com',
    avatar: 'NU'
}
```

### Theme
Toggle between dark/light mode via:
- Navbar sun/moon button
- Preferences modal

---

## 📦 Build Commands

```bash
# Development
npm run dev

# Production build
npm run build

# Preview production
npm run preview

# Docker build
docker build -t iks-dashboard:v3 .
```

---

## 🔑 Release Notes (Google Sheets) Auth

The release-notes feed pulls from a private Google Sheet.

**Local (Vite/Flask):**
1. Place the provided service account key at `secrets/agentic-ai-key.json`.
2. (Optional) Export `RELEASES_SHEETS_CREDENTIALS_JSON=$(pwd)/secrets/agentic-ai-key.json`. If you don't set it, the app will auto-use `secrets/agentic-ai-key.json`.
3. Start the backend (Gunicorn/Flask) then open the app; `/api/releases` should return data with `"source": "sheets"`.

**Docker run / compose:**
```
-v ./secrets/agentic-ai-key.json:/run/secrets/agentic-ai-key.json:ro \
-e RELEASES_SHEETS_CREDENTIALS_JSON=/run/secrets/agentic-ai-key.json
```
Make sure the service account `agentic-ai@iksdev.iam.gserviceaccount.com` has at least Viewer on the Sheet.

If you cannot pass env vars at run-time, you can also bake the key into the image: place it in `secrets/agentic-ai-key.json` before `docker build`. The runtime will look for `/app/secrets/agentic-ai-key.json` automatically.

---

## 📞 Support

- **Website**: [ikshealth.com](https://ikshealth.com)
- **Contact**: [Contact Us](https://ikshealth.com/contact-us/)
- **Careers**: [Careers](https://ikshealth.com/careers/)

---

## 📄 License

© 2026 IKS Health. Proprietary software.
