from django.conf import settings
from django.conf.urls.i18n import i18n_patterns
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.core.views import switch_language

urlpatterns = [
    path("i18n/setlang/", switch_language, name="set_language"),
    path("i18n/", include("django.conf.urls.i18n")),
    path("api/configurator/", include("apps.configurator.api_urls")),
]

urlpatterns += i18n_patterns(
    path("admin/", admin.site.urls),
    path("", include("apps.core.urls")),
    path("katalogas/", include("apps.catalog.urls")),
    path("konfiguratorius/", include("apps.configurator.urls")),
    prefix_default_language=False,
)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
