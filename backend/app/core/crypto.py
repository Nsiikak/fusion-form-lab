"""Field encryption for bank account numbers (Fernet: AES-128-CBC + HMAC-SHA256).

Key: FIELD_ENCRYPTION_KEY (a Fernet key: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
If it isn't set, a key is derived from SECRET_KEY — fine for development, but in production set a
dedicated key and keep it backed up: losing it makes stored account numbers unreadable."""
import base64
import hashlib
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy.types import String, TypeDecorator

logger = logging.getLogger(__name__)
_fernet = None


def _cipher() -> Fernet:
    global _fernet
    if _fernet is None:
        key = os.getenv("FIELD_ENCRYPTION_KEY", "").strip()
        if not key:
            from app.core.config import SECRET_KEY
            key = base64.urlsafe_b64encode(hashlib.sha256(f"plagohive-fields:{SECRET_KEY}".encode()).digest()).decode()
        _fernet = Fernet(key.encode())
    return _fernet


def is_encrypted(value: str) -> bool:
    return isinstance(value, str) and value.startswith("gAAAA")


def encrypt(value):
    if value in (None, "") or is_encrypted(value):
        return value
    return _cipher().encrypt(str(value).encode()).decode()


def decrypt(value):
    if not is_encrypted(value):
        return value                     # legacy plain value (encrypted by the migration)
    try:
        return _cipher().decrypt(value.encode()).decode()
    except InvalidToken:
        logger.error("Couldn't decrypt a stored field: wrong FIELD_ENCRYPTION_KEY?")
        return None


class EncryptedString(TypeDecorator):
    """Stored encrypted, read back as plain text — transparent to the rest of the code."""
    impl = String(255)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt(value)

    def process_result_value(self, value, dialect):
        return decrypt(value)
