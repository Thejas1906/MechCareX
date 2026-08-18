from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Optional

from app.db.session import get_db
from app.models.machine import MaintenanceRecord

router = APIRouter(prefix="/api/maintenance", tags=["maintenance"])


class CreateRecord(BaseModel):
    machine_code: str
    machine_name: str
    fault_type: Optional[str] = None
    issue: str
    recommended_action: str
    priority: str = "MEDIUM"
    notes: Optional[str] = None


class UpdateRecord(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None


def _to_dict(r: MaintenanceRecord) -> dict:
    return {
        "id": r.id,
        "machine_code": r.machine_code,
        "machine_name": r.machine_name,
        "fault_type": r.fault_type,
        "issue": r.issue,
        "recommended_action": r.recommended_action,
        "priority": r.priority,
        "status": r.status,
        "created_at": r.created_at.isoformat(),
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        "notes": r.notes,
    }


@router.get("")
async def list_records(machine_code: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(MaintenanceRecord).order_by(desc(MaintenanceRecord.created_at))
    if machine_code:
        q = q.where(MaintenanceRecord.machine_code == machine_code)
    result = await db.execute(q)
    return [_to_dict(r) for r in result.scalars().all()]


@router.post("")
async def create_record(body: CreateRecord, db: AsyncSession = Depends(get_db)):
    if body.priority not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        raise HTTPException(status_code=400, detail="Invalid priority")
    rec = MaintenanceRecord(**body.model_dump())
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return _to_dict(rec)


@router.patch("/{record_id}")
async def update_record(record_id: int, body: UpdateRecord, db: AsyncSession = Depends(get_db)):
    from app.simulation.engine import get_engine

    result = await db.execute(select(MaintenanceRecord).where(MaintenanceRecord.id == record_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")

    if body.status:
        valid_statuses = ("OPEN", "IN_PROGRESS", "COMPLETED")
        if body.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

        prev_status = rec.status
        rec.status = body.status

        engine = get_engine()
        machine_code = rec.machine_code
        state = engine.machines.get(machine_code)

        if body.status == "IN_PROGRESS" and prev_status != "IN_PROGRESS":
            # Shut the machine down — set status OFFLINE and freeze sensors at 0
            if state:
                state.status = "OFFLINE"
                state.fault_severity = 0.0

        elif body.status == "COMPLETED" and not rec.completed_at:
            rec.completed_at = datetime.utcnow()
            # Bring the machine back online at full health
            if state:
                from app.simulation.engine import FaultType
                from app.simulation.engine import FaultModifiers
                state.fault_type = FaultType.NORMAL
                state.fault_severity = 0.0
                state.manual_modifiers = FaultModifiers()
                state.health_score = 100.0
                state.status = "RUNNING"

    if body.notes is not None:
        rec.notes = body.notes

    await db.commit()
    await db.refresh(rec)
    return _to_dict(rec)


@router.delete("/{record_id}")
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MaintenanceRecord).where(MaintenanceRecord.id == record_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Record not found")
    await db.delete(rec)
    await db.commit()
    return {"status": "deleted"}
