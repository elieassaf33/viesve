from django.urls import path
from . import views

app_name = "core"

urlpatterns = [
    path("", views.home, name="home"),
    path("projektai/", views.portfolio, name="portfolio"),
    path("apie-mus/", views.about, name="about"),
    path("kontaktai/", views.contact, name="contact"),
]
