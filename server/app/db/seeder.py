import asyncio
from sqlalchemy import text
from app.core.db import engine

async def seed():
    async with engine.begin() as conn:

        print("🔄 Clearing existing data...")

        # Clear tables (order matters if you add FK later)
        await conn.execute(text("TRUNCATE geo_profiles RESTART IDENTITY CASCADE;"))
        await conn.execute(text("TRUNCATE messages RESTART IDENTITY CASCADE;"))

        print("🌱 Inserting fresh data...")

        # Insert clean geo profiles
        await conn.execute(text("""
            INSERT INTO geo_profiles 
            (id, user_id, label, lat, lng, radius_meters, zone_type)
            VALUES
            (gen_random_uuid(), 'user_1', 'home', 13.0827, 80.2707, 200, 'always_deliver'),
            (gen_random_uuid(), 'user_1', 'gym', 13.0800, 80.2600, 150, 'critical_only');
        """))

        print("✅ Seed complete")

if __name__ == "__main__":
    asyncio.run(seed())