from app.core.redis import r
import json
import time

PRIORITY_WEIGHT = {
    "critical": 4,
    "high": 3,
    "normal": 2,
    "low": 1
}

TTL_MAP = {
    "otp": 300,
    "transactional": 3600,
    "alert": 1800,
    "social": 86400,
    "marketing": 43200
}


async def enqueue(user_id: str, content: str, analysis: dict):
    now = int(time.time())

    message = {
        "content": content,
        "priority": analysis["priority"],
        "category": analysis["category"],
        "summary": analysis["summary"],
        "enqueued_at": now,
        "ttl": TTL_MAP.get(analysis["category"], 86400)
    }

    score = PRIORITY_WEIGHT[analysis["priority"]] * 1000000000 + now

    await r.zadd(
        f"queue:{user_id}",
        {json.dumps(message): score}
    )

    print(f"[QUEUE] Enqueued message for {user_id} with priority {analysis['priority']}")