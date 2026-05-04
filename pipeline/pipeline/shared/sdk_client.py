"""Async one-shot LLM helpers using the logged-in Codex CLI.

Codex does not expose ChatGPT subscription auth as a normal backend token API.
The supported local pattern is `codex login`, then `codex exec` from Python so
the CLI handles ChatGPT/Codex auth and model access.
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
from typing import Any

GPT_5_5 = "gpt-5.5"

# Backward-compatible names for the existing pipeline stages.
SONNET = GPT_5_5
OPUS = GPT_5_5


async def ask(
    prompt: str,
    *,
    system: str,
    model: str = SONNET,
    max_turns: int = 1,
    timeout_s: float = 900.0,
) -> str:
    """Send a single user prompt with a system prompt; return concatenated text output.

    Wraps `codex exec` in `asyncio.wait_for` so a hung CLI subprocess fails
    loudly instead of stalling the whole pipeline.
    """
    if max_turns != 1:
        raise ValueError("codex exec client only supports max_turns=1")

    codex_bin = shutil.which("codex")
    if not codex_bin:
        raise RuntimeError("codex CLI not found; install @openai/codex and run `codex login`")

    full_prompt = (
        "# System instructions\n\n"
        f"{system.strip()}\n\n"
        "# User prompt\n\n"
        f"{prompt.strip()}\n"
    )

    async def _once() -> str:
        env = os.environ.copy()
        env.setdefault("NO_COLOR", "1")
        proc = await asyncio.create_subprocess_exec(
            codex_bin,
            "exec",
            "--ephemeral",
            "--skip-git-repo-check",
            "--sandbox",
            "read-only",
            "--model",
            model,
            "-",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout_b, stderr_b = await proc.communicate(full_prompt.encode())
        stdout = stdout_b.decode(errors="replace").strip()
        stderr = stderr_b.decode(errors="replace").strip()
        if proc.returncode != 0:
            detail = stderr or stdout or f"codex exited with {proc.returncode}"
            raise RuntimeError(detail)
        return stdout

    # Retry on empty response OR on transient exceptions (CLI subprocess gets
    # killed by SIGTERM=exit 143, network blip, OAuth window exhaustion).
    # Exponential backoff up to 4 tries.
    last_text = ""
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            text = await asyncio.wait_for(_once(), timeout=timeout_s)
        except asyncio.TimeoutError:
            text = ""
            last_err = asyncio.TimeoutError()
        except Exception as e:  # noqa: BLE001   -  incl. CLI-killed exit-143
            text = ""
            last_err = e
        last_text = text
        if text:
            return text
        if attempt < 3:
            await asyncio.sleep(15 * (attempt + 1))   # 15, 30, 45s
    if last_err is not None and not last_text:
        raise last_err
    return last_text   # gives JSONDecodeError downstream  -  caller logs the topic


async def ask_json(
    prompt: str,
    *,
    system: str,
    model: str = SONNET,
    max_turns: int = 1,
    timeout_s: float = 900.0,
) -> Any:
    raw = await ask(prompt, system=system, model=model, max_turns=max_turns, timeout_s=timeout_s)
    return _extract_json(raw)


def _extract_json(text: str) -> Any:
    s = text.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.startswith("json"):
            s = s[4:]
        s = s.strip()
        if s.endswith("```"):
            s = s[:-3].strip()
    if "{" in s or "[" in s:
        start = min((i for i in (s.find("{"), s.find("[")) if i != -1), default=-1)
        if start > 0:
            s = s[start:]
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # Common LLM mistake: literal newlines inside JSON strings. json.loads
        # rejects them. Use strict=False to allow control chars in strings.
        return json.loads(s, strict=False)


def run(coro):
    """Convenience for sync callers."""
    return asyncio.run(coro)
