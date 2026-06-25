"""
API communication layer for the LocalFlow Desktop Agent.

Purpose & Reasoning:
    This module encapsulates all HTTP requests to the hosted LocalFlow API
    (transcription, refinement, agent query) and the shared audio-processing
    pipeline (``process_audio_bytes``). By isolating network I/O here, the
    agent orchestrator (``__init__.py``) and recovery module (``recovery.py``)
    can both call the same pipeline without duplicating logic.

Dependencies:
    - .config: CONFIG, CLIENT_VERSION, log_* helpers.
    - requests: HTTP client with multipart and JSON support.
    - base64: Encoding fallback for legacy JSON upload path.

Role in Codebase:
    Imported by recovery.py (for ``process_audio_bytes``) and __init__.py
    (for ``run()``). Depends only on config.py.

Key Technologies/APIs:
    - requests.post: HTTP upload with multipart/form-data and JSON bodies.
    - base64.b64encode: Fallback encoding for servers that don't support multipart.
"""

import base64
import requests

from .config import CONFIG, CLIENT_VERSION, log_info, log_error, log_warning


def _get_transcribe_endpoint() -> str:
    """Return the transcribe API URL."""
    return f"{CONFIG.api_url.rstrip('/')}/api/dictation/transcribe"


def _get_refine_endpoint() -> str:
    """Return the refine API URL."""
    return f"{CONFIG.api_url.rstrip('/')}/api/dictation/refine"


# ---------------------------------------------------------------------------
# Transcription helpers
# ---------------------------------------------------------------------------

def _transcribe_multipart(audio_bytes: bytes, translate: bool, api_key: str, processing_mode: str) -> dict:
    """Send raw WAV bytes as multipart/form-data.

    Returns the parsed JSON response dict on success.
    Raises HTTPError on non-2xx responses (caller falls back to JSON).
    """
    response = requests.post(
        _get_transcribe_endpoint(),
        files={"audio": ("audio.wav", audio_bytes, "audio/wav")},
        data={
            "mode": processing_mode,
            "translate": str(translate).lower(),
            "apiKey": api_key,
        },
        timeout=60,
        headers={"X-Client-Version": CLIENT_VERSION},
    )
    response.raise_for_status()
    return response.json()


def _transcribe_json(audio_bytes: bytes, translate: bool, api_key: str, processing_mode: str) -> dict:
    """Send base64-encoded audio as JSON (legacy fallback for old servers).

    Returns the parsed JSON response dict on success.
    """
    audio_base64 = base64.b64encode(audio_bytes).decode("utf-8")
    response = requests.post(
        _get_transcribe_endpoint(),
        json={
            "audio": audio_base64,
            "mode": processing_mode,
            "translate": translate,
            "apiKey": api_key,
        },
        timeout=60,
        headers={
            "Content-Type": "application/json",
            "X-Client-Version": CLIENT_VERSION,
        },
    )
    response.raise_for_status()
    return response.json()


def _transcribe_audio(audio_bytes: bytes, translate: bool, api_key: str, processing_mode: str) -> dict:
    """Send audio to the transcription API and return the result.

    POSTs raw WAV bytes as multipart/form-data to the hosted transcribe
    endpoint with the user's API key for BYOK cloud transcription. Sending
    raw bytes avoids the ~33% base64 inflation that previously caused 413
    ``Payload Too Large`` errors on Vercel's 4.5 MB body limit for
    recordings longer than ~1:45.

    Falls back to JSON (base64-encoded) if the multipart request fails
    with an HTTP error, so the client works with older servers that
    have not been updated to accept multipart uploads.

    Args:
        audio_bytes: Raw WAV audio data (16kHz mono int16 PCM).
        translate: Whether to translate non-English audio to English.
        api_key: User's Groq API key.
        processing_mode: Where processing occurs.

    Returns:
        dict: API response with keys success, text, wordCount, mode, processingTime.
    """
    try:
        return _transcribe_multipart(audio_bytes, translate, api_key, processing_mode)
    except requests.exceptions.Timeout:
        log_error("Transcription request timed out (60s)")
        return {"success": False, "error": "Transcription timed out"}
    except requests.exceptions.ConnectionError as e:
        log_error(f"Failed to connect to transcription API: {e}")
        return {"success": False, "error": f"Connection failed: {e}"}
    except requests.exceptions.HTTPError as e:
        log_warning(f"Multipart upload failed ({e.response.status_code}), falling back to JSON")
        return _transcribe_json(audio_bytes, translate, api_key, processing_mode)
    except Exception as e:
        log_error(f"Transcription request failed: {e}")
        return {"success": False, "error": str(e)}


# ---------------------------------------------------------------------------
# Refinement helpers
# ---------------------------------------------------------------------------

def _refine_text(text: str, mode: str, processing_mode: str, translate: bool = False) -> dict:
    """Send text to the refinement API and return the result.

    Args:
        text: The raw transcribed text to refine.
        mode: The refinement mode (developer, concise, professional, outline, cleanup).
        processing_mode: Where processing occurs.
        translate: Whether the text was translated.

    Returns:
        dict: API response with keys success, refinedText, etc.
    """
    try:
        response = requests.post(
            _get_refine_endpoint(),
            json={
                "text": text,
                "mode": mode,
                "processingMode": processing_mode,
                "translated": translate,
            },
            timeout=45,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        log_error("Refinement request timed out (45s)")
        return {"success": False, "error": "Refinement timed out"}
    except Exception as e:
        log_error(f"Refinement request failed: {e}")
        return {"success": False, "error": str(e)}


def _agent_query(text: str) -> dict:
    """Send text to the voice agent API and return the answer.

    Args:
        text: The transcribed question text.

    Returns:
        dict: API response with keys success, answer, etc.
    """
    try:
        endpoint = f"{CONFIG.api_url.rstrip('/')}/api/agent/query"
        response = requests.post(
            endpoint,
            json={"text": text},
            timeout=45,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.Timeout:
        log_error("Agent query timed out (45s)")
        return {"success": False, "error": "Agent query timed out"}
    except Exception as e:
        log_error(f"Agent query failed: {e}")
        return {"success": False, "error": str(e)}


def _format_text(text: str, format_target: str, processing_mode: str) -> str:
    """Send text to the formatting API and return the formatted result."""
    response = requests.post(
        _get_refine_endpoint(),
        json={
            "text": text,
            "operation": "text_format",
            "formatTarget": format_target,
            "processingMode": processing_mode,
        },
        timeout=45,
    )
    payload = response.json()
    if not response.ok or not payload.get("success"):
        raise RuntimeError(payload.get("details") or payload.get("error") or "Formatting failed")
    formatted_text = payload.get("refinedText", "")
    if not formatted_text:
        raise RuntimeError("Formatter returned empty text")
    return formatted_text


# ---------------------------------------------------------------------------
# Shared audio-processing pipeline
# ---------------------------------------------------------------------------

def process_audio_bytes(
    audio_bytes: bytes,
    mode: str,
    translate: bool,
    api_key: str,
    processing_mode: str,
    run_agent_query: bool = True,
) -> dict:
    """Transcribe WAV bytes and run the mode-appropriate post-processing.

    This is the shared pipeline used by both the live recording flow
    (``_stop_recording``) and the failed-recording retry CLI. It performs
    multipart upload, transcription, and the agent/refine/raw dispatch, but
    deliberately avoids side effects on the overlay, paste handler, or the
    failed-recording lifecycle so callers can compose it freely.

    Args:
        audio_bytes: Raw WAV file bytes.
        mode: Effective mode (``agent``, ``raw``, ``outline``,
            ``developer``, etc.).
        translate: Whether translation was requested.
        api_key: User's Groq API key.
        processing_mode: Where processing occurs.
        run_agent_query: When True (the live default) agent-mode audio also
            runs the voice-agent query. When False (the retry default)
            agent-mode audio is transcribed only, leaving the web-search
            replay as an explicit opt-in.

    Returns:
        dict with keys: ``success`` (bool), ``text`` (final text),
        ``raw_text`` (transcript before refinement), ``error`` (str|None),
        ``stage`` ("transcribe"|"agent"|"refine"|"done"), ``word_count``,
        ``processing_time``, ``agent_failed`` (bool), ``refine_failed`` (bool).
    """
    transcribe_result = _transcribe_audio(audio_bytes, translate, api_key, processing_mode)

    if not transcribe_result.get("success"):
        error = transcribe_result.get("error") or transcribe_result.get("details") or "Transcription failed"
        return {
            "success": False,
            "text": "",
            "raw_text": "",
            "error": error,
            "stage": "transcribe",
            "word_count": 0,
            "processing_time": 0,
            "agent_failed": False,
            "refine_failed": False,
        }

    raw_text = transcribe_result.get("text", "")
    word_count = transcribe_result.get("wordCount", 0)
    processing_time = transcribe_result.get("processingTime", 0)
    log_info(f"Transcribed: {word_count} words, {processing_time}ms")

    final_text = raw_text
    agent_failed = False
    refine_failed = False
    stage = "done"

    if mode == "agent":
        if run_agent_query:
            log_info("Sending to voice agent...")
            agent_result = _agent_query(raw_text)
            if agent_result.get("success"):
                final_text = agent_result.get("answer", "")
                log_info(f"Agent answer: {len(final_text)} chars")
            else:
                error = agent_result.get("error") or "Agent query failed"
                log_error(f"Agent query failed: {error}")
                final_text = raw_text
                agent_failed = True
        else:
            log_info("Agent-mode retry: transcribing only (use --retry-agent-query to replay the web-search answer)")
    elif mode != "raw":
        refine_result = _refine_text(raw_text, mode, processing_mode, translate)
        if refine_result.get("success"):
            final_text = refine_result.get("refinedText", raw_text)
            log_info(f"Refined text: {len(final_text)} chars")
        else:
            error = refine_result.get("error") or refine_result.get("details") or "Refinement failed"
            log_warning(f"Refinement failed, using raw text: {error}")
            final_text = raw_text
            refine_failed = True

    return {
        "success": True,
        "text": final_text,
        "raw_text": raw_text,
        "error": None,
        "stage": stage,
        "word_count": word_count,
        "processing_time": processing_time,
        "agent_failed": agent_failed,
        "refine_failed": refine_failed,
    }
