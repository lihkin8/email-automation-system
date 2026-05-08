"""Template variable rendering for campaign emails.

Single source of truth for resolving the placeholder context from a
``Recruiter`` (and the sending ``User``) and rendering Jinja-style
templates. Used by both ``campaign_preview`` and the actual send paths
so previews always match what recipients receive.
"""
from __future__ import annotations

from typing import Any

from jinja2 import Environment, ChainableUndefined

from app.models import Recruiter, User


_env = Environment(undefined=ChainableUndefined, autoescape=False)


def build_recruiter_context(recruiter: Recruiter, user: User | None = None) -> dict[str, Any]:
    """Build the variable map exposed to templates for a single recipient.

    Mirrors what the design spec advertises in the variables sidebar.
    Unknown variables render as empty strings via ``ChainableUndefined``.
    """
    name = recruiter.name or ""
    first_name = name.split(" ")[0] if name else ""
    return {
        "company": recruiter.company or "",
        "company_name": recruiter.company or "",
        "recruiter_name": name,
        "first_name": first_name,
        "email": recruiter.email or "",
        "your_name": (user.name if user is not None else "") or "",
    }


def render_template_string(text: str | None, ctx: dict[str, Any]) -> str:
    """Render a Jinja-style ``text`` using ``ctx``.

    Returns an empty string for ``None`` so callers don't need to guard.
    Missing variables render as empty (lenient) so existing templates that
    reference unsupported placeholders don't blow up the send.
    """
    if not text:
        return ""
    return _env.from_string(text).render(**ctx)
