"""Email delivery over SMTP (e.g. Gmail with an App Password).

Uses the stdlib ``smtplib`` in a worker thread (no extra dependency). If SMTP
isn't configured, sends are skipped gracefully and callers fall back to sharing
the link manually — nothing errors.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from html import escape
from typing import Optional

from ..config import settings

logger = logging.getLogger("task_tracker.mailer")


def emails_enabled() -> bool:
    return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)


def _safe_reason(exc: Exception) -> str:
    """Short, UI-safe stringification of an SMTP error (no secrets/stack traces)."""
    msg = f"{type(exc).__name__}: {exc}".replace("\n", " ").replace("\r", " ")
    return (msg[:157] + "...") if len(msg) > 160 else msg


def _send_sync(to: str, subject: str, text: str, html: str) -> None:
    from_addr = settings.smtp_from or settings.smtp_user
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name or "Orbit", from_addr))
    msg["To"] = to
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    host, port = settings.smtp_host, settings.smtp_port
    if port == 465:  # implicit TLS
        with smtplib.SMTP_SSL(host, port, timeout=20) as s:
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
    else:  # STARTTLS (587)
        with smtplib.SMTP(host, port, timeout=20) as s:
            s.ehlo()
            s.starttls()
            s.ehlo()
            s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)


async def send_email(to: str, subject: str, text: str, html: str = "") -> tuple[bool, Optional[str]]:
    """Returns (sent, error_reason). error_reason is None when sent is True."""
    if not emails_enabled():
        logger.info("Email skipped for %s (SMTP not configured).", to)
        return False, "SMTP is not configured on the server"
    try:
        await asyncio.to_thread(_send_sync, to, subject, text, html)
        logger.info("Email sent to %s: %s", to, subject)
        return True, None
    except Exception as exc:
        logger.error("Email send to %s failed: %s", to, exc)
        return False, _safe_reason(exc)


async def send_invite_email(
    to: str, link: str, inviter_name: str, calendar_name: str, role: str
) -> tuple[bool, Optional[str]]:
    subject = f'{inviter_name} invited you to "{calendar_name}" on Orbit'
    text = (
        f'{inviter_name} invited you to collaborate on "{calendar_name}" as '
        f"{role} in Orbit.\n\n"
        f"Accept your invitation:\n{link}\n\n"
        "If you weren't expecting this, you can safely ignore this email."
    )
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
  <h2 style="margin:0 0 4px;font-size:20px">You're invited to Orbit</h2>
  <p style="margin:0 0 16px;color:#475569;font-size:14px">
    <strong>{escape(inviter_name)}</strong> invited you to collaborate on
    <strong>{escape(calendar_name)}</strong> as <strong>{escape(role)}</strong>.
  </p>
  <a href="{escape(link)}"
     style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;
            padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px">
    Accept invitation
  </a>
  <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;word-break:break-all">
    Or paste this link into your browser:<br>{escape(link)}
  </p>
  <p style="margin:16px 0 0;color:#94a3b8;font-size:12px">
    If you weren't expecting this, you can ignore this email.
  </p>
</div>"""
    return await send_email(to, subject, text, html)
