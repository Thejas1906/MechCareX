"""
Health score computation for MechCareX Phase 2.
Machine-specific baselines with weighted sensor scoring.
"""
from dataclasses import dataclass

MACHINE_BASELINES = {
    "M01": {"temp": 45.0, "vib": 0.20, "curr": 1.75, "rpm": 1450.0, "acou": 46.0},
    "M02": {"temp": 50.0, "vib": 0.28, "curr": 2.50, "rpm": 1750.0, "acou": 50.0},
    "M03": {"temp": 40.0, "vib": 0.15, "curr": 1.05, "rpm": 1200.0, "acou": 45.0},
}

WEIGHTS = {"temperature": 0.20, "vibration": 0.30, "current": 0.20, "rpm": 0.15, "acoustic": 0.15}


@dataclass
class HealthBreakdown:
    temperature: float
    vibration: float
    current: float
    rpm: float
    acoustic: float
    total: float

    def health_status(self) -> str:
        if self.total >= 90:
            return "HEALTHY"
        if self.total >= 70:
            return "WARNING"
        if self.total >= 40:
            return "DEGRADED"
        return "CRITICAL"

    def to_dict(self) -> dict:
        return {
            "temperature": round(self.temperature, 1),
            "vibration": round(self.vibration, 1),
            "current": round(self.current, 1),
            "rpm": round(self.rpm, 1),
            "acoustic": round(self.acoustic, 1),
            "total": round(self.total, 1),
            "status": self.health_status(),
        }


def _score_temperature(actual: float, base: float) -> float:
    excess = max(0.0, actual - (base + 3.0))
    return max(0.0, 100.0 - (excess / 30.0) * 100.0)


def _score_vibration(actual: float, base: float) -> float:
    ratio = actual / max(base, 0.001)
    excess = max(0.0, ratio - 1.15)
    return max(0.0, 100.0 - (excess / 5.0) * 100.0)


def _score_current(actual: float, base: float) -> float:
    ratio = actual / max(base, 0.001)
    excess = max(0.0, ratio - 1.10)
    return max(0.0, 100.0 - (excess / 1.2) * 100.0)


def _score_rpm(actual: float, base: float) -> float:
    deviation = abs(actual - base) / max(base, 1.0)
    excess = max(0.0, deviation - 0.03)
    return max(0.0, 100.0 - (excess / 0.20) * 100.0)


def _score_acoustic(actual: float, base: float) -> float:
    excess = max(0.0, actual - (base + 4.0))
    return max(0.0, 100.0 - (excess / 20.0) * 100.0)


def compute_health(machine_code: str, temperature: float, vibration: float,
                   current: float, rpm: float, acoustic: float) -> HealthBreakdown:
    cfg = MACHINE_BASELINES.get(machine_code, MACHINE_BASELINES["M01"])

    t = min(100.0, _score_temperature(temperature, cfg["temp"]))
    v = min(100.0, _score_vibration(vibration, cfg["vib"]))
    c = min(100.0, _score_current(current, cfg["curr"]))
    r = min(100.0, _score_rpm(rpm, cfg["rpm"]))
    a = min(100.0, _score_acoustic(acoustic, cfg["acou"]))

    total = (
        WEIGHTS["temperature"] * t
        + WEIGHTS["vibration"] * v
        + WEIGHTS["current"] * c
        + WEIGHTS["rpm"] * r
        + WEIGHTS["acoustic"] * a
    )
    total = max(0.0, min(100.0, total))
    return HealthBreakdown(temperature=t, vibration=v, current=c, rpm=r, acoustic=a, total=total)
