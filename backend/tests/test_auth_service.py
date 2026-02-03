import pytest
from app.services.auth import AuthService


def test_password_hashing():
    auth = AuthService()
    password = "test_password_123"
    hashed = auth.hash_password(password)

    assert hashed != password
    assert auth.verify_password(password, hashed) is True
    assert auth.verify_password("wrong_password", hashed) is False


def test_token_creation():
    auth = AuthService()
    token = auth.create_access_token(data={"sub": "user@example.com"})

    assert token is not None
    assert isinstance(token, str)
    assert len(token) > 0


def test_token_decode():
    auth = AuthService()
    email = "user@example.com"
    token = auth.create_access_token(data={"sub": email})

    payload = auth.decode_token(token)

    assert payload is not None
    assert payload["sub"] == email
    assert "exp" in payload


def test_invalid_token_decode():
    auth = AuthService()

    # Invalid token should return None
    payload = auth.decode_token("invalid.token.here")

    assert payload is None
