from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class MachineBase(BaseModel):
    machine_code: str
    name: str
    machine_type: str
    description: Optional[str] = None
    location: Optional[str] = None


class MachineResponse(MachineBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    health_score: float
    created_at: datetime
    updated_at: datetime


class SensorReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_id: int
    timestamp: datetime
    temperature: float
    vibration: float
    current: float
    rpm: float
    acoustic: float
    vibration_signal: Optional[dict] = None


class FaultEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_id: int
    fault_type: str
    severity: float
    started_at: datetime
    ended_at: Optional[datetime] = None
    active: bool
    description: Optional[str] = None


class FaultInjectionRequest(BaseModel):
    fault_type: str
    severity: float = 0.5

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "fault_type": "BEARING_FAILURE",
                "severity": 0.75
            }
        }
    )


class ManualControlRequest(BaseModel):
    temperature_fault: float = 0.0
    vibration_fault: float = 0.0
    current_load: float = 0.0
    rpm_variation: float = 0.0
    acoustic_noise: float = 0.0


class SimulationStatusResponse(BaseModel):
    status: str
    running: bool
    machine_count: int
    tick_interval: float


class WsMachineSensors(BaseModel):
    temperature: float
    vibration: float
    current: float
    rpm: float
    acoustic: float


class WsMachineInfo(BaseModel):
    id: str
    name: str


class WsMessage(BaseModel):
    type: str
    timestamp: str
    machine: WsMachineInfo
    sensors: WsMachineSensors
    active_faults: list[str]
    health_score: float
    status: str
    vibration_signal: Optional[dict] = None
