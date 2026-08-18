"""
Sensor signal generation for MechCareX.
Produces realistic sensor readings with natural variation and vibration waveform data.
"""
import math
import numpy as np
from typing import Optional
from app.simulation.fault_models import FaultModifiers


# Noise seed is deterministic per machine to keep variation consistent
RNG_CACHE: dict[str, np.random.Generator] = {}


def _rng(machine_code: str) -> np.random.Generator:
    if machine_code not in RNG_CACHE:
        seed = sum(ord(c) for c in machine_code)
        RNG_CACHE[machine_code] = np.random.default_rng(seed)
    return RNG_CACHE[machine_code]


def _gauss(rng: np.random.Generator, scale: float) -> float:
    return float(rng.normal(0.0, scale))


def generate_temperature(
    machine_code: str,
    base: float,
    modifiers: FaultModifiers,
    tick: int,
) -> float:
    rng = _rng(machine_code + "_temp")
    noise = _gauss(rng, 0.15 * modifiers.temperature_noise_scale)
    # Slow thermal drift component
    drift = 0.3 * math.sin(tick * 0.05)
    return round(base + modifiers.temperature_delta + drift + noise, 2)


def generate_current(
    machine_code: str,
    base: float,
    modifiers: FaultModifiers,
) -> float:
    rng = _rng(machine_code + "_curr")
    noise = _gauss(rng, 0.03)
    value = base * modifiers.current_multiplier + noise
    return round(max(0.0, value), 3)


def generate_rpm(
    machine_code: str,
    base: float,
    modifiers: FaultModifiers,
    tick: int,
) -> float:
    rng = _rng(machine_code + "_rpm")
    noise_scale = 3.0 * modifiers.rpm_fluctuation_scale
    noise = _gauss(rng, noise_scale)
    # Slow oscillation in RPM
    drift = 5.0 * math.sin(tick * 0.03) * modifiers.rpm_fluctuation_scale
    value = base * modifiers.rpm_multiplier + drift + noise
    return round(max(100.0, value), 1)


def generate_acoustic(
    machine_code: str,
    base: float,
    modifiers: FaultModifiers,
) -> float:
    rng = _rng(machine_code + "_acou")
    noise = _gauss(rng, 0.5)
    value = base + modifiers.acoustic_delta + noise
    return round(max(20.0, value), 1)


def generate_vibration_signal(
    machine_code: str,
    rpm: float,
    base_amplitude: float,
    modifiers: FaultModifiers,
    tick: int,
) -> dict:
    """
    Generate a vibration signal with harmonic components.

    Returns a dict with:
    - rms: overall RMS vibration in g
    - components: {1x, 2x, 3x} frequency amplitudes in g
    - frequencies: {1x, 2x, 3x} frequencies in Hz
    - raw_samples: 256-point time-domain signal for FFT (sampled at ~5 kHz)

    Architecture note: raw_samples allows Phase 2 to run real FFT analysis.
    """
    rng = _rng(machine_code + "_vib")
    freq_1x = rpm / 60.0
    freq_2x = freq_1x * 2
    freq_3x = freq_1x * 3

    amp_1x = base_amplitude * modifiers.vib_1x_weight * modifiers.vibration_multiplier
    amp_2x = base_amplitude * modifiers.vib_2x_weight * modifiers.vibration_multiplier
    amp_3x = base_amplitude * modifiers.vib_3x_weight * modifiers.vibration_multiplier

    # 256 samples at 5 kHz gives 51.2 ms window — enough for FFT
    fs = 5000.0
    n_samples = 256
    t = np.linspace(0, n_samples / fs, n_samples, endpoint=False)

    # Phase offsets shift every tick to produce natural variation
    phi_1 = tick * 0.15
    phi_2 = tick * 0.23
    phi_3 = tick * 0.31

    signal = (
        amp_1x * np.sin(2 * np.pi * freq_1x * t + phi_1)
        + amp_2x * np.sin(2 * np.pi * freq_2x * t + phi_2)
        + amp_3x * np.sin(2 * np.pi * freq_3x * t + phi_3)
    )

    # Add broadband noise
    noise_level = 0.01 * modifiers.vibration_noise_scale
    signal += rng.normal(0, noise_level, n_samples)

    rms = float(np.sqrt(np.mean(signal ** 2)))

    return {
        "rms": round(rms, 4),
        "components": {
            "1x": round(amp_1x, 4),
            "2x": round(amp_2x, 4),
            "3x": round(amp_3x, 4),
        },
        "frequencies": {
            "1x": round(freq_1x, 2),
            "2x": round(freq_2x, 2),
            "3x": round(freq_3x, 2),
        },
        "sample_rate": fs,
        "raw_samples": signal.tolist(),
    }
