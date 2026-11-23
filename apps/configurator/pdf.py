"""
ReportLab PDF Spec Sheet generator for SavedConfiguration.
Includes 3D snapshot (when captured), dimensions, wall bays, BOM, and itemized pricing.
"""

import base64
import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_config_pdf(saved_config) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    styles = getSampleStyleSheet()
    story = []

    cfg = saved_config.config_json or {}
    bom = saved_config.bom_json or {}

    # Header
    story.append(Paragraph("<b>VIESVĖ — 3D Architektūrinė Specifikacija</b>", styles["Title"]))
    story.append(
        Paragraph(
            f"Konfigūracijos ID: {saved_config.uuid} &nbsp;|&nbsp; Sukurta: {saved_config.created_at:%Y-%m-%d %H:%M}",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 6 * mm))

    # Optional 3D Snapshot
    data_url = saved_config.snapshot_data_url or ""
    if data_url.startswith("data:image/") and ";base64," in data_url:
        try:
            b64_part = data_url.split(";base64,", 1)[1]
            img_bytes = base64.b64decode(b64_part)
            img = Image(io.BytesIO(img_bytes), width=165 * mm, height=92 * mm, kind="proportional")
            story.append(img)
            story.append(Spacer(1, 5 * mm))
        except Exception:
            pass

    # Dimensions & Parameters Table
    walls = cfg.get("walls", {})
    spec_data = [
        ["Parametras", "Reikšmė"],
        ["Matmenys (P × G × A)", f"{cfg.get('width', 400)} × {cfg.get('depth', 400)} × {cfg.get('wallHeight', 230)} cm"],
        ["Stogo iškyša (Overhang)", f"{cfg.get('overhang', 30)} cm"],
        ["Stogo tipas / danga", f"{cfg.get('roofType', 'pyramid')} / {cfg.get('roofFinish', '')}"],
        ["Medienos apdaila", f"{cfg.get('woodFinish', 'natural-pine')}"],
        ["Sienos (Priekis / Galas / Kairė / Dešinė)", f"{walls.get('front', 'open')} / {walls.get('back', 'open')} / {walls.get('left', 'open')} / {walls.get('right', 'open')}"],
        ["Plotas / Medienos tūris / Stogas", f"{bom.get('footprint_m2', 0)} m² | {bom.get('timber_m3', 0)} m³ | {bom.get('roof_area_m2', 0)} m²"],
    ]
    spec_table = Table(spec_data, colWidths=[68 * mm, 102 * mm])
    spec_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1C1917")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6D3D1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(spec_table)
    story.append(Spacer(1, 6 * mm))

    # BOM & Pricing Table
    items = bom.get("items", [])
    bom_data = [["Pozicija", "Kiekis", "Suma (EUR)"]]
    for item in items:
        bom_data.append([
            item.get("label_lt", item.get("code", "")),
            str(item.get("quantity", "")),
            f"{item.get('total', 0):.2f} €",
        ])
    bom_data.append(["VISO (su PVM)", "", f"{float(saved_config.total_price):.2f} €"])

    bom_table = Table(bom_data, colWidths=[108 * mm, 30 * mm, 32 * mm])
    bom_table.setStyle(
        TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#78350F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F5F5F4")),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D6D3D1")),
            ("PADDING", (0, 0), (-1, -1), 6),
        ])
    )
    story.append(bom_table)

    doc.build(story)
    return buffer.getvalue()
