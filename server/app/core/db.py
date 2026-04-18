from sqlalchemy.ext.asyncio import create_async_engine
from .config import settings

if not settings.POSTGRES_URL:
    raise ValueError("POSTGRES_URL is not set. Check your .env file.")

engine = create_async_engine(settings.POSTGRES_URL, echo=True)