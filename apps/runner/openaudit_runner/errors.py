"""Error reports to Sentry. On only where SENTRY_DSN is set: the production runner containers."""

import os

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration


def start_sentry() -> None:
    """Uncaught errors and the run errors that `work.step` catches. No log lines, personal data or locals."""
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("SENTRY_ENVIRONMENT") or "production",
        send_default_pii=False,
        include_local_variables=False,
        integrations=[LoggingIntegration(event_level=None)],
    )
