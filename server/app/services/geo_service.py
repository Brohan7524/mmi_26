from app.utils.haversine import haversine

from app.api.geo import GEO_STORE as GEO_ZONES


async def match(user_id, lat, lng):
    try:
        profiles = GEO_ZONES.get(user_id, [])

        print(f"[GEO] Loaded {len(profiles)} zone(s) for {user_id}")

        for p in profiles:
            distance = haversine(lat, lng, p["lat"], p["lng"])

            print(f"[GEO] Checking {p['label']}: {distance:.2f}m (radius: {p['radius_meters']}m)")

            if distance <= p["radius_meters"]:
                print(f"[GEO] Matched zone: {p['label']} ({p['zone_type']})")
                return {
                    "type": p["zone_type"],
                    "label": p["label"]
                }

        print("[GEO] No zone matched → default always_deliver")

        return {"type": "always_deliver", "label": "default"}

    except Exception as e:
        print("[GEO] Error:", e)
        return {"type": "always_deliver", "label": "default"}