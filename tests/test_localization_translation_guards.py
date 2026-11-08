import tempfile
import unittest
import json
from pathlib import Path
from unittest.mock import patch

from localization_backfill_service import (
    LocalizationBackfillService,
    blocking_quality_warnings,
    has_corrupt_iso_reference,
    localization_quality_warnings,
    localized_title_from_raw,
    model_token_cost,
    normalize_localized_listing,
    parse_localized_listing,
    usage_with_new_attempt,
)


class LocalizationTranslationGuardsTest(unittest.TestCase):
    def test_corrupt_iso_reference_is_detected_without_rejecting_the_standard(self):
        self.assertTrue(has_corrupt_iso_reference("ISO / ASTM 52900me ISO/ASTM 52900"))
        self.assertFalse(has_corrupt_iso_reference("ISO/ASTM 52900"))

    def test_automation_tracking_entry_can_be_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            service = LocalizationBackfillService(
                Path(directory),
                catalog_loader=lambda shop_key: {},
                openai_request=lambda request: (200, {}),
                translation_publisher=lambda *args: {},
            )
            queued = service.enqueue_automation("grosgeek", "123", "collection")
            automation_id = queued["automationId"]

            result = service.automation_action(automation_id, "delete")

            self.assertEqual(result["deleted"], True)
            self.assertEqual(service.automation_dashboard()["entries"], [])
            with self.assertRaisesRegex(ValueError, "introuvable"):
                service.automation_entry(automation_id)

    def test_active_automation_cannot_be_deleted(self):
        with tempfile.TemporaryDirectory() as directory:
            service = LocalizationBackfillService(
                Path(directory),
                catalog_loader=lambda shop_key: {},
                openai_request=lambda request: (200, {}),
                translation_publisher=lambda *args: {},
            )
            automation_id = service.enqueue_automation(
                "grosgeek", "123", "collection"
            )["automationId"]
            with service._db_lock, service._connect() as connection:
                connection.execute(
                    "UPDATE localization_automation_entries SET state='publishing' WHERE automation_id=?",
                    (automation_id,),
                )

            with self.assertRaisesRegex(ValueError, "en cours"):
                service.automation_action(automation_id, "delete")
            self.assertEqual(service.automation_entry(automation_id)["entry"]["state"], "publishing")

    def test_start_now_checks_etsy_and_skips_the_stability_delay(self):
        listing = {
            "listingId": "123", "state": "active", "title": "Titre français",
            "description": "Description française", "tags": ["figurine à peindre"],
            "imageUrl": "https://example.com/cover.jpg", "translations": [],
        }
        with tempfile.TemporaryDirectory() as directory:
            service = LocalizationBackfillService(
                Path(directory),
                catalog_loader=lambda shop_key: {},
                openai_request=lambda request: (200, {}),
                translation_publisher=lambda *args: {},
                listing_loader=lambda shop_key, listing_ids: {"listings": [listing]},
            )
            automation_id = service.enqueue_automation("grosgeek", "123", "collection")["automationId"]
            with patch.object(service, "_prompt_version", return_value="test"):
                result = service.automation_action(automation_id, "start_now")

            self.assertEqual(result["entry"]["state"], "generating")
            self.assertEqual(result["entry"]["imageUrl"], listing["imageUrl"])
            self.assertTrue(result["entry"]["runId"])
            self.assertEqual(len(result["entry"]["languages"]), 10)

    def test_start_now_rejects_an_inactive_etsy_listing(self):
        with tempfile.TemporaryDirectory() as directory:
            service = LocalizationBackfillService(
                Path(directory),
                catalog_loader=lambda shop_key: {},
                openai_request=lambda request: (200, {}),
                translation_publisher=lambda *args: {},
                listing_loader=lambda shop_key, listing_ids: {
                    "listings": [{"listingId": "123", "state": "draft", "title": "X", "description": "Y"}]
                },
            )
            automation_id = service.enqueue_automation("grosgeek", "123", "collection")["automationId"]
            with self.assertRaisesRegex(ValueError, "active sur Etsy"):
                service.automation_action(automation_id, "start_now")
            self.assertEqual(service.automation_entry(automation_id)["entry"]["state"], "waiting_activation")

    def test_lost_3d_and_italian_fan_art_block_publication(self):
        source = {"title": "Coen, figurine imprimée en 3D", "tags": []}
        output = {"title": "Coen Fan Art", "tags": [], "description": ""}

        warnings = localization_quality_warnings(source, output, language="it")
        blocked = {warning["code"] for warning in blocking_quality_warnings(warnings)}

        self.assertIn("missing_title_technical_token", blocked)
        self.assertIn("italian_forbidden_fan_art", blocked)

    def test_drastically_shortened_english_title_blocks_publication(self):
        source = {
            "title": "Coen - The blood of dawnwalker's, garage kit de collection en résine à peindre, figurine imprimée en 3D pour fans de vampire",
            "tags": [],
        }
        output = {
            "title": "Coen The Blood of Dawnwalker's Unpainted Resin Garage Kit Vampire Figure",
            "tags": [],
        }

        warnings = localization_quality_warnings(source, output, language="en")
        blocked = {warning["code"] for warning in blocking_quality_warnings(warnings)}

        self.assertIn("suspicious_title_length", blocked)
        self.assertIn("missing_title_commas", blocked)

    def test_japanese_title_keeps_the_three_source_groups(self):
        source = {"title": "Karlach - Baldur's Gate 3, figurine en résine à peindre, garage kit pour fans de RPG"}
        first = localization_quality_warnings(source, {
            "title": "Karlach - Baldur's Gate 3 未塗装レジンフィギュア ガレージキット RPGファン向け",
        }, language="ja")
        self.assertIn("missing_title_commas", {warning["code"] for warning in first})
        accepted = localization_quality_warnings(source, {
            "title": "Karlach - Baldur's Gate 3、未塗装レジンフィギュア、RPGファン向けガレージキット",
        }, language="ja")
        self.assertNotIn("missing_title_commas", {warning["code"] for warning in accepted})

    def test_failed_output_keeps_its_title_and_generation_cost_on_retry(self):
        raw = '{"title":"日本語のタイトル", "tags":["long tag"]}'
        self.assertEqual(localized_title_from_raw(raw, "ja"), "日本語のタイトル")
        previous = {"input_tokens": 100, "output_tokens": 50}
        next_usage = {"input_tokens": 120, "output_tokens": 60}
        job = {"usage_json": json.dumps(previous), "usage_history_json": "[]"}
        history = json.loads(usage_with_new_attempt(job, next_usage))
        self.assertEqual(history, [previous, next_usage])

    def test_luna_cost_uses_current_rates_and_long_context_tier(self):
        short_cost = model_token_cost(
            "gpt-5.6-luna", 1000, 100, cached_tokens=100,
        )
        self.assertAlmostEqual(short_cost, 900 * 0.20 / 1_000_000 + 100 * 0.02 / 1_000_000 + 100 * 1.20 / 1_000_000)
        long_cost = model_token_cost("gpt-5.6-luna", 273_000, 100)
        self.assertAlmostEqual(long_cost, 273_000 * 0.40 / 1_000_000 + 100 * 1.80 / 1_000_000)

    def test_localized_title_keeps_commas_without_putting_them_in_tags(self):
        output = normalize_localized_listing({
            "title": "Coen, resin garage kit, unpainted 3D figure",
            "tags": ["resin, figure"],
            "description": "",
        }, "en")

        self.assertEqual(output["title"], "Coen, resin garage kit, unpainted 3D figure")
        self.assertEqual(output["tags"], ["resin figure"])

    def test_dutch_paintable_tags_are_shortened_before_length_validation(self):
        for original, expected in (
            ("verzamelfiguur om te schilderen", "beschilderbare verzamelfiguur"),
            ("Metroid figuur om te schilderen", "Metroid beschilderbaar figuur"),
            ("Deadpool figuur om te schilderen", "Deadpool beschilderbaar figuur"),
        ):
            with self.subTest(original=original):
                output = parse_localized_listing(
                    '{"title":"Figuur", "description":"Beschrijving", "tags":["' + original + '"]}',
                    "nl",
                )
                self.assertEqual(output["tags"], [expected])
                self.assertLessEqual(len(output["tags"][0]), 30)


if __name__ == "__main__":
    unittest.main()
