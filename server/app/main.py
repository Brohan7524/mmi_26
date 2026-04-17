from fastapi import FastAPI
from app.api import notify, beacon

app = FastAPI()

app.include_router(notify.router, prefix="/api/notify")
app.include_router(beacon.router, prefix="/api/beacon")