from django.contrib import admin
from .models import Category, StructureModel


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name_lt", "name_en", "slug", "order")
    prepopulated_fields = {"slug": ("name_en",)}


@admin.register(StructureModel)
class StructureModelAdmin(admin.ModelAdmin):
    list_display = ("name_lt", "category", "base_price", "is_featured", "order")
    list_filter = ("category", "is_featured")
    prepopulated_fields = {"slug": ("name_en",)}
