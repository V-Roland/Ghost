"""Runtime configuration.

Ghost is built to run on Azure OpenAI, but the prototype must demo with no
credentials at all. Every module therefore asks `azure_configured()` and
falls back to the deterministic offline engine when the answer is no.
"""

import os
from dataclasses import dataclass
from typing import Optional

DEFAULT_API_VERSION = "2024-10-21"


@dataclass
class AzureConfig:
    endpoint: str = ""
    api_key: str = ""
    deployment: str = ""
    api_version: str = DEFAULT_API_VERSION
    timeout_s: float = 45.0

    @property
    def configured(self) -> bool:
        return bool(self.endpoint and self.api_key and self.deployment)

    @property
    def chat_url(self) -> str:
        base = self.endpoint.rstrip("/")
        return "{}/openai/deployments/{}/chat/completions?api-version={}".format(
            base, self.deployment, self.api_version
        )


def load_azure_config() -> AzureConfig:
    return AzureConfig(
        endpoint=os.environ.get("AZURE_OPENAI_ENDPOINT", "").strip(),
        api_key=os.environ.get("AZURE_OPENAI_API_KEY", "").strip(),
        deployment=os.environ.get("AZURE_OPENAI_DEPLOYMENT", "").strip(),
        api_version=os.environ.get("AZURE_OPENAI_API_VERSION", DEFAULT_API_VERSION).strip()
        or DEFAULT_API_VERSION,
    )


def azure_configured() -> bool:
    return load_azure_config().configured


def engine_name(override: Optional[str] = None) -> str:
    """Which generation path is active - surfaced in the UI so a demo is honest."""
    if override:
        return override
    return "azure-openai" if azure_configured() else "offline"
