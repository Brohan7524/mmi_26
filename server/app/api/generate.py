from fastapi import APIRouter
import httpx
import json
import re
import random

router = APIRouter()

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL      = "mistral"

GENERATE_PROMPT = """Generate one realistic mobile push notification. Return ONLY a JSON object, no markdown, no explanation.

Format:
{"content": "the notification text", "sender": "app name"}

Vary the type: OTP codes, payment alerts, social media, marketing spam, server alerts, delivery updates, meeting reminders.
Keep content under 120 characters. Make it specific and realistic."""

FALLBACKS = [
    {"content": "Your OTP is 8247. Valid for 5 minutes. Do not share.", "sender": "bankapp"},
    {"content": "₹1,200 debited from A/C ending 9823. Ref: TXN20260418.", "sender": "hdfc"},
    {"content": "Server CPU at 94% — immediate attention needed.", "sender": "pagerduty"},
    {"content": "Arjun liked your post: 'Shipped the MVP!'", "sender": "twitter"},
    {"content": "FLASH SALE: 80% off everything! Today only. Claim now!", "sender": "promo"},
    {"content": "Your Swiggy order is out for delivery. 10 min away.", "sender": "swiggy"},
    {"content": "New login from Firefox on Mac in Bangalore.", "sender": "google"},
    {"content": "Standup in 15 minutes — Team Sync room.", "sender": "calendar"},
    {"content": "Package #IN2940 delivered at your door.", "sender": "delhivery"},
    {"content": "Meeting in 15 minutes", "sender": "calendar"},
    {"content": "Suspicious login detected from new device.", "sender": "security"},
    {"content": "Payment of ₹500 successful. Ref: UPI2026.", "sender": "gpay"},
]


@router.get("/")
async def generate():
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(OLLAMA_URL, json={
                "model": MODEL,
                "prompt": GENERATE_PROMPT,
                "stream": False,
                "options": {"temperature": 0.9, "num_predict": 100}
            })
            response.raise_for_status()
            raw = response.json().get("response", "").strip()

        raw = re.sub(r"^```json\s*|^```\s*|```$", "", raw, flags=re.MULTILINE).strip()
        match = re.search(r"\{.*?\}", raw, re.DOTALL)
        if match:
            result = json.loads(match.group(0))
            if "content" in result and len(result["content"]) > 5:
                return {"content": result["content"], "sender": result.get("sender", "system")}

    except Exception as e:
        print(f"[GENERATE] Ollama failed: {e} — using fallback")

    return random.choice(FALLBACKS)