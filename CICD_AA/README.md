# RIFT 2026 – Autonomous CI/CD Healing Agent

> **Hackathon Track:** AI/ML DevOps Automation · RIFT 2026  
> **Team:** RIFT ORGANISERS · **Leader:** Saiyam Kumar

An autonomous desktop application that clones a GitHub repository, discovers and executes tests in sandboxed Docker containers, classifies failures, generates LLM-powered fixes, commits them to a dedicated branch, and monitors CI/CD — all without any cloud services at runtime.

---

## Architecture

```
┌────────────────────────────────────────────────┐
│            Electron Shell (electron-app/)       │
│  ┌─────────────────────────────────────────┐   │
│  │      React Frontend (frontend-react/)   │   │
│  │  InputForm  SummaryCard  ScorePanel     │   │
│  │  FixesTable  Timeline  CodeEditor(Monaco)│   │
│  └────────────────┬────────────────────────┘   │
│                   │ HTTP localhost:8000          │
│  ┌────────────────▼────────────────────────┐   │
│  │     Python FastAPI Backend (backend/)   │   │
│  │                                         │   │
│  │  DiscoveryAgent ─→ ExecutionAgent       │   │
│  │        │               │                │   │
│  │   (find tests)  (Docker / subprocess)   │   │
│  │        │               │                │   │
│  │  DiagnosisAgent ─→ FixAgent             │   │
│  │   (classify)    (Ollama / OpenAI)       │   │
│  │        │                                │   │
│  │  VerificationAgent (git push + CI poll) │   │
│  └─────────────────────────────────────────┘   │
└────────────────────────────────────────────────┘
```

## Tech Stack

| Layer        | Technology                              |
|:-------------|:----------------------------------------|
| Desktop       | Electron 30, electron-builder (NSIS)   |
| Frontend      | React 18, Monaco Editor, Recharts, TanStack Table |
| Backend       | Python 3.11, FastAPI, Uvicorn          |
| Agents        | CrewAI, LangChain (concurrent.futures) |
| VCS           | GitPython                              |
| Sandboxing    | Docker (python:3.11-slim) + subprocess fallback |
| LLM           | Ollama (local) → OpenAI (fallback)     |
| Config        | python-dotenv, .env                    |

---

## Prerequisites

| Tool | Version | Notes |
|:-----|:--------|:------|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18 LTS+ | [nodejs.org](https://nodejs.org) |
| Git | any | for GitPython |
| Docker Desktop | latest | optional – fallback uses subprocess |
| Ollama | latest | optional – `ollama pull llama3` |

---

## Installation & Setup

### 1 · Clone this repository

```bash
git clone https://github.com/YOUR_ORG/cicd-healing-agent.git
cd cicd-healing-agent
```

### 2 · Configure environment

```bash
copy backend\.env.example backend\.env
# Edit backend\.env and fill in GITHUB_PAT (and optionally OPENAI_API_KEY)
```

### 3 · Install Python backend dependencies

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 4 · Install React frontend dependencies

```bash
cd frontend-react
npm install
npm run build          # creates frontend-react/build/
cd ..
```

### 5 · Install Electron dependencies

```bash
cd electron-app
npm install
cd ..
```

---

## Running Locally (Development)

Open **two terminals**:

**Terminal 1 – Backend:**
```bash
cd backend
.venv\Scripts\activate
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 – Frontend + Electron:**
```bash
cd frontend-react
npm start                 # CRA dev server on :3000
# In a third terminal:
cd electron-app
npm run dev
```

Or, if you have already run `npm run build`, just:
```bash
cd electron-app
npm start
```

---

## Building the Windows Installer (.exe)

```bash
# 1. Build React
cd frontend-react && npm run build && cd ..

# 2. Package with electron-builder
cd electron-app
npm run dist
```

The installer will be generated in `electron-app/dist/`.

---

## Usage

1. Launch the `.exe` (or `npm start` in `electron-app/`)
2. Enter a **GitHub repository URL**, **Team Name**, and **Leader Name**
3. Click **▶ Run Agent**
4. Watch the Results tab for live phase updates, the CI/CD timeline, and fix table
5. When done, the **Code Editor** tab shows all repo files with fixed files highlighted

---

## Branch Naming Convention

Branches are auto-named using the format:
```
TEAM_NAME_LEADER_NAME_AI_Fix
```
Example: `RIFT_ORGANISERS_SAIYAM_KUMAR_AI_Fix`

All commits are prefixed with `[AI-AGENT]`.

---

## Score Breakdown

| Component | Points |
|:----------|:-------|
| Base score | 100 |
| Speed bonus (< 5 min) | +10 |
| Commit penalty (> 20 commits, -2 each) | variable |

---

## Security Notes

- GitHub PAT and LLM keys are stored only in `backend/.env` (never committed)
- All test code runs in Docker containers with `--network none`
- No pushing to `main` or default branch; only to the dedicated AI-Fix branch

---

## Known Limitations

- Requires Docker Desktop for fully sandboxed execution (falls back to subprocess)
- LLM fix quality depends on model capability and context window size
- Very large repositories (>10K files) may slow the Monaco file tree
- GitHub CI polling requires PAT with `repo` scope

---

## Team Members

| Name | Role |
|:-----|:-----|
| Saiyam Kumar | Team Leader |
| RIFT ORGANISERS | Team |

---

## License

MIT © 2026 RIFT ORGANISERS
