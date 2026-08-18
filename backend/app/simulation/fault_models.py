"""
Fault models for MechCareX simulation.
Each fault modifies machine sensor parameters in a physically correlated way.
Severity ranges from 0.0 (no effect) to 1.0 (maximum effect).
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class FaultType(str, Enum):
    NORMAL = "NORMAL"
    BEARING_FAILURE = "BEARING_FAILURE"
    IMBALANCE = "IMBALANCE"
    MISALIGNMENT = "MISALIGNMENT"
    OVERLOAD = "OVERLOAD"
    OVERHEATING = "OVERHEATING"
    RPM_ANOMALY = "RPM_ANOMALY"
    ACOUSTIC_ANOMALY = "ACOUSTIC_ANOMALY"


@dataclass
class FaultModifiers:
    """Multiplicative/additive modifiers applied to base sensor values."""
    temperature_delta: float = 0.0      # degrees C added
    vibration_multiplier: float = 1.0   # multiplicative factor
    current_multiplier: float = 1.0     # multiplicative factor
    rpm_multiplier: float = 1.0         # multiplicative factor
    acoustic_delta: float = 0.0         # dB added

    # Vibration frequency component weights (1x, 2x, 3x RPM)
    vib_1x_weight: float = 1.0
    vib_2x_weight: float = 0.3
    vib_3x_weight: float = 0.1

    # Noise amplitude modifiers
    temperature_noise_scale: float = 1.0
    vibration_noise_scale: float = 1.0
    rpm_fluctuation_scale: float = 1.0


def compute_fault_modifiers(fault_type: FaultType, severity: float) -> FaultModifiers:
    """Return blended FaultModifiers for the given fault and severity."""
    s = max(0.0, min(1.0, severity))

    if fault_type == FaultType.NORMAL or s == 0.0:
        return FaultModifiers()

    if fault_type == FaultType.BEARING_FAILURE:
        return FaultModifiers(
            temperature_delta=20.0 * s,
            vibration_multiplier=1.0 + 3.5 * s,
            current_multiplier=1.0 + 0.3 * s,
            rpm_multiplier=1.0 - 0.05 * s,
            acoustic_delta=18.0 * s,
            vib_1x_weight=1.0 + 0.5 * s,
            vib_2x_weight=0.3 + 0.8 * s,
            vib_3x_weight=0.1 + 1.2 * s,      # sub- and super-harmonics grow
            temperature_noise_scale=1.0 + 0.5 * s,
            vibration_noise_scale=1.0 + 2.0 * s,
            rpm_fluctuation_scale=1.0 + 0.3 * s,
        )

    if fault_type == FaultType.IMBALANCE:
        return FaultModifiers(
            temperature_delta=5.0 * s,
            vibration_multiplier=1.0 + 4.0 * s,
            current_multiplier=1.0 + 0.2 * s,
            rpm_multiplier=1.0,               # RPM stays stable
            acoustic_delta=8.0 * s,
            vib_1x_weight=1.0 + 5.0 * s,     # strong 1x component
            vib_2x_weight=0.3,
            vib_3x_weight=0.1,
            vibration_noise_scale=1.0 + 1.5 * s,
        )

    if fault_type == FaultType.MISALIGNMENT:
        return FaultModifiers(
            temperature_delta=10.0 * s,
            vibration_multiplier=1.0 + 2.5 * s,
            current_multiplier=1.0 + 0.35 * s,
            rpm_multiplier=1.0 - 0.03 * s,
            acoustic_delta=10.0 * s,
            vib_1x_weight=1.0,
            vib_2x_weight=0.3 + 4.0 * s,     # strong 2x component
            vib_3x_weight=0.1 + 0.5 * s,
            vibration_noise_scale=1.0 + s,
            rpm_fluctuation_scale=1.0 + 0.5 * s,
        )

    if fault_type == FaultType.OVERLOAD:
        return FaultModifiers(
            temperature_delta=15.0 * s,
            vibration_multiplier=1.0 + 1.5 * s,
            current_multiplier=1.0 + 1.2 * s,
            rpm_multiplier=1.0 - 0.12 * s,
            acoustic_delta=6.0 * s,
            vib_1x_weight=1.0 + 0.5 * s,
            vib_2x_weight=0.3 + 0.2 * s,
            vib_3x_weight=0.1,
        )

    if fault_type == FaultType.OVERHEATING:
        return FaultModifiers(
            temperature_delta=40.0 * s,
            vibration_multiplier=1.0 + 0.3 * s,
            current_multiplier=1.0 + 0.15 * s,
            rpm_multiplier=1.0 - 0.02 * s,
            acoustic_delta=3.0 * s,
            temperature_noise_scale=1.0 + s,
        )

    if fault_type == FaultType.RPM_ANOMALY:
        return FaultModifiers(
            temperature_delta=3.0 * s,
            vibration_multiplier=1.0 + 1.0 * s,
            current_multiplier=1.0 + 0.2 * s,
            rpm_multiplier=1.0 - 0.20 * s,
            acoustic_delta=4.0 * s,
            rpm_fluctuation_scale=1.0 + 5.0 * s,
            vibration_noise_scale=1.0 + s,
        )

    if fault_type == FaultType.ACOUSTIC_ANOMALY:
        return FaultModifiers(
            temperature_delta=2.0 * s,
            vibration_multiplier=1.0 + 0.5 * s,
            current_multiplier=1.0 + 0.1 * s,
            rpm_multiplier=1.0,
            acoustic_delta=25.0 * s,
            vib_3x_weight=0.1 + 2.0 * s,     # high-freq noise proxy
        )

    return FaultModifiers()
