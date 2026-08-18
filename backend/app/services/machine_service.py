"""
Machine seeding and database persistence service.
"""
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.machine import Machine, SensorReading
from app.simulation.engine import SimulationEngine

logger = logging.getLogger(__name__)

MACHINE_SEEDS = [
    {
        "machine_code": "M01",
        "name": "Industrial Motor 01",
        "machine_type": "Industrial Motor",
        "description": "Three-phase induction motor, 2.2 kW rated power",
        "location": "Bay A - Station 1",
    },
    {
        "machine_code": "M02",
        "name": "Centrifugal Pump 02",
        "machine_type": "Centrifugal Pump",
        "description": "Single-stage centrifugal pump, 3.7 kW rated power",
        "location": "Bay B - Station 2",
    },
    {
        "machine_code": "M03",
        "name": "Cooling Fan 03",
        "machine_type": "Cooling Fan",
        "description": "Industrial axial cooling fan, 1.1 kW rated power",
        "location": "Bay C - Station 3",
    },
]


async def seed_machines(engine: SimulationEngine):
    """Ensure three machines exist in the database. Safe to call on every restart."""
    async with AsyncSessionLocal() as db:
        for seed in MACHINE_SEEDS:
            result = await db.execute(
                select(Machine).where(Machine.machine_code == seed["machine_code"])
            )
            existing = result.scalar_one_or_none()
            if not existing:
                m = Machine(**seed)
                db.add(m)
                logger.info(f"Seeded machine: {seed['machine_code']}")
            else:
                logger.info(f"Machine already exists: {seed['machine_code']}")

        await db.commit()

        # Bind DB ids to simulation engine states
        for seed in MACHINE_SEEDS:
            result = await db.execute(
                select(Machine).where(Machine.machine_code == seed["machine_code"])
            )
            m = result.scalar_one_or_none()
            if m and seed["machine_code"] in engine.machines:
                engine.machines[seed["machine_code"]].db_id = m.id


async def db_persist_callback(machines: dict, now: datetime):
    """Persist one sensor reading per machine per tick."""
    async with AsyncSessionLocal() as db:
        for code, state in machines.items():
            if state.db_id is None:
                continue

            vib_signal_for_db = getattr(state, "_raw_vibration_signal", state.vibration_signal)

            reading = SensorReading(
                machine_id=state.db_id,
                timestamp=now,
                temperature=round(state.temperature, 2),
                vibration=round(state.vibration, 4),
                current=round(state.current, 3),
                rpm=round(state.rpm, 1),
                acoustic=round(state.acoustic, 1),
                vibration_signal={
                    "components": vib_signal_for_db.get("components", {}),
                    "frequencies": vib_signal_for_db.get("frequencies", {}),
                    "sample_rate": vib_signal_for_db.get("sample_rate", 5000),
                } if vib_signal_for_db else None,
            )
            db.add(reading)

        try:
            await db.commit()
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to persist readings: {e}")
