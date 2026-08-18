"""
Rule-based anomaly detection and fault classification for MechCareX Phase 2.
Produces deterministic engineering analysis that Phase 3 will feed into Gemini.
"""
from dataclasses import dataclass
from typing import Optional
from app.services.health_service import MACHINE_BASELINES


@dataclass
class Anomaly:
    type: str          # HIGH_TEMPERATURE, HIGH_VIBRATION, HIGH_CURRENT, RPM_ANOMALY, HIGH_ACOUSTIC
    severity: str      # INFO, WARNING, CRITICAL
    value: float
    baseline: float
    deviation_pct: float
    message: str

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "severity": self.severity,
            "value": self.value,
            "baseline": self.baseline,
            "deviation_pct": round(self.deviation_pct, 1),
            "message": self.message,
        }


@dataclass
class AnomalyResult:
    anomalies: list[Anomaly]
    probable_fault: str
    overall_severity: str

    def to_dict(self) -> dict:
        return {
            "anomalies": [a.to_dict() for a in self.anomalies],
            "probable_fault": self.probable_fault,
            "overall_severity": self.overall_severity,
            "anomaly_count": len(self.anomalies),
        }


def _classify_fault(anomaly_types: set[str], vib_components: dict) -> str:
    v1x = vib_components.get("1x", 0)
    v2x = vib_components.get("2x", 0)

    high_vib = "HIGH_VIBRATION" in anomaly_types
    high_temp = "HIGH_TEMPERATURE" in anomaly_types
    high_curr = "HIGH_CURRENT" in anomaly_types
    high_acou = "HIGH_ACOUSTIC" in anomaly_types
    rpm_anom = "RPM_ANOMALY" in anomaly_types

    # Overload: high current + RPM drop + temp — RPM drop distinguishes from bearing
    if high_curr and rpm_anom and high_temp:
        return "OVERLOAD"

    # Bearing degradation: vibration + temp + current all elevated (no RPM drop)
    if high_vib and high_temp and high_curr:
        return "BEARING_DEGRADATION"

    # Imbalance: strong 1× RPM dominant, vibration high
    if high_vib and v1x > 0 and v2x > 0 and v1x > v2x * 2.5:
        return "IMBALANCE"

    # Misalignment: 2× RPM dominant
    if high_vib and v2x > 0 and v1x > 0 and v2x > v1x * 1.3:
        return "MISALIGNMENT"

    # Overheating: temperature only
    if high_temp and not high_vib and not high_curr:
        return "OVERHEATING"

    if rpm_anom and high_vib:
        return "RPM_ANOMALY"

    if high_acou and not high_vib:
        return "ACOUSTIC_ANOMALY"

    if anomaly_types:
        return "UNKNOWN_ANOMALY"

    return "NORMAL"


def _overall_severity(anomalies: list[Anomaly]) -> str:
    if any(a.severity == "CRITICAL" for a in anomalies):
        return "CRITICAL"
    if any(a.severity == "WARNING" for a in anomalies):
        return "WARNING"
    if anomalies:
        return "INFO"
    return "NORMAL"


def detect_anomalies(
    machine_code: str,
    temperature: float,
    vibration: float,
    current: float,
    rpm: float,
    acoustic: float,
    vib_components: Optional[dict] = None,
) -> AnomalyResult:
    cfg = MACHINE_BASELINES.get(machine_code, MACHINE_BASELINES["M01"])
    anomalies: list[Anomaly] = []

    # Temperature
    temp_excess = temperature - (cfg["temp"] + 5.0)
    if temp_excess > 15.0:
        pct = temp_excess / cfg["temp"] * 100
        anomalies.append(Anomaly("HIGH_TEMPERATURE", "CRITICAL", temperature, cfg["temp"], pct,
                                 f"Temperature {temperature:.1f}°C is critically above baseline"))
    elif temp_excess > 5.0:
        pct = temp_excess / cfg["temp"] * 100
        anomalies.append(Anomaly("HIGH_TEMPERATURE", "WARNING", temperature, cfg["temp"], pct,
                                 f"Temperature {temperature:.1f}°C elevated above baseline"))

    # Vibration
    vib_ratio = vibration / max(cfg["vib"], 0.001)
    if vib_ratio > 2.5:
        anomalies.append(Anomaly("HIGH_VIBRATION", "CRITICAL", vibration, cfg["vib"],
                                 (vib_ratio - 1) * 100,
                                 f"Vibration {vibration:.4f}g is {vib_ratio:.1f}× baseline"))
    elif vib_ratio > 1.5:
        anomalies.append(Anomaly("HIGH_VIBRATION", "WARNING", vibration, cfg["vib"],
                                 (vib_ratio - 1) * 100,
                                 f"Vibration {vibration:.4f}g elevated"))

    # Current
    curr_ratio = current / max(cfg["curr"], 0.001)
    if curr_ratio > 1.5:
        anomalies.append(Anomaly("HIGH_CURRENT", "CRITICAL", current, cfg["curr"],
                                 (curr_ratio - 1) * 100,
                                 f"Current {current:.3f}A is critically above baseline"))
    elif curr_ratio > 1.2:
        anomalies.append(Anomaly("HIGH_CURRENT", "WARNING", current, cfg["curr"],
                                 (curr_ratio - 1) * 100,
                                 f"Current {current:.3f}A elevated"))

    # RPM
    rpm_dev = abs(rpm - cfg["rpm"]) / max(cfg["rpm"], 1.0)
    if rpm_dev > 0.10:
        severity = "CRITICAL" if rpm_dev > 0.15 else "WARNING"
        anomalies.append(Anomaly("RPM_ANOMALY", severity, rpm, cfg["rpm"], rpm_dev * 100,
                                 f"RPM {rpm:.0f} deviates {rpm_dev*100:.0f}% from baseline"))
    elif rpm_dev > 0.05:
        anomalies.append(Anomaly("RPM_ANOMALY", "INFO", rpm, cfg["rpm"], rpm_dev * 100,
                                 f"RPM slightly off nominal"))

    # Acoustic
    acou_excess = acoustic - (cfg["acou"] + 5.0)
    if acou_excess > 12.0:
        pct = acou_excess / cfg["acou"] * 100
        anomalies.append(Anomaly("HIGH_ACOUSTIC", "CRITICAL", acoustic, cfg["acou"], pct,
                                 f"Acoustic level {acoustic:.1f}dB critically elevated"))
    elif acou_excess > 5.0:
        pct = acou_excess / cfg["acou"] * 100
        anomalies.append(Anomaly("HIGH_ACOUSTIC", "WARNING", acoustic, cfg["acou"], pct,
                                 f"Acoustic level {acoustic:.1f}dB elevated"))

    anomaly_types = {a.type for a in anomalies}
    probable_fault = _classify_fault(anomaly_types, vib_components or {})
    severity = _overall_severity(anomalies)

    return AnomalyResult(anomalies=anomalies, probable_fault=probable_fault, overall_severity=severity)
