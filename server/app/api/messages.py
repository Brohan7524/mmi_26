from fastapi import APIRouter
from sqlalchemy import text
from app.core.db import engine

router = APIRouter()

@router.get("/{user_id}")
async def get_messages(user_id: str):
    async with engine.connect() as conn:
        result = await conn.execute(
            text("""
                SELECT content, priority, category, created_at
                FROM messages
                WHERE user_id = :uid
                ORDER BY created_at DESC
            """),
            {"uid": user_id}
        )

        messages = result.mappings().all()

    return {"messages": messages}