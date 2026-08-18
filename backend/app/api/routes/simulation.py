from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.session import get_db
from app.models.machine import Machine, FaultEvent
from app.schemas.machine import (
    FaultInjectionRequest,
    ManualControlRequest,
    SimulationStatusResponse,
)
from app.simulation.engine import get_engine
from app.simulation.fault_models import FaultType

router = APIRouter(prefix="/api/simulation", tags=["simulation"])


@router.get("/status", response_model=SimulationStatusResponse)
async def simulation_status():
    engine = get_engine()
    return SimulationStatusResponse(
        status="running" if engine.is_running else "stopped",
        running=engine.is_running,
        machine_count=len(engine.machines),
        tick_interval=engine._tick_interval,
    )


@router.post("/machines/{machine_code}/fault")
async def inject_fault(
    machine_code: str,
    request: FaultInjectionRequest,
    db: AsyncSession = Depends(get_db),
):
    engine = get_engine()
    if machine_code not in engine.machines:
        raise HTTPException(status_code=404, detail="Machine not found")

    try:
        fault_type = FaultType(request.fault_type)
    except ValueError:
        valid = [f.value for f in FaultType]
        raise HTTPException(status_code=400, detail=f"Invalid fault_type. Valid values: {valid}")

    engine.inject_fault(machine_code, fault_type, request.severity)

    # Record fault event in DB
    result = await db.execute(select(Machine).where(Machine.machine_code == machine_code))
    machine = result.scalar_one_or_none()
    if machine:
        # Close any existing active fault for this machine
        await db.execute(
            update(FaultEvent)
            .where(FaultEvent.machine_id == machine.id, FaultEvent.active == True)  # noqa: E712
            .values(active=False, ended_at=datetime.utcnow())
        )
        if fault_type != FaultType.NORMAL:
            fault_event = FaultEvent(
                machine_id=machine.id,
                fault_type=fault_type.value,
                severity=request.severity,
                description=f"Fault injected via API: {fault_type.value} @ severity {request.severity}",
            )
            db.add(fault_event)
        await db.commit()

    return {"status": "ok", "machine": machine_code, "fault_type": fault_type.value, "severity": request.severity}


@router.post("/machines/{machine_code}/reset")
async def reset_machine(machine_code: str, db: AsyncSession = Depends(get_db)):
    engine = get_engine()
    if machine_code not in engine.machines:
        raise HTTPException(status_code=404, detail="Machine not found")

    engine.reset_machine(machine_code)

    # Close active fault events in DB
    result = await db.execute(select(Machine).where(Machine.machine_code == machine_code))
    machine = result.scalar_one_or_none()
    if machine:
        await db.execute(
            update(FaultEvent)
            .where(FaultEvent.machine_id == machine.id, FaultEvent.active == True)  # noqa: E712
            .values(active=False, ended_at=datetime.utcnow())
        )
        await db.commit()

    return {"status": "ok", "machine": machine_code, "message": "Machine reset to normal operation"}


@router.post("/machines/{machine_code}/manual")
async def manual_controls(machine_code: str, request: ManualControlRequest):
    engine = get_engine()
    if machine_code not in engine.machines:
        raise HTTPException(status_code=404, detail="Machine not found")

    engine.apply_manual_controls(
        machine_code,
        request.temperature_fault,
        request.vibration_fault,
        request.current_load,
        request.rpm_variation,
        request.acoustic_noise,
    )
    return {"status": "ok", "machine": machine_code, "controls_applied": True}


@router.get("/machines/{machine_code}/state")
async def machine_live_state(machine_code: str):
    engine = get_engine()
    state = engine.machines.get(machine_code)
    if not state:
        raise HTTPException(status_code=404, detail="Machine not found")

    return {
        "machine_code": state.machine_code,
        "name": state.name,
        "status": state.status,
        "health_score": round(state.health_score, 1),
        "fault_type": state.fault_type.value,
        "fault_severity": state.fault_severity,
        "sensors": {
            "temperature": round(state.temperature, 2),
            "vibration": round(state.vibration, 4),
            "current": round(state.current, 3),
            "rpm": round(state.rpm, 1),
            "acoustic": round(state.acoustic, 1),
        },
        "vibration_signal": state.vibration_signal,
        "active_faults": state.active_fault_names(),
    }
