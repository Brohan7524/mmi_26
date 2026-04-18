from app.core.redis import r
import time
import json
from sqlalchemy import text
from app.core.db import engine

WEIGHTS = {"critical": 4, "high": 3, "normal": 2, "low": 1}

async def enqueue(user_id, content, analysis):
    score = WEIGHTS[analysis["priority"]] * 1_000_000_000 + int(time.time())

    message = json.dumps({
        "content": content,
        **analysis
    }, sort_keys=True)

    r.zadd(f"queue:{user_id}", {message: score})

    # ➜ Persist to DB
    async with engine.begin() as conn:
        await conn.execute(
            text("""
                INSERT INTO messages (id, user_id, content, priority, category)
                VALUES (gen_random_uuid(), :uid, :content, :priority, :category)
            """),
            {
                "uid": user_id,
                "content": content,
                "priority": analysis["priority"],
                "category": analysis["category"]
            }
        )