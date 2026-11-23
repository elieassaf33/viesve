from rest_framework import serializers
from .models import MaterialFinish, SavedConfiguration


class MaterialFinishSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialFinish
        fields = [
            "id",
            "kind",
            "code",
            "name_lt",
            "name_en",
            "hex_color",
            "roughness",
            "metalness",
            "price_per_m2",
            "price_per_liter",
            "is_default",
        ]


class CalculateRequestSerializer(serializers.Serializer):
    width = serializers.IntegerField(min_value=250, max_value=600, default=400)
    depth = serializers.IntegerField(min_value=250, max_value=600, default=400)
    wallHeight = serializers.IntegerField(min_value=210, max_value=260, default=230)
    overhang = serializers.IntegerField(min_value=20, max_value=40, default=30)
    roofType = serializers.ChoiceField(choices=["pyramid", "flat"], default="pyramid")
    roofFinish = serializers.CharField(default="shingle-black")
    woodFinish = serializers.CharField(default="natural-pine")
    includeGutterFinial = serializers.BooleanField(default=True)
    includeDecking = serializers.BooleanField(default=True)
    walls = serializers.DictField(child=serializers.CharField(), required=False)


class SaveConfigSerializer(serializers.Serializer):
    config = CalculateRequestSerializer()
    snapshot_data_url = serializers.CharField(required=False, allow_blank=True, default="")
    structure_slug = serializers.SlugField(required=False, allow_blank=True, default="")


class QuoteSubmitSerializer(serializers.Serializer):
    config = CalculateRequestSerializer()
    snapshot_data_url = serializers.CharField(required=False, allow_blank=True, default="")
    structure_slug = serializers.SlugField(required=False, allow_blank=True, default="")
    customer_name = serializers.CharField(max_length=120)
    customer_email = serializers.EmailField()
    customer_phone = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")
    customer_notes = serializers.CharField(required=False, allow_blank=True, default="")


class SavedConfigurationSerializer(serializers.ModelSerializer):
    share_url = serializers.SerializerMethodField()
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = SavedConfiguration
        fields = [
            "uuid",
            "config_json",
            "bom_json",
            "total_price",
            "status",
            "created_at",
            "share_url",
            "pdf_url",
        ]

    def get_share_url(self, obj):
        return f"/konfiguratorius/c/{obj.uuid}/"

    def get_pdf_url(self, obj):
        return f"/konfiguratorius/c/{obj.uuid}/pdf/"
