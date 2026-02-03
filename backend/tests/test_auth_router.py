import pytest


def test_register_user(client):
    response = client.post("/api/auth/register", json={
        "email": "test@example.com",
        "name": "Test User",
        "password": "password123"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data


def test_register_duplicate_email(client):
    # Register first user
    client.post("/api/auth/register", json={
        "email": "duplicate@example.com",
        "name": "First User",
        "password": "password123"
    })

    # Try to register with same email
    response = client.post("/api/auth/register", json={
        "email": "duplicate@example.com",
        "name": "Second User",
        "password": "password456"
    })
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_user(client):
    # First register
    client.post("/api/auth/register", json={
        "email": "login@example.com",
        "name": "Login User",
        "password": "password123"
    })

    # Then login
    response = client.post("/api/auth/login", json={
        "email": "login@example.com",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials(client):
    # Register a user
    client.post("/api/auth/register", json={
        "email": "valid@example.com",
        "name": "Valid User",
        "password": "password123"
    })

    # Try to login with wrong password
    response = client.post("/api/auth/login", json={
        "email": "valid@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()


def test_login_nonexistent_user(client):
    response = client.post("/api/auth/login", json={
        "email": "nonexistent@example.com",
        "password": "password123"
    })
    assert response.status_code == 401
    assert "invalid" in response.json()["detail"].lower()
