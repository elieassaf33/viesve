from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.catalog.models import Category, StructureModel
from apps.configurator.models import MaterialFinish, PricingRule
from apps.core.models import PortfolioProject


class Command(BaseCommand):
    help = "Seed initial Viesvė catalog, pricing rules, materials, and portfolio."

    def handle(self, *args, **options):
        self._seed_materials()
        self._seed_pricing()
        self._seed_catalog()
        self._seed_portfolio()
        self.stdout.write(self.style.SUCCESS("Viesvė database seeded successfully."))

    def _seed_materials(self):
        wood_finishes = [
            ("natural-pine", "Natūrali pušis (neimpregnuota)", "Natural Untreated Pine", "#D7B286", 0.78, 0.02, 0.00, True, 1),
            ("teak", "Šiltas tikas", "Warm Teak", "#9C5B34", 0.65, 0.05, 18.50, False, 2),
            ("oak", "Auksinis ąžuolas", "Golden Oak", "#B57B45", 0.68, 0.04, 18.50, False, 3),
            ("anthracite", "Antracito pilka (RAL 7016)", "Anthracite Grey (RAL 7016)", "#32373D", 0.56, 0.12, 21.00, False, 4),
            ("white-wash", "Skandinaviška balta", "Scandinavian White Wash", "#EAE6DF", 0.62, 0.04, 19.50, False, 5),
        ]
        for code, lt, en, hx, rough, metal, ppl, is_def, order in wood_finishes:
            MaterialFinish.objects.update_or_create(
                code=code,
                defaults={
                    "kind": "wood_stain",
                    "name_lt": lt,
                    "name_en": en,
                    "hex_color": hx,
                    "roughness": rough,
                    "metalness": metal,
                    "price_per_liter": Decimal(str(ppl)),
                    "is_default": is_def,
                    "order": order,
                },
            )

        roof_finishes = [
            ("shingle-black", "Juodos bituminės čerpės", "Black Bitumen Shingles", "#1E2024", 0.85, 0.08, 34.00, True, 1),
            ("shingle-red", "Raudonos bituminės čerpės", "Terracotta Red Shingles", "#6E2E26", 0.84, 0.06, 34.00, False, 2),
            ("shingle-green", "Samanų žalios čerpės", "Forest Green Shingles", "#2B3F33", 0.84, 0.06, 34.00, False, 3),
            ("epdm-membrane", "EPDM guminė danga", "EPDM Rubber Membrane", "#26282B", 0.72, 0.05, 42.00, False, 4),
        ]
        for code, lt, en, hx, rough, metal, ppm2, is_def, order in roof_finishes:
            MaterialFinish.objects.update_or_create(
                code=code,
                defaults={
                    "kind": "roof_covering",
                    "name_lt": lt,
                    "name_en": en,
                    "hex_color": hx,
                    "roughness": rough,
                    "metalness": metal,
                    "price_per_m2": Decimal(str(ppm2)),
                    "is_default": is_def,
                    "order": order,
                },
            )

    def _seed_pricing(self):
        rules = [
            ("timber_m3", "Klijuoto tašo mediena (C24)", "Glulam Timber (C24)", "m³", "680.00"),
            ("post_unit", "140×140 mm stulpas su inkaru", "140×140 mm post with anchor", "vnt.", "65.00"),
            ("wall_solid_m2", "Špuntuotų lentų siena (28 mm)", "Tongue & groove wall (28 mm)", "m²", "88.00"),
            ("wall_half_m2", "Pusės aukščio baliustrada", "Half-wall balustrade", "m²", "62.00"),
            ("wall_louver_m2", "Medinės žaliuzės", "Wooden louver screen", "m²", "115.00"),
            ("glass_sliding_m", "Stumdoma grūdinto stiklo sistema", "Sliding tempered glass system", "m", "390.00"),
            ("roof_pyramid_base", "4-šlaičio piramidinio stogo mazgai", "4-sided pyramid roof joinery", "kompl.", "340.00"),
            ("roof_flat_base", "Plokščio stogo konstrukcija", "Flat roof construction", "kompl.", "240.00"),
            ("gutter_finial", "Lietvamzdžiai ir viršūnė", "Rain gutters & finial", "kompl.", "185.00"),
            ("decking_m2", "Terasinės grindys", "Terrace floor decking", "m²", "72.00"),
            ("assembly_engineering", "CNC apdirbimas ir tvirtinimai", "CNC joinery & hardware", "kompl.", "290.00"),
        ]
        for code, lt, en, unit, price in rules:
            PricingRule.objects.update_or_create(
                code=code,
                defaults={
                    "name_lt": lt,
                    "name_en": en,
                    "unit": unit,
                    "unit_price": Decimal(price),
                },
            )

    def _seed_catalog(self):
        cats = [
            ("pavesines", "Pavėsinės", "Gazebos", "Klasikinės ir modernios medinės pavėsinės su piramidiniu arba plokščiu stogu.", "Classic and modern timber gazebos with pyramid or flat roofs.", "pavilion", 1),
            ("pergolos", "Pergolos", "Pergolas", "Atviros architektūrinės pergolos su žaliuzėmis ir stumdomu stiklu.", "Open architectural pergolas with louvers and sliding glass.", "pergola", 2),
            ("stogines", "Stoginės", "Carports", "Tvirtos klijuotos medienos stoginės automobiliams ir terasoms.", "Heavy-duty glulam timber carports and terrace canopies.", "carport", 3),
            ("sodo-nameliai", "Sodo nameliai", "Garden Houses", "Uždaros poilsio ir darbo erdvės iš 44 mm špuntuotos medienos.", "Enclosed leisure and studio cabins from 44 mm interlocking timber.", "house", 4),
        ]
        cat_objs = {}
        for slug, lt, en, d_lt, d_en, icon, order in cats:
            obj, _ = Category.objects.update_or_create(
                slug=slug,
                defaults={
                    "name_lt": lt,
                    "name_en": en,
                    "description_lt": d_lt,
                    "description_en": d_en,
                    "icon_name": icon,
                    "order": order,
                },
            )
            cat_objs[slug] = obj

        models_data = [
            (
                cat_objs["pavesines"],
                "viesve-aurora-400",
                "Viesvė Aurora 400",
                "Viesvė Aurora 400",
                "Flagmanas su piramidiniu stogu ir stumdomu stiklu",
                "Flagship pyramid-roof pavilion with sliding glass",
                "Elegantiška 4×4 m pavėsinė su 140×140 mm klijuotos medienos stulpais, grūdinto stiklo sistema ir bituminėmis čerpėmis.",
                "Elegant 4×4 m pavilion featuring 140×140 mm glulam posts, tempered sliding glass walls, and bitumen shingles.",
                "4890.00",
                {
                    "width": 400,
                    "depth": 400,
                    "wallHeight": 230,
                    "overhang": 30,
                    "roofType": "pyramid",
                    "roofFinish": "shingle-black",
                    "woodFinish": "teak",
                    "includeGutterFinial": True,
                    "includeDecking": True,
                    "walls": {"front": "glass", "back": "solid", "left": "louver", "right": "glass"},
                },
                {"posts": "140×140 mm", "timber": "Šiaurinė eglė / pušis", "roof": "4-šlaitis piramidinis"},
                True,
                1,
            ),
            (
                cat_objs["pergolos"],
                "viesve-nordic-lounge",
                "Viesvė Nordic Lounge",
                "Viesvė Nordic Lounge",
                "Minimalistinė plokščio stogo pergola su žaliuzėmis",
                "Minimalist flat-roof pergola with wooden louvers",
                "Šiuolaikinė plokščio stogo konstrukcija su EPDM danga, antracito apdaila ir vertikaliomis medinėmis žaliuzėmis.",
                "Contemporary flat-roof structure with EPDM membrane, anthracite finish, and vertical timber louver screens.",
                "3950.00",
                {
                    "width": 450,
                    "depth": 350,
                    "wallHeight": 240,
                    "overhang": 25,
                    "roofType": "flat",
                    "roofFinish": "epdm-membrane",
                    "woodFinish": "anthracite",
                    "includeGutterFinial": False,
                    "includeDecking": True,
                    "walls": {"front": "open", "back": "louver", "left": "louver", "right": "open"},
                },
                {"posts": "140×140 mm", "timber": "Klijuota eglė", "roof": "Plokščias EPDM"},
                True,
                2,
            ),
            (
                cat_objs["stogines"],
                "viesve-terra-carport",
                "Viesvė Terra Stoginė",
                "Viesvė Terra Carport",
                "Atvira 5×3.5 m stoginė automobiliui ar terasai",
                "Open 5×3.5 m carport or terrace canopy",
                "Sustiprinta konstrukcija su tarpiniais atraminiais stulpais didesniam nei 4 m tarpatramiui.",
                "Reinforced span structure with automatic intermediate posts for spans exceeding 4.0 m.",
                "3290.00",
                {
                    "width": 500,
                    "depth": 350,
                    "wallHeight": 245,
                    "overhang": 35,
                    "roofType": "flat",
                    "roofFinish": "epdm-membrane",
                    "woodFinish": "oak",
                    "includeGutterFinial": True,
                    "includeDecking": False,
                    "walls": {"front": "open", "back": "open", "left": "half", "right": "open"},
                },
                {"posts": "140×140 mm (6 vnt.)", "timber": "C24 klijuotas tašas", "roof": "Plokščias"},
                True,
                3,
            ),
            (
                cat_objs["sodo-nameliai"],
                "viesve-studio-cabin",
                "Viesvė Studio 350",
                "Viesvė Studio 350",
                "Uždaras sodo namelis su panoraminiu stiklu",
                "Enclosed garden studio cabin with panoramic glass",
                "Jaukus 3.5×3.5 m sodo namelis darbui ar poilsiui su trimis aklinomis sienomis ir stumdomu stiklo fasadu.",
                "Cozy 3.5×3.5 m garden cabin for work or relaxation with three solid walls and sliding glass facade.",
                "5150.00",
                {
                    "width": 350,
                    "depth": 350,
                    "wallHeight": 230,
                    "overhang": 30,
                    "roofType": "pyramid",
                    "roofFinish": "shingle-black",
                    "woodFinish": "natural-pine",
                    "includeGutterFinial": True,
                    "includeDecking": True,
                    "walls": {"front": "glass", "back": "solid", "left": "solid", "right": "solid"},
                },
                {"posts": "140×140 mm", "timber": "Špuntuota 28 mm", "roof": "Piramidinis"},
                True,
                4,
            ),
        ]

        for cat, slug, lt, en, t_lt, t_en, d_lt, d_en, price, cfg, specs, feat, order in models_data:
            StructureModel.objects.update_or_create(
                slug=slug,
                defaults={
                    "category": cat,
                    "name_lt": lt,
                    "name_en": en,
                    "tagline_lt": t_lt,
                    "tagline_en": t_en,
                    "description_lt": d_lt,
                    "description_en": d_en,
                    "base_price": Decimal(price),
                    "default_config_json": cfg,
                    "specs_json": specs,
                    "is_featured": feat,
                    "order": order,
                },
            )

    def _seed_portfolio(self):
        projects = [
            ("Pavilnė, Vilnius — Aurora 400", "Pavilnė, Vilnius — Aurora 400", "gazebo", "400 × 400 cm", "Šiltas tikas", "4-šlaitis piramidinis", "Vilnius", 2025, "Privati poilsio pavėsinė su grūdinto stiklo sistema ir paslėptu LED apšvietimu.", "Private leisure pavilion with tempered sliding glass and concealed LED lighting.", "#9C5B34", "viesve-aurora-400", 1),
            ("Nida — Nordic Lounge", "Nida — Nordic Lounge", "pergola", "450 × 350 cm", "Antracito pilka", "Plokščias EPDM", "Neringa", 2025, "Atspari pajūrio vėjams pergola su vertikaliomis žaliuzėmis.", "Coastal wind-resistant pergola with vertical timber louvers.", "#32373D", "viesve-nordic-lounge", 2),
            ("Kauno raj. — Terra Stoginė", "Kaunas District — Terra Carport", "carport", "500 × 350 cm", "Auksinis ąžuolas", "Plokščias EPDM", "Kaunas", 2024, "Dviejų tarpatramių klijuotos medienos stoginė prie modernaus namo.", "Two-bay glulam carport integrated beside a contemporary residence.", "#B57B45", "viesve-terra-carport", 3),
            ("Trakai — Studio 350", "Trakai — Studio 350", "garden_house", "350 × 350 cm", "Natūrali pušis", "4-šlaitis piramidinis", "Trakai", 2025, "Ežero pakrantės sodo studija su panoraminėmis stumdomomis durimis.", "Lakeside garden studio with panoramic sliding glass doors.", "#D7B286", "viesve-studio-cabin", 4),
        ]
        for lt, en, cat, dim, wood, roof, loc, yr, d_lt, d_en, acc, slug, order in projects:
            PortfolioProject.objects.update_or_create(
                title_lt=lt,
                defaults={
                    "title_en": en,
                    "category": cat,
                    "dimensions": dim,
                    "wood_finish": wood,
                    "roof_type": roof,
                    "location": loc,
                    "year": yr,
                    "description_lt": d_lt,
                    "description_en": d_en,
                    "accent_color": acc,
                    "preset_slug": slug,
                    "is_featured": True,
                    "order": order,
                },
            )
