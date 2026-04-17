from fastapi import APIRouter
from app.services import ai_service, queue_service

router = APIRouter()

@router.post("/")
async def notify(data: dict):
    recipient_id = data["recipient_id"]
    content = data["content"]

    spam = await ai_service.check_spam(content)

    if spam["is_spam"] and spam["confidence"] > 0.85:
        return {"status": "dropped_spam"}

    analysis = await ai_service.analyze(content)

    if analysis["should_bypass_deferral"]:
        return {"status": "sent_immediately"}

    await queue_service.enqueue(recipient_id, content, analysis)

    return {"status": "queued"}