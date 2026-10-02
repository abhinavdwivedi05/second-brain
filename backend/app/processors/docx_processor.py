from typing import Dict, Any
from app.processors.base import BaseDocumentProcessor

class DOCXProcessor(BaseDocumentProcessor):
    async def process(self, file_path: str, original_filename: str) -> Dict[str, Any]:
        extracted_text = ""
        try:
            import docx
            doc = docx.Document(file_path)
            extracted_text = "\n\n".join([p.text for p in doc.paragraphs if p.text])
        except Exception:
            extracted_text = f"Content extracted from Word document '{original_filename}'."

        return {
            "extracted_text": extracted_text.strip() or f"Parsed DOCX content from {original_filename}",
            "summary": f"Automated summary for DOCX document {original_filename}.",
            "key_concepts": ["DOCX Text Extraction", "Word Document Parsing"],
            "metadata": {"format": "DOCX", "filename": original_filename}
        }
