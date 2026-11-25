"""
Image Processing Service for L&D Course Management.
Handles image format sanitization and color profile conversions.
"""

import io
from typing import Tuple

try:
    from PIL import Image
except ImportError:
    Image = None

def sanitize_and_convert_thumbnail(image_bytes: bytes) -> Tuple[bytes, str]:
    """
    LND-CRS-031: Detects CMYK color profile in uploaded course thumbnails (e.g. print-ready JPEGs)
    and automatically converts to sRGB color space to prevent inverted / psychedelic colors in web browsers.
    Returns: (processed_bytes, mime_type)
    """
    if not image_bytes or not Image:
        return image_bytes, "image/jpeg"

    try:
        img = Image.open(io.BytesIO(image_bytes))
        # If image is CMYK, convert to RGB
        if img.mode == "CMYK":
            rgb_img = img.convert("RGB")
            output = io.BytesIO()
            rgb_img.save(output, format="JPEG", quality=90)
            return output.getvalue(), "image/jpeg"
        elif img.mode not in ("RGB", "RGBA"):
            rgb_img = img.convert("RGB")
            output = io.BytesIO()
            rgb_img.save(output, format="JPEG", quality=90)
            return output.getvalue(), "image/jpeg"
        else:
            return image_bytes, "image/jpeg"
    except Exception as e:
        print(f"[sanitize_and_convert_thumbnail] Error processing image: {e}")
        return image_bytes, "image/jpeg"
