import logging
import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from app.core.config import settings
from app.db.session import init_db
from app.simulation.engine import get_engine
from app.services.machine_service import seed_machines, db_persist_callback
from app.api.websocket import manager, ws_broadcast_callback
from app.api.routes import machines, simulation, health, alerts, analytics, ai, maintenance, reports

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("MechCareX backend starting...")

    # Retry DB connection (PostgreSQL may not be ready instantly)
    for attempt in range(15):
        try:
            await init_db()
            break
        except Exception as e:
            if attempt == 14:
                raise RuntimeError(f"Cannot connect to database after 15 attempts: {e}")
            logger.warning(f"DB not ready (attempt {attempt + 1}/15), retrying in 2s...")
            await asyncio.sleep(2)

    engine = get_engine()
    await seed_machines(engine)

    # Load persisted alerts from DB into memory
    from app.services.alert_service import get_alert_service
    await get_alert_service().load_from_db()

    engine.set_ws_callback(ws_broadcast_callback)
    engine.set_db_callback(db_persist_callback)
    await engine.start()

    logger.info("Simulation engine running. MechCareX is live.")

    yield

    # Shutdown
    await engine.stop()
    logger.info("MechCareX backend stopped.")


app = FastAPI(
    title="MechCareX API",
    description="IoT-Based Predictive Maintenance and Real-Time Health Monitoring for Rotating Machines",
    version="1.0.0-phase1",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routers
app.include_router(machines.router)
app.include_router(simulation.router)
app.include_router(health.router)
app.include_router(alerts.router)
app.include_router(analytics.router)
app.include_router(ai.router)
app.include_router(maintenance.router)
app.include_router(reports.router)


@app.get("/health")
async def health():
    engine = get_engine()
    db_status = "connected"
    try:
        from app.db.session import engine as db_engine
        async with db_engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
    except Exception:
        db_status = "disconnected"

    return JSONResponse({
        "status": "ok",
        "service": "mechcarex-backend",
        "simulation": "running" if engine.is_running else "stopped",
        "database": db_status,
        "machines": len(engine.machines),
        "ws_clients": manager.connection_count,
    })


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; engine pushes data via broadcast
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# Serve Virtual Factory UI
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_ui():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return JSONResponse({"message": "MechCareX API running. UI not found."})
