import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi import HTTPException
from PIL import Image
import main


class PhotoSearchTests(unittest.TestCase):
    def test_failed_model_is_not_a_fake_match(self):
        with patch.object(main, "compute_cat_focused_embedding", return_value=(None, "unavailable")):
            with self.assertRaises(HTTPException) as result:
                main.compute_image_embedding(Image.new("RGB", (8, 8)), "auto")
        self.assertEqual(result.exception.status_code, 503)

    def test_readiness_checks_weights(self):
        with patch.object(main, "_ready", False), patch.object(main, "get_cat_detector", side_effect=RuntimeError("no weights")):
            with self.assertRaises(HTTPException) as result:
                main.ready()
        self.assertEqual(result.exception.status_code, 503)

    def test_successful_readiness_is_cached(self):
        with patch.object(main, "_ready", False), patch.object(main, "get_cat_detector") as detector, patch.object(main, "get_transformers_embedder") as model:
            model.return_value.embed.return_value = np.ones(384)
            self.assertEqual(main.ready()["status"], "ready")
            main.ready()
            detector.assert_called_once()

    def test_corrupt_photo_returns_400(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(main.os.environ, {"UPLOAD_DIR": ""}):
            photo = Path(folder) / "bad.jpg"
            photo.write_text("not a photo")
            with self.assertRaises(HTTPException) as result:
                main.embed(main.EmbedRequest(imagePaths=[str(photo)]))
            self.assertEqual(result.exception.status_code, 400)

    def test_paths_stay_inside_uploads(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(main.os.environ, {"UPLOAD_DIR": folder}):
            with self.assertRaises(HTTPException) as result:
                main.resolve_image_path("../private.jpg")
            self.assertEqual(result.exception.status_code, 400)

    def test_empty_and_oversized_batches_are_rejected(self):
        for paths in [[], ["x.jpg"] * 5]:
            with self.assertRaises(HTTPException) as result:
                main.embed(main.EmbedRequest(imagePaths=paths))
            self.assertEqual(result.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()
