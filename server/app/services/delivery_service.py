from app.core.redis import r
import json
import time

DIGEST_THRESHOLD = 3

PRIORITY_ORDER = {
    "critical": 4,
    "high": 3,
    "normal": 2,
    "low": 1
}


def _build_digest(messages):
    categories = {}

    for m in messages:
        cat = m.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1

    parts = [f"{v} {k}" for k, v in categories.items()]
    summary = ", ".join(parts)

    return {
        "content": f"You have {len(messages)} new notifications: {summary}",
        "priority": "high",
        "category": "digest",
        "summary": "Batch notification summary",
        "is_digest": True
    }


async def flush(user_id: str, zone_type: str) -> list:
    raw_messages = await r.zrange(f"queue:{user_id}", 0, -1)

    parsed = []
    expired = []
    now = int(time.time())

    for raw in raw_messages:
        try:
            m = json.loads(raw)
            enqueued_at = m.get("enqueued_at", now)
            ttl = m.get("ttl", 86400)

            if now - enqueued_at > ttl:
                expired.append(raw)
            else:
                parsed.append((raw, m))
        except Exception:
            expired.append(raw)

    # Remove expired
    for raw in expired:
        await r.zrem(f"queue:{user_id}", raw)

    if expired:
        print(f"[DELIVERY] Expired {len(expired)} message(s)")

    # Filter based on zone
    to_deliver = []
    to_keep = []

    for raw, m in parsed:
        if zone_type == "critical_only" and m.get("priority") != "critical":
            to_keep.append(raw)
        else:
            to_deliver.append((raw, m))

    # Remove delivered from queue
    for raw, _ in to_deliver:
        await r.zrem(f"queue:{user_id}", raw)

    delivered = [m for _, m in to_deliver]

    if len(delivered) > DIGEST_THRESHOLD:
        # sort by priority
        delivered.sort(key=lambda x: PRIORITY_ORDER.get(x["priority"], 1), reverse=True)

        top_messages = delivered[:2]
        remaining = delivered[2:]

        digest = _build_digest(remaining)

        final_output = top_messages + [digest]

        print(f"[DELIVERY] Digest created for {len(delivered)} messages")

        return final_output

    print(f"[DELIVERY] Delivered {len(delivered)} message(s)")
    return delivered