"""
git_utils.py – GitPython helpers for clone, branch, commit, push
"""

import os
import logging
import shutil
from pathlib import Path
from urllib.parse import urlparse, urlunparse

from git import Repo, GitCommandError
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

CLONES_DIR = Path(__file__).parent.parent / "cloned_repos"


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------

def get_clone_path(repo_url: str, run_id: str) -> Path:
    """Return a unique local path for this run's clone."""
    repo_name = urlparse(repo_url).path.rstrip("/").split("/")[-1].replace(".git", "")
    return CLONES_DIR / f"{run_id}_{repo_name}"


def clone_repo(repo_url: str, run_id: str, pat: str | None = None) -> Repo:
    """
    Clone *repo_url* to a local directory.
    If *pat* is provided it is embedded in the URL for auth (HTTPS only).
    Returns a GitPython Repo object.
    """
    clone_path = get_clone_path(repo_url, run_id)

    # Clean up any leftover clone from a previous (crashed) run
    if clone_path.exists():
        shutil.rmtree(clone_path, ignore_errors=True)

    CLONES_DIR.mkdir(parents=True, exist_ok=True)

    # Embed PAT for private repos
    auth_url = _inject_pat(repo_url, pat) if pat else repo_url

    logger.info(f"Cloning {repo_url} → {clone_path}")
    # Set non-interactive environment for clone
    env = {"GIT_TERMINAL_PROMPT": "0", "GIT_ASKPASS": "echo"}
    repo = Repo.clone_from(auth_url, str(clone_path), depth=50, env=env)
    
    # Configure local repo to NEVER use credential manager
    with repo.config_writer() as cw:
        cw.set_value("credential", "helper", "")
    
    logger.info("Clone complete.")
    return repo


def create_branch(repo: Repo, branch_name: str) -> None:
    """Create and checkout a new branch. Raises if it already exists."""
    # Ensure we're on the default branch first
    try:
        origin_head = repo.remotes.origin.refs["HEAD"].reference.name.split("/")[-1]
    except Exception:
        origin_head = "main"

    try:
        repo.git.checkout(origin_head)
    except GitCommandError:
        pass  # already on default branch

    logger.info(f"Creating branch: {branch_name}")
    new_branch = repo.create_head(branch_name)
    new_branch.checkout()


def commit_and_push(
    repo: Repo,
    changed_files: list[str],
    commit_message: str,
    pat: str | None = None,
) -> str:
    """
    Stage *changed_files*, commit with *commit_message*, push to origin.
    Prepends '[AI-AGENT] ' to the message automatically.
    Returns the short commit SHA.
    """
    if not commit_message.startswith("[AI-AGENT]"):
        commit_message = f"[AI-AGENT] {commit_message}"

    repo.index.add(changed_files)
    commit = repo.index.commit(commit_message)
    sha = commit.hexsha[:7]
    logger.info(f"Committed {sha}: {commit_message}")

    # Configure remote URL with PAT if provided
    if pat:
        remote_url = repo.remotes.origin.url
        auth_url = _inject_pat(remote_url, pat)
        repo.remotes.origin.set_url(auth_url)

    # Aggressively suppress interactive prompts
    non_interactive_env = {
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_ASKPASS": "echo",
        "SSH_ASKPASS": "echo",
        "DISPLAY": ":0",
        "GCM_INTERACTIVE": "never",  # Disable Git Credential Manager popups
        "GIT_CONFIG_PARAMETERS": "'credential.helper='", # Override system helper
    }

    with repo.git.custom_environment(**non_interactive_env):
        try:
            # Re-verify remote URL with PAT
            if pat:
                remote_url = repo.remotes.origin.url
                auth_url = _inject_pat(remote_url, pat)
                repo.remotes.origin.set_url(auth_url)
            
            # Ensure local config survives nested calls
            repo.git.config("credential.helper", "")
            
            current_branch = repo.active_branch.name
            logger.info(f"Pushing {current_branch} to origin...")
            repo.remotes.origin.push(refspec=f"{current_branch}:{current_branch}", force=True)
            logger.info(f"Pushed to origin/{current_branch}")
        except GitCommandError as exc:
            logger.error(f"Push failed: {exc}")
            raise
    return sha


def get_all_files(repo: Repo, extensions: tuple = (".py", ".js", ".ts", ".json", ".yaml", ".yml", ".md")) -> list[dict]:
    """
    Walk the repo working tree and return a list of
    { path: str, content: str } dicts for the frontend Monaco viewer.
    Skips .git, node_modules, __pycache__, hidden dirs.
    """
    results = []
    root = Path(repo.working_dir)
    skip_dirs = {".git", "node_modules", "__pycache__", ".venv", "venv", ".tox"}

    for file_path in root.rglob("*"):
        if file_path.is_file():
            # Skip unwanted directories
            if any(part in skip_dirs for part in file_path.parts):
                continue
            if file_path.suffix not in extensions:
                continue
            rel = str(file_path.relative_to(root)).replace("\\", "/")
            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                results.append({"path": rel, "content": content})
            except Exception as exc:
                logger.warning(f"Could not read {rel}: {exc}")
    return results


def cleanup_clone(repo: Repo) -> None:
    """Remove the cloned directory after the run."""
    try:
        shutil.rmtree(repo.working_dir, ignore_errors=True)
        logger.info(f"Cleaned up {repo.working_dir}")
    except Exception as exc:
        logger.warning(f"Cleanup failed: {exc}")


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _inject_pat(url: str, pat: str) -> str:
    """Inject GitHub PAT into an HTTPS URL: https://PAT@github.com/..."""
    parsed = urlparse(url)
    authed = parsed._replace(netloc=f"{pat}@{parsed.hostname}")
    return urlunparse(authed)
