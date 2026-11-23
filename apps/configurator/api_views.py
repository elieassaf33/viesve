from django.conf import settings
from django.core.mail import send_mail
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import StructureModel
from .models import MaterialFinish, SavedConfiguration
from .pricing import calculate_bom_and_price
from .serializers import (
    CalculateRequestSerializer,
    MaterialFinishSerializer,
    QuoteSubmitSerializer,
    SaveConfigSerializer,
    SavedConfigurationSerializer,
)


class OptionsAPIView(APIView):
    """Return available material finishes and presets."""

    def get(self, request):
        finishes = MaterialFinish.objects.all()
        wood = MaterialFinishSerializer(finishes.filter(kind="wood_stain"), many=True).data
        roof = MaterialFinishSerializer(finishes.filter(kind="roof_covering"), many=True).data
        return Response({"wood_finishes": wood, "roof_finishes": roof})


class CalculateAPIView(APIView):
    """Validate structural rules and return live BOM + pricing."""

    def post(self, request):
        serializer = CalculateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = calculate_bom_and_price(serializer.validated_data)
        return Response(result, status=status.HTTP_200_OK)


class SaveConfigAPIView(APIView):
    """Persist a configuration and return its unique shareable UUID URL."""

    def post(self, request):
        serializer = SaveConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        calc = calculate_bom_and_price(data["config"])

        structure = None
        if data.get("structure_slug"):
            structure = StructureModel.objects.filter(slug=data["structure_slug"]).first()

        saved = SavedConfiguration.objects.create(
            structure_model=structure,
            config_json=calc["config"],
            bom_json=calc["bom"],
            total_price=calc["total_price"],
            snapshot_data_url=data.get("snapshot_data_url", ""),
            status="draft",
        )
        return Response(SavedConfigurationSerializer(saved).data, status=status.HTTP_201_CREATED)


class QuoteSubmitAPIView(APIView):
    """Save configuration as submitted quote and notify admin via email."""

    def post(self, request):
        serializer = QuoteSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        calc = calculate_bom_and_price(data["config"])

        structure = None
        if data.get("structure_slug"):
            structure = StructureModel.objects.filter(slug=data["structure_slug"]).first()

        saved = SavedConfiguration.objects.create(
            structure_model=structure,
            config_json=calc["config"],
            bom_json=calc["bom"],
            total_price=calc["total_price"],
            snapshot_data_url=data.get("snapshot_data_url", ""),
            customer_name=data["customer_name"],
            customer_email=data["customer_email"],
            customer_phone=data.get("customer_phone", ""),
            customer_notes=data.get("customer_notes", ""),
            status="submitted",
        )

        cfg = calc["config"]
        try:
            send_mail(
                subject=f"[Viesvė 3D] Naujas užsakymas ({cfg['width']}×{cfg['depth']} cm) — {saved.total_price} €",
                message=(
                    f"Klientas: {saved.customer_name}\n"
                    f"El. paštas: {saved.customer_email}\n"
                    f"Telefonas: {saved.customer_phone}\n"
                    f"Matmenys: {cfg['width']} × {cfg['depth']} × {cfg['wallHeight']} cm\n"
                    f"Stogas: {cfg['roofType']} ({cfg['roofFinish']})\n"
                    f"Mediena: {cfg['woodFinish']}\n"
                    f"Bendra kaina: {saved.total_price} EUR\n"
                    f"Nuoroda: /konfiguratorius/c/{saved.uuid}/\n\n"
                    f"Pastabos:\n{saved.customer_notes}"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.QUOTE_NOTIFICATION_EMAIL],
                fail_silently=True,
            )
        except Exception:
            pass

        return Response(SavedConfigurationSerializer(saved).data, status=status.HTTP_201_CREATED)
