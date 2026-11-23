from django.urls import path
from . import views

app_name = "configurator"

urlpatterns = [
    path("", views.configurator_view, name="index"),
    path("c/<uuid:config_uuid>/", views.configurator_view, name="share"),
    path("c/<uuid:config_uuid>/pdf/", views.config_pdf_view, name="pdf"),
]
