import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from fastapi.testclient import TestClient
import unittest.mock as mock

# Import app with mocked model loading (no .zip files needed for tests)
with mock.patch("server.load_models"):
    from server import app, MODELS

@pytest.fixture
def client():
    return TestClient(app)

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "models_loaded" in data

def test_action_with_no_model_returns_fallback(client):
    """If model not loaded, /action returns a valid legal action."""
    MODELS.clear()
    payload = {
        "state": {
            "hand": [3.0, -1.0, 7.0, -1.0],
            "discard_top": 5.0,
            "drawn_card": -1.0,
            "bot_total": 0.0,
            "opp_total": 0.0,
            "opp_count": 4.0,
            "round_num": 1.0,
            "phase": 0.0,
        },
        "difficulty": "medium",
        "legal_actions": [0, 1],
    }
    r = client.post("/action", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert "action_index" in data
    assert "action_name" in data
    assert data["action_index"] in [0, 1]
