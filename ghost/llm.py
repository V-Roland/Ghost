"""Azure OpenAI client.

Deliberately stdlib-only (urllib) so the prototype installs nothing. When
we move onto Azure Functions this file is the only one that changes -
swap it for `openai.AzureOpenAI` with a managed identity credential and
every caller keeps working.
"""

import json
import logging
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

from .config import AzureConfig, load_azure_config

log = logging.getLogger("ghost.llm")

MAX_ATTEMPTS = 3
RETRY_STATUS = (429, 500, 502, 503, 504)


class LLMUnavailable(Exception):
    """Raised when Azure OpenAI cannot serve the request."""


def _post(url: str, payload: Dict[str, Any], api_key: str, timeout: float) -> Dict[str, Any]:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "api-key": api_key},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def chat(
    messages: List[Dict[str, str]],
    temperature: float = 0.4,
    max_tokens: int = 1600,
    json_mode: bool = True,
    config: Optional[AzureConfig] = None,
) -> str:
    """Single chat completion. Raises LLMUnavailable rather than returning junk."""
    cfg = config or load_azure_config()
    if not cfg.configured:
        raise LLMUnavailable("Azure OpenAI is not configured")

    payload: Dict[str, Any] = {
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            data = _post(cfg.chat_url, payload, cfg.api_key, cfg.timeout_s)
            return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in RETRY_STATUS or attempt == MAX_ATTEMPTS:
                raise LLMUnavailable("Azure OpenAI returned HTTP {}".format(exc.code))
            time.sleep(2 ** (attempt - 1))
        except (urllib.error.URLError, KeyError, IndexError, ValueError, OSError) as exc:
            last_error = exc
            if attempt == MAX_ATTEMPTS:
                raise LLMUnavailable("Azure OpenAI call failed: {}".format(exc))
            time.sleep(2 ** (attempt - 1))

    raise LLMUnavailable("Azure OpenAI call failed: {}".format(last_error))


def chat_json(
    system: str,
    user: str,
    temperature: float = 0.4,
    max_tokens: int = 1600,
    config: Optional[AzureConfig] = None,
) -> Dict[str, Any]:
    """Chat completion parsed as a JSON object."""
    raw = chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=temperature,
        max_tokens=max_tokens,
        json_mode=True,
        config=config,
    )
    try:
        parsed = json.loads(raw)
    except ValueError:
        # Some deployments wrap JSON in prose despite response_format.
        start, end = raw.find("{"), raw.rfind("}")
        if start == -1 or end <= start:
            raise LLMUnavailable("Azure OpenAI did not return JSON")
        parsed = json.loads(raw[start : end + 1])
    if not isinstance(parsed, dict):
        raise LLMUnavailable("Azure OpenAI returned a non-object JSON payload")
    return parsed


def try_chat_json(system: str, user: str, **kwargs: Any) -> Optional[Dict[str, Any]]:
    """chat_json that returns None instead of raising, for fallback paths."""
    try:
        return chat_json(system, user, **kwargs)
    except LLMUnavailable as exc:
        log.info("falling back to offline engine: %s", exc)
        return None
