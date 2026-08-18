from pathlib import Path
from pydantic_settings import BaseSettings

# .env lives at project root (parent of backend/)
_ROOT = Path(__file__).parent.parent.parent.parent
_ENV_FILES = [str(_ROOT / ".env"), ".env"]


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://rotaryguard:rotaryguard_secret@localhost:5432/rotaryguard"
    backend_port: int = 8000
    frontend_port: int = 3000
    simulation_tick_interval: float = 1.0  # seconds
    db_persist_interval: int = 1  # persist every N ticks
    gemini_api_key: str = ""

    model_config = {"env_file": _ENV_FILES, "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
