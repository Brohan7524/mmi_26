from fastapi import APIRouter
import random

router = APIRouter()

MESSAGES = [
    {"content": "Your OTP is 8247. Valid for 5 minutes.", "sender": "HDFCBank"},
    {"content": "₹1,200 debited from A/C ending 9823.", "sender": "HDFCBank"},
    {"content": "Server CPU at 94% — immediate attention needed.", "sender": "BisectHosting"},
    {"content": "Arjun liked your post: 'Shipped the MVP!'", "sender": "X.com"},
    {"content": "FLASH SALE: 30% off everything! Valid today only.", "sender": "zara_promo"},
    {"content": "Your order is out for delivery. 10 min away.", "sender": "Swiggy"},
    {"content": "New login detected from Chrome in Bangalore. Was this you?", "sender": "Google"},
    {"content": "Standup in 15 minutes — Team Sync.", "sender": "TheLaughStore"},
    {"content": "Package delivered at your doorstep.", "sender": "Delhivery"},
    {"content": "Meeting in 15 minutes", "sender": "Calendar"},
    {"content": "Suspicious login detected from new device.", "sender": "Security"},
    {"content": "Payment of ₹500 successful.", "sender": "GPay"},
]


@router.get("/")
async def generate():
    msg = random.choice(MESSAGES)

    print(f"[GENERATE] Generated: {msg['content']}")

    return msg