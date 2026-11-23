"""
Parametric BOM & Pricing Engine for Viesvė 3D Configurator.
Validates structural rules, computes material quantities (timber m3, roof m2,
glass units, treatment liters, decking m2), and returns itemized pricing.
"""

import math
from decimal import Decimal, ROUND_HALF_UP
from .models import MaterialFinish, PricingRule

DEFAULT_RULES = {
    "timber_m3": Decimal("680.00"),
    "post_unit": Decimal("65.00"),
    "wall_solid_m2": Decimal("88.00"),
    "wall_half_m2": Decimal("62.00"),
    "wall_louver_m2": Decimal("115.00"),
    "glass_sliding_m": Decimal("390.00"),
    "roof_pyramid_base": Decimal("340.00"),
    "roof_flat_base": Decimal("240.00"),
    "gutter_finial": Decimal("185.00"),
    "decking_m2": Decimal("72.00"),
    "assembly_engineering": Decimal("290.00"),
}

VALID_ROOF_TYPES = {"pyramid", "flat"}
VALID_WALL_TYPES = {"open", "solid", "half", "glass", "louver"}


def _q(val):
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def normalize_config(raw: dict) -> dict:
    """Validate and normalize parametric configuration dictionary."""
    width = int(raw.get("width", 400))
    depth = int(raw.get("depth", 400))
    wall_height = int(raw.get("wallHeight", 230))
    overhang = int(raw.get("overhang", 30))

    width = max(250, min(600, width))
    depth = max(250, min(600, depth))
    wall_height = max(210, min(260, wall_height))
    overhang = max(20, min(40, overhang))

    roof_type = raw.get("roofType", "pyramid")
    if roof_type not in VALID_ROOF_TYPES:
        roof_type = "pyramid"

    walls_raw = raw.get("walls", {}) or {}
    walls = {}
    for side in ("front", "back", "left", "right"):
        val = walls_raw.get(side, "open")
        walls[side] = val if val in VALID_WALL_TYPES else "open"

    return {
        "width": width,
        "depth": depth,
        "wallHeight": wall_height,
        "overhang": overhang,
        "roofType": roof_type,
        "roofFinish": raw.get("roofFinish", "shingle-black"),
        "woodFinish": raw.get("woodFinish", "natural-pine"),
        "includeGutterFinial": bool(raw.get("includeGutterFinial", True)),
        "includeDecking": bool(raw.get("includeDecking", True)),
        "walls": walls,
    }


def calculate_bom_and_price(raw_config: dict) -> dict:
    """Calculate exact Bill of Materials and itemized price from DB pricing rules."""
    cfg = normalize_config(raw_config)

    rules = dict(DEFAULT_RULES)
    for r in PricingRule.objects.all():
        rules[r.code] = r.unit_price

    wood_finish = MaterialFinish.objects.filter(
        kind="wood_stain", code=cfg["woodFinish"]
    ).first()
    roof_finish = MaterialFinish.objects.filter(
        kind="roof_covering", code=cfg["roofFinish"]
    ).first()

    w_m = cfg["width"] / 100.0
    d_m = cfg["depth"] / 100.0
    h_m = cfg["wallHeight"] / 100.0
    oh_m = cfg["overhang"] / 100.0

    # 1. Structural Posts (140x140mm laminated timber)
    # 4 corner posts + intermediate posts when span > 4.0m
    mid_posts_w = 2 if w_m > 4.0 else 0
    mid_posts_d = 2 if d_m > 4.0 else 0
    total_posts = 4 + mid_posts_w + mid_posts_d
    post_volume_m3 = total_posts * (0.14 * 0.14 * h_m)

    # Ring beams & rafters
    perimeter_m = 2 * (w_m + d_m)
    beam_volume_m3 = perimeter_m * (0.14 * 0.18)

    # Roof geometry & area
    roof_w = w_m + 2 * oh_m
    roof_d = d_m + 2 * oh_m
    if cfg["roofType"] == "pyramid":
        roof_pitch_h = max(0.65, min(roof_w, roof_d) * 0.24)
        slope_w = math.hypot(roof_d / 2.0, roof_pitch_h)
        slope_d = math.hypot(roof_w / 2.0, roof_pitch_h)
        roof_area_m2 = (roof_w * slope_w) + (roof_d * slope_d)
        rafter_len = 4 * math.hypot(roof_w / 2.0, roof_d / 2.0, roof_pitch_h) + 2 * (roof_w + roof_d)
    else:
        roof_area_m2 = roof_w * roof_d * 1.03
        rafter_len = (math.ceil(w_m / 0.6) + 1) * roof_d

    roof_timber_m3 = rafter_len * (0.06 * 0.14) + roof_area_m2 * 0.02
    total_timber_m3 = round(post_volume_m3 + beam_volume_m3 + roof_timber_m3, 3)

    # 2. Wall Bays
    side_lengths = {
        "front": w_m,
        "back": w_m,
        "left": d_m,
        "right": d_m,
    }
    solid_m2 = 0.0
    half_m2 = 0.0
    louver_m2 = 0.0
    glass_m = 0.0
    glass_units = 0

    for side, wall_type in cfg["walls"].items():
        length = side_lengths[side]
        if wall_type == "solid":
            solid_m2 += length * h_m
        elif wall_type == "half":
            half_m2 += length * 0.90
        elif wall_type == "louver":
            louver_m2 += length * h_m
        elif wall_type == "glass":
            glass_m += length
            glass_units += 4 if length > 3.6 else 3

    # 3. Decking & Treatment
    decking_m2 = round(w_m * d_m, 2) if cfg["includeDecking"] else 0.0
    painted_surface_m2 = (
        (total_posts * 4 * 0.14 * h_m)
        + (perimeter_m * 0.5)
        + (solid_m2 * 2.0)
        + (half_m2 * 2.0)
        + (louver_m2 * 2.2)
    )
    treatment_liters = round(painted_surface_m2 / 8.5, 1) if cfg["woodFinish"] != "natural-pine" else 0.0

    # 4. Itemized Pricing
    items = []

    timber_cost = _q(Decimal(str(total_timber_m3)) * rules["timber_m3"] + Decimal(total_posts) * rules["post_unit"])
    items.append({
        "code": "timber_frame",
        "label_lt": f"Klijuoto tašo karkasas (140×140 mm, {total_posts} stulpai)",
        "label_en": f"Laminated timber frame (140×140 mm, {total_posts} posts)",
        "quantity": f"{total_timber_m3:.2f} m³",
        "unit_price": float(rules["timber_m3"]),
        "total": float(timber_cost),
    })

    roof_base = rules["roof_pyramid_base"] if cfg["roofType"] == "pyramid" else rules["roof_flat_base"]
    roof_mat_rate = roof_finish.price_per_m2 if roof_finish else Decimal("32.00")
    roof_cost = _q(roof_base + Decimal(str(round(roof_area_m2, 2))) * roof_mat_rate)
    items.append({
        "code": "roof",
        "label_lt": f"Stogo konstrukcija ir danga ({roof_finish.name_lt if roof_finish else cfg['roofFinish']})",
        "label_en": f"Roof structure & covering ({roof_finish.name_en if roof_finish else cfg['roofFinish']})",
        "quantity": f"{roof_area_m2:.1f} m²",
        "unit_price": float(roof_mat_rate),
        "total": float(roof_cost),
    })

    if solid_m2 > 0:
        c = _q(Decimal(str(solid_m2)) * rules["wall_solid_m2"])
        items.append({
            "code": "wall_solid",
            "label_lt": "Aklina špuntuotų lentų siena",
            "label_en": "Solid tongue-and-groove timber wall",
            "quantity": f"{solid_m2:.1f} m²",
            "unit_price": float(rules["wall_solid_m2"]),
            "total": float(c),
        })

    if half_m2 > 0:
        c = _q(Decimal(str(half_m2)) * rules["wall_half_m2"])
        items.append({
            "code": "wall_half",
            "label_lt": "Pusės aukščio sienelė / baliustrada (90 cm)",
            "label_en": "Half-wall / balustrade (90 cm)",
            "quantity": f"{half_m2:.1f} m²",
            "unit_price": float(rules["wall_half_m2"]),
            "total": float(c),
        })

    if louver_m2 > 0:
        c = _q(Decimal(str(louver_m2)) * rules["wall_louver_m2"])
        items.append({
            "code": "wall_louver",
            "label_lt": "Medinės žaliuzės / tašelių sienelė",
            "label_en": "Fixed vertical wooden louver screen",
            "quantity": f"{louver_m2:.1f} m²",
            "unit_price": float(rules["wall_louver_m2"]),
            "total": float(c),
        })

    if glass_m > 0:
        c = _q(Decimal(str(glass_m)) * rules["glass_sliding_m"])
        items.append({
            "code": "wall_glass",
            "label_lt": f"Stumdoma grūdinto stiklo sistema ({glass_units} varčios)",
            "label_en": f"Sliding tempered glass door system ({glass_units} panels)",
            "quantity": f"{glass_m:.1f} m",
            "unit_price": float(rules["glass_sliding_m"]),
            "total": float(c),
        })

    if cfg["includeDecking"]:
        c = _q(Decimal(str(decking_m2)) * rules["decking_m2"])
        items.append({
            "code": "decking",
            "label_lt": "Impregnuotos terasinės grindys",
            "label_en": "Impregnated terrace floor decking",
            "quantity": f"{decking_m2:.1f} m²",
            "unit_price": float(rules["decking_m2"]),
            "total": float(c),
        })

    if treatment_liters > 0 and wood_finish:
        c = _q(Decimal(str(treatment_liters)) * wood_finish.price_per_liter)
        items.append({
            "code": "treatment",
            "label_lt": f"Gamyklinis dažymas / impregnavimas ({wood_finish.name_lt})",
            "label_en": f"Factory wood treatment ({wood_finish.name_en})",
            "quantity": f"{treatment_liters:.1f} L",
            "unit_price": float(wood_finish.price_per_liter),
            "total": float(c),
        })

    if cfg["includeGutterFinial"]:
        c = _q(rules["gutter_finial"])
        items.append({
            "code": "gutter_finial",
            "label_lt": "Lietvamzdžių sistema ir dekoratyvinė viršūnė",
            "label_en": "Rain gutter system & decorative finial",
            "quantity": "1 kompl.",
            "unit_price": float(c),
            "total": float(c),
        })

    eng_cost = _q(rules["assembly_engineering"])
    items.append({
        "code": "engineering",
        "label_lt": "CNC paruošimas, brėžiniai ir tvirtinimo detalės",
        "label_en": "CNC joinery, blueprints & hardware kit",
        "quantity": "1 kompl.",
        "unit_price": float(eng_cost),
        "total": float(eng_cost),
    })

    total_price = sum(Decimal(str(i["total"])) for i in items)

    bom = {
        "footprint_m2": round(w_m * d_m, 2),
        "total_posts": total_posts,
        "intermediate_posts": mid_posts_w + mid_posts_d,
        "timber_m3": total_timber_m3,
        "roof_area_m2": round(roof_area_m2, 2),
        "glass_units": glass_units,
        "treatment_liters": treatment_liters,
        "decking_m2": decking_m2,
        "items": items,
    }

    return {
        "config": cfg,
        "bom": bom,
        "total_price": float(_q(total_price)),
        "currency": "EUR",
    }
