from django.utils.translation import get_language


def language_context(request):
    """Expose normalized 2-letter language code ('lt' or 'en') to all templates."""
    current = (get_language() or "lt").split("-")[0].lower()
    return {"lang": "en" if current == "en" else "lt"}
