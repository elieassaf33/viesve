from django.urls import path
from . import api_views

urlpatterns = [
    path("options/", api_views.OptionsAPIView.as_view(), name="api-configurator-options"),
    path("calculate/", api_views.CalculateAPIView.as_view(), name="api-configurator-calculate"),
    path("save/", api_views.SaveConfigAPIView.as_view(), name="api-configurator-save"),
    path("quote/", api_views.QuoteSubmitAPIView.as_view(), name="api-configurator-quote"),
]
