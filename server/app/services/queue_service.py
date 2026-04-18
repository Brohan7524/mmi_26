import time

QUEUE_STORE = {}

TTL_MAP = {
    "otp": 300,
    "transactional": 3600,
    "alert": 1800,
    "social": 86400,
    "marketing": 43200
}


def _get_user_queue(user_id: str):
    if user_id not in QUEUE_STORE:
        QUEUE_STORE[user_id] = []
    return QUEUE_STORE[user_id]


async def enqueue(user_id: str, content: str, analysis: dict):
    queue = _get_user_queue(user_id)

    now = int(time.time())

    message = {
        "content": content,
        "priority": analysis.get("priority", "normal"),
        "category": analysis.get("category", "social"),
        "summary": analysis.get("summary", ""),
        "enqueued_at": now,
        "ttl": TTL_MAP.get(analysis.get("category", "social"), 86400)
    }

    queue.append(message)

    print(f"[QUEUE] Enqueued for {user_id} | priority={message['priority']} | total={len(queue)}")


async def get_queue(user_id: str):
    return _get_user_queue(user_id)


async def clear_queue(user_id: str):
    QUEUE_STORE[user_id] = []