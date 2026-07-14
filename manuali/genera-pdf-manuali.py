#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera i due PDF di "La Corsa Invisibile" (regolamento e guida rapida) a
partire dai sorgenti Markdown approvati in manuali/, nello stile grafico
delle schede dei ruoli (sfondo bianco, rosso cremisi, riquadri crema,
Helvetica, A4).

Rilanciabile: se i .md cambiano, basta rilanciare
    python manuali/genera-pdf-manuali.py
per rigenerare entrambi i PDF. I testi dei .md NON vengono mai riscritti:
lo script decide soltanto gli a-capo e l'impaginazione.

Dipendenze: reportlab, Pillow.
"""

import os
import re
import io

from PIL import Image
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    ListFlowable, ListItem, PageBreak, HRFlowable, NextPageTemplate,
)

# ---------------------------------------------------------------------------
# Percorsi
# ---------------------------------------------------------------------------
BASE = os.path.dirname(os.path.abspath(__file__))          # .../manuali
REPO = os.path.dirname(BASE)                                # repo root
MD_REGOLAMENTO = os.path.join(BASE, "regolamento-la-corsa-invisibile.md")
MD_GUIDA = os.path.join(BASE, "guida-rapida-la-corsa-invisibile.md")
COPERTINA_SRC = os.path.join(BASE, "copertina-originale.png")
COPERTINA_JPG = os.path.join(BASE, "copertina-stampa.jpg")
OUT_DIR = os.path.join(REPO, "public", "materiali")
OUT_REGOLAMENTO = os.path.join(OUT_DIR, "regolamento-la-corsa-invisibile.pdf")
OUT_GUIDA = os.path.join(OUT_DIR, "guida-rapida-la-corsa-invisibile.pdf")

# ---------------------------------------------------------------------------
# Stile ufficiale (valori esatti dalle schede dei ruoli)
# ---------------------------------------------------------------------------
RED = Color(0.690, 0.227, 0.180)      # rosso cremisi #B03A2E
BLACK = Color(0.110, 0.110, 0.110)    # nero testo #1C1C1C
GREY = Color(0.431, 0.431, 0.431)     # grigio note #6E6E6E
CREAM = Color(0.961, 0.949, 0.929)    # crema riquadri #F5F2ED
BORDER = Color(0.847, 0.827, 0.796)   # bordo riquadri #D8D3CB

PAGE_W, PAGE_H = A4
MARGIN = 25 * mm                      # sinistra/destra

FOOTER_TEXT = ("Dai romanzi di Simone Badii: "
               "Il ragazzo che correva nel tempo / I passi tornano")

CONTENT_W = PAGE_W - 2 * MARGIN

# ---------------------------------------------------------------------------
# Markdown inline -> markup reportlab
# ---------------------------------------------------------------------------
def inline(md):
    """Converte **grassetto** e *corsivo* in markup <b>/<i>, con escaping XML."""
    s = md.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)   # prima il grassetto
    s = re.sub(r"\*(.+?)\*", r"<i>\1</i>", s)        # poi il corsivo
    return s


# ---------------------------------------------------------------------------
# Parser a blocchi del Markdown
# ---------------------------------------------------------------------------
def parse_blocks(path):
    """Restituisce una lista di blocchi:
    {'type': 'h1'|'subtitle'|'h2'|'p'|'ul'|'ol'|'table', ...}
    Ignora le righe orizzontali '---'.
    """
    with open(path, "r", encoding="utf-8") as f:
        lines = [ln.rstrip("\n") for ln in f]

    blocks = []
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i].rstrip()
        if not line.strip():
            i += 1
            continue
        if line.strip() == "---":
            i += 1
            continue
        # titolo documento
        if line.startswith("# "):
            blocks.append({"type": "h1", "text": line[2:].strip()})
            i += 1
            continue
        # titolo capitolo
        if line.startswith("## "):
            blocks.append({"type": "h2", "text": line[3:].strip()})
            i += 1
            continue
        # tabella markdown
        if line.lstrip().startswith("|"):
            rows = []
            while i < n and lines[i].lstrip().startswith("|"):
                rows.append(lines[i].strip())
                i += 1
            parsed = []
            for r in rows:
                cells = [c.strip() for c in r.strip().strip("|").split("|")]
                # scarta la riga separatore |---|---|
                if all(set(c) <= set("-: ") and c for c in cells):
                    continue
                parsed.append(cells)
            if parsed:
                blocks.append({"type": "table", "rows": parsed})
            continue
        # lista puntata
        if line.lstrip().startswith("- "):
            items = []
            while i < n and lines[i].lstrip().startswith("- "):
                items.append(lines[i].lstrip()[2:].strip())
                i += 1
            blocks.append({"type": "ul", "items": items})
            continue
        # lista numerata
        if re.match(r"^\d+\.\s", line.lstrip()):
            items = []
            while i < n and re.match(r"^\d+\.\s", lines[i].lstrip()):
                items.append(re.sub(r"^\d+\.\s", "", lines[i].lstrip()).strip())
                i += 1
            blocks.append({"type": "ol", "items": items})
            continue
        # sottotitolo in corsivo (riga tutta *...*)
        if line.startswith("*") and line.endswith("*") and not line.startswith("**"):
            blocks.append({"type": "subtitle", "text": line.strip("*").strip()})
            i += 1
            continue
        # paragrafo normale (una riga = un paragrafo)
        blocks.append({"type": "p", "text": line.strip()})
        i += 1
    return blocks


def split_chapters(blocks):
    """Divide i blocchi in (masthead, [capitoli]). Ogni capitolo inizia con h2."""
    masthead = []
    chapters = []
    current = None
    for b in blocks:
        if b["type"] == "h2":
            if current is not None:
                chapters.append(current)
            current = [b]
        elif current is None:
            masthead.append(b)
        else:
            current.append(b)
    if current is not None:
        chapters.append(current)
    return masthead, chapters


# ---------------------------------------------------------------------------
# Stili paragrafo (regolamento)
# ---------------------------------------------------------------------------
def make_styles(scale=1.0):
    body = ParagraphStyle(
        "body", fontName="Helvetica", fontSize=12.5 * scale,
        leading=15 * scale, textColor=BLACK, alignment=TA_LEFT,
        spaceAfter=7 * scale,
    )
    note = ParagraphStyle(
        "note", parent=body, fontName="Helvetica-Oblique",
        fontSize=11 * scale, leading=13.5 * scale, textColor=GREY,
    )
    h2 = ParagraphStyle(
        "h2", fontName="Helvetica-Bold", fontSize=16 * scale,
        leading=19 * scale, textColor=RED, spaceAfter=2 * scale,
    )
    doctitle = ParagraphStyle(
        "doctitle", fontName="Helvetica-Bold", fontSize=26 * scale,
        leading=30 * scale, textColor=BLACK, spaceAfter=2 * scale,
    )
    tcell = ParagraphStyle(
        "tcell", fontName="Helvetica", fontSize=11 * scale,
        leading=13 * scale, textColor=BLACK,
    )
    thead = ParagraphStyle(
        "thead", fontName="Helvetica-Bold", fontSize=11 * scale,
        leading=13 * scale, textColor=RED,
    )
    return dict(body=body, note=note, h2=h2, doctitle=doctitle,
                tcell=tcell, thead=thead)


def make_table_flow(rows, st):
    header, body_rows = rows[0], rows[1:]
    ncol = len(header)
    if ncol == 2:
        weights = [0.35, 0.65]
    elif ncol == 3:
        weights = [0.17, 0.23, 0.60]
    else:
        weights = [1.0 / ncol] * ncol
    col_w = [w * CONTENT_W for w in weights]
    data = [[Paragraph(inline(c), st["thead"]) for c in header]]
    for r in body_rows:
        data.append([Paragraph(inline(c), st["tcell"]) for c in r])
    t = Table(data, colWidths=col_w, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), CREAM),
        ("GRID", (0, 0), (-1, -1), 0.75, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def make_list_flow(items, ordered, st):
    flows = [Paragraph(inline(it), st["body"]) for it in items]
    litems = [ListItem(f, leftIndent=16) for f in flows]
    kwargs = dict(leftIndent=16, bulletColor=RED, bulletFontName="Helvetica-Bold")
    if ordered:
        return ListFlowable(litems, bulletType="1", bulletFormat="%s.",
                            bulletFontSize=st["body"].fontSize, **kwargs)
    return ListFlowable(litems, bulletType="bullet", start="•",
                        bulletFontSize=st["body"].fontSize * 0.9, **kwargs)


def blocks_to_flow(blocks, st, skip_first_h2_rule=False):
    """Rende una lista di blocchi in flowables. I titoli h2 diventano
    16pt bold maiuscolo con riga rossa sottile sotto."""
    out = []
    for b in blocks:
        t = b["type"]
        if t == "h1":
            out.append(Paragraph(inline(b["text"]), st["doctitle"]))
            out.append(HRFlowable(color=RED, thickness=2, width="100%",
                                  spaceBefore=1, spaceAfter=8))
        elif t == "subtitle":
            out.append(Paragraph(inline(b["text"]), st["note"]))
            out.append(Spacer(1, 6))
        elif t == "h2":
            out.append(Paragraph(b["text"].upper(), st["h2"]))
            out.append(HRFlowable(color=RED, thickness=1, width="100%",
                                  spaceBefore=1, spaceAfter=10))
        elif t == "p":
            style = st["note"] if _is_note(b["text"]) else st["body"]
            out.append(Paragraph(inline(b["text"]), style))
        elif t == "ul":
            out.append(make_list_flow(b["items"], False, st))
            out.append(Spacer(1, 4))
        elif t == "ol":
            out.append(make_list_flow(b["items"], True, st))
            out.append(Spacer(1, 4))
        elif t == "table":
            out.append(Spacer(1, 2))
            out.append(make_table_flow(b["rows"], st))
            out.append(Spacer(1, 8))
    return out


def _is_note(text):
    """Un paragrafo interamente in corsivo (*...*) va reso come nota grigia."""
    t = text.strip()
    return t.startswith("*") and t.endswith("*") and not t.startswith("**")


# ---------------------------------------------------------------------------
# Copertina: PNG RGBA -> JPEG RGB qualità 85
# ---------------------------------------------------------------------------
def build_cover_jpg():
    im = Image.open(COPERTINA_SRC)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im, mask=im.split()[-1])
        im = bg
    else:
        im = im.convert("RGB")
    im.save(COPERTINA_JPG, "JPEG", quality=85, optimize=True)
    return im.size


# ---------------------------------------------------------------------------
# PDF regolamento
# ---------------------------------------------------------------------------
def draw_cover(canvas, doc):
    """Pagina 1: copertina a tutta pagina, ritaglio minimo centrato."""
    iw, ih = Image.open(COPERTINA_JPG).size
    scale = max(PAGE_W / iw, PAGE_H / ih)      # cover-fit
    w, h = iw * scale, ih * scale
    x, y = (PAGE_W - w) / 2, (PAGE_H - h) / 2
    canvas.saveState()
    p = canvas.beginPath()
    p.rect(0, 0, PAGE_W, PAGE_H)
    canvas.clipPath(p, stroke=0, fill=0)       # clip alla pagina
    canvas.drawImage(COPERTINA_JPG, x, y, w, h,
                     preserveAspectRatio=False, mask=None)
    canvas.restoreState()


def draw_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica-Oblique", 9)
    canvas.setFillColor(GREY)
    canvas.drawString(MARGIN, 12 * mm, FOOTER_TEXT)
    canvas.drawRightString(PAGE_W - MARGIN, 12 * mm, str(doc.page))
    canvas.restoreState()


def build_regolamento():
    st = make_styles(1.0)
    blocks = parse_blocks(MD_REGOLAMENTO)
    masthead, chapters = split_chapters(blocks)

    doc = BaseDocTemplate(
        OUT_REGOLAMENTO, pagesize=A4,
        title="La Corsa Invisibile - Regolamento", author="Simone Badii",
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=22 * mm, bottomMargin=20 * mm,
    )
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, id="cover",
                        leftPadding=0, rightPadding=0,
                        topPadding=0, bottomPadding=0)
    body_frame = Frame(MARGIN, 18 * mm, CONTENT_W,
                       PAGE_H - 22 * mm - 18 * mm, id="body",
                       leftPadding=0, rightPadding=0,
                       topPadding=0, bottomPadding=0)
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=draw_cover),
        PageTemplate(id="body", frames=[body_frame], onPage=draw_footer),
    ])

    story = [NextPageTemplate("body"), PageBreak()]
    story += blocks_to_flow(masthead, st)
    for idx, chap in enumerate(chapters):
        if idx > 0:
            story.append(PageBreak())
        story += blocks_to_flow(chap, st)
    doc.build(story)


# ---------------------------------------------------------------------------
# PDF guida rapida (UNA sola pagina, auto-fit)
# ---------------------------------------------------------------------------
def make_box_flow(header_text, items, st):
    """Riquadro crema con bordo contenente il blocco del tiro."""
    inner = [Paragraph(inline(header_text), st["body"])]
    for it in items:
        inner.append(Paragraph(inline(it), st["body"]))
    t = Table([[inner]], colWidths=[CONTENT_W])
    style = [
        ("BACKGROUND", (0, 0), (-1, -1), CREAM),
        ("BOX", (0, 0), (-1, -1), 1, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]
    try:
        style.append(("ROUNDEDCORNERS", [6, 6, 6, 6]))
    except Exception:
        pass
    t.setStyle(TableStyle(style))
    return t


def build_guida_flow(scale):
    """Costruisce i flowables della guida a una data scala tipografica."""
    st = make_styles(scale)
    blocks = parse_blocks(MD_GUIDA)
    out = []
    i = 0
    while i < len(blocks):
        b = blocks[i]
        t = b["type"]
        if t == "h1":
            out.append(Paragraph(inline(b["text"]), st["doctitle"]))
            out.append(HRFlowable(color=RED, thickness=2, width="100%",
                                  spaceBefore=1, spaceAfter=6 * scale))
        elif t == "subtitle":
            out.append(Paragraph(inline(b["text"]), st["note"]))
            out.append(Spacer(1, 4 * scale))
        elif t == "p":
            # il blocco "Il tiro" + la lista che segue vanno in un riquadro crema
            if b["text"].startswith("**Il tiro"):
                items = []
                if i + 1 < len(blocks) and blocks[i + 1]["type"] == "ul":
                    items = blocks[i + 1]["items"]
                    i += 1
                out.append(Spacer(1, 2 * scale))
                out.append(make_box_flow(b["text"], items, st))
                out.append(Spacer(1, 4 * scale))
            else:
                style = st["note"] if _is_note(b["text"]) else st["body"]
                out.append(Paragraph(inline(b["text"]), style))
        elif t == "ul":
            out.append(make_list_flow(b["items"], False, st))
        elif t == "ol":
            out.append(make_list_flow(b["items"], True, st))
        i += 1
    return out


def guida_fits(flowables, top_mm, bottom_mm):
    """True se i flowables entrano in UNA pagina con i margini dati."""
    fh = PAGE_H - top_mm * mm - bottom_mm * mm
    fr = Frame(MARGIN, bottom_mm * mm, CONTENT_W, fh,
               leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    c = Canvas(io.BytesIO(), pagesize=A4)
    lst = list(flowables)
    try:
        fr.addFromList(lst, c)
    except Exception:
        return False
    return len(lst) == 0


def build_guida():
    # cerca la scala tipografica piu' grande che sta in una pagina;
    # se serve, stringe anche i margini verticali. Mai il testo.
    chosen = None
    for top_mm, bottom_mm in [(16, 15), (13, 13), (11, 12)]:
        scale = 1.0
        while scale >= 0.60:
            flow = build_guida_flow(scale)
            if guida_fits(flow, top_mm, bottom_mm):
                chosen = (scale, top_mm, bottom_mm, flow)
                break
            scale -= 0.02
        if chosen:
            break
    if not chosen:
        # fallback estremo: scala minima e margini minimi
        scale, top_mm, bottom_mm = 0.60, 11, 12
        chosen = (scale, top_mm, bottom_mm, build_guida_flow(scale))

    scale, top_mm, bottom_mm, flow = chosen
    c = Canvas(OUT_GUIDA, pagesize=A4)
    c.setTitle("La Corsa Invisibile - Guida rapida")
    c.setAuthor("Simone Badii")
    # pie' di pagina (senza numero di pagina)
    c.saveState()
    c.setFont("Helvetica-Oblique", 9)
    c.setFillColor(GREY)
    c.drawString(MARGIN, 12 * mm, FOOTER_TEXT)
    c.restoreState()
    fh = PAGE_H - top_mm * mm - bottom_mm * mm
    fr = Frame(MARGIN, bottom_mm * mm, CONTENT_W, fh,
               leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    fr.addFromList(flow, c)
    c.showPage()
    c.save()
    return scale, top_mm, bottom_mm


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    csize = build_cover_jpg()
    print("copertina-stampa.jpg:", csize,
          "%.0f KB" % (os.path.getsize(COPERTINA_JPG) / 1024))
    build_regolamento()
    print("regolamento:", "%.0f KB" % (os.path.getsize(OUT_REGOLAMENTO) / 1024))
    info = build_guida()
    print("guida rapida:", "%.0f KB" % (os.path.getsize(OUT_GUIDA) / 1024),
          "| scala=%.2f margini(top,bottom)mm=%s,%s" % (info[0], info[1], info[2]))


if __name__ == "__main__":
    main()
