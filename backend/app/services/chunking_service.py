import re
import hashlib
import unicodedata
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from app.core.config import settings

@dataclass
class DocumentChunk:
    chunk_index: int
    content: str
    content_hash: str
    start_char: int
    end_char: int
    token_count: int
    source_metadata: Dict[str, Any] = field(default_factory=dict)

class ChunkingService:
    """Intelligent document chunking engine with configurable chunk size and overlap.
    
    Preserves paragraph and sentence boundaries, attaches source metadata (pages, headings),
    and calculates character offsets and SHA-256 hashes for deduplication.
    """

    def __init__(
        self,
        default_chunk_size: Optional[int] = None,
        default_chunk_overlap: Optional[int] = None,
    ):
        self.chunk_size = default_chunk_size or getattr(settings, "CHUNK_SIZE", 800)
        self.chunk_overlap = default_chunk_overlap or getattr(settings, "CHUNK_OVERLAP", 120)

    @staticmethod
    def estimate_token_count(text: str) -> int:
        """Estimate token count based on standard ~4 characters per token heuristic."""
        if not text:
            return 0
        return max(1, len(text) // 4)

    @staticmethod
    def normalize_text(text: str) -> str:
        """Normalize unicode, whitespace, and line breaks while preserving paragraph boundaries."""
        if not text:
            return ""

        # Normalize Unicode to NFKC
        normalized = unicodedata.normalize("NFKC", text)

        # Standardize carriage returns to newlines
        normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")

        # Strip trailing whitespace on each line
        lines = [line.rstrip() for line in normalized.split("\n")]
        normalized = "\n".join(lines)

        # Collapse more than two consecutive newlines into two (paragraph break)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)

        # Strip leading/trailing document whitespace
        return normalized.strip()

    def chunk_text(
        self,
        text: str,
        source_type: str = "NOTE",
        metadata: Optional[Dict[str, Any]] = None,
        chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
    ) -> List[DocumentChunk]:
        """Split normalized text into overlapping chunks, respecting paragraphs and sentences.
        
        Args:
            text: Raw input text from note, PDF, DOCX, TXT, MD, or web link.
            source_type: Type identifier (NOTE, DOCUMENT, LINK, PDF, DOCX, etc.).
            metadata: Optional base metadata dict (url, file_name, etc.).
            chunk_size: Max token limit per chunk (overrides default).
            chunk_overlap: Token overlap between consecutive chunks (overrides default).
            
        Returns:
            List of DocumentChunk instances with offsets, index, and hashes.
        """
        clean_text = self.normalize_text(text)
        if not clean_text:
            return []

        target_chunk_tokens = chunk_size or self.chunk_size
        target_overlap_tokens = chunk_overlap or self.chunk_overlap
        
        # Approximate character thresholds (~4 chars per token)
        target_chunk_chars = target_chunk_tokens * 4
        target_overlap_chars = target_overlap_tokens * 4

        # If total text fits comfortably within one chunk, return immediately
        if len(clean_text) <= target_chunk_chars:
            content_hash = hashlib.sha256(clean_text.encode("utf-8")).hexdigest()
            chunk_meta = dict(metadata or {})
            chunk_meta["source_type"] = source_type
            page_match = re.search(r"--- Page (\d+) ---", clean_text)
            if page_match:
                chunk_meta["page_number"] = int(page_match.group(1))

            header_match = re.search(r"^(#{1,4}\s+.+)$", clean_text, re.MULTILINE)
            if header_match:
                chunk_meta["heading"] = header_match.group(1).lstrip("#").strip()

            table_match = re.search(r"\[Table (\d+)\]", clean_text)
            if table_match:
                chunk_meta["table_index"] = int(table_match.group(1))

            return [
                DocumentChunk(
                    chunk_index=0,
                    content=clean_text,
                    content_hash=content_hash,
                    start_char=0,
                    end_char=len(clean_text),
                    token_count=self.estimate_token_count(clean_text),
                    source_metadata=chunk_meta,
                )
            ]

        # Break text into atomic segments (paragraphs, headings, or long-paragraph subdivisions)
        segments = self._split_into_atomic_segments(clean_text, max_segment_chars=target_chunk_chars)

        chunks: List[DocumentChunk] = []
        current_segment_indices: List[int] = []
        current_chars = 0
        chunk_idx = 0

        i = 0
        while i < len(segments):
            seg_text, seg_start, seg_end = segments[i]
            seg_len = len(seg_text)

            # If adding this segment exceeds target_chunk_chars and we already have content:
            if current_segment_indices and (current_chars + seg_len > target_chunk_chars):
                # Finalize the current chunk
                chunk_obj = self._build_chunk(
                    clean_text=clean_text,
                    segments=segments,
                    selected_indices=current_segment_indices,
                    chunk_index=chunk_idx,
                    source_type=source_type,
                    base_metadata=metadata,
                )
                chunks.append(chunk_obj)
                chunk_idx += 1

                # Step backwards to implement overlap
                overlap_chars = 0
                step_back_count = 0
                for idx in reversed(current_segment_indices):
                    overlap_chars += len(segments[idx][0])
                    step_back_count += 1
                    if overlap_chars >= target_overlap_chars:
                        break

                # Advance start of next chunk, ensuring forward progress
                if step_back_count >= len(current_segment_indices):
                    # Step back at most all-but-one segment to avoid infinite loop
                    step_back_count = max(1, len(current_segment_indices) - 1)

                start_next_idx = i - step_back_count
                if start_next_idx <= current_segment_indices[0]:
                    start_next_idx = current_segment_indices[0] + 1

                i = start_next_idx
                current_segment_indices = []
                current_chars = 0
                continue

            current_segment_indices.append(i)
            current_chars += seg_len
            i += 1

        # Emit any trailing segment(s)
        if current_segment_indices:
            chunk_obj = self._build_chunk(
                clean_text=clean_text,
                segments=segments,
                selected_indices=current_segment_indices,
                chunk_index=chunk_idx,
                source_type=source_type,
                base_metadata=metadata,
            )
            # Avoid emitting a duplicate trailing chunk
            if not chunks or chunks[-1].content_hash != chunk_obj.content_hash:
                chunks.append(chunk_obj)

        return chunks

    def _split_into_atomic_segments(self, text: str, max_segment_chars: int) -> List[Tuple[str, int, int]]:
        """Split text into manageable units (paragraphs, list items, or sentences)."""
        raw_paragraphs = re.split(r"(\n\n+)", text)
        segments: List[Tuple[str, int, int]] = []
        cursor = 0

        for part in raw_paragraphs:
            if not part:
                continue

            part_len = len(part)
            start_pos = cursor
            end_pos = cursor + part_len
            cursor = end_pos

            # If segment is purely paragraph spacing, skip standalone token
            if part.strip() == "":
                continue

            # If the paragraph is smaller than maximum segment threshold, keep intact
            if part_len <= max_segment_chars:
                segments.append((part, start_pos, end_pos))
            else:
                # Subdivide oversized paragraph by sentences
                sentence_segments = self._split_sentences(part, start_pos, max_segment_chars)
                segments.extend(sentence_segments)

        return segments

    def _split_sentences(self, paragraph: str, base_offset: int, max_chars: int) -> List[Tuple[str, int, int]]:
        """Split a long paragraph into sentence-level atomic units."""
        # Split on sentence ending punctuation followed by space
        sentence_matches = list(re.finditer(r"(?<=[.!?])\s+", paragraph))
        if not sentence_matches:
            # Fallback: split by words if no sentence punctuation
            return self._split_words(paragraph, base_offset, max_chars)

        sub_segments: List[Tuple[str, int, int]] = []
        last_end = 0

        for match in sentence_matches:
            split_point = match.start() + 1
            s_text = paragraph[last_end:split_point].strip()
            if s_text:
                s_start = base_offset + last_end
                s_end = base_offset + split_point
                if len(s_text) > max_chars:
                    sub_segments.extend(self._split_words(s_text, s_start, max_chars))
                else:
                    sub_segments.append((s_text, s_start, s_end))
            last_end = match.end()

        # Remainder
        if last_end < len(paragraph):
            rem_text = paragraph[last_end:].strip()
            if rem_text:
                rem_start = base_offset + last_end
                rem_end = base_offset + len(paragraph)
                if len(rem_text) > max_chars:
                    sub_segments.extend(self._split_words(rem_text, rem_start, max_chars))
                else:
                    sub_segments.append((rem_text, rem_start, rem_end))

        return sub_segments

    def _split_words(self, text: str, base_offset: int, max_chars: int) -> List[Tuple[str, int, int]]:
        """Fallback splitter for unbroken text without sentence punctuation."""
        words = text.split(" ")
        sub_segments: List[Tuple[str, int, int]] = []
        curr_words: List[str] = []
        curr_len = 0
        seg_start = base_offset

        for w in words:
            if curr_words and (curr_len + len(w) + 1 > max_chars):
                seg_text = " ".join(curr_words)
                sub_segments.append((seg_text, seg_start, seg_start + len(seg_text)))
                seg_start += len(seg_text) + 1
                curr_words = [w]
                curr_len = len(w)
            else:
                curr_words.append(w)
                curr_len += len(w) + 1

        if curr_words:
            seg_text = " ".join(curr_words)
            sub_segments.append((seg_text, seg_start, seg_start + len(seg_text)))

        return sub_segments

    def _build_chunk(
        self,
        clean_text: str,
        segments: List[Tuple[str, int, int]],
        selected_indices: List[int],
        chunk_index: int,
        source_type: str,
        base_metadata: Optional[Dict[str, Any]],
    ) -> DocumentChunk:
        """Assemble chunk text, character offsets, hash, and source metadata."""
        first_seg = segments[selected_indices[0]]
        last_seg = segments[selected_indices[-1]]

        start_char = first_seg[1]
        end_char = last_seg[2]

        chunk_text = clean_text[start_char:end_char].strip()
        content_hash = hashlib.sha256(chunk_text.encode("utf-8")).hexdigest()

        # Extract contextual metadata
        chunk_meta = dict(base_metadata or {})
        chunk_meta["source_type"] = source_type
        chunk_meta["chunk_index"] = chunk_index

        # Page detection from PDF markers
        page_match = re.search(r"--- Page (\d+) ---", chunk_text)
        if page_match:
            chunk_meta["page_number"] = int(page_match.group(1))

        # Markdown header detection
        header_match = re.search(r"^(#{1,4}\s+.+)$", chunk_text, re.MULTILINE)
        if header_match:
            chunk_meta["heading"] = header_match.group(1).lstrip("#").strip()

        # Table detection
        table_match = re.search(r"\[Table (\d+)\]", chunk_text)
        if table_match:
            chunk_meta["table_index"] = int(table_match.group(1))

        return DocumentChunk(
            chunk_index=chunk_index,
            content=chunk_text,
            content_hash=content_hash,
            start_char=start_char,
            end_char=end_char,
            token_count=self.estimate_token_count(chunk_text),
            source_metadata=chunk_meta,
        )

chunking_service = ChunkingService()
