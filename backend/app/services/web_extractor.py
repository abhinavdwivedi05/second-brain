import ipaddress
import re
import socket
from typing import Dict, List, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse
import httpx
from bs4 import BeautifulSoup, Comment

from app.services.ai_service import ai_service


class WebExtractionError(Exception):
    """Base exception for web extraction errors."""
    pass


class SSRFSecurityError(WebExtractionError):
    """Raised when a URL attempts to target a prohibited, private, or local network."""
    pass


class WebDownloadError(WebExtractionError):
    """Raised when fetching a remote webpage fails or returns an error."""
    pass


# Disallowed hosts and keywords for SSRF protection
BLOCKED_HOSTNAMES: Set[str] = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "[::1]",
    "metadata.google.internal",
    "169.254.169.254",
    "instance-data",
}

BLOCKED_SUFFIXES: Tuple[str, ...] = (
    ".local",
    ".internal",
    ".localhost",
    ".lan",
    ".home.arpa",
)

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SecondBrain/2.0"
)


def validate_target_url(url: str) -> str:
    """Validate a target URL and enforce strict SSRF protections.
    
    Ensures:
    1. Scheme is strictly HTTP or HTTPS.
    2. Hostname is present and not a blacklisted private/internal name.
    3. Resolved IP addresses are public (no loopback, private, link-local, multicast, or reserved ranges).
    """
    clean_url = (url or "").strip()
    if not clean_url:
        raise SSRFSecurityError("URL cannot be empty.")

    try:
        parsed = urlparse(clean_url)
    except Exception as exc:
        raise SSRFSecurityError(f"Malformed URL: {str(exc)}")

    # 1. Enforce HTTP/HTTPS only
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise SSRFSecurityError(
            f"Unsupported URL scheme '{scheme}'. Only HTTP and HTTPS URLs are permitted."
        )

    hostname = (parsed.hostname or "").lower()
    if not hostname:
        raise SSRFSecurityError("URL must contain a valid domain or hostname.")

    # 2. Check blocked hostnames and suffixes
    if hostname in BLOCKED_HOSTNAMES:
        raise SSRFSecurityError(
            f"Prohibited destination '{hostname}'. Access to localhost or internal network services is blocked."
        )

    for suffix in BLOCKED_SUFFIXES:
        if hostname.endswith(suffix):
            raise SSRFSecurityError(
                f"Prohibited destination '{hostname}'. Access to internal/local domain suffixes is blocked."
            )

    # 3. Determine port
    port = parsed.port or (443 if scheme == "https" else 80)

    # 4. Resolve DNS and validate every returned IP
    try:
        addr_info = socket.getaddrinfo(hostname, port, family=socket.AF_UNSPEC, type=socket.SOCK_STREAM)
    except socket.gaierror as dns_err:
        raise WebDownloadError(f"Could not resolve host '{hostname}': {dns_err.strerror or 'DNS lookup failed'}")
    except Exception as exc:
        raise WebDownloadError(f"DNS resolution failed for '{hostname}': {str(exc)}")

    if not addr_info:
        raise WebDownloadError(f"No IP addresses resolved for '{hostname}'.")

    for entry in addr_info:
        ip_str = entry[4][0]
        try:
            ip = ipaddress.ip_address(ip_str)
        except ValueError:
            raise SSRFSecurityError(f"Invalid resolved IP address: '{ip_str}'")

        if (
            ip.is_loopback
            or ip.is_private
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise SSRFSecurityError(
                f"Access prohibited: Hostname '{hostname}' resolves to private/internal IP '{ip_str}'."
            )

        # Cloud metadata address check
        if str(ip) == "169.254.169.254":
            raise SSRFSecurityError("Access to cloud metadata endpoints is strictly forbidden.")

    # Reconstruct normalized URL without fragment
    normalized = f"{scheme}://{parsed.netloc}{parsed.path or '/'}"
    if parsed.query:
        normalized += f"?{parsed.query}"
    return normalized


async def fetch_webpage(
    url: str,
    max_size_bytes: int = 5 * 1024 * 1024, # 5MB limit
    timeout_seconds: float = 15.0,
    max_redirects: int = 5,
) -> Tuple[str, str, str]:
    """Fetch webpage HTML safely over HTTP/HTTPS with redirect SSRF validation.
    
    Returns:
        tuple[html_content, final_url, content_type]
    """
    current_url = validate_target_url(url)
    redirects_followed = 0

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
    }

    timeout = httpx.Timeout(connect=10.0, read=timeout_seconds, write=10.0, pool=10.0)

    async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
        while True:
            try:
                response = await client.get(current_url, headers=headers)
            except httpx.TimeoutException:
                raise WebDownloadError(f"Connection to '{current_url}' timed out after {timeout_seconds} seconds.")
            except httpx.RequestError as req_err:
                raise WebDownloadError(f"Network error accessing '{current_url}': {str(req_err)}")

            # Handle redirects safely by revalidating target URL
            if response.status_code in (301, 302, 303, 307, 308):
                location = response.headers.get("Location")
                if not location:
                    raise WebDownloadError(f"Received redirect status {response.status_code} without Location header.")

                redirects_followed += 1
                if redirects_followed > max_redirects:
                    raise WebDownloadError(f"Exceeded maximum redirect limit ({max_redirects}).")

                next_url = urljoin(current_url, location)
                # Revalidate new URL against SSRF filters
                current_url = validate_target_url(next_url)
                continue

            # Non-redirect responses
            if response.status_code == 404:
                raise WebDownloadError("Webpage not found (HTTP 404). Please verify the URL.")
            elif response.status_code in (401, 403):
                raise WebDownloadError(
                    f"Access denied to webpage (HTTP {response.status_code}). Site may require authentication or paywall."
                )
            elif response.status_code >= 500:
                raise WebDownloadError(f"Target website returned server error (HTTP {response.status_code}).")
            elif response.status_code != 200:
                raise WebDownloadError(f"Failed to fetch webpage (HTTP {response.status_code}).")

            # Check content-type header
            content_type = response.headers.get("Content-Type", "").lower()
            if not any(t in content_type for t in ("text/html", "application/xhtml+xml", "text/plain")):
                raise WebDownloadError(
                    f"Unsupported content type '{content_type}'. Web Clipper extracts HTML web pages."
                )

            # Check content length
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) > max_size_bytes:
                raise WebDownloadError(
                    f"Webpage response exceeds maximum allowed size ({max_size_bytes // (1024 * 1024)}MB)."
                )

            raw_bytes = response.content
            if len(raw_bytes) > max_size_bytes:
                raw_bytes = raw_bytes[:max_size_bytes]

            # Decode safely
            encoding = response.encoding or "utf-8"
            try:
                html_text = raw_bytes.decode(encoding, errors="replace")
            except Exception:
                html_text = raw_bytes.decode("utf-8", errors="replace")

            return html_text, str(response.url or current_url), content_type


def parse_webpage_content(html: str, source_url: str) -> Dict:
    """Parse HTML using BeautifulSoup, stripping noise and extracting structured article content.
    
    Extracts:
    - title
    - meta description
    - canonical URL
    - domain
    - clean readable text / markdown content
    - word count
    - reading time
    """
    if not html or not html.strip():
        return {
            "title": "Untitled Web Page",
            "source_url": source_url,
            "canonical_url": source_url,
            "domain": urlparse(source_url).netloc,
            "description": "",
            "extracted_content": "No content found on the requested webpage.",
            "word_count": 0,
            "reading_time_minutes": 1,
            "extraction_status": "FAILED",
        }

    try:
        soup = BeautifulSoup(html, "lxml")
    except Exception:
        soup = BeautifulSoup(html, "html.parser")

    # 1. Extract Title
    title = ""
    og_title = soup.find("meta", property="og:title")
    tw_title = soup.find("meta", attrs={"name": "twitter:title"})
    title_tag = soup.find("title")
    h1_tag = soup.find("h1")

    if og_title and og_title.get("content"):
        title = og_title["content"].strip()
    elif tw_title and tw_title.get("content"):
        title = tw_title["content"].strip()
    elif title_tag and title_tag.string:
        title = title_tag.string.strip()
    elif h1_tag and h1_tag.get_text():
        title = h1_tag.get_text().strip()

    if not title:
        parsed_url = urlparse(source_url)
        path_name = parsed_url.path.strip("/").split("/")[-1]
        title = path_name.replace("-", " ").replace("_", " ").title() if path_name else parsed_url.netloc

    # Clean title separator tails (e.g., "Post Title | Website Name" -> "Post Title")
    if " | " in title:
        title = title.split(" | ")[0].strip()
    elif " - " in title and len(title.split(" - ")[0].strip()) > 10:
        title = title.split(" - ")[0].strip()

    # 2. Extract Description
    description = ""
    meta_desc = soup.find("meta", attrs={"name": "description"})
    og_desc = soup.find("meta", property="og:description")
    tw_desc = soup.find("meta", attrs={"name": "twitter:description"})

    if meta_desc and meta_desc.get("content"):
        description = meta_desc["content"].strip()
    elif og_desc and og_desc.get("content"):
        description = og_desc["content"].strip()
    elif tw_desc and tw_desc.get("content"):
        description = tw_desc["content"].strip()

    # 3. Extract Canonical URL
    canonical_url = source_url
    canonical_tag = soup.find("link", rel="canonical")
    if canonical_tag and canonical_tag.get("href"):
        canonical_url = urljoin(source_url, canonical_tag["href"].strip())
    else:
        og_url = soup.find("meta", property="og:url")
        if og_url and og_url.get("content"):
            canonical_url = urljoin(source_url, og_url["content"].strip())

    domain = urlparse(canonical_url or source_url).netloc

    # 4. Remove Irrelevant / Noisy DOM Elements
    disallowed_tags = [
        "script", "style", "noscript", "nav", "header", "footer", "aside",
        "form", "svg", "canvas", "iframe", "object", "embed", "dialog",
        "menu", "button", "input", "textarea", "select", "option", "applet"
    ]
    for tag in soup(disallowed_tags):
        tag.decompose()

    # Remove HTML comments
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # Remove ad / cookie / sidebar / popup / nav containers
    ad_pattern = re.compile(
        r"(banner|cookie|advert|sidebar|popup|modal|newsletter|social-share|disqus|comment|sponsor|navheader|navfooter|breadcrumb|pagination)",
        re.I
    )
    for element in soup.find_all(attrs={"class": ad_pattern}):
        # Do not decompose if class also includes content or article
        cls_list = element.get("class") or []
        cls_str = " ".join(cls_list) if isinstance(cls_list, list) else str(cls_list)
        if not re.search(r"(article|content|post|main)", cls_str, re.I):
            element.decompose()

    for element in soup.find_all(attrs={"id": ad_pattern}):
        id_str = str(element.get("id") or "")
        if not re.search(r"(article|content|post|main)", id_str, re.I):
            element.decompose()

    # 5. Extract Main Article Body
    article_container = (
        soup.find("article")
        or soup.find("main")
        or soup.find("div", attrs={"role": "main"})
        or soup.find(class_=re.compile(r"(article-content|post-content|entry-content|main-content|article-body)", re.I))
        or soup.find(id=re.compile(r"(article-content|post-content|entry-content|main-content)", re.I))
        or soup.find("body")
    )

    if not article_container:
        article_container = soup

    # Structured Markdown Extraction from DOM nodes
    content_lines: List[str] = []
    seen_paragraphs: Set[str] = set()

    for node in article_container.find_all(["h1", "h2", "h3", "h4", "p", "li", "pre", "blockquote"]):
        tag_name = node.name.lower()
        text = node.get_text(separator=" ", strip=True)
        if not text or len(text) < 3:
            continue

        # Deduplicate identical consecutive paragraphs
        text_lower = text.lower()
        if text_lower in seen_paragraphs:
            continue
        seen_paragraphs.add(text_lower)

        if tag_name == "h1":
            content_lines.append(f"\n# {text}\n")
        elif tag_name == "h2":
            content_lines.append(f"\n## {text}\n")
        elif tag_name == "h3":
            content_lines.append(f"\n### {text}\n")
        elif tag_name == "h4":
            content_lines.append(f"\n#### {text}\n")
        elif tag_name == "li":
            content_lines.append(f"- {text}")
        elif tag_name == "blockquote":
            content_lines.append(f"> {text}\n")
        elif tag_name == "pre":
            content_lines.append(f"```\n{text}\n```\n")
        else: # 'p'
            content_lines.append(f"{text}\n")

    extracted_content = "\n".join(content_lines).strip()

    # Fallback to general text if no paragraphs could be structured
    if len(extracted_content) < 50:
        extracted_content = article_container.get_text(separator="\n", strip=True)

    # Normalize excessive newlines
    extracted_content = re.sub(r"\n{3,}", "\n\n", extracted_content).strip()

    # If still empty, use description or title
    if not extracted_content:
        extracted_content = description or f"Web link bookmark for {title} ({source_url})."

    word_count = len(extracted_content.split())
    reading_time = max(1, round(word_count / 200))

    return {
        "title": title,
        "source_url": source_url,
        "canonical_url": canonical_url,
        "domain": domain,
        "description": description,
        "extracted_content": extracted_content,
        "word_count": word_count,
        "reading_time_minutes": reading_time,
        "extraction_status": "SUCCESS" if word_count > 20 else "PARTIAL",
    }


class WebExtractorService:
    """Service orchestrating SSRF validation, webpage retrieval, parsing, and AI enrichment."""

    async def extract_webpage(self, url: str) -> Dict:
        """Fetch and extract structured content from a public webpage."""
        html, final_url, _ = await fetch_webpage(url)
        return parse_webpage_content(html, final_url)

    async def analyze_and_enrich(
        self,
        url: str,
        existing_user_tags: Optional[List[str]] = None,
    ) -> Dict:
        """Extract webpage, generate concise summary, extract concepts, and suggest tags.
        
        Uses existing AI service with automatic fallback to local NLP when Gemini is offline.
        """
        extracted = await self.extract_webpage(url)
        content = extracted["extracted_content"]
        title = extracted["title"]

        # 1. Summary Generation (uses existing AIService with automatic local NLP fallback)
        try:
            summary = await ai_service.summarize(content=content, title=title)
        except Exception:
            from app.ai.mock_provider import MockAIProvider
            summary = await MockAIProvider().summarize(content, title)

        # 2. Key Concepts Extraction
        try:
            concepts = await ai_service.extract_concepts(content=content)
        except Exception:
            from app.ai.mock_provider import MockAIProvider
            concepts = await MockAIProvider().extract_concepts(content)

        # 3. Tag Suggestion
        try:
            suggested_tags = await ai_service.suggest_tags(content=content, title=title)
        except Exception:
            from app.ai.mock_provider import MockAIProvider
            suggested_tags = await MockAIProvider().suggest_tags(content, title)

        # Always include web/domain tag
        domain_tag = extracted["domain"].replace("www.", "").split(".")[0].lower()
        if domain_tag and len(domain_tag) > 2 and domain_tag not in suggested_tags:
            suggested_tags.append(domain_tag)

        # Reconcile with existing user tags
        reconciled_tags: List[str] = []
        user_tag_map = {t.lower(): t for t in (existing_user_tags or [])}

        for t in suggested_tags:
            clean_t = t.lower().strip().lstrip("#")
            if not clean_t:
                continue
            if clean_t in user_tag_map:
                reconciled_tags.append(user_tag_map[clean_t])
            else:
                reconciled_tags.append(clean_t)

        return {
            "title": title,
            "original_url": extracted["source_url"],
            "canonical_url": extracted["canonical_url"],
            "domain": extracted["domain"],
            "description": extracted["description"],
            "content": content,
            "summary": summary,
            "tags": list(dict.fromkeys(reconciled_tags))[:6],
            "key_concepts": concepts[:8],
            "word_count": extracted["word_count"],
            "extraction_status": extracted["extraction_status"],
        }


web_extractor = WebExtractorService()

