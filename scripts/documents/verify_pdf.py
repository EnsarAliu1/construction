"""Read-only page geometry/text checks and PNG rendering of synthetic app outputs."""
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path("artifacts/document-tools").resolve()))
import pymupdf

root = Path("artifacts/documents")
results = []
for path in sorted(root.glob("deftesa-*.pdf")):
    doc = pymupdf.open(path)
    if path.name in ("deftesa-demo.pdf", "deftesa-pa-tvsh.pdf", "deftesa-vlera-te-medha.pdf"):
        assert len(doc) == 1, (path.name, "normal receipt should fit one A4 page", len(doc))
    else:
        assert len(doc) > 1
    for index, page in enumerate(doc):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        text = page.get_text()
        assert "FATURË TATIMORE" not in text
        assert f"{index + 1} / {len(doc)}" in text
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                for span in line["spans"]:
                    x0, y0, x1, y1 = span["bbox"]
                    assert x0 >= 35 and x1 <= 561 and y0 >= 24 and y1 <= 821, (path.name, index, span["text"], span["bbox"])
        if index in {0, len(doc) - 1}:
            page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(root / f"{path.stem}-{index + 1}.png")
    full_text = "\n".join(page.get_text() for page in doc)
    assert "TOTALI I PRANUAR" in full_text
    if path.name == "deftesa-demo.pdf":
        assert "1 234.56 EUR" in full_text and "1 046.24 EUR" in full_text and "188.32 EUR" in full_text
    if path.name == "deftesa-pa-tvsh.pdf":
        assert "TVSH 18%" not in full_text
    results.append({"file": path.name, "pages": len(doc), "a4": True, "text_within_margins": True})
(root / "pdf-verification.json").write_text(json.dumps(results, indent=2), encoding="utf-8")
print(json.dumps(results))
