from fastapi import APIRouter
from app.services import geo_service, delivery_service

router = APIRouter()

@router.post("/")
async def beacon(data: dict):
    user_id = data.get("user_id", "unknown")
    lat = data.get("lat")
    lng = data.get("lng")
    connectivity_score = data.get("connectivity_score", 0)

    if lat is None or lng is None:
        return {"status": "invalid_location"}

    print(f"[BEACON] User {user_id} at ({lat}, {lng}) with connectivity {connectivity_score}")

    zone = await geo_service.match(user_id, lat, lng)
    print("Matched zone:", zone)

    can_deliver = (
        connectivity_score >= 2 and
        zone["type"] != "defer"
    )

    print("Can deliver:", can_deliver)

    delivered_messages = []

    if can_deliver:
        delivered_messages = await delivery_service.flush(user_id, zone["type"])

    return {
        "status": "processed",
        "zone": zone,
        "delivered": can_deliver,
        "messages": delivered_messages
    }