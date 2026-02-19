"""
main.py – FastAPI backend for the Autonomous CI/CD Healing Agent
Endpoints:
  POST /analyze  – start an agent pipeline run
  GET  /results/{run_id} – poll for live status / final results
"""

import uuid
import threading
import logging
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from agents import run_pipeline

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="CI/CD Healing Agent API", version="1.0.0")

# Allow all origins so the React dev-server / Electron renderer can call us
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory run store  { run_id: { status, result, error, started_at } }
# ---------------------------------------------------------------------------
runs: dict = {}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------
class ConfigUpdate(BaseModel):
    github_pat: Optional[str] = None
    nvidia_api_key: Optional[str] = None

class AnalyzeRequest(BaseModel):
    repo_url: str
    team_name: str
    leader_name: str


class AnalyzeResponse(BaseModel):
    run_id: str
    message: str
    branch_name: str


# ---------------------------------------------------------------------------
# Helper – derive canonical branch name
# ---------------------------------------------------------------------------
def derive_branch_name(team_name: str, leader_name: str) -> str:
    """
    Creates a branch name in the format:
      TEAM_NAME_LEADER_NAME_AI_Fix
    All uppercase, spaces → underscore, strip special chars.
    """
    import re
    team = re.sub(r"[^A-Za-z0-9 ]", "", team_name).strip().upper().replace(" ", "_")
    leader = re.sub(r"[^A-Za-z0-9 ]", "", leader_name).strip().upper().replace(" ", "_")
    return f"{team}_{leader}_AI_Fix"


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------
def _background_run(run_id: str, repo_url: str, team_name: str, leader_name: str, branch_name: str):
    """Runs the full agent pipeline in a background thread and stores results."""
    runs[run_id]["status"] = "running"
    try:
        logger.info(f"[{run_id}] Starting pipeline for {repo_url}")
        result = run_pipeline(
            run_id=run_id,
            repo_url=repo_url,
            team_name=team_name,
            leader_name=leader_name,
            branch_name=branch_name,
            runs=runs,        # pass the shared dict so agents can write live updates
        )
        runs[run_id]["status"] = "completed"
        runs[run_id]["result"] = result
        logger.info(f"[{run_id}] Pipeline completed.")
    except Exception as exc:
        logger.exception(f"[{run_id}] Pipeline failed: {exc}")
        runs[run_id]["status"] = "failed"
        runs[run_id]["error"] = str(exc)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    """
    Start an autonomous healing run.
    Returns a run_id to poll via /results/{run_id}.
    """
    if not req.repo_url.startswith("http"):
        raise HTTPException(status_code=400, detail="repo_url must be a valid HTTP/HTTPS GitHub URL")

    run_id = str(uuid.uuid4())
    branch_name = derive_branch_name(req.team_name, req.leader_name)

    runs[run_id] = {
        "status": "queued",
        "result": None,
        "error": None,
        "started_at": datetime.utcnow().isoformat(),
        "branch_name": branch_name,
        "repo_url": req.repo_url,
        "team_name": req.team_name,
        "leader_name": req.leader_name,
        # Live progress fields written by agents
        "live": {
            "phase": "queued",
            "message": "Queued – waiting for worker thread",
            "iterations": [],
            "files": [],          # list of { path, content } for Monaco
            "terminal_output": "", # raw execution output
        },
    }

    # Kick off background thread (non-blocking)
    t = threading.Thread(
        target=_background_run,
        args=(run_id, req.repo_url, req.team_name, req.leader_name, branch_name),
        daemon=True,
    )
    t.start()

    return AnalyzeResponse(run_id=run_id, message="Pipeline started", branch_name=branch_name)


@app.get("/results/{run_id}")
async def get_results(run_id: str):
    """Poll for live status or final results of a run."""
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = runs[run_id]
    return {
        "run_id": run_id,
        "status": run["status"],          # queued | running | completed | failed
        "branch_name": run.get("branch_name"),
        "repo_url": run.get("repo_url"),
        "team_name": run.get("team_name"),
        "leader_name": run.get("leader_name"),
        "started_at": run.get("started_at"),
        "live": run.get("live", {}),
        "result": run.get("result"),      # final results.json payload (None until done)
        "error": run.get("error"),
    }


@app.get("/config")
async def get_config():
    """Return which critical environment variables are set (masking values)."""
    import os
    return {
        "github_pat_set": bool(os.getenv("GITHUB_PAT") and "your_github" not in os.getenv("GITHUB_PAT", "").lower()),
        "nvidia_api_key_set": bool(os.getenv("NVIDIA_API_KEY")),
        "nvidia_model": os.getenv("NVIDIA_MODEL"),
    }


@app.post("/config")
async def update_config(conf: ConfigUpdate):
    """Update .env file with new values."""
    import os
    from pathlib import Path
    
    env_path = Path(__file__).parent / ".env"
    lines = []
    if env_path.exists():
        lines = env_path.read_text().splitlines()
    
    updates = {}
    if conf.github_pat: updates["GITHUB_PAT"] = conf.github_pat
    if conf.nvidia_api_key: updates["NVIDIA_API_KEY"] = conf.nvidia_api_key
    
    new_lines = []
    seen = set()
    for line in lines:
        if "=" in line:
            key = line.split("=")[0].strip()
            if key in updates:
                new_lines.append(f"{key}={updates[key]}")
                seen.add(key)
                continue
        new_lines.append(line)
    
    for key, val in updates.items():
        if key not in seen:
            new_lines.append(f"{key}={val}")
            
    env_path.write_text("\n".join(new_lines) + "\n")
    
    # Reload in current process
    for key, val in updates.items():
        os.environ[key] = val
        
    return {"message": "Configuration updated successfully"}


@app.get("/health")
async def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


# ---------------------------------------------------------------------------
# Entry point (for direct execution)
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
