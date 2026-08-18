from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.db.session import get_db
from app.models.machine import PersistentAlert
from app.services.alert_service import get_alert_service

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    active_only: bool = False,
    machine_code: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    # Return in-memory active alerts + DB historical
    svc = get_alert_service()
    mem_alerts = [a.to_dict() for a in svc.get_all(limit=limit)]

    # Supplement with DB records not in memory (previous sessions)
    mem_ids = {a["id"] for a in mem_alerts}
    q = select(PersistentAlert).order_by(desc(PersistentAlert.created_at)).limit(limit)
    if active_only:
        q = q.where(PersistentAlert.status == "ACTIVE")
    if machine_code:
        q = q.where(PersistentAlert.machine_code == machine_code)
    db_result = await db.execute(q)
    for rec in db_result.scalars().all():
        if rec.id not in mem_ids:
            mem_alerts.append({
                "id": rec.id,
                "machine_code": rec.machine_code,
                "machine_name": rec.machine_name,
                "probable_fault": rec.probable_fault,
                "severity": rec.severity,
                "anomalies": rec.anomalies or [],
                "message": rec.message,
                "status": rec.status,
                "created_at": rec.created_at.isoformat(),
                "resolved_at": rec.resolved_at.isoformat() if rec.resolved_at else None,
                "acknowledged_at": rec.acknowledged_at.isoformat() if rec.acknowledged_at else None,
            })

    if machine_code:
        mem_alerts = [a for a in mem_alerts if a["machine_code"] == machine_code]
    mem_alerts.sort(key=lambda a: a["created_at"], reverse=True)
    return mem_alerts[:limit]


@router.get("/active")
async def active_alerts():
    return [a.to_dict() for a in get_alert_service().get_active()]


@router.get("/count")
async def alert_count():
    svc = get_alert_service()
    active = svc.get_active()
    return {
        "active": len(active),
        "critical": sum(1 for a in active if a.severity == "CRITICAL"),
        "warning": sum(1 for a in active if a.severity == "WARNING"),
    }


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str):
    svc = get_alert_service()
    alert = svc.acknowledge(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found or already resolved")
    return alert.to_dict()
