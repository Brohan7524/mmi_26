import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PORT = int(os.getenv("PORT", 5000))
    POSTGRES_URL = os.getenv("POSTGRES_URL")
    REDIS_HOST = os.getenv("REDIS_HOST")
    REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
    # Using dummy API key - replace with real key when ready
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "dummy-key")

settings = Settings()