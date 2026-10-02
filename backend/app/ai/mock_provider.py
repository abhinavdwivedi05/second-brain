from typing import List, Optional
from app.ai.base import BaseAIProvider

class MockAIProvider(BaseAIProvider):
    async def summarize(self, content: str, title: Optional[str] = None) -> str:
        if not content or len(content.strip()) == 0:
            return "No content provided to summarize."
        
        words = content.split()
        if len(words) < 25:
            return f"Quick summary for '{title or 'Knowledge Note'}': {content.strip()}"
            
        return f"This document on '{title or 'Knowledge'}' focuses on core software architecture principles, performance patterns, system boundaries, and scalable design recommendations."

    async def extract_concepts(self, content: str) -> List[str]:
        return [
            "Architectural Abstraction & Boundaries",
            "Performance Optimization & Latency",
            "Security Best Practices & Safeguards",
            "Scalable Microservice Design",
            "Data Consistency & Cache Invalidation"
        ]

    async def suggest_tags(self, content: str, title: str) -> List[str]:
        text = (title + " " + content).lower()
        tags = []
        if "react" in text or "component" in text: tags.append("react")
        if "auth" in text or "jwt" in text or "security" in text: tags.append("security")
        if "backend" in text or "api" in text: tags.append("backend")
        if "docker" in text or "cloud" in text: tags.append("devops")
        if "python" in text or "fastapi" in text: tags.append("python")
        if not tags:
            tags = ["general", "notes"]
        return tags

    async def chat(self, query: str, context: Optional[str] = None) -> str:
        q = query.lower()
        if context:
            return f"Regarding your selected document:\n\nKey takeaways:\n• Focused architecture review\n• Scalable design patterns\n• Modular component structure\n\nQuery response to '{query}': The item provides comprehensive technical guidelines."

        if "jwt" in q or "auth" in q:
            return "In your Second Brain, you have notes on JWT Authentication & Token Security detailing short-lived access tokens, refresh token rotation, and HttpOnly cookies."
        if "react" in q or "rsc" in q:
            return "Your knowledge base contains React Server Components Architecture detailing zero-bundle-size components and streamable HTML rendering."

        return f"I searched your Second Brain knowledge base for '{query}'. Found relevant items across your collections. Would you like me to extract key concepts or generate a graph view?"
