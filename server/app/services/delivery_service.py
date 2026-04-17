from app.core.redis import r
import json

async def flush(user_id, zone_type):
    messages = r.zrange(f"queue:{user_id}", 0, -1)

    parsed = [json.loads(m) for m in messages]

    filtered = [
        m for m in parsed
        if zone_type != "critical_only" or m["priority"] == "critical"
    ]

    print("Delivering:", filtered)

    r.delete(f"queue:{user_id}")