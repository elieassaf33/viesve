import json
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, render
from django.utils.translation import get_language

from apps.catalog.models import StructureModel
from .models import MaterialFinish, SavedConfiguration
from .pdf import generate_config_pdf
from .pricing import calculate_bom_and_price


def configurator_view(request, config_uuid=None):
    lang = get_language() or "lt"
    preset_slug = request.GET.get("preset", "")

    initial_config = None
    saved_obj = None

    if config_uuid:
        saved_obj = get_object_or_404(SavedConfiguration, uuid=config_uuid)
        initial_config = saved_obj.config_json
    elif preset_slug:
        model = StructureModel.objects.filter(slug=preset_slug).first()
        if model and model.default_config_json:
            initial_config = model.default_config_json

    if not initial_config:
        initial_config = {
            "width": 400,
            "depth": 400,
            "wallHeight": 230,
            "overhang": 30,
            "roofType": "pyramid",
            "roofFinish": "shingle-black",
            "woodFinish": "teak",
            "includeGutterFinial": True,
            "includeDecking": True,
            "walls": {
                "front": "glass",
                "back": "solid",
                "left": "louver",
                "right": "open",
            },
        }

    initial_calc = calculate_bom_and_price(initial_config)
    wood_finishes = list(
        MaterialFinish.objects.filter(kind="wood_stain").values(
            "code", "name_lt", "name_en", "hex_color", "roughness", "metalness", "price_per_liter"
        )
    )
    roof_finishes = list(
        MaterialFinish.objects.filter(kind="roof_covering").values(
            "code", "name_lt", "name_en", "hex_color", "roughness", "metalness", "price_per_m2"
        )
    )

    for w in wood_finishes:
        w["price_per_liter"] = float(w["price_per_liter"])
    for r in roof_finishes:
        r["price_per_m2"] = float(r["price_per_m2"])

    presets = list(
        StructureModel.objects.values("slug", "name_lt", "name_en", "default_config_json")
    )

    return render(
        request,
        "configurator/index.html",
        {
            "lang": lang,
            "saved_obj": saved_obj,
            "preset_slug": preset_slug,
            "bootstrap_json": json.dumps(
                {
                    "lang": lang,
                    "presetSlug": preset_slug,
                    "initialConfig": initial_calc["config"],
                    "initialBom": initial_calc["bom"],
                    "initialPrice": initial_calc["total_price"],
                    "woodFinishes": wood_finishes,
                    "roofFinishes": roof_finishes,
                    "presets": presets,
                    "shareUuid": str(saved_obj.uuid) if saved_obj else None,
                }
            ),
        },
    )


def config_pdf_view(request, config_uuid):
    saved_obj = get_object_or_404(SavedConfiguration, uuid=config_uuid)
    pdf_bytes = generate_config_pdf(saved_obj)
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="viesve-spec-{saved_obj.uuid}.pdf"'
    return response
