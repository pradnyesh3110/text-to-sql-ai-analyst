# backend/subscriptions.py
import datetime
from sqlalchemy.orm import Session
from backend.database import User, PLAN_QUOTAS_MB


def sync_subscription_status(user: User, db: Session) -> User:
    """Lazily expire a subscription if its expiry date has passed.
    Called on login/me/upload/query so status is always accurate
    without needing a background cron job."""
    if (
        user.plan != "free"
        and user.subscription_expires_at is not None
        and user.subscription_expires_at < datetime.datetime.utcnow()
        and user.subscription_status == "active"
    ):
        user.subscription_status = "expired"
        user.plan = "free"
        user.storage_quota_mb = float(PLAN_QUOTAS_MB["free"])
        db.commit()
        db.refresh(user)
    return user


def grant_subscription(user: User, db: Session, plan: str = "pro", days: int = 30) -> User:
    """Activate (or renew) a paid plan for a user. In production this
    should only be called after a verified payment webhook — right now
    it's a direct grant so you can test/manually activate accounts."""
    if plan not in PLAN_QUOTAS_MB:
        plan = "pro"
    now = datetime.datetime.utcnow()
    user.plan = plan
    user.subscription_status = "active"
    user.subscription_started_at = now
    user.subscription_expires_at = now + datetime.timedelta(days=days)
    user.storage_quota_mb = float(PLAN_QUOTAS_MB[plan])
    db.commit()
    db.refresh(user)
    return user


def subscription_summary(user: User) -> dict:
    return {
        "plan"            : user.plan,
        "status"          : user.subscription_status,
        "started_at"      : user.subscription_started_at.isoformat() if user.subscription_started_at else None,
        "expires_at"      : user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
        "storage_quota_mb": user.storage_quota_mb,
        "storage_used_mb" : round(user.storage_used_mb, 2),
        "storage_pct"     : round((user.storage_used_mb / user.storage_quota_mb * 100), 1) if user.storage_quota_mb else 0,
    }
