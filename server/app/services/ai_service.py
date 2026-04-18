import re

def analyze_full(content: str) -> dict:
    text = content.lower()

    if re.search(r"\botp\b", text) or re.search(r"\b\d{4,6}\b", text):
        return {
            "is_spam": False,
            "confidence": 0.01,
            "priority": "critical",
            "category": "otp",
            "summary": "OTP verification code",
            "should_bypass_deferral": True
        }

    if any(w in text for w in ["debited", "credited", "payment", "transaction", "debit", "credit"]):
        return {
            "is_spam": False,
            "confidence": 0.05,
            "priority": "high",
            "category": "transactional",
            "summary": "Transaction or payment alert",
            "should_bypass_deferral": True
        }

    if any(w in text for w in ["server", "cpu", "breach", "security", "alert", "emergency", "login"]):
        return {
            "is_spam": False,
            "confidence": 0.05,
            "priority": "critical",
            "category": "alert",
            "summary": "System or security alert",
            "should_bypass_deferral": True
        }

    if any(w in text for w in ["offer", "sale", "discount", "win", "free", "click", "congratulations"]):
        return {
            "is_spam": True,
            "confidence": 0.9,
            "priority": "low",
            "category": "marketing",
            "summary": "Promotional message",
            "should_bypass_deferral": False
        }

    return {
        "is_spam": False,
        "confidence": 0.1,
        "priority": "normal",
        "category": "social",
        "summary": content[:60],
        "should_bypass_deferral": False
    }

async def analyze(content: str) -> dict:
    return analyze_full(content)


async def check_spam(content: str) -> dict:
    result = analyze_full(content)
    return {
        "is_spam": result["is_spam"],
        "confidence": result["confidence"],
        "reason": result["summary"]
    }