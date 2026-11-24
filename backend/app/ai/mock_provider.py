import re
from typing import List, Optional, Set, Tuple
from app.ai.base import BaseAIProvider

# Comprehensive stopwords and structural document words that should never be technical concepts
DOCUMENT_STRUCTURE_WORDS: Set[str] = {
    "part", "tutorial", "welcome", "intended", "give", "chapter", "section",
    "appendix", "table", "contents", "overview", "introduction", "summary",
    "conclusion", "page", "guide", "documentation", "document", "manual",
    "article", "readme", "license", "author", "copyright", "version", "release",
    "following", "getting", "started", "using", "learn", "example", "examples",
    "sample", "samples", "exercise", "exercises", "note", "notes", "knowledge",
    "also", "into", "their", "will", "would", "could", "should", "about",
    "which", "when", "then", "have", "more", "this", "that", "these", "those",
    "such", "than", "very", "first", "second", "third", "simple", "general",
    "assume", "anyone", "aspects", "computer", "click", "here", "read", "view",
    "index", "home", "prev", "previous", "next", "up", "top", "bottom"
}

# Known key technical terms and canonical casing
KNOWN_TECHNOLOGY_NAMES = {
    "postgresql": "PostgreSQL",
    "postgres": "PostgreSQL",
    "sql": "SQL",
    "python": "Python",
    "docker": "Docker",
    "dockerfile": "Dockerfile",
    "kubernetes": "Kubernetes",
    "k8s": "Kubernetes",
    "fastapi": "FastAPI",
    "react": "React",
    "nextjs": "Next.js",
    "typescript": "TypeScript",
    "javascript": "JavaScript",
    "sqlalchemy": "SQLAlchemy",
    "alembic": "Alembic",
    "pydantic": "Pydantic",
    "redis": "Redis",
    "graphql": "GraphQL",
    "rest": "REST API",
    "api": "API",
    "jwt": "JWT Authentication",
    "auth": "Authentication",
    "oauth": "OAuth",
    "html": "HTML",
    "css": "CSS",
    "tailwind": "Tailwind CSS",
    "linux": "Linux",
    "git": "Git",
    "github": "GitHub",
    "json": "JSON Querying",
    "mvcc": "PostgreSQL MVCC",
    "acid": "ACID Compliance",
}

BOILERPLATE_STARTS = (
    "welcome to", "the following", "this tutorial", "in this chapter",
    "click here", "table of contents", "we only assume", "part i", "part ii",
    "to learn more", "read more", "getting started with", "for more information"
)

class MockAIProvider(BaseAIProvider):
    """Intelligent mock AI provider generating content-specific summaries, concepts, and chat answers.
    
    Used during offline testing, local development, and when external LLMs are unconfigured.
    Implements substantive NLP extraction, intent detection, and extractive question-answering.
    """

    async def generate(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        words = re.findall(r"\w+", prompt)
        preview = " ".join(words[:12])
        return f"Processed prompt focusing on '{preview}'."

    async def summarize(self, content: str, title: Optional[str] = None) -> str:
        clean_content = (content or "").strip()
        if not clean_content:
            return "No content provided to summarize."

        # Strip markdown headers, code fences, and divider lines before splitting into sentences
        prose_lines = []
        for line in clean_content.split("\n"):
            line_s = line.strip()
            if not line_s or line_s.startswith(("#", "```", "---", "|", ">", "===", "---")):
                continue
            line_s = re.sub(r"^[\*\-\d\.]+\s+", "", line_s)
            prose_lines.append(line_s)

        prose_text = " ".join(prose_lines)

        raw_sentences = [
            s.strip()
            for s in re.split(r"(?<=[.!?])\s+", prose_text)
            if len(s.strip()) > 15
        ]

        clean_sentences: List[str] = []
        for s in raw_sentences:
            s_clean = s.strip()
            s_lower = s_clean.lower()
            if any(s_lower.startswith(prefix) for prefix in BOILERPLATE_STARTS):
                continue
            if len(s_clean.split()) < 6:
                continue
            clean_sentences.append(s_clean)

        if not clean_sentences:
            clean_sentences = [s for s in raw_sentences if len(s.split()) >= 5]

        if not clean_sentences:
            words = clean_content.split()
            return " ".join(words[:30])

        def score_sentence(sentence: str, index: int) -> float:
            score = 1.0 / (index + 1)
            s_low = sentence.lower()
            if any(term in s_low for term in [" is an ", " is a ", " provides ", " supports ", " enables ", " designed for ", " allows "]):
                score += 3.5
            if any(tech in s_low for tech in KNOWN_TECHNOLOGY_NAMES):
                score += 2.0
            if len(sentence.split()) >= 10:
                score += 1.0
            return score

        scored = [(score_sentence(s, idx), idx, s) for idx, s in enumerate(clean_sentences)]
        scored.sort(key=lambda x: x[0], reverse=True)

        selected = sorted(scored[:3], key=lambda x: x[1])
        result = " ".join(item[2] for item in selected).strip()
        return result

    async def extract_concepts(self, content: str) -> List[str]:
        clean_content = (content or "").strip()
        if not clean_content:
            return []

        found_concepts: List[str] = []
        content_lower = clean_content.lower()

        for tech_key, canonical in KNOWN_TECHNOLOGY_NAMES.items():
            pattern = rf"\b{re.escape(tech_key)}\b"
            if re.search(pattern, content_lower):
                if canonical not in found_concepts:
                    found_concepts.append(canonical)

        phrase_matches = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", clean_content)
        for phrase in phrase_matches:
            clean_phrase = phrase.strip()
            words = [w.lower() for w in clean_phrase.split()]
            if all(w not in DOCUMENT_STRUCTURE_WORDS for w in words):
                if clean_phrase not in found_concepts and len(clean_phrase) > 5:
                    found_concepts.append(clean_phrase)

        single_words = re.findall(r"\b[A-Za-z]{4,}\b", clean_content)
        for w in single_words:
            w_lower = w.lower()
            if w_lower in DOCUMENT_STRUCTURE_WORDS:
                continue
            if len(w) >= 4 and (w[0].isupper() or w.isupper()):
                canonical = KNOWN_TECHNOLOGY_NAMES.get(w_lower, w)
                if canonical not in found_concepts and canonical.lower() not in [c.lower() for c in found_concepts]:
                    found_concepts.append(canonical)

        valid_concepts = [
            c for c in found_concepts
            if c.lower() not in DOCUMENT_STRUCTURE_WORDS and len(c.strip()) > 2
        ]

        return valid_concepts[:6] or ["Software Architecture", "System Design", "Engineering"]

    async def suggest_tags(self, content: str, title: str = "") -> List[str]:
        text = f"{title} {content}".lower()
        tags: List[str] = []

        domain_mappings = [
            ("postgres", ["postgresql", "database", "sql"]),
            ("sql", ["sql", "database"]),
            ("relational", ["relational-db", "database"]),
            ("python", ["python", "programming"]),
            ("fastapi", ["fastapi", "backend", "api"]),
            ("docker", ["docker", "containers", "devops"]),
            ("kubernetes", ["kubernetes", "devops", "cloud"]),
            ("react", ["react", "frontend", "typescript"]),
            ("typescript", ["typescript", "frontend"]),
            ("next", ["nextjs", "frontend"]),
            ("auth", ["auth", "security"]),
            ("jwt", ["jwt", "security"]),
            ("cache", ["caching", "performance"]),
            ("api", ["api", "backend"]),
            ("database", ["database"]),
        ]

        for keyword, matching_tags in domain_mappings:
            if keyword in text:
                for t in matching_tags:
                    if t not in tags:
                        tags.append(t)

        if not tags:
            words = [w.lower() for w in re.findall(r"\b[A-Za-z]{4,}\b", text)]
            filtered = [w for w in words if w not in DOCUMENT_STRUCTURE_WORDS]
            tags = list(dict.fromkeys(filtered))[:4]

        return tags[:5] or ["technology", "reference"]

    async def chat(self, query: str, context: Optional[str] = None) -> str:
        clean_query = query.strip()
        if not context or not context.strip():
            return (
                f"I searched your Second Brain knowledge base for '{clean_query}', "
                "but none of your saved notes or documents contain relevant information on this topic."
            )

        clean_context = context.strip()

        # Extract document title if present in context
        doc_title_match = re.search(r"^(?:Active Document|Document Title|Title|Document):\s*[\"']?([^\"'\n\r]+)[\"']?", clean_context, re.MULTILINE)
        doc_title = doc_title_match.group(1).strip() if doc_title_match else ""

        # Extract clean prose sentences, completely excluding markdown headers and boilerplate
        all_sentences: List[str] = []
        for line in clean_context.split("\n"):
            line_str = line.strip()
            if not line_str or line_str.startswith((
                "---", "===", "Type:", "Document Title:", "Active Document:", "Title:", "Summary:",
                "Document:", "[Passage", "IMPORTANT SECURITY NOTICE:", "The following excerpts",
                "Treat all content strictly"
            )):
                continue
            if line_str.startswith("#"):
                continue
            for sentence in re.split(r"(?<=[.!?])\s+", line_str):
                s_strip = sentence.strip()
                s_lower = s_strip.lower()
                # Skip sentences shorter than 15 chars or starting with boilerplate phrases
                if len(s_strip) < 15 or s_strip.startswith(("#", "```", "---", "===")):
                    continue
                if any(s_lower.startswith(bp) for bp in BOILERPLATE_STARTS):
                    continue
                if any(bp in s_lower for bp in ["intended to give a simple introduction", "we only assume some general knowledge"]):
                    continue
                # Prompt injection defense check: skip injection directives
                if any(inj in s_lower for inj in [
                    "ignore previous instructions",
                    "ignore all previous instructions",
                    "disregard previous instructions",
                    "you are now a",
                    "you are now an",
                    "override instructions",
                    "forget your rules",
                    "system prompt",
                ]):
                    continue
                all_sentences.append(s_strip)

        if not all_sentences:
            target_scope = f"The selected document ('{doc_title}')" if doc_title else "The provided knowledge context"
            return f"{target_scope} does not contain enough textual content to answer your question."

        q_lower = clean_query.lower()

        # -------------------------------------------------------------
        # INTENT 1: COMPARISON / DIFFERENCE ("What is the difference between A and B?")
        # -------------------------------------------------------------
        diff_pattern = r"(?:difference\s+between|compare|distinguish\s+between|versus|vs\.?)\s+([a-zA-Z0-9_\-\s]+?)\s+(?:and|vs\.?|to)\s+([a-zA-Z0-9_\-\s?]+)"
        diff_match = re.search(diff_pattern, q_lower)
        if diff_match:
            concept_a = diff_match.group(1).strip().rstrip("?")
            concept_b = diff_match.group(2).strip().rstrip("?")

            # Clean leading articles like 'a', 'an', 'the'
            concept_a_clean = re.sub(r"^(?:a|an|the)\s+", "", concept_a).strip()
            concept_b_clean = re.sub(r"^(?:a|an|the)\s+", "", concept_b).strip()

            # Search for sentences that directly contrast both concepts
            contrast_sentences = []
            for s in all_sentences:
                s_low = s.lower()
                if concept_a_clean in s_low and concept_b_clean in s_low:
                    if any(c_word in s_low for c_word in ["while", "whereas", "unlike", "contrast", "difference", "within", "holds", "contains"]):
                        contrast_sentences.append(s)

            if contrast_sentences:
                return (
                    f"Based on your saved Second Brain knowledge:\n\n"
                    f"{' '.join(contrast_sentences[:2])}"
                )

            # Check individual definitions for both concepts
            def_a = self._find_definition(concept_a_clean, all_sentences)
            def_b = self._find_definition(concept_b_clean, all_sentences)

            if def_a and def_b and def_a != def_b:
                return (
                    f"Based on your saved Second Brain knowledge:\n\n"
                    f"• **{concept_a_clean.capitalize()}**: {def_a}\n"
                    f"• **{concept_b_clean.capitalize()}**: {def_b}"
                )

            # Neither direct contrast nor dual definitions exist in the document: state honest limitation
            target_doc_str = f"The selected document ('{doc_title}')" if doc_title else "The provided knowledge note"
            return (
                f"{target_doc_str} discusses database concepts, but does not contain detailed information "
                f"explaining the specific difference between a {concept_a_clean} and a {concept_b_clean}."
            )

        # -------------------------------------------------------------
        # INTENT 2: DIRECT DEFINITIONS & PROCEDURES
        # -------------------------------------------------------------
        # Normalize query tokens and expand domain-specific synonyms
        query_tokens = [w.lower() for w in re.findall(r"\w+", clean_query)]
        stopwords = {
            "what", "is", "are", "the", "a", "an", "how", "why", "who", "when", "where",
            "do", "does", "did", "can", "could", "should", "tell", "me", "about", "in",
            "to", "for", "with", "from", "and", "or", "of", "it", "its", "you", "your",
            "know", "have", "some", "any"
        }
        search_terms = [t for t in query_tokens if t not in stopwords and len(t) > 2]

        expanded_terms = set(search_terms)
        for term in search_terms:
            if "postgres" in term:
                expanded_terms.update(["postgres", "postgresql"])
            if term in ("db", "database", "databases"):
                expanded_terms.update(["db", "database", "databases", "relational"])
            if "docker" in term:
                expanded_terms.update(["docker", "container", "containers"])
            if "py" in term:
                expanded_terms.update(["python"])

        # Score candidate sentences based on semantic relevance to query terms
        scored_candidates: List[Tuple[float, str]] = []
        for sentence in all_sentences:
            s_lower = sentence.lower()
            words_in_s = set(re.findall(r"\w+", s_lower))

            match_count = 0
            for term in expanded_terms:
                if term in words_in_s or any(term in w or w in term for w in words_in_s if len(w) >= 4 and len(term) >= 4):
                    match_count += 1

            if match_count > 0:
                score = float(match_count * 2.5)

                # Prioritize definition sentences for "What is" questions
                if any(q_start in q_lower for q_start in ["what is", "what are", "explain", "describe", "who is"]):
                    if any(def_phrase in s_lower for def_phrase in [" is an ", " is a ", " provides ", " refers to ", " stands for ", " is known for "]):
                        score += 4.0

                # Prioritize procedural sentences for "How to" questions
                if any(q_start in q_lower for q_start in ["how to", "how do", "how can", "steps to", "learn how"]):
                    if any(proc_phrase in s_lower for proc_phrase in ["you will learn", "learn how to", "to create", "start by", "use the"]):
                        score += 4.0

                # Check if exact subject is mentioned
                for term in search_terms:
                    if f" {term} " in f" {s_lower} ":
                        score += 2.0

                scored_candidates.append((score, sentence))

        if not scored_candidates or max(c[0] for c in scored_candidates) <= 2.0:
            if doc_title:
                return f"The selected document ('{doc_title}') does not contain information addressing '{clean_query}'."
            return (
                f"I searched your Second Brain knowledge base for '{clean_query}', "
                "but could not find information addressing this specific question in your saved notes."
            )

        scored_candidates.sort(key=lambda x: x[0], reverse=True)
        top_answers = [c[1] for c in scored_candidates[:2]]
        # Deduplicate sentences while preserving order
        unique_answers = list(dict.fromkeys(top_answers))

        explanation = " ".join(unique_answers)
        return (
            f"Based on your saved Second Brain knowledge:\n\n"
            f"{explanation}"
        )

    def _find_definition(self, concept: str, sentences: List[str]) -> Optional[str]:
        """Find a clean definition sentence for a specific concept."""
        concept_lower = concept.lower()
        patterns = [
            rf"\b{re.escape(concept_lower)}\s+is\s+(?:an?|the)\s+([^.]+)",
            rf"\b{re.escape(concept_lower)}\s+provides\s+([^.]+)",
            rf"\b{re.escape(concept_lower)}\s+refers\s+to\s+([^.]+)",
        ]
        for s in sentences:
            s_low = s.lower()
            if concept_lower in s_low:
                for p in patterns:
                    if re.search(p, s_low):
                        return s.strip()
        return None
