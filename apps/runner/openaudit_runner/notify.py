"""Calls the web app's /api/runner/notify, so it sends emails. Best effort: an error does not stop
the runner. Needs OPENAUDIT_URL and RUNNER_NOTIFY_TOKEN."""

import os
from typing import Any

import httpx


def notify_web(body: dict[str, Any], label: str) -> bool:
    """Posts `body`. `label` starts each log line. True: the web app took it."""
    url, token = os.environ.get("OPENAUDIT_URL"), os.environ.get("RUNNER_NOTIFY_TOKEN")
    if not url or not token:
        print(f"{label}: set OPENAUDIT_URL and RUNNER_NOTIFY_TOKEN to send emails.", flush=True)
        return False
    try:
        response = httpx.post(
            f"{url.rstrip('/')}/api/runner/notify",
            json=body,
            headers={
                "Authorization": f"Bearer {token}",
                # A named agent: Cloudflare blocks some default client agents (error 1010).
                "User-Agent": "openaudit-runner",
            },
            timeout=15,
        )
        if response.status_code >= 400:
            print(f"{label}: notify got HTTP {response.status_code}: {response.text[:200]}", flush=True)
            return False
        return True
    except Exception as e:  # noqa: BLE001 - emails are best effort.
        print(f"{label}: notify failed: {type(e).__name__}: {e}", flush=True)
        return False
