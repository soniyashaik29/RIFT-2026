"""
llm_client.py – LLM integration via NVIDIA API (Mixtral-8x22B-Instruct)

Uses the OpenAI-compatible NVIDIA inference endpoint as the primary LLM.
Falls back to a local Ollama instance if the NVIDIA API is unavailable.

Usage:
    fix = generate_fix(
        bug_type="LINTING",
        file_path="src/utils.py",
        line_number=15,
        error_message="unused import 'os'",
        original_code="import os\n\ndef foo(): pass",
    )
"""

import os
import logging
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
logger = logging.getLogger(__name__)

# ── NVIDIA API (primary) ──────────────────────────────────────────────────
NVIDIA_API_KEY    = os.getenv("NVIDIA_API_KEY",   "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")
NVIDIA_BASE_URL   = os.getenv("NVIDIA_BASE_URL",  "https://integrate.api.nvidia.com/v1")
NVIDIA_MODEL      = os.getenv("NVIDIA_MODEL",     "mistralai/mixtral-8x22b-instruct-v0.1")

# ── Ollama (local fallback) ───────────────────────────────────────────────
OLLAMA_BASE_URL   = os.getenv("OLLAMA_BASE_URL",  "http://localhost:11434")
OLLAMA_MODEL      = os.getenv("OLLAMA_MODEL",     "llama3")

# ── Prompt template ───────────────────────────────────────────────────────
FIX_PROMPT = """\
You are an expert software engineer. Fix the following {bug_type} bug in the file '{file_path}' at line {line_number}.

Project Structure Context:
{project_context}

Error message:
{error_message}

Original code of '{file_path}':
```
{original_code}
```

Instructions:
- Return ONLY the corrected full file content, no explanations.
- Do NOT wrap the output in markdown code fences.
- Preserve all indentation and file structure.
- Make the minimal change necessary to fix the error.
- If the bug is in a different file (e.g. the test is correct but the source it calls is wrong), fix the file that most likely contains the error based on the context.
""".strip()

COMMIT_PROMPT = """\
Write a concise one-line git commit message (max 72 chars) for fixing a {bug_type} error: '{error_message}'.
Start with a verb (Fix, Remove, Add, Update). No code fences, no quotes.
""".strip()

GENERATE_TESTS_PROMPT = """\
You are an expert software engineer. Generate a STUNNINGLY comprehensive and deep test suite for the following {language} code.
Goal: At least 15-20 distinct test cases (assertions) for this specific file, contributing to a total project goal of 50+ test cases.

Project Structure Context:
{project_context}

Source Code to Test:
```
{source_code}
```

Instructions:
1. **High Volume & Depth**: Generate a large number of tests. Do not stop at just 2 or 3. Aim for 10-15+ scenarios per file.
2. **Categories**:
   - **Sanity/Happy Path**: Standard usage.
   - **Architectural/Design**: Interface adherence, component interactions, and structural integrity.
   - **Flow/Business Logic**: Complex sequences, data transformations, and state changes.
   - **Edge Cases & Length**: Empty inputs, extremely long strings/arrays, boundary values, nulls, and unusual characters.
   - **Error Handling**: Verify robust failure modes and correct error propagation.
3. **Framework Best Practices**: Use framework-idiomatic patterns (e.g., React Testing Library hooks, Vitest/Jest for JS/TS, pytest for Python).
4. **Mocks & Stubs**: Mock external dependencies (APIs, DBs, File System) to Keep tests fast and isolated.
5. **Output**: Return ONLY the code for the test suite. No explanations, no markdown code fences. The output must be valid, runnable {language} code.
""".strip()


# ── Public API ────────────────────────────────────────────────────────────

def generate_fix(
    bug_type: str,
    file_path: str,
    line_number: int,
    error_message: str,
    original_code: str,
    project_context: str = "",
) -> str:
    """
    Generate a fixed version of *original_code*.
    Returns the full corrected file content as a string.
    Tries NVIDIA API first; falls back to local Ollama.
    """
    prompt = FIX_PROMPT.format(
        bug_type=bug_type,
        file_path=file_path,
        line_number=line_number,
        error_message=error_message,
        original_code=original_code,
        project_context=project_context,
    )

    # --- Primary: NVIDIA API ---
    try:
        logger.info(f"[LLM] Requesting NVIDIA fix for {file_path}:{line_number}...")
        result = _call_nvidia(prompt)
        logger.info(f"[LLM] NVIDIA fix generated for {file_path}:{line_number}")
        return _strip_markdown(result)
    except Exception as nvidia_err:
        logger.warning(f"[LLM] NVIDIA API failed: {nvidia_err}. Trying Ollama…")

    # --- Fallback: local Ollama ---
    try:
        import requests as _req
        payload = {"model": OLLAMA_MODEL, "prompt": prompt, "stream": False}
        resp = _req.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload, timeout=30)
        resp.raise_for_status()
        result = resp.json().get("response", "").strip()
        logger.info(f"[LLM] Ollama fix generated for {file_path}:{line_number}")
        return _strip_markdown(result)
    except Exception as ollama_err:
        logger.error(f"[LLM] Ollama also failed: {ollama_err}. Returning original code.")

    return original_code   # Last resort: no change


def explain_error(bug_type: str, error_message: str) -> str:
    """Return a short git commit message describing the fix."""
    prompt = COMMIT_PROMPT.format(bug_type=bug_type, error_message=error_message)
    try:
        return _call_nvidia(prompt).strip().splitlines()[0]
    except Exception:
        pass
    return f"Fix {bug_type} error: {error_message[:60]}"


def generate_tests_for_code(source_code: str, language: str = "Python", project_context: str = "") -> str:
    """Generate a test file for the given source code and language."""
    prompt = GENERATE_TESTS_PROMPT.format(source_code=source_code, language=language, project_context=project_context)
    try:
        result = _call_nvidia(prompt)
        logger.info(f"[LLM] Generated new {language} test suite")
        return _strip_markdown(result)
    except Exception as exc:
        logger.error(f"[LLM] Test generation failed for {language}: {exc}")
        return f"// Generation failed\n// {exc}"


# ── Private helper ────────────────────────────────────────────────────────

def _call_nvidia(prompt: str) -> str:
    """
    Call the NVIDIA inference endpoint (OpenAI-compatible).
    Uses streaming internally and concatenates chunks for the full response.
    """
    client = OpenAI(
        base_url=NVIDIA_BASE_URL,
        api_key=NVIDIA_API_KEY,
    )

    completion = client.chat.completions.create(
        model=NVIDIA_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.5,
        top_p=1,
        max_tokens=2048,
        stream=True,
        timeout=60,
    )

    # Collect streamed chunks into a single string
    parts = []
    for chunk in completion:
        if not getattr(chunk, "choices", None):
            continue
        delta_content = chunk.choices[0].delta.content
        if delta_content is not None:
            parts.append(delta_content)

    return "".join(parts).strip()


def _strip_markdown(text: str) -> str:
    """Extract code from a markdown block if present, otherwise return original."""
    if "```" in text:
        # Simple extraction: find the first block and take everything inside
        # Skip the language identifier if present (e.g. ```python)
        try:
            parts = text.split("```")
            if len(parts) >= 2:
                # The code is between the first and second ```
                content = parts[1]
                # Split at first newline to remove potential language tag
                lines = content.splitlines()
                if lines and (lines[0].strip().lower() in ("python", "javascript", "js", "ts", "typescript", "jsx", "tsx", "html", "css")):
                    return "\n".join(lines[1:]).strip()
                return content.strip()
        except Exception:
            pass
    return text.strip()
