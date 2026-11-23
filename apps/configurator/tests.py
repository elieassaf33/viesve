from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class ViesveEndToEndTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_viesve")

    def setUp(self):
        self.api = APIClient()

    def test_pages_render_ok(self):
        for url in ["/", "/katalogas/", "/projektai/", "/apie-mus/", "/kontaktai/", "/konfiguratorius/", "/en/konfiguratorius/"]:
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 200, f"Failed on {url}")

    def test_calculate_api_adds_intermediate_posts_over_4m(self):
        resp = self.api.post(
            "/api/configurator/calculate/",
            {
                "width": 500,
                "depth": 450,
                "wallHeight": 230,
                "overhang": 30,
                "roofType": "pyramid",
                "roofFinish": "shingle-black",
                "woodFinish": "teak",
                "includeGutterFinial": True,
                "includeDecking": True,
                "walls": {"front": "glass", "back": "solid", "left": "louver", "right": "open"},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["bom"]["total_posts"], 8)
        self.assertEqual(data["bom"]["intermediate_posts"], 4)
        self.assertGreater(data["total_price"], 3000)

    def test_save_share_and_pdf_generation(self):
        save_resp = self.api.post(
            "/api/configurator/save/",
            {
                "config": {
                    "width": 400,
                    "depth": 400,
                    "wallHeight": 230,
                    "overhang": 30,
                    "roofType": "pyramid",
                    "roofFinish": "shingle-black",
                    "woodFinish": "teak",
                    "walls": {"front": "glass", "back": "solid", "left": "open", "right": "open"},
                }
            },
            format="json",
        )
        self.assertEqual(save_resp.status_code, 201)
        payload = save_resp.json()
        share_resp = self.client.get(payload["share_url"])
        self.assertEqual(share_resp.status_code, 200)

        pdf_resp = self.client.get(payload["pdf_url"])
        self.assertEqual(pdf_resp.status_code, 200)
        self.assertEqual(pdf_resp["Content-Type"], "application/pdf")
        self.assertTrue(pdf_resp.content.startswith(b"%PDF"))

    def test_quote_submission(self):
        resp = self.api.post(
            "/api/configurator/quote/",
            {
                "config": {"width": 350, "depth": 350, "wallHeight": 230, "overhang": 30},
                "customer_name": "Jonas Jonaitis",
                "customer_email": "jonas@example.lt",
                "customer_phone": "+37060012345",
                "customer_notes": "Vilnius",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()["status"], "submitted")

    def test_lithuanian_is_default_and_language_switcher_works(self):
        # Even with Accept-Language: en-US, unprefixed "/" must render Lithuanian
        home_resp = self.client.get("/", HTTP_ACCEPT_LANGUAGE="en-US,en;q=0.9")
        self.assertEqual(home_resp.status_code, 200)
        self.assertContains(home_resp, '<html lang="lt">')
        self.assertContains(home_resp, "Susikonfigūruokite 3D")

        # Switching to English redirects to /en/
        en_resp = self.client.post("/i18n/setlang/", {"language": "en", "next": "/konfiguratorius/"})
        self.assertEqual(en_resp.status_code, 302)
        self.assertEqual(en_resp["Location"], "/en/konfiguratorius/")

        # Switching back to Lithuanian from /en/konfiguratorius/ strips /en/ and renders lt
        lt_resp = self.client.post("/i18n/setlang/", {"language": "lt", "next": "/en/konfiguratorius/"}, follow=True)
        self.assertEqual(lt_resp.status_code, 200)
        self.assertEqual(lt_resp.redirect_chain[-1][0], "/konfiguratorius/")
        self.assertContains(lt_resp, '<html lang="lt">')
        self.assertContains(lt_resp, "Matmenys")
