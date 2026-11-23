import os
from pathlib import Path
from typing import Tuple, Optional
import pypdf
from pypdf.errors import PdfReadError
import docx
from docx.opc.exceptions import PackageNotFoundError

# Magic bytes
PDF_MAGIC = b"%PDF-"
DOCX_MAGIC = b"PK\x03\x04"

def validate_file_content(file_path: Path, original_filename: str) -> str:
    """Validate file extension and file signature (magic bytes).
    
    Returns 'pdf' or 'docx'.
    Raises ValueError with user-friendly error message if invalid.
    """
    ext = Path(original_filename).suffix.lower()
    
    if ext not in [".pdf", ".docx"]:
        raise ValueError(f"Unsupported file extension '{ext}'. Only .pdf and .docx files are accepted.")
    
    # Read the first 2048 bytes for signature validation
    try:
        with open(file_path, "rb") as f:
            header = f.read(2048)
    except Exception as e:
        raise ValueError(f"Unable to read uploaded file: {str(e)}")
        
    if not header:
        raise ValueError("Uploaded file is empty (0 bytes).")

    if ext == ".pdf":
        if not header.startswith(PDF_MAGIC):
            raise ValueError("File content does not match PDF format signature (%PDF-).")
        return "pdf"
        
    if ext == ".docx":
        if not header.startswith(DOCX_MAGIC):
            raise ValueError("File content does not match DOCX package signature (PK).")
        return "docx"

    raise ValueError(f"Unsupported document format: {ext}")

def extract_text_from_pdf(file_path: Path) -> str:
    """Extract text page-by-page from a PDF file using pypdf.
    
    Handles multi-page PDFs, encrypted PDFs, corrupted files,
    and detects scanned/empty documents where OCR would be required.
    """
    try:
        reader = pypdf.PdfReader(str(file_path))
    except PdfReadError as e:
        raise ValueError(f"Corrupted or invalid PDF file: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to open PDF document: {str(e)}")

    if reader.is_encrypted:
        try:
            # Try decrypting with empty password
            decrypt_status = reader.decrypt("")
            if decrypt_status == 0:
                return "[Encrypted PDF: Password protected. Text extraction failed because document is encrypted.]"
        except Exception:
            return "[Encrypted PDF: Password protected. Text extraction failed because document is encrypted.]"

    total_pages = len(reader.pages)
    if total_pages == 0:
        return "[Empty PDF: Document contains 0 pages.]"

    pages_text = []
    has_any_text = False

    for page_idx, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
            cleaned = text.strip()
            if cleaned:
                has_any_text = True
                if total_pages > 1:
                    pages_text.append(f"--- Page {page_idx + 1} ---\n{cleaned}")
                else:
                    pages_text.append(cleaned)
        except Exception as page_err:
            pages_text.append(f"--- Page {page_idx + 1} [Extraction error: {page_err}] ---")

    if not has_any_text:
        return (
            "[No extractable text found in this PDF document. "
            "This file appears to be a scanned image or bitmap PDF. "
            "OCR (Optical Character Recognition) is not supported in this version.]"
        )

    return "\n\n".join(pages_text)

def extract_text_from_docx(file_path: Path) -> str:
    """Extract paragraphs and tables from a Word (.docx) document using python-docx."""
    try:
        doc = docx.Document(str(file_path))
    except (PackageNotFoundError, KeyError) as e:
        raise ValueError(f"Corrupted or invalid DOCX archive: {str(e)}")
    except Exception as e:
        raise ValueError(f"Failed to open DOCX document: {str(e)}")

    sections = []

    # Extract paragraphs
    for p in doc.paragraphs:
        text = p.text.strip()
        if text:
            sections.append(text)

    # Extract tables
    for table_idx, table in enumerate(doc.tables):
        table_rows = []
        for row in table.rows:
            row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
            if any(row_cells):
                table_rows.append(" | ".join(row_cells))
        if table_rows:
            table_content = "\n".join(table_rows)
            sections.append(f"\n[Table {table_idx + 1}]\n{table_content}\n")

    full_text = "\n\n".join(sections).strip()

    if not full_text:
        return "[Empty Document: No readable paragraph or table text found in DOCX file.]"

    return full_text

def extract_document_text(file_path: Path, original_filename: str) -> str:
    """Validate content and extract text according to file format."""
    doc_type = validate_file_content(file_path, original_filename)
    if doc_type == "pdf":
        return extract_text_from_pdf(file_path)
    elif doc_type == "docx":
        return extract_text_from_docx(file_path)
    else:
        raise ValueError(f"Unsupported document type: {doc_type}")

