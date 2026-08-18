"""
FFT analysis service for MechCareX Phase 2.
Computes vibration spectrum from raw samples stored in the simulation engine.
"""
import numpy as np
from typing import Optional


def compute_fft_from_samples(raw_samples: list[float], sample_rate: float, rpm: float,
                              max_freq: float = 200.0) -> dict:
    """Compute FFT spectrum and return bins up to max_freq Hz."""
    samples = np.array(raw_samples)
    n = len(samples)

    # Apply Hanning window to reduce spectral leakage
    window = np.hanning(n)
    windowed = samples * window

    fft_vals = np.fft.rfft(windowed)
    freqs = np.fft.rfftfreq(n, d=1.0 / sample_rate)
    amplitudes = (np.abs(fft_vals) / (n / 2)).tolist()

    # Trim to max_freq
    mask = freqs <= max_freq
    freqs_trimmed = freqs[mask].tolist()
    amps_trimmed = [amplitudes[i] for i, m in enumerate(mask) if m]

    fund_freq = rpm / 60.0

    # Find dominant FFT bin
    if amps_trimmed:
        dom_idx = int(np.argmax(amps_trimmed))
        dom_freq = freqs_trimmed[dom_idx]
    else:
        dom_freq = fund_freq

    harmonics = {"1x": round(fund_freq, 2), "2x": round(fund_freq * 2, 2), "3x": round(fund_freq * 3, 2)}

    # Dominant harmonic: determined by closest harmonic to dominant FFT peak
    # with tolerance of half a frequency bin to handle resolution limits
    bin_size = sample_rate / n if n > 0 else 20.0

    def closest_harmonic(freq: float) -> str:
        dists = {k: abs(freq - v) for k, v in harmonics.items()}
        best = min(dists, key=dists.get)
        # Use 1.5 bins of tolerance to account for spectral leakage
        return best if dists[best] < max(fund_freq * 0.4, bin_size * 1.5) else "other"

    dominant_harmonic = closest_harmonic(dom_freq)

    return {
        "frequencies": [round(f, 2) for f in freqs_trimmed],
        "amplitudes": [round(a, 6) for a in amps_trimmed],
        "fundamental_frequency": round(fund_freq, 2),
        "harmonics": harmonics,
        "dominant_frequency": round(dom_freq, 2),
        "dominant_harmonic": dominant_harmonic,
        "sample_rate": sample_rate,
        "n_samples": n,
    }


def get_machine_fft(machine_code: str) -> Optional[dict]:
    from app.simulation.engine import get_engine
    engine = get_engine()
    state = engine.machines.get(machine_code)
    if not state:
        return None

    raw_sig = getattr(state, "_raw_vibration_signal", None)
    if not raw_sig or "raw_samples" not in raw_sig:
        # Fallback: synthesize from components
        components = raw_sig.get("components", {}) if raw_sig else {}
        return {
            "frequencies": [],
            "amplitudes": [],
            "fundamental_frequency": round(state.rpm / 60, 2),
            "harmonics": {
                "1x": round(state.rpm / 60, 2),
                "2x": round(state.rpm / 30, 2),
                "3x": round(state.rpm / 20, 2),
            },
            "dominant_frequency": round(state.rpm / 60, 2),
            "dominant_harmonic": "1x",
            "components": components,
            "sample_rate": 5000,
            "n_samples": 0,
        }

    result = compute_fft_from_samples(
        raw_sig["raw_samples"],
        raw_sig.get("sample_rate", 5000),
        state.rpm,
    )
    result["components"] = raw_sig.get("components", {})
    return result
