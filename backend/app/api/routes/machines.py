from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.machine import Machine, SensorReading, FaultEvent
from app.schemas.machine import MachineResponse, SensorReadingResponse, FaultEventResponse
from app.simulation.engine import get_engine

router = APIRouter(prefix="/api/machines", tags=["machines"])


@router.get("", response_model=list[MachineResponse])
async def list_machines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).order_by(Machine.machine_code))
    machines = result.scalars().all()

    # Overlay live simulation state onto DB records
    engine = get_engine()
    response = []
    for m in machines:
        state = engine.machines.get(m.machine_code)
        if state:
            m.status = state.status
            m.health_score = round(state.health_score, 1)
        response.append(MachineResponse.model_validate(m))
    return response


@router.get("/{machine_code}", response_model=MachineResponse)
async def get_machine(machine_code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).where(Machine.machine_code == machine_code))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")

    engine = get_engine()
    state = engine.machines.get(machine_code)
    if state:
        m.status = state.status
        m.health_score = round(state.health_score, 1)
    return MachineResponse.model_validate(m)


@router.get("/{machine_code}/readings", response_model=list[SensorReadingResponse])
async def get_readings(machine_code: str, limit: int = 60, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).where(Machine.machine_code == machine_code))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")

    readings_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.machine_id == m.id)
        .order_by(desc(SensorReading.timestamp))
        .limit(limit)
    )
    return [SensorReadingResponse.model_validate(r) for r in readings_result.scalars().all()]


@router.get("/{machine_code}/faults", response_model=list[FaultEventResponse])
async def get_faults(machine_code: str, active_only: bool = False, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).where(Machine.machine_code == machine_code))
    m = result.scalar_one_or_none()
    if not m:
        raise HTTPException(status_code=404, detail="Machine not found")

    query = select(FaultEvent).where(FaultEvent.machine_id == m.id).order_by(desc(FaultEvent.started_at))
    if active_only:
        query = query.where(FaultEvent.active == True)  # noqa: E712
    result = await db.execute(query)
    return [FaultEventResponse.model_validate(f) for f in result.scalars().all()]
