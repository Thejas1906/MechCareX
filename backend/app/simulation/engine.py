"""
Core simulation engine for MechCareX.
Manages virtual machine states, runs the simulation loop, and coordinates persistence.
"""
import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from app.simulation.fault_models import FaultType, FaultModifiers, compute_fault_modifiers
from app.simulation.sensor_models import (
    generate_temperature,
    generate_current,
    generate_rpm,
    generate_acoustic,
    generate_vibration_signal,
)

logger = logging.getLogger(__name__)


@dataclass
class MachineBaseline:
    """Static nominal operating parameters for a machine."""
    machine_code: str
    name: str
    machine_type: str
    description: str
    location: str

    base_temperature: float
    base_current: float
    base_rpm: float
    base_vibration: float
    base_acoustic: float


@dataclass
class MachineState:
    """Live runtime state of a simulated machine."""
    baseline: MachineBaseline
    db_id: Optional[int] = None

    # Current fault
    fault_type: FaultType = FaultType.NORMAL
    fault_severity: float = 0.0
    manual_modifiers: FaultModifiers = field(default_factory=FaultModifiers)

    # Current sensor readings
    temperature: float = 0.0
    vibration: float = 0.0
    current: float = 0.0
    rpm: float = 0.0
    acoustic: float = 0.0
    vibration_signal: dict = field(default_factory=dict)

    # Health degrades with severe faults, recovers on NORMAL
    health_score: float = 100.0
    status: str = "RUNNING"
    tick_count: int = 0

    @property
    def machine_code(self) -> str:
        return self.baseline.machine_code

    @property
    def name(self) -> str:
        return self.baseline.name

    def active_fault_names(self) -> list[str]:
        faults = []
        if self.fault_type != FaultType.NORMAL and self.fault_severity > 0:
            faults.append(self.fault_type.value)
        return faults


# Singleton engine instance
_engine_instance: Optional["SimulationEngine"] = None


def get_engine() -> "SimulationEngine":
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = SimulationEngine()
    return _engine_instance


class SimulationEngine:
    MACHINE_DEFS: list[MachineBaseline] = [
        MachineBaseline(
            machine_code="M01",
            name="Industrial Motor 01",
            machine_type="Industrial Motor",
            description="Three-phase induction motor, 2.2 kW rated power",
            location="Bay A - Station 1",
            base_temperature=45.0,
            base_current=1.75,
            base_rpm=1450.0,
            base_vibration=0.20,
            base_acoustic=46.0,
        ),
        MachineBaseline(
            machine_code="M02",
            name="Centrifugal Pump 02",
            machine_type="Centrifugal Pump",
            description="Single-stage centrifugal pump, 3.7 kW rated power",
            location="Bay B - Station 2",
            base_temperature=50.0,
            base_current=2.5,
            base_rpm=1750.0,
            base_vibration=0.28,
            base_acoustic=50.0,
        ),
        MachineBaseline(
            machine_code="M03",
            name="Cooling Fan 03",
            machine_type="Cooling Fan",
            description="Industrial axial cooling fan, 1.1 kW rated power",
            location="Bay C - Station 3",
            base_temperature=40.0,
            base_current=1.05,
            base_rpm=1200.0,
            base_vibration=0.15,
            base_acoustic=45.0,
        ),
    ]

    def __init__(self):
        self.machines: dict[str, MachineState] = {}
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._tick_interval = 1.0
        self._ws_broadcast_callback = None
        self._db_persist_callback = None

        for baseline in self.MACHINE_DEFS:
            state = MachineState(baseline=baseline)
            state.temperature = baseline.base_temperature
            state.vibration = baseline.base_vibration
            state.current = baseline.base_current
            state.rpm = baseline.base_rpm
            state.acoustic = baseline.base_acoustic
            self.machines[baseline.machine_code] = state

    def set_ws_callback(self, callback):
        self._ws_broadcast_callback = callback

    def set_db_callback(self, callback):
        self._db_persist_callback = callback

    async def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())
        logger.info("Simulation engine started.")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation engine stopped.")

    @property
    def is_running(self) -> bool:
        return self._running

    def inject_fault(self, machine_code: str, fault_type: FaultType, severity: float):
        state = self.machines.get(machine_code)
        if not state:
            raise ValueError(f"Machine {machine_code} not found.")
        state.fault_type = fault_type
        state.fault_severity = max(0.0, min(1.0, severity))
        logger.info(f"Fault injected: {machine_code} → {fault_type} @ {severity}")

    def reset_machine(self, machine_code: str):
        state = self.machines.get(machine_code)
        if not state:
            raise ValueError(f"Machine {machine_code} not found.")
        state.fault_type = FaultType.NORMAL
        state.fault_severity = 0.0
        state.manual_modifiers = FaultModifiers()
        logger.info(f"Machine reset: {machine_code}")

    def apply_manual_controls(self, machine_code: str, temperature_fault: float,
                               vibration_fault: float, current_load: float,
                               rpm_variation: float, acoustic_noise: float):
        state = self.machines.get(machine_code)
        if not state:
            raise ValueError(f"Machine {machine_code} not found.")
        state.manual_modifiers = FaultModifiers(
            temperature_delta=temperature_fault * 15.0,
            vibration_multiplier=1.0 + vibration_fault * 2.0,
            current_multiplier=1.0 + current_load * 0.8,
            rpm_multiplier=1.0 - rpm_variation * 0.15,
            acoustic_delta=acoustic_noise * 12.0,
        )

    async def _loop(self):
        while self._running:
            try:
                await self._tick()
                await asyncio.sleep(self._tick_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Simulation tick error: {e}", exc_info=True)
                await asyncio.sleep(self._tick_interval)

    async def _tick(self):
        now = datetime.utcnow()

        for code, state in self.machines.items():
            state.tick_count += 1
            tick = state.tick_count
            b = state.baseline

            # Compute fault modifiers
            fault_mod = compute_fault_modifiers(state.fault_type, state.fault_severity)

            # Merge manual modifiers (additive on deltas, multiplicative on multipliers)
            mm = state.manual_modifiers
            merged = FaultModifiers(
                temperature_delta=fault_mod.temperature_delta + mm.temperature_delta,
                vibration_multiplier=fault_mod.vibration_multiplier * mm.vibration_multiplier,
                current_multiplier=fault_mod.current_multiplier * mm.current_multiplier,
                rpm_multiplier=fault_mod.rpm_multiplier * mm.rpm_multiplier,
                acoustic_delta=fault_mod.acoustic_delta + mm.acoustic_delta,
                vib_1x_weight=fault_mod.vib_1x_weight,
                vib_2x_weight=fault_mod.vib_2x_weight,
                vib_3x_weight=fault_mod.vib_3x_weight,
                temperature_noise_scale=fault_mod.temperature_noise_scale,
                vibration_noise_scale=fault_mod.vibration_noise_scale,
                rpm_fluctuation_scale=fault_mod.rpm_fluctuation_scale,
            )

            # Generate sensor values
            state.rpm = generate_rpm(code, b.base_rpm, merged, tick)
            state.temperature = generate_temperature(code, b.base_temperature, merged, tick)
            state.current = generate_current(code, b.base_current, merged)
            state.acoustic = generate_acoustic(code, b.base_acoustic, merged)

            vib_signal = generate_vibration_signal(code, state.rpm, b.base_vibration, merged, tick)
            state.vibration = vib_signal["rms"]
            state.vibration_signal = {
                "components": vib_signal["components"],
                "frequencies": vib_signal["frequencies"],
                "sample_rate": vib_signal["sample_rate"],
                # raw_samples stored separately to keep WS messages small
            }
            # Store raw samples for DB persistence (enables Phase 2 FFT)
            state._raw_vibration_signal = vib_signal

            # Update health score
            self._update_health(state)

        # Persist and broadcast
        if self._db_persist_callback:
            try:
                await self._db_persist_callback(self.machines, now)
            except Exception as e:
                logger.error(f"DB persist error: {e}")

        if self._ws_broadcast_callback:
            try:
                await self._ws_broadcast_callback(self.machines, now)
            except Exception as e:
                logger.error(f"WS broadcast error: {e}")

    def _update_health(self, state: MachineState):
        if state.fault_type == FaultType.NORMAL and state.fault_severity == 0.0:
            # Recovery: health increases toward 100
            state.health_score = min(100.0, state.health_score + 0.5)
        else:
            # Degradation based on severity and fault type
            degradation_rate = {
                FaultType.BEARING_FAILURE: 0.8,
                FaultType.OVERLOAD: 0.6,
                FaultType.OVERHEATING: 0.5,
                FaultType.MISALIGNMENT: 0.4,
                FaultType.IMBALANCE: 0.3,
                FaultType.RPM_ANOMALY: 0.25,
                FaultType.ACOUSTIC_ANOMALY: 0.15,
            }.get(state.fault_type, 0.1)

            state.health_score = max(0.0, state.health_score - degradation_rate * state.fault_severity)

        if state.health_score > 80:
            state.status = "RUNNING"
        elif state.health_score > 50:
            state.status = "WARNING"
        elif state.health_score > 20:
            state.status = "CRITICAL"
        else:
            state.status = "FAULT"
