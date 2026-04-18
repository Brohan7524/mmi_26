from app.core.redis import r
import json

async def flush(user_id, zone_type):
    messages = r.zrange(f"queue:{user_id}", 0, -1)

    parsed = [json.loads(m) for m in messages]

    print("Flushing for:", user_id)
    print("Messages:", parsed)
    
    filtered = [
        m for m in parsed
        if zone_type != "critical_only" or m["priority"] == "critical"
    ]

    for msg in filtered:
        r.zrem(f"queue:{user_id}", json.dumps(msg, sort_keys=True))

    print("Delivering:", filtered)

    return filtered
