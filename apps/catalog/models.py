from django.db import models


class Category(models.Model):
    slug = models.SlugField(unique=True)
    name_lt = models.CharField(max_length=100)
    name_en = models.CharField(max_length=100)
    description_lt = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    icon_name = models.CharField(max_length=40, default="pavilion")
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name_lt"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name_lt

    def get_name(self, lang="lt"):
        return self.name_en if lang == "en" and self.name_en else self.name_lt

    def get_description(self, lang="lt"):
        return self.description_en if lang == "en" and self.description_en else self.description_lt


class StructureModel(models.Model):
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name="models")
    slug = models.SlugField(unique=True)
    name_lt = models.CharField(max_length=140)
    name_en = models.CharField(max_length=140)
    tagline_lt = models.CharField(max_length=200, blank=True)
    tagline_en = models.CharField(max_length=200, blank=True)
    description_lt = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=10, decimal_places=2, default=2890.00)
    default_config_json = models.JSONField(default=dict)
    specs_json = models.JSONField(default=dict)
    is_featured = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "name_lt"]

    def __str__(self):
        return self.name_lt

    def get_name(self, lang="lt"):
        return self.name_en if lang == "en" and self.name_en else self.name_lt

    def get_tagline(self, lang="lt"):
        return self.tagline_en if lang == "en" and self.tagline_en else self.tagline_lt

    def get_description(self, lang="lt"):
        return self.description_en if lang == "en" and self.description_en else self.description_lt
