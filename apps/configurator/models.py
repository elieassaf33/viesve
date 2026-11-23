import uuid
from django.db import models
from apps.catalog.models import StructureModel


class MaterialFinish(models.Model):
    KIND_CHOICES = [
        ("wood_stain", "Medienos apdaila / dažai"),
        ("roof_covering", "Stogo danga"),
    ]

    kind = models.CharField(max_length=24, choices=KIND_CHOICES)
    code = models.SlugField(unique=True)
    name_lt = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    hex_color = models.CharField(max_length=16, default="#D4A977")
    roughness = models.FloatField(default=0.72)
    metalness = models.FloatField(default=0.05)
    price_per_m2 = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    price_per_liter = models.DecimalField(max_digits=8, decimal_places=2, default=0.00)
    is_default = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["kind", "order", "name_lt"]

    def __str__(self):
        return f"{self.get_kind_display()}: {self.name_lt}"


class PricingRule(models.Model):
    code = models.SlugField(unique=True)
    name_lt = models.CharField(max_length=120)
    name_en = models.CharField(max_length=120)
    unit = models.CharField(max_length=24, default="vnt.")
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} ({self.unit_price} EUR/{self.unit})"


class SavedConfiguration(models.Model):
    STATUS_CHOICES = [
        ("draft", "Juodraštis"),
        ("submitted", "Pateikta užklausa"),
        ("reviewed", "Peržiūrėta"),
    ]

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    structure_model = models.ForeignKey(
        StructureModel,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="saved_configs",
    )
    config_json = models.JSONField(default=dict)
    bom_json = models.JSONField(default=dict)
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    snapshot_data_url = models.TextField(blank=True)

    customer_name = models.CharField(max_length=120, blank=True)
    customer_email = models.EmailField(blank=True)
    customer_phone = models.CharField(max_length=40, blank=True)
    customer_notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        label = self.customer_name or str(self.uuid)[:8]
        return f"Konfigūracija {label} — {self.total_price} €"
