from django.contrib import admin
from .models import MaterialFinish, PricingRule, SavedConfiguration


@admin.register(MaterialFinish)
class MaterialFinishAdmin(admin.ModelAdmin):
    list_display = ("name_lt", "kind", "code", "hex_color", "price_per_m2", "price_per_liter", "is_default")
    list_filter = ("kind", "is_default")


@admin.register(PricingRule)
class PricingRuleAdmin(admin.ModelAdmin):
    list_display = ("code", "name_lt", "unit", "unit_price")


@admin.register(SavedConfiguration)
class SavedConfigurationAdmin(admin.ModelAdmin):
    list_display = ("uuid", "customer_name", "customer_email", "total_price", "status", "created_at")
    list_filter = ("status", "created_at")
    readonly_fields = ("uuid", "created_at", "updated_at")
    search_fields = ("uuid", "customer_name", "customer_email")
