from django.contrib import admin
from .models import ContactInquiry, PortfolioProject


@admin.register(PortfolioProject)
class PortfolioProjectAdmin(admin.ModelAdmin):
    list_display = ("title_lt", "category", "dimensions", "location", "year", "is_featured", "order")
    list_filter = ("category", "year", "is_featured")
    search_fields = ("title_lt", "title_en", "location")


@admin.register(ContactInquiry)
class ContactInquiryAdmin(admin.ModelAdmin):
    list_display = ("name", "email", "phone", "created_at")
    readonly_fields = ("created_at",)
