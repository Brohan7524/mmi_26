import re

async def analyze_full(content: str):
    text = content.lower()

    # OTP detection
    if re.search(r"\botp\b", text) or re.search(r"\b\d{4,6}\b", text):
        return {
            "is_spam": False,
            "confidence": 0.01,
            "priority": "critical",
            "category": "otp",
            "summary": "OTP message",
            "should_bypass_deferral": True
        }

    # Payment / alert
    if any(word in text for word in ["debited", "credited", "payment", "transaction"]):
        return {
            "is_spam": False,
            "confidence": 0.05,
            "priority": "high",
            "category": "transactional",
            "summary": "Transaction alert",
            "should_bypass_deferral": True
        }

    # Spam / marketing
    if any(word in text for word in ["offer", "sale", "discount", "win", "free", "click"]):
        return {
            "is_spam": True,
            "confidence": 0.9,
            "priority": "low",
            "category": "marketing",
            "summary": "Promotional message",
            "should_bypass_deferral": False
        }

    # Social / default
    return {
        "is_spam": False,
        "confidence": 0.1,
        "priority": "normal",
        "category": "social",
        "summary": content[:50],
        "should_bypass_deferral": False
    }


async def check_spam(content: str):
    """Dummy spam check"""
    text = content.lower()
    
    # Simple heuristic
    if any(word in text for word in ["offer", "sale", "discount", "win", "free", "click"]):
        return {
            "is_spam": True,
            "confidence": 0.85,
            "reason": "Promotional keywords detected"
        }
    
    return {
        "is_spam": False,
        "confidence": 0.1,
        "reason": "No spam indicators"
    }


async def analyze(content: str):
    """Alias for analyze_full"""
    return await analyze_full(content)