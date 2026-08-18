from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from app.db.session import get_db
from app.models.machine import AIAnalysis

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/machines/{machine_code}/analyze")
async def analyze_machine(machine_code: str, db: AsyncSession = Depends(get_db)):
    """Run Gemini AI analysis for a machine. Cached per condition fingerprint."""
    try:
        from app.services.ai_service import run_ai_analysis
        result = await run_ai_analysis(machine_code)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Gemini analysis failed for {machine_code}: {e}")
        raise HTTPException(status_code=503, detail="AI analysis temporarily unavailable. Engineering diagnostics remain active.")

    # Check for existing analysis with same fingerprint (skip repeat calls)
    existing = await db.execute(
        select(AIAnalysis)
        .where(AIAnalysis.machine_code == machine_code)
        .where(AIAnalysis.fingerprint == result["fingerprint"])
        .order_by(desc(AIAnalysis.created_at))
        .limit(1)
    )
    cached = existing.scalar_one_or_none()
    if cached:
        return {
            "machine_code": cached.machine_code,
            "machine_name": result["machine_name"],
            "fingerprint": cached.fingerprint,
            "engineering": result["engineering"],
            "ai": {
                "summary": cached.summary,
                "probable_cause": cached.probable_cause,
                "risk_level": cached.risk_level,
                "evidence": cached.evidence,
                "recommendations": cached.recommendations,
                "urgency": cached.urgency,
                "maintenance_action": cached.maintenance_action,
            },
            "generated_at": cached.created_at.isoformat(),
            "cached": True,
        }

    ai = result["ai"]
    record = AIAnalysis(
        machine_code=machine_code,
        fingerprint=result["fingerprint"],
        summary=ai["summary"],
        probable_cause=ai["probable_cause"],
        risk_level=ai["risk_level"],
        evidence=ai.get("evidence", []),
        recommendations=ai.get("recommendations", []),
        urgency=ai["urgency"],
        maintenance_action=ai["maintenance_action"],
    )
    db.add(record)
    await db.commit()

    return {**result, "cached": False}


@router.get("/machines/{machine_code}/latest")
async def latest_analysis(machine_code: str, db: AsyncSession = Depends(get_db)):
    """Return the most recent AI analysis for a machine without triggering a new call."""
    result = await db.execute(
        select(AIAnalysis)
        .where(AIAnalysis.machine_code == machine_code)
        .order_by(desc(AIAnalysis.created_at))
        .limit(1)
    )
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="No AI analysis found for this machine")

    return {
        "machine_code": rec.machine_code,
        "fingerprint": rec.fingerprint,
        "ai": {
            "summary": rec.summary,
            "probable_cause": rec.probable_cause,
            "risk_level": rec.risk_level,
            "evidence": rec.evidence,
            "recommendations": rec.recommendations,
            "urgency": rec.urgency,
            "maintenance_action": rec.maintenance_action,
        },
        "generated_at": rec.created_at.isoformat(),
    }
