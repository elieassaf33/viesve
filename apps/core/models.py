from django.db import models


class PortfolioProject(models.Model):
    CATEGORY_CHOICES = [
        ("gazebo", "Pavėsinė"),
        ("pergola", "Pergola"),
        ("carport", "Stoginė"),
        ("garden_house", "Sodo namelis"),
    ]

    title_lt = models.CharField(max_length=160)
    title_en = models.CharField(max_length=160)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default="gazebo")
    dimensions = models.CharField(max_length=64, help_text="e.g. 400 × 400 cm")
    wood_finish = models.CharField(max_length=80, default="Natūrali pušis")
    roof_type = models.CharField(max_length=80, default="4-šlaitis piramidinis")
    location = models.CharField(max_length=100, default="Vilnius")
    year = models.PositiveIntegerField(default=2025)
    description_lt = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    accent_color = models.CharField(max_length=16, default="#C89B6E")
    preset_slug = models.SlugField(blank=True)
    is_featured = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["order", "-year"]

    def __str__(self):
        return f"{self.title_lt} ({self.dimensions})"

    def get_title(self, lang="lt"):
        return self.title_en if lang == "en" and self.title_en else self.title_lt

    def get_description(self, lang="lt"):
        return self.description_en if lang == "en" and self.description_en else self.description_lt


class ContactInquiry(models.Model):
    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True)
    message = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({self.email})"
