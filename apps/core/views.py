from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from django.shortcuts import redirect, render
from django.urls import translate_url
from django.utils.http import url_has_allowed_host_and_scheme
from django.utils.translation import get_language, gettext as _

from apps.catalog.models import Category, StructureModel
from .models import ContactInquiry, PortfolioProject


def switch_language(request):
    """Switch between Lithuanian (default, unprefixed) and English (/en/)."""
    lang = request.POST.get("language") or request.GET.get("language") or "lt"
    if lang not in dict(settings.LANGUAGES):
        lang = "lt"

    next_url = request.POST.get("next") or request.GET.get("next") or "/"
    if not url_has_allowed_host_and_scheme(next_url, allowed_hosts={request.get_host()}):
        next_url = "/"

    # Translate URL path prefix properly between lt (unprefixed) and en (/en/)
    translated = translate_url(next_url, lang)
    if lang == "lt" and translated.startswith("/en/"):
        translated = "/" + translated[4:]
    elif lang == "lt" and translated == "/en":
        translated = "/"

    response = redirect(translated)
    response.set_cookie(
        settings.LANGUAGE_COOKIE_NAME,
        lang,
        max_age=settings.LANGUAGE_COOKIE_AGE,
        path=settings.LANGUAGE_COOKIE_PATH,
        domain=settings.LANGUAGE_COOKIE_DOMAIN,
        secure=settings.LANGUAGE_COOKIE_SECURE,
        httponly=settings.LANGUAGE_COOKIE_HTTPONLY,
        samesite=settings.LANGUAGE_COOKIE_SAMESITE,
    )
    return response


def home(request):
    lang = get_language() or "lt"
    categories = Category.objects.all()
    featured_models = StructureModel.objects.filter(is_featured=True).select_related("category")[:4]
    portfolio_projects = PortfolioProject.objects.filter(is_featured=True)[:6]
    return render(
        request,
        "core/home.html",
        {
            "lang": lang,
            "categories": categories,
            "featured_models": featured_models,
            "portfolio_projects": portfolio_projects,
        },
    )


def portfolio(request):
    lang = get_language() or "lt"
    category_filter = request.GET.get("category", "")
    projects = PortfolioProject.objects.all()
    if category_filter:
        projects = projects.filter(category=category_filter)
    return render(
        request,
        "core/portfolio.html",
        {
            "lang": lang,
            "projects": projects,
            "active_category": category_filter,
            "categories": PortfolioProject.CATEGORY_CHOICES,
        },
    )


def about(request):
    return render(request, "core/about.html", {"lang": get_language() or "lt"})


def contact(request):
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        email = request.POST.get("email", "").strip()
        phone = request.POST.get("phone", "").strip()
        message = request.POST.get("message", "").strip()
        if name and email and message:
            ContactInquiry.objects.create(
                name=name, email=email, phone=phone, message=message
            )
            try:
                send_mail(
                    subject=f"[Viesvė] Nauja užklausa nuo {name}",
                    message=f"Vardas: {name}\nEl. paštas: {email}\nTelefonas: {phone}\n\nŽinutė:\n{message}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[settings.QUOTE_NOTIFICATION_EMAIL],
                    fail_silently=True,
                )
            except Exception:
                pass
            messages.success(request, _("Ačiū! Jūsų užklausa gauta, susisieksime artimiausiu metu."))
            return redirect("core:contact")
        messages.error(request, _("Prašome užpildyti visus privalomus laukus."))
    return render(request, "core/contact.html", {"lang": get_language() or "lt"})
