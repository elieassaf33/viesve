from django.shortcuts import get_object_or_404, render
from django.utils.translation import get_language
from .models import Category, StructureModel


def catalog_list(request):
    lang = get_language() or "lt"
    category_slug = request.GET.get("category", "")
    categories = Category.objects.all()
    models_qs = StructureModel.objects.select_related("category").all()
    if category_slug:
        models_qs = models_qs.filter(category__slug=category_slug)
    return render(
        request,
        "catalog/list.html",
        {
            "lang": lang,
            "categories": categories,
            "models": models_qs,
            "active_category": category_slug,
        },
    )


def catalog_detail(request, slug):
    lang = get_language() or "lt"
    structure = get_object_or_404(StructureModel.objects.select_related("category"), slug=slug)
    return render(
        request,
        "catalog/detail.html",
        {
            "lang": lang,
            "structure": structure,
        },
    )
