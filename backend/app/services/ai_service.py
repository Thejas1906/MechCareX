"""
Gemini AI integration for MechCareX Phase 3.
Receives structured engineering context from Phase 2 analysis and returns diagnostic insights.
"""
import hashlib
import json
import logging
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a rotating machinery maintenance analyst specialising in predictive maintenance.
You receive structured engineering sensor data and analysis from an IoT monitoring system.
Your task is to reason from the supplied evidence and provide a practical maintenance assessment.

Rules:
- Reason only from the provided sensor data and analysis. Do not invent sensor values.
- Distinguish between what is certain and what is possible.
- Acknowledge when evidence is inconclusive.
- Provide practical, prioritised maintenance recommendations.
- Do not claim a physical inspection has occurred.
- Do not present yourself as a certified safety system.
- Return valid JSON matching the specified schema exactly."""

RESPONSE_SCHEMA = {
    "summary": "string — short natural-language assessment of machine condition",
    "probable_cause": "string — most likely root cause explanation",
    "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
    "evidence": ["string — supporting observation 1", "string — supporting observation 2"],
    "recommendations": ["string — action 1", "string — action 2"],
    "urgency": "Monitor | Inspect Soon | Schedule Maintenance | Immediate Attention",
    "maintenance_action": "string — single most important immediate action"
}

MACHINE_LABELS = {
    "M01": "Industrial Motor 01",
    "M02": "Centrifugal Pump 02",
    "M03": "Cooling Fan 03",
}

BASELINES = {
    "M01": {"temp": 45.0, "vib": 0.20, "curr": 1.75, "rpm": 1450.0, "acou": 46.0},
    "M02": {"temp": 50.0, "vib": 0.28, "curr": 2.50, "rpm": 1750.0, "acou": 50.0},
    "M03": {"temp": 40.0, "vib": 0.15, "curr": 1.05, "rpm": 1200.0, "acou": 45.0},
}


def _build_fingerprint(machine_code: str, probable_fault: str, severity: str, health_rounded: float) -> str:
    key = f"{machine_code}:{probable_fault}:{severity}:{health_rounded}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def _build_context(machine_code: str, state, breakdown, anomaly_result, fft_data: Optional[dict]) -> str:
    bl = BASELINES.get(machine_code, {})
    lines = [
        f"MACHINE: {machine_code} — {state.name}",
        f"TYPE: {state.baseline.machine_type}",
        f"",
        f"HEALTH SCORE: {round(breakdown.total, 1)}%  STATUS: {breakdown.health_status()}",
        f"",
        f"CURRENT SENSOR VALUES (with baseline deviation):",
        f"  Temperature: {round(state.temperature, 1)}°C  (baseline {bl.get('temp','?')}°C)",
        f"  Vibration:   {round(state.vibration, 4)}g   (baseline {bl.get('vib','?')}g)",
        f"  Current:     {round(state.current, 3)}A    (baseline {bl.get('curr','?')}A)",
        f"  RPM:         {round(state.rpm, 1)}          (baseline {bl.get('rpm','?')})",
        f"  Acoustic:    {round(state.acoustic, 1)}dB   (baseline {bl.get('acou','?')}dB)",
        f"",
        f"HEALTH SUB-SCORES:",
        f"  Temperature: {round(breakdown.temperature, 1)}%",
        f"  Vibration:   {round(breakdown.vibration, 1)}%",
        f"  Current:     {round(breakdown.current, 1)}%",
        f"  RPM:         {round(breakdown.rpm, 1)}%",
        f"  Acoustic:    {round(breakdown.acoustic, 1)}%",
        f"",
        f"DETECTED ANOMALIES ({len(anomaly_result.anomalies)}):",
    ]
    for a in anomaly_result.anomalies:
        lines.append(f"  [{a.severity}] {a.type}: {a.message}")

    lines += [
        f"",
        f"PROBABLE FAULT: {anomaly_result.probable_fault}",
        f"FAULT SEVERITY: {anomaly_result.overall_severity}",
        f"",
    ]

    if fft_data:
        comp = fft_data.get("components", {})
        lines += [
            f"VIBRATION FFT ANALYSIS:",
            f"  Fundamental frequency: {fft_data.get('fundamental_frequency', 0):.1f} Hz (1× RPM)",
            f"  2× RPM: {fft_data.get('harmonics', {}).get('2x', 0):.1f} Hz",
            f"  3× RPM: {fft_data.get('harmonics', {}).get('3x', 0):.1f} Hz",
            f"  Dominant harmonic: {fft_data.get('dominant_harmonic', 'unknown')}",
            f"  1× amplitude: {comp.get('1x', 0):.4f}g",
            f"  2× amplitude: {comp.get('2x', 0):.4f}g",
            f"  3× amplitude: {comp.get('3x', 0):.4f}g",
            f"",
        ]

    return "\n".join(lines)


def _parse_response(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


async def run_ai_analysis(machine_code: str) -> dict:
    """
    Build engineering context, call Gemini, return structured analysis.
    Raises exceptions on failure — callers must handle gracefully.
    """
    from app.core.config import settings
    from app.simulation.engine import get_engine
    from app.services.health_service import compute_health
    from app.services.anomaly_service import detect_anomalies
    from app.services.fft_service import get_machine_fft

    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not configured")

    engine = get_engine()
    state = engine.machines.get(machine_code)
    if not state:
        raise ValueError(f"Machine {machine_code} not found")

    breakdown = compute_health(
        machine_code, state.temperature, state.vibration,
        state.current, state.rpm, state.acoustic
    )
    anomaly_result = detect_anomalies(
        machine_code, state.temperature, state.vibration,
        state.current, state.rpm, state.acoustic,
        state.vibration_signal.get("components") if state.vibration_signal else None,
    )
    fft_data = get_machine_fft(machine_code)

    context = _build_context(machine_code, state, breakdown, anomaly_result, fft_data)

    prompt = f"""{SYSTEM_PROMPT}

ENGINEERING ANALYSIS INPUT:
{context}

Return a JSON object matching this schema:
{json.dumps(RESPONSE_SCHEMA, indent=2)}

Respond with valid JSON only. No markdown, no explanation outside the JSON."""

    import google.generativeai as genai
    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel("gemini-flash-lite-latest")

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.3,
            max_output_tokens=1024,
        ),
    )

    parsed = _parse_response(response.text)

    required = {"summary", "probable_cause", "risk_level", "evidence", "recommendations", "urgency", "maintenance_action"}
    missing = required - set(parsed.keys())
    if missing:
        raise ValueError(f"Gemini response missing fields: {missing}")

    if parsed["risk_level"] not in ("LOW", "MEDIUM", "HIGH", "CRITICAL"):
        parsed["risk_level"] = "MEDIUM"

    return {
        "machine_code": machine_code,
        "machine_name": state.name,
        "fingerprint": _build_fingerprint(
            machine_code,
            anomaly_result.probable_fault,
            anomaly_result.overall_severity,
            round(breakdown.total / 5) * 5,
        ),
        "engineering": {
            "health_score": round(breakdown.total, 1),
            "health_status": breakdown.health_status(),
            "probable_fault": anomaly_result.probable_fault,
            "overall_severity": anomaly_result.overall_severity,
            "anomaly_count": len(anomaly_result.anomalies),
            "anomalies": [a.type for a in anomaly_result.anomalies],
            "dominant_harmonic": fft_data.get("dominant_harmonic") if fft_data else None,
        },
        "ai": parsed,
        "generated_at": datetime.utcnow().isoformat(),
    }
