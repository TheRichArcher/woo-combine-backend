"""Real Firestore SDK/emulator integration; never contacts a production project.

Run with FIRESTORE_EMULATOR_HOST=127.0.0.1:8787 pytest backend/tests/test_draft_emulator.py
Auth alone is stubbed by app_client; persistence uses the real SDK and emulator.
"""
import os
import uuid
from concurrent.futures import ThreadPoolExecutor

import pytest
from google.auth.credentials import AnonymousCredentials
from google.cloud import firestore


@pytest.fixture()
def fake_db():
    host = os.getenv("FIRESTORE_EMULATOR_HOST", "")
    if not host:
        pytest.skip("Requires explicitly started local Firestore emulator")
    if not host.startswith(("127.0.0.1:", "localhost:")):
        pytest.fail("Emulator tests refuse non-local hosts")
    db = firestore.Client(project="demo-woo-test-" + uuid.uuid4().hex[:10], credentials=AnonymousCredentials())
    yield db
    db.close()


def test_sdk_document_transaction_read_is_iterator(fake_db):
    ref = fake_db.collection("probe").document("one")
    ref.set({"value": 1})
    @firestore.transactional
    def read(tx):
        streamed = tx.get(ref)
        assert iter(streamed) is streamed
        assert next(streamed).to_dict() == {"value": 1}
        assert ref.get(transaction=tx).exists
    read(fake_db.transaction())


def test_real_api_refresh_concurrent_pick_undo_and_completion(app_client, fake_db, organizer_headers):
    def post(path, data=None):
        response = app_client.post(path, json=data, headers=organizer_headers)
        assert response.status_code == 200, response.text
        return response.json()
    draft = post("/api/drafts", {"name": "Emulator rehearsal", "num_rounds": 2, "pick_timer_seconds": 0})
    base = "/api/drafts/" + draft["id"]
    teams = [post(base + "/teams", {"team_name": name}) for name in ("A", "B")]
    players = [post(base + "/players", {"name": "Player " + str(i)}) for i in range(5)]
    post(base + "/start")
    state = app_client.get(base, headers=organizer_headers).json()
    team = state["current_team_id"]
    def pick(_):
        return app_client.post(base + "/picks", json={"team_id": team, "player_id": players[0]["id"]}, headers=organizer_headers)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(pick, range(2)))
    assert sorted(r.status_code for r in results) in ([200, 400], [200, 409]), [(r.status_code, r.text) for r in results]
    assert len(app_client.get(base + "/players/drafted", headers=organizer_headers).json()) == 1
    remaining = app_client.get(base + "/players", headers=organizer_headers).json()
    assert len(remaining) == 4
    post(base + "/picks/undo")
    assert len(app_client.get(base + "/players", headers=organizer_headers).json()) == 5
    for player in players:
        state = app_client.get(base, headers=organizer_headers).json()
        post(base + "/picks", {"team_id": state["current_team_id"], "player_id": player["id"]})
    state = app_client.get(base, headers=organizer_headers).json()
    assert state["status"] == "completed"
    assert len(app_client.get(base + "/players/drafted", headers=organizer_headers).json()) == 5
    assert len(list(fake_db.collection("team_rosters").stream())) == 2


def test_standalone_invite_claim_race_and_scope(app_client, fake_db, organizer_headers):
    from backend.tests.conftest import make_jwt
    draft = app_client.post("/api/drafts", json={"name": "Invite rehearsal"}, headers=organizer_headers).json()
    base = "/api/drafts/" + draft["id"]
    team = app_client.post(base + "/teams", json={"team_name": "Invited team"}, headers=organizer_headers).json()
    headers = []
    for uid in ("guest-one", "guest-two"):
        fake_db.collection("users").document(uid).set({"id": uid, "role": "viewer", "email": uid + "@example.com"})
        headers.append({"Authorization": "Bearer " + make_jwt(uid=uid)})
    def claim(header):
        return app_client.post("/api/drafts/join/" + team["invite_token"], headers=header)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(claim, headers))
    assert sorted(r.status_code for r in results) == [200, 400], [(r.status_code, r.text) for r in results]
    winner = next(i for i, response in enumerate(results) if response.status_code == 200)
    assert app_client.get(base, headers=headers[winner]).status_code == 200
    assert app_client.get(base, headers=headers[1-winner]).status_code == 403
    # Token possession grants only this team: no league membership or management.
    assert not fake_db.collection("user_memberships").document(("guest-one", "guest-two")[winner]).get().exists
    assert app_client.patch(base, json={"name": "Unauthorized edit"}, headers=headers[winner]).status_code == 403


def test_real_safe_rounds_sibling_future_turn_and_undo(app_client, fake_db, organizer_headers):
    def post(path, data=None):
        response = app_client.post(path, json=data, headers=organizer_headers)
        assert response.status_code == 200, response.text
        return response.json()
    draft = post("/api/drafts", {"name": "Safe siblings", "num_rounds": 4, "pick_timer_seconds": 0})
    base = "/api/drafts/" + draft["id"]
    teams = [post(base + "/teams", {"team_name": n}) for n in ("A", "B", "C")]
    players = [post(base + "/players", {"name": "Player " + str(i)}) for i in range(12)]
    # A has two opening safe rounds. Its next turn must be round3, slot7.
    for player in players[:2]:
        post(base + "/pre-slots", {"team_id": teams[0]["id"], "player_id": player["id"]})
    for player in players[2:4]:
        fake_db.collection("draft_players").document(player["id"]).update({"siblingGroupId": "sibs", "forceSameTeamWithSibling": True})
    post(base + "/start")
    state = app_client.get(base, headers=organizer_headers).json()
    # Start may randomize order: calculate B's first and next slots from stored order.
    order = state["team_order"]
    team_id = state["current_team_id"]
    first_slot = state["current_pick"]
    post(base + "/picks", {"team_id": team_id, "player_id": players[2]["id"]})
    drafted = app_client.get(base + "/players/drafted", headers=organizer_headers).json()
    sibling_picks = [p for p in drafted if p["player_id"] in [players[2]["id"], players[3]["id"]]]
    assert len(sibling_picks) == 2
    assert {p["team_id"] for p in sibling_picks} == {team_id}
    slots = sorted(p["pick_number"] for p in sibling_picks)
    assert slots[0] == first_slot
    def owner(slot):
        round_index, position = divmod(slot-1, 3)
        return (order if round_index % 2 == 0 else list(reversed(order)))[position]
    assert owner(slots[1]) == team_id
    assert all(owner(slot) != team_id for slot in range(slots[0]+1, slots[1]))
    post(base + "/picks/undo")
    drafted = app_client.get(base + "/players/drafted", headers=organizer_headers).json()
    assert {p["player_id"] for p in drafted} == {players[0]["id"], players[1]["id"]}
    safe_rounds = sorted(p["round"] for p in drafted)
    assert safe_rounds == [1, 2]


def test_real_registration_import_race_is_atomic(app_client, fake_db, organizer_headers):
    response = app_client.post('/api/drafts', json={'name':'Import race'}, headers=organizer_headers)
    assert response.status_code == 200
    draft_id = response.json()['id']
    rows = [{'name':f'Synthetic Import {i}', 'registration_source':'SportsConnect', 'registration_source_id':f'synthetic-{i}'} for i in range(3)]
    def load(_):
        return app_client.post(f'/api/drafts/{draft_id}/players/bulk',json={'players':rows},headers=organizer_headers)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(load,range(2)))
    assert sorted(r.status_code for r in results)==[200,409], [(r.status_code,r.text) for r in results]
    saved=list(fake_db.collection('draft_players').where('draft_id','==',draft_id).stream())
    assert len(saved)==3
