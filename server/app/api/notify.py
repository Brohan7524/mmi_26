from fastapi import APIRouter
from app.services import ai_service, queue_service

router = APIRouter()

@router.post("/")
async def notify(data: dict):
    recipient_id = data["recipient_id"]
    content = data["content"]

    analysis = await ai_service.analyze_full(content)

    # Drop spam
    if analysis["is_spam"] and analysis["confidence"] > 0.85:
        return {"status": "dropped_spam"}

    # Bypass queue for critical messages (OTP, alerts)
    if analysis["should_bypass_deferral"]:
        return {"status": "sent_immediately"}

    # Otherwise queue
    await queue_service.enqueue(recipient_id, content, analysis)

    return {"status": "queued"}