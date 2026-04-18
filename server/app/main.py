from fastapi import FastAPI
from app.api import notify, beacon, messages, geo

app = FastAPI()

app.include_router(notify.router, prefix="/api/notify")
app.include_router(beacon.router, prefix="/api/beacon")
app.include_router(messages.router, prefix="/api/messages")
app.include_router(geo.router, prefix="/api/geo")