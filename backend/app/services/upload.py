import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
LOCAL_UPLOAD_DIR = Path("uploads/vendor-images")


async def upload_image(file: UploadFile, folder: str = "vendor-images") -> str:
    content_type = file.content_type or ""
    if content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, WebP and GIF images are allowed")

    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be under 5 MB")

    from app.core.config import ENVIRONMENT
    if ENVIRONMENT == "production":
        return _upload_to_cloudinary(content, folder)
    return _save_locally(content, file.filename or "image.jpg")


async def delete_image(url: str) -> None:
    from app.core.config import ENVIRONMENT
    if ENVIRONMENT == "production":
        _delete_from_cloudinary(url)
    else:
        _delete_locally(url)


# ── Local (development) ──────────────────────────────────────────────────────

def _save_locally(content: bytes, original_filename: str) -> str:
    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(original_filename).suffix.lower() or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = LOCAL_UPLOAD_DIR / filename
    file_path.write_bytes(content)
    return f"/uploads/vendor-images/{filename}"


def _delete_locally(url: str) -> None:
    relative = url.lstrip("/")
    path = Path(relative)
    if path.exists():
        path.unlink()


# ── Cloudinary (production) ──────────────────────────────────────────────────

def _upload_to_cloudinary(content: bytes, folder: str) -> str:
    import cloudinary
    import cloudinary.uploader
    from app.core.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )
    result = cloudinary.uploader.upload(content, folder=folder, resource_type="image")
    return result["secure_url"]


def _delete_from_cloudinary(url: str) -> None:
    import cloudinary
    import cloudinary.uploader
    from app.core.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )
    public_id = _extract_cloudinary_public_id(url)
    cloudinary.uploader.destroy(public_id)


def _extract_cloudinary_public_id(url: str) -> str:
    # https://res.cloudinary.com/cloud/image/upload/v123/vendor-images/abc.jpg
    # -> vendor-images/abc
    try:
        after_upload = url.split("/upload/")[1]
        # Strip version segment (v1234567/)
        if after_upload.startswith("v") and "/" in after_upload:
            after_upload = after_upload.split("/", 1)[1]
        return after_upload.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return url
