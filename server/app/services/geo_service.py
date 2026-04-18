from app.core.db import engine
from sqlalchemy import text
from app.utils.haversine import haversine

async def match(user_id, lat, lng):
    try:
        async with engine.connect() as conn:

            # Debug: check DB
            db_result = await conn.execute(text("SELECT current_database();"))
            print("FASTAPI DB:", db_result.scalar())

            # Main query
            result = await conn.execute(
                text("SELECT * FROM geo_profiles WHERE user_id = :uid"),
                {"uid": user_id}
            )

            profiles = result.mappings().all()   # ✅ FIX

        print(f"Loaded {len(profiles)} geo profile(s) for user {user_id}")

        for p in profiles:
            distance = haversine(lat, lng, p["lat"], p["lng"])

            print(f"Checking {p['label']}: {distance}m (radius: {p['radius_meters']}m)")

            if distance <= p["radius_meters"]:
                return {
                    "type": p["zone_type"],
                    "label": p["label"]
                }

        return {"type": "always_deliver", "label": "default"}

    except Exception as e:
        print("Error matching zones:", e)
        return {"type": "always_deliver", "label": "default"}