import unittest

from server import threads_carousel_image_urls_from_instagram


class ThreadsCarouselSourcesTest(unittest.TestCase):
    def test_instagram_carousel_preserves_image_order(self):
        media = {
            "media_type": "CAROUSEL_ALBUM",
            "children": {"data": [
                {"media_type": "IMAGE", "media_url": "https://cdn.example/first.jpg"},
                {"media_type": "IMAGE", "media_url": "https://cdn.example/second.jpg"},
            ]},
        }
        self.assertEqual(
            threads_carousel_image_urls_from_instagram(media, 2),
            ["https://cdn.example/first.jpg", "https://cdn.example/second.jpg"],
        )
        self.assertEqual(len(threads_carousel_image_urls_from_instagram(media, 0)), 2)

    def test_mismatch_or_unusable_media_blocks_publication(self):
        media = {
            "media_type": "CAROUSEL_ALBUM",
            "children": {"data": [
                {"media_type": "IMAGE", "media_url": "https://cdn.example/first.jpg"},
                {"media_type": "VIDEO", "media_url": "https://cdn.example/second.mp4"},
            ]},
        }
        with self.assertRaisesRegex(ValueError, "au lieu"):
            threads_carousel_image_urls_from_instagram(media, 3)
        with self.assertRaisesRegex(ValueError, "n’est pas une image"):
            threads_carousel_image_urls_from_instagram(media, 2)


if __name__ == "__main__":
    unittest.main()
