from fastapi import APIRouter
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.db.session import get_db
from app.models.machine import Machine, SensorReading, FaultEvent
from app.simulation.engine import get_engine
from app.services.health_service import compute_health
from app.services.anomaly_service import detect_anomalies
from app.services.alert_service import get_alert_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def analytics_overview(db: AsyncSession = Depends(get_db)):
    engine = get_engine()
    alert_svc = get_alert_service()

    machine_summaries = []
    healthy = warning = degraded = critical = 0

    for code, state in engine.machines.items():
        breakdown = compute_health(
            code, state.temperature, state.vibration,
            state.current, state.rpm, state.acoustic
        )
        anomaly_result = detect_anomalies(
            code, state.temperature, state.vibration,
            state.current, state.rpm, state.acoustic,
            state.vibration_signal.get("components") if state.vibration_signal else None,
        )
        health_status = breakdown.health_status()
        if health_status == "HEALTHY":
            healthy += 1
        elif health_status == "WARNING":
            warning += 1
        elif health_status == "DEGRADED":
            degraded += 1
        else:
            critical += 1

        machine_summaries.append({
            "machine_code": code,
            "name": state.name,
            "health_score": round(breakdown.total, 1),
            "health_status": health_status,
            "operational_status": state.status,
            "probable_fault": anomaly_result.probable_fault,
            "anomaly_count": len(anomaly_result.anomalies),
        })

    machine_summaries.sort(key=lambda x: x["health_score"])

    # Fault distribution from fault_events table
    fault_result = await db.execute(
        select(FaultEvent.fault_type, func.count(FaultEvent.id))
        .group_by(FaultEvent.fault_type)
        .order_by(desc(func.count(FaultEvent.id)))
    )
    fault_distribution = [{"fault_type": r[0], "count": r[1]} for r in fault_result.all()]

    # Reading count
    reading_count_result = await db.execute(select(func.count(SensorReading.id)))
    reading_count = reading_count_result.scalar() or 0

    active_alerts = alert_svc.get_active()

    return {
        "factory": {
            "total_machines": len(engine.machines),
            "healthy": healthy,
            "warning": warning,
            "degraded": degraded,
            "critical": critical,
            "active_alerts": len(active_alerts),
        },
        "machines": machine_summaries,
        "fault_distribution": fault_distribution,
        "reading_count": reading_count,
    }
