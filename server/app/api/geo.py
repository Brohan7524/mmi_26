from fastapi import APIRouter

router = APIRouter()

GEO_STORE = {
    "user_123": [
        {
            "label": "home",
            "lat": 13.0827,
            "lng": 80.2707,
            "radius_meters": 300,
            "zone_type": "always_deliver"
        },
        {
            "label": "office",
            "lat": 13.0900,
            "lng": 80.2800,
            "radius_meters": 200,
            "zone_type": "critical_only"
        }
    ]
}


def _get_user_zones(user_id: str):
    if user_id not in GEO_STORE:
        GEO_STORE[user_id] = []
    return GEO_STORE[user_id]


@router.post("/create")
async def create_geo(data: dict):
    user_id = data.get("user_id", "user_123")

    zone = {
        "label": data.get("label", "custom"),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "radius_meters": data.get("radius_meters", 200),
        "zone_type": data.get("zone_type", "always_deliver")
    }

    if zone["lat"] is None or zone["lng"] is None:
        return {"status": "error", "message": "lat/lng required"}

    zones = _get_user_zones(user_id)
    zones.append(zone)

    print(f"[GEO] Added zone → {zone['label']} for {user_id}")

    return {
        "status": "created",
        "zone": zone
    }


@router.get("/{user_id}")
async def get_geo(user_id: str):
    zones = _get_user_zones(user_id)

    return {
        "profiles": zones
    }