import os
import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
CHUNK_SIZE = 8 * 1024              # 8 KB read chunks
LOCAL_UPLOAD_DIR = Path("uploads/vendor-images")


def _validate_magic_bytes(content: bytes) -> bool:
    """
    Verify the actual file bytes match a known image format.
    Content-Type header from the client is untrusted and trivially spoofed.
    """
    if content[:3] == b"\xff\xd8\xff":
        return True  # JPEG
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return True  # PNG
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return True  # GIF
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return True  # WebP
    return False


async def _read_limited(file: UploadFile, max_bytes: int) -> bytes:
    """
    Read the upload in chunks and abort as soon as the size limit is exceeded.
    Prevents OOM from large malicious uploads.
    """
    content = b""
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        content += chunk
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"Image must be under {max_bytes // (1024 * 1024)} MB",
            )
    return content


async def upload_image(file: UploadFile, folder: str = "vendor-images") -> str:
    # 1. Check declared Content-Type (fast pre-filter, not trusted alone)
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only JPEG, PNG, WebP, and GIF images are allowed",
        )

    # 2. Stream into memory with size cap (prevents OOM on large uploads)
    content = await _read_limited(file, MAX_SIZE_BYTES)

    # 3. Verify actual file magic bytes (defends against Content-Type spoofing)
    if not _validate_magic_bytes(content):
        raise HTTPException(
            status_code=400,
            detail="File content does not match a supported image format",
        )

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


# ── Local (development) ───────────────────────────────────────────────────────

def _save_locally(content: bytes, original_filename: str) -> str:
    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(original_filename).suffix.lower()
    # Only allow known-safe extensions
    if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = LOCAL_UPLOAD_DIR / filename
    file_path.write_bytes(content)
    return f"/uploads/vendor-images/{filename}"


def _delete_locally(url: str) -> None:
    relative = url.lstrip("/")
    path = Path(relative)
    if path.exists():
        path.unlink()


# ── Cloudinary (production) ───────────────────────────────────────────────────

# Configure Cloudinary once at module level when in production, not on every call.
_cloudinary_configured = False

def _ensure_cloudinary_configured() -> None:
    global _cloudinary_configured
    if _cloudinary_configured:
        return
    import cloudinary
    from app.core.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
    if not all([CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET]):
        raise RuntimeError(
            "Cloudinary credentials are not set. "
            "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in your .env"
        )
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
    )
    _cloudinary_configured = True


def _upload_to_cloudinary(content: bytes, folder: str) -> str:
    import cloudinary.uploader
    _ensure_cloudinary_configured()
    result = cloudinary.uploader.upload(content, folder=folder, resource_type="image")
    return result["secure_url"]


def _delete_from_cloudinary(url: str) -> None:
    import cloudinary.uploader
    _ensure_cloudinary_configured()
    public_id = _extract_cloudinary_public_id(url)
    cloudinary.uploader.destroy(public_id)


def _extract_cloudinary_public_id(url: str) -> str:
    # https://res.cloudinary.com/cloud/image/upload/v123/vendor-images/abc.jpg
    # → vendor-images/abc
    try:
        after_upload = url.split("/upload/")[1]
        if after_upload.startswith("v") and "/" in after_upload:
            after_upload = after_upload.split("/", 1)[1]
        return after_upload.rsplit(".", 1)[0]
    except (IndexError, ValueError):
        return url
