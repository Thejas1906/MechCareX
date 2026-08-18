import io
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.machine import SensorReading, FaultEvent, AIAnalysis, ReportHistory, MaintenanceRecord
from app.simulation.engine import get_engine
from app.services.health_service import compute_health, MACHINE_BASELINES
from app.services.anomaly_service import detect_anomalies
from app.services.fft_service import get_machine_fft

router = APIRouter(prefix="/api/reports", tags=["reports"])
logger = logging.getLogger(__name__)

PERIOD_HOURS = {"1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720}


class GenerateRequest(BaseModel):
    machine_code: str
    period: str = "24h"


def _get_report_data(machine_code: str, period: str, db_readings, db_faults, ai_rec, maint_records):
    engine = get_engine()
    state = engine.machines.get(machine_code)
    if not state:
        return None

    breakdown = compute_health(
        machine_code, state.temperature, state.vibration,
        state.current, state.rpm, state.acoustic
    )
    anomaly_result = detect_anomalies(
        machine_code, state.temperature, state.vibration,
        state.current, state.rpm, state.acoustic,
        state.vibration_signal.get("components") if state.vibration_signal else None,
    )
    fft = get_machine_fft(machine_code)
    bl = MACHINE_BASELINES.get(machine_code, {})

    return {
        "machine_code": machine_code,
        "machine_name": state.name,
        "machine_type": state.baseline.machine_type,
        "period": period,
        "generated_at": datetime.utcnow().isoformat(),
        "health": breakdown.to_dict(),
        "sensors": {
            "temperature": round(state.temperature, 2),
            "vibration": round(state.vibration, 4),
            "current": round(state.current, 3),
            "rpm": round(state.rpm, 1),
            "acoustic": round(state.acoustic, 1),
        },
        "baselines": bl,
        "anomalies": anomaly_result.to_dict(),
        "fft": fft,
        "readings_count": len(db_readings),
        "fault_events": [{"fault_type": f.fault_type, "severity": f.severity, "started": f.started_at.isoformat(), "ended": f.ended_at.isoformat() if f.ended_at else None} for f in db_faults],
        "ai": {
            "summary": ai_rec.summary if ai_rec else None,
            "probable_cause": ai_rec.probable_cause if ai_rec else None,
            "risk_level": ai_rec.risk_level if ai_rec else None,
            "evidence": ai_rec.evidence if ai_rec else None,
            "recommendations": ai_rec.recommendations if ai_rec else None,
            "urgency": ai_rec.urgency if ai_rec else None,
            "maintenance_action": ai_rec.maintenance_action if ai_rec else None,
            "generated_at": ai_rec.created_at.isoformat() if ai_rec else None,
        } if ai_rec else None,
        "maintenance_records": [{"issue": m.issue, "status": m.status, "priority": m.priority, "created_at": m.created_at.isoformat()} for m in maint_records],
    }


@router.post("/generate")
async def generate_report(body: GenerateRequest, db: AsyncSession = Depends(get_db)):
    hours = PERIOD_HOURS.get(body.period, 24)
    since = datetime.utcnow() - timedelta(hours=hours)

    engine = get_engine()
    state = engine.machines.get(body.machine_code)
    if not state or state.db_id is None:
        raise HTTPException(status_code=404, detail="Machine not found")

    # Fetch DB data
    readings_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.machine_id == state.db_id)
        .where(SensorReading.timestamp >= since)
        .order_by(desc(SensorReading.timestamp))
        .limit(500)
    )
    db_readings = readings_result.scalars().all()

    faults_result = await db.execute(
        select(FaultEvent)
        .where(FaultEvent.machine_id == state.db_id)
        .where(FaultEvent.started_at >= since)
        .order_by(desc(FaultEvent.started_at))
    )
    db_faults = faults_result.scalars().all()

    ai_result = await db.execute(
        select(AIAnalysis)
        .where(AIAnalysis.machine_code == body.machine_code)
        .order_by(desc(AIAnalysis.created_at))
        .limit(1)
    )
    ai_rec = ai_result.scalar_one_or_none()

    maint_result = await db.execute(
        select(MaintenanceRecord)
        .where(MaintenanceRecord.machine_code == body.machine_code)
        .order_by(desc(MaintenanceRecord.created_at))
        .limit(5)
    )
    maint_records = maint_result.scalars().all()

    data = _get_report_data(body.machine_code, body.period, db_readings, db_faults, ai_rec, maint_records)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to compile report data")

    # Save report history
    history_rec = ReportHistory(
        machine_code=body.machine_code,
        machine_name=data["machine_name"],
        period=body.period,
        health_score=data["health"]["total"],
        has_ai=ai_rec is not None,
    )
    db.add(history_rec)
    await db.commit()
    await db.refresh(history_rec)
    data["report_id"] = history_rec.id

    return data


@router.get("/history")
async def report_history(machine_code: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(ReportHistory).order_by(desc(ReportHistory.generated_at)).limit(50)
    if machine_code:
        q = q.where(ReportHistory.machine_code == machine_code)
    result = await db.execute(q)
    return [{"id": r.id, "machine_code": r.machine_code, "machine_name": r.machine_name, "period": r.period, "health_score": r.health_score, "has_ai": r.has_ai, "generated_at": r.generated_at.isoformat()} for r in result.scalars().all()]


@router.post("/generate/pdf")
async def generate_pdf_report(body: GenerateRequest, db: AsyncSession = Depends(get_db)):
    hours = PERIOD_HOURS.get(body.period, 24)
    since = datetime.utcnow() - timedelta(hours=hours)

    engine = get_engine()
    state = engine.machines.get(body.machine_code)
    if not state or state.db_id is None:
        raise HTTPException(status_code=404, detail="Machine not found")

    readings_result = await db.execute(
        select(SensorReading).where(SensorReading.machine_id == state.db_id).where(SensorReading.timestamp >= since).order_by(desc(SensorReading.timestamp)).limit(500)
    )
    db_readings = readings_result.scalars().all()
    faults_result = await db.execute(
        select(FaultEvent).where(FaultEvent.machine_id == state.db_id).where(FaultEvent.started_at >= since).order_by(desc(FaultEvent.started_at))
    )
    db_faults = faults_result.scalars().all()
    ai_result = await db.execute(select(AIAnalysis).where(AIAnalysis.machine_code == body.machine_code).order_by(desc(AIAnalysis.created_at)).limit(1))
    ai_rec = ai_result.scalar_one_or_none()
    maint_result = await db.execute(select(MaintenanceRecord).where(MaintenanceRecord.machine_code == body.machine_code).order_by(desc(MaintenanceRecord.created_at)).limit(5))
    maint_records = maint_result.scalars().all()

    data = _get_report_data(body.machine_code, body.period, db_readings, db_faults, ai_rec, maint_records)
    if not data:
        raise HTTPException(status_code=500, detail="Failed to compile report data")

    pdf_bytes = _build_pdf(data)
    filename = f"mechcarex_{body.machine_code}_{body.period}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_pdf(data: dict) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.lib import colors
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    from reportlab.platypus import KeepTogether

    PINK = colors.HexColor("#FF204E")
    CRIMSON = colors.HexColor("#A0153E")
    PURPLE = colors.HexColor("#5D0E41")
    NAVY = colors.HexColor("#00224D")
    LIGHT_GRAY = colors.HexColor("#F8FAFC")
    MID_GRAY = colors.HexColor("#64748B")
    DARK = colors.HexColor("#0F172A")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        topMargin=2*cm, bottomMargin=2*cm,
        leftMargin=2*cm, rightMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("H1", parent=styles["Normal"], fontSize=20, textColor=NAVY, fontName="Helvetica-Bold", spaceAfter=4)
    h2 = ParagraphStyle("H2", parent=styles["Normal"], fontSize=13, textColor=NAVY, fontName="Helvetica-Bold", spaceBefore=16, spaceAfter=6)
    h3 = ParagraphStyle("H3", parent=styles["Normal"], fontSize=10, textColor=NAVY, fontName="Helvetica-Bold", spaceBefore=8, spaceAfter=4)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontSize=9, textColor=DARK, leading=14, spaceAfter=4)
    small = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8, textColor=MID_GRAY, leading=12)
    label = ParagraphStyle("Label", parent=styles["Normal"], fontSize=8, textColor=MID_GRAY, fontName="Helvetica-Bold", spaceAfter=2)

    health = data["health"]
    sensors = data["sensors"]
    bl = data.get("baselines", {})
    anomalies = data["anomalies"]
    fft = data.get("fft")
    ai = data.get("ai")

    def status_color(score):
        if score >= 90: return colors.HexColor("#16a34a")
        if score >= 70: return colors.HexColor("#ca8a04")
        if score >= 40: return colors.HexColor("#ea580c")
        return colors.HexColor("#dc2626")

    BrandStyle = ParagraphStyle("Brand", parent=styles["Normal"], fontSize=26, textColor=PINK, fontName="Helvetica-Bold", leading=30, spaceAfter=2)
    SubStyle = ParagraphStyle("Sub", parent=styles["Normal"], fontSize=10, textColor=MID_GRAY, leading=14, spaceAfter=6)
    TaglineStyle = ParagraphStyle("Tagline", parent=styles["Normal"], fontSize=7, textColor=colors.HexColor("#94A3B8"), leading=10, spaceAfter=0)
    MetaKeyStyle = ParagraphStyle("MetaKey", parent=styles["Normal"], fontSize=8, textColor=MID_GRAY, fontName="Helvetica-Bold", leading=13, spaceAfter=2)
    MetaValStyle = ParagraphStyle("MetaVal", parent=styles["Normal"], fontSize=9, textColor=DARK, leading=13, spaceAfter=4)

    def _score_color_hex(score):
        if score >= 90: return "#16a34a"
        if score >= 70: return "#ca8a04"
        if score >= 40: return "#ea580c"
        return "#dc2626"

    story = []

    # Two-column header: brand left, report meta right
    score_hdr = health.get("total", 0)
    score_hex = _score_color_hex(score_hdr)
    hdr_left = [
        Paragraph("MechCareX", BrandStyle),
        Paragraph("Machine Health Report", SubStyle),
        Paragraph("IoT Predictive Maintenance System", TaglineStyle),
    ]
    hdr_right = [
        Paragraph(f"<b>{data['machine_code']}</b> — {data['machine_name']}", MetaValStyle),
        Paragraph(data.get("machine_type", "—"), MetaKeyStyle),
        Paragraph(f"Period: <b>{data.get('period', '24h')}</b>", MetaValStyle),
        Paragraph(f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", MetaKeyStyle),
        Paragraph(f"<font color='{score_hex}'><b>Health: {round(score_hdr, 1)}% — {health.get('status', '—')}</b></font>", MetaValStyle),
    ]
    hdr_table = Table([[hdr_left, hdr_right]], colWidths=[9*cm, 8*cm])
    hdr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(hdr_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=2, color=PINK, spaceAfter=16))

    # Executive summary
    story.append(Paragraph("Executive Summary", h2))
    prob_fault = anomalies.get("probable_fault", "NORMAL")
    n_anomalies = anomalies.get("anomaly_count", 0)
    story.append(Paragraph(f"Probable Fault: <b>{prob_fault}</b>   |   Active Anomalies: <b>{n_anomalies}</b>   |   Sensor Readings (period): <b>{data.get('readings_count', 0)}</b>", body))
    story.append(Spacer(1, 12))

    # Sensor summary table
    story.append(Paragraph("Sensor Summary", h2))
    sensor_rows = [["Parameter", "Current", "Baseline", "Sub-Score", "Deviation"]]
    sensor_map = [
        ("Temperature", "temperature", "temp", "°C"),
        ("Vibration", "vibration", "vib", "g"),
        ("Current", "current", "curr", "A"),
        ("RPM", "rpm", "rpm", ""),
        ("Acoustic", "acoustic", "acou", "dB"),
    ]
    for name, sk, bk, unit in sensor_map:
        curr = sensors.get(sk, 0)
        base = bl.get(bk, 0)
        sub = round(health.get(sk, 100), 1)
        dev = round((curr - base) / base * 100, 1) if base else 0
        dev_str = f"+{dev}%" if dev >= 0 else f"{dev}%"
        sensor_rows.append([name, f"{curr}{unit}", f"{base}{unit}", f"{sub}%", dev_str])

    sensor_table = Table(sensor_rows, colWidths=[4*cm, 3*cm, 3*cm, 3*cm, 3*cm])
    sensor_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GRAY, colors.white]),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ("ALIGN", (1, 0), (-1, -1), "CENTER"),
    ]))
    story.append(sensor_table)
    story.append(Spacer(1, 12))

    # Anomaly detection
    if anomalies.get("anomalies"):
        story.append(Paragraph("Detected Anomalies", h2))
        anom_rows = [["Type", "Severity", "Value", "Baseline", "Deviation"]]
        for a in anomalies["anomalies"]:
            anom_rows.append([
                a["type"].replace("_", " "),
                a["severity"],
                str(round(a["value"], 3)),
                str(round(a["baseline"], 3)),
                f"{round(a['deviation_pct'], 1)}%",
            ])
        anom_table = Table(anom_rows, colWidths=[5*cm, 3*cm, 2.5*cm, 2.5*cm, 3*cm])
        anom_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), CRIMSON),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#FEF2F2"), colors.white]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#FECACA")),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
        ]))
        story.append(anom_table)
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"Probable Fault Classification: <b>{prob_fault}</b>  |  Severity: <b>{anomalies.get('overall_severity', '—')}</b>", body))
        story.append(Spacer(1, 12))

    # Vibration FFT
    if fft:
        story.append(Paragraph("Vibration Analysis (FFT)", h2))
        fft_data = [
            ["Fundamental (1×)", f"{fft.get('fundamental_frequency', 0):.2f} Hz"],
            ["2× RPM", f"{fft.get('harmonics', {}).get('2x', 0):.2f} Hz"],
            ["3× RPM", f"{fft.get('harmonics', {}).get('3x', 0):.2f} Hz"],
            ["Dominant Harmonic", fft.get("dominant_harmonic", "—")],
        ]
        comp = fft.get("components", {})
        if comp:
            fft_data += [
                ["1× Amplitude", f"{comp.get('1x', 0):.4f} g"],
                ["2× Amplitude", f"{comp.get('2x', 0):.4f} g"],
                ["3× Amplitude", f"{comp.get('3x', 0):.4f} g"],
            ]
        fft_table = Table(fft_data, colWidths=[6*cm, 6*cm])
        fft_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("TEXTCOLOR", (0, 0), (0, -1), MID_GRAY),
            ("TEXTCOLOR", (1, 0), (1, -1), DARK),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [LIGHT_GRAY, colors.white]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ]))
        story.append(fft_table)
        story.append(Spacer(1, 12))

    # AI Assessment
    story.append(Paragraph("AI Assessment", h2))
    if ai:
        story.append(Paragraph(f"<i>Generated: {ai.get('generated_at', '—')}</i>", small))
        story.append(Spacer(1, 4))
        story.append(Paragraph("Summary", h3))
        story.append(Paragraph(ai.get("summary", "—"), body))
        story.append(Paragraph("Probable Cause", h3))
        story.append(Paragraph(ai.get("probable_cause", "—"), body))
        story.append(Paragraph(f"Risk Level: <b>{ai.get('risk_level', '—')}</b>  |  Urgency: <b>{ai.get('urgency', '—')}</b>", body))
        evidence = ai.get("evidence") or []
        if evidence:
            story.append(Paragraph("Supporting Evidence", h3))
            for ev in evidence:
                story.append(Paragraph(f"• {ev}", body))
        recs = ai.get("recommendations") or []
        if recs:
            story.append(Paragraph("Recommendations", h3))
            for i, rec in enumerate(recs, 1):
                story.append(Paragraph(f"{i}. {rec}", body))
        if ai.get("maintenance_action"):
            story.append(Paragraph("Immediate Action", h3))
            story.append(Paragraph(ai["maintenance_action"], body))
    else:
        story.append(Paragraph("AI analysis was not requested for this report.", body))
    story.append(Spacer(1, 12))

    # Maintenance records
    if data.get("maintenance_records"):
        story.append(Paragraph("Maintenance Records", h2))
        maint_rows = [["Issue", "Priority", "Status", "Created"]]
        for m in data["maintenance_records"]:
            maint_rows.append([m["issue"][:60], m["priority"], m["status"], m["created_at"][:10]])
        mt = Table(maint_rows, colWidths=[8*cm, 2.5*cm, 2.5*cm, 3*cm])
        mt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [LIGHT_GRAY, colors.white]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")),
        ]))
        story.append(mt)
        story.append(Spacer(1, 12))

    # Footer
    story.append(HRFlowable(width="100%", thickness=1, color=LIGHT_GRAY, spaceAfter=8))
    story.append(Paragraph(
        f"MechCareX — IoT-Based Predictive Maintenance System  |  Report generated {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        small
    ))

    doc.build(story)
    return buf.getvalue()
