from fastapi import APIRouter, HTTPException
from app.simulation.engine import get_engine
from app.services.health_service import compute_health
from app.services.anomaly_service import detect_anomalies
from app.services.fft_service import get_machine_fft

router = APIRouter(prefix="/api/machines", tags=["health"])


@router.get("/{machine_code}/health")
async def machine_health(machine_code: str):
    engine = get_engine()
    state = engine.machines.get(machine_code)
    if not state:
        raise HTTPException(status_code=404, detail="Machine not found")

    breakdown = compute_health(
        machine_code,
        state.temperature, state.vibration, state.current, state.rpm, state.acoustic
    )
    anomaly_result = detect_anomalies(
        machine_code,
        state.temperature, state.vibration, state.current, state.rpm, state.acoustic,
        state.vibration_signal.get("components") if state.vibration_signal else None,
    )

    return {
        "machine_code": machine_code,
        "health_breakdown": breakdown.to_dict(),
        "anomalies": anomaly_result.to_dict(),
        "sensors": {
            "temperature": round(state.temperature, 2),
            "vibration": round(state.vibration, 4),
            "current": round(state.current, 3),
            "rpm": round(state.rpm, 1),
            "acoustic": round(state.acoustic, 1),
        },
    }


@router.get("/{machine_code}/vibration-spectrum")
async def vibration_spectrum(machine_code: str):
    engine = get_engine()
    if machine_code not in engine.machines:
        raise HTTPException(status_code=404, detail="Machine not found")

    result = get_machine_fft(machine_code)
    if not result:
        raise HTTPException(status_code=503, detail="FFT data not available yet")

    return result
