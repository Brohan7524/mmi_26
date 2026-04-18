from fastapi import APIRouter
from sqlalchemy import text
from app.core.db import engine

router = APIRouter()

@router.post("/create")
async def create_geo(data: dict):
    async with engine.begin() as conn:
        await conn.execute(
            text("""
                INSERT INTO geo_profiles
                (id, user_id, label, lat, lng, radius_meters, zone_type)
                VALUES
                (gen_random_uuid(), :uid, :label, :lat, :lng, :radius, :zone)
            """),
            {
                "uid": data["user_id"],
                "label": data["label"],
                "lat": data["lat"],
                "lng": data["lng"],
                "radius": data["radius_meters"],
                "zone": data["zone_type"]
            }
        )

    return {"status": "created"}

@router.get("/{user_id}")
async def get_geo(user_id: str):
    async with engine.connect() as conn:
        result = await conn.execute(
            text("SELECT * FROM geo_profiles WHERE user_id = :uid"),
            {"uid": user_id}
        )

        profiles = result.mappings().all()

    return {"profiles": profiles}