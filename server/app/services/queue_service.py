from app.core.redis import r
import time
import json

WEIGHTS = {"critical": 4, "high": 3, "normal": 2, "low": 1}

async def enqueue(user_id, content, analysis):
    """Dummy enqueue - just stores in queue"""
    score = WEIGHTS[analysis["priority"]] * 1000 + int(time.time())

    message = json.dumps({
        "content": content,
        **analysis
    })

    r.zadd(f"queue:{user_id}", {message: score})
    return {"status": "queued", "user_id": user_id}