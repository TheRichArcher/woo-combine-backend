"""Commissioner draft rules: safe rounds, sibling turn accounting and recovery."""
import pytest
from backend.routes import drafts


def seed(db, count=9, teams=2, safe=None, name='engine'):
    draft = {'id': name, 'name': name, 'created_by': 'org-1', 'league_id': 'league-1',
             'status': 'setup', 'draft_type': 'snake', 'pick_timer_seconds': 0,
             'auto_pick_on_timeout': False}
    db.collection('drafts').document(name).set(draft)
    ids = []
    for i in range(teams):
        tid = f'{name}-t{i}'
        ids.append(tid)
        db.collection('draft_teams').document(tid).set({
            'id': tid, 'draft_id': name, 'team_name': tid, 'pick_order': i,
            'pre_slotted_player_ids': (safe or {}).get(i, [])})
    players = [f'{name}-p{i}' for i in range(count)]
    for pid in players:
        db.collection('draft_players').document(pid).set({'id': pid, 'draft_id': name, 'name': pid})
    return name, ids, players


def post(client, headers, path, payload=None):
    response = client.post('/api/drafts/' + path, json=payload, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def records(db, collection, did):
    return [d.to_dict() for d in db.collection(collection).where('draft_id', '==', did).stream()]


def test_three_safe_players_use_each_teams_first_three_snake_rounds(app_client, fake_db, organizer_headers):
    did, teams, players = seed(fake_db, 9, safe={0: ['engine-p0','engine-p1','engine-p2'], 1: ['engine-p3','engine-p4','engine-p5']})
    state = post(app_client, organizer_headers, did+'/start')
    assert (state['current_round'],state['current_pick'],state['current_team_id']) == (4,7,teams[1])
    picks = records(fake_db, 'draft_picks', did)
    assert sorted((p['round'],p['team_id']) for p in picks) == sorted((r,t) for r in [1,2,3] for t in teams)
    assert all(p['pick_type']=='safe' for p in picks)
    response=app_client.post('/api/drafts/'+did+'/picks/undo',headers=organizer_headers)
    assert response.status_code == 400


def test_safe_limit_includes_auto_added_sibling_and_no_partial_write(app_client, fake_db, organizer_headers):
    did, teams, players = seed(fake_db)
    for pid in players[:2]:
        fake_db.collection('draft_players').document(pid).update({'siblingGroupId':'family'})
    result=post(app_client,organizer_headers,did+'/pre-slots',{'team_id':teams[0],'player_id':players[0]})
    assert set(result['pre_slotted_player_ids'])==set(players[:2])
    post(app_client,organizer_headers,did+'/pre-slots',{'team_id':teams[0],'player_id':players[2]})
    response=app_client.post('/api/drafts/'+did+'/pre-slots',json={'team_id':teams[0],'player_id':players[3]},headers=organizer_headers)
    assert response.status_code==400
    assert len(fake_db.collection('draft_teams').document(teams[0]).get().to_dict()['pre_slotted_player_ids'])==3
    duplicate=app_client.post('/api/drafts/'+did+'/pre-slots',json={'team_id':teams[1],'player_id':players[0]},headers=organizer_headers)
    assert duplicate.status_code==400


def test_siblings_reserve_own_future_snake_turn_and_undo_whole_action(app_client, fake_db, organizer_headers):
    did, teams, players = seed(fake_db, 7, 3)
    for pid in players[:2]:
        fake_db.collection('draft_players').document(pid).update({'siblingGroupId':'family'})
    post(app_client,organizer_headers,did+'/start')
    result=post(app_client,organizer_headers,did+'/picks',{'player_id':players[0]})
    assert set(result['assigned_player_ids'])==set(players[:2])
    picks=records(fake_db,'draft_picks',did)
    assert {p['pick_number'] for p in picks}=={1,6}
    assert {p['team_id'] for p in picks}=={teams[0]}
    state=fake_db.collection('drafts').document(did).get().to_dict()
    assert (state['current_pick'],state['current_team_id'])==(2,teams[1])
    post(app_client,organizer_headers,did+'/picks',{'player_id':players[2]})
    # Undo latest chronological action, not future sibling pick number 6.
    post(app_client,organizer_headers,did+'/picks/undo')
    assert {p['player_id'] for p in records(fake_db,'draft_picks',did)}==set(players[:2])
    undone=post(app_client,organizer_headers,did+'/picks/undo')
    assert len(undone['removed_pick_ids'])==2
    assert records(fake_db,'draft_picks',did)==[]


def test_explicit_separation_does_not_auto_assign_sibling(app_client,fake_db,organizer_headers):
    did,teams,players=seed(fake_db,3)
    for pid in players[:2]:
        fake_db.collection('draft_players').document(pid).update({'siblingGroupId':'family','siblingSeparationRequested':True})
    post(app_client,organizer_headers,did+'/start')
    result=post(app_client,organizer_headers,did+'/picks',{'player_id':players[0]})
    assert result['assigned_player_ids']==[players[0]]


@pytest.mark.parametrize('divisions',[2,20])
def test_varied_pools_finish_every_player_once_and_final_undo_rebuilds_rosters(app_client,fake_db,organizer_headers,divisions):
    for division in range(divisions):
        did,teams,players=seed(fake_db,3+division%7,2+division%3,name=f'division-{division}')
        post(app_client,organizer_headers,did+'/start')
        for pid in players:
            state=fake_db.collection('drafts').document(did).get().to_dict()
            post(app_client,organizer_headers,did+'/picks',{'player_id':pid,'expected_pick_number':state['current_pick']})
        assert fake_db.collection('drafts').document(did).get().to_dict()['status']=='completed'
        assert sorted(p['player_id'] for p in records(fake_db,'draft_picks',did))==sorted(players)
        rosters=records(fake_db,'team_rosters',did)
        assert sorted(pid for r in rosters for pid in r['player_ids'])==sorted(players)
        post(app_client,organizer_headers,did+'/picks/undo')
        assert fake_db.collection('drafts').document(did).get().to_dict()['status']=='active'
        assert players[-1] not in [pid for r in records(fake_db,'team_rosters',did) for pid in r['player_ids']]
        post(app_client,organizer_headers,did+'/picks',{'player_id':players[-1]})
        assert len(records(fake_db,'team_rosters',did))==len(teams)
        post(app_client,organizer_headers,did+'/reset')
        assert records(fake_db,'draft_picks',did)==[]
        assert records(fake_db,'team_rosters',did)==[]


def test_stale_expected_turn_rejected_at_snake_reversal(app_client,fake_db,organizer_headers):
    did,teams,players=seed(fake_db,5)
    post(app_client,organizer_headers,did+'/start')
    post(app_client,organizer_headers,did+'/picks',{'player_id':players[0]})
    post(app_client,organizer_headers,did+'/picks',{'player_id':players[1], 'expected_pick_number':2})
    r=app_client.post('/api/drafts/'+did+'/picks',json={'player_id':players[2],'expected_pick_number':2},headers=organizer_headers)
    assert r.status_code==409
    assert len(records(fake_db,'draft_picks',did))==2


def test_explicit_roster_cap_skips_filled_team_and_finishes(app_client,fake_db,organizer_headers):
    did,teams,players=seed(fake_db,4,2)
    fake_db.collection('drafts').document(did).update({'max_players_per_team':2})
    for pid in players[:2]:
        fake_db.collection('draft_players').document(pid).update({'siblingGroupId':'family'})
    post(app_client,organizer_headers,did+'/start')
    post(app_client,organizer_headers,did+'/picks',{'player_id':players[0]})
    post(app_client,organizer_headers,did+'/picks',{'player_id':players[2]})
    result=post(app_client,organizer_headers,did+'/picks',{'player_id':players[3]})
    assert result['completed']
    assert sorted(len(r['player_ids']) for r in records(fake_db,'team_rosters',did))==[2,2]


def test_safe_sibling_remove_removes_unit_without_reappearing_on_start(app_client,fake_db,organizer_headers):
    did,teams,players=seed(fake_db,5)
    for pid in players[:2]:
        fake_db.collection('draft_players').document(pid).update({'siblingGroupId':'family'})
    post(app_client,organizer_headers,did+'/pre-slots',{'team_id':teams[0],'player_id':players[0]})
    r=app_client.delete(f'/api/drafts/{did}/pre-slots/{teams[0]}/{players[1]}',headers=organizer_headers)
    assert r.status_code==200
    assert set(r.json()['removed_player_ids'])==set(players[:2])
    post(app_client,organizer_headers,did+'/start')
    assert records(fake_db,'draft_picks',did)==[]


def test_pause_resume_and_completion_cannot_reopen_via_pause(app_client,fake_db,organizer_headers):
    did,teams,players=seed(fake_db,1)
    post(app_client,organizer_headers,did+'/start')
    post(app_client,organizer_headers,did+'/pause')
    r=app_client.post('/api/drafts/'+did+'/picks',json={'player_id':players[0]},headers=organizer_headers)
    assert r.status_code==400
    post(app_client,organizer_headers,did+'/resume')
    post(app_client,organizer_headers,did+'/picks',{'player_id':players[0]})
    for action in ['pause','resume']:
        r=app_client.post('/api/drafts/'+did+'/'+action,headers=organizer_headers)
        assert r.status_code==400
    assert fake_db.collection('drafts').document(did).get().to_dict()['status']=='completed'


def test_manual_sibling_review_explicitly_separates_group(app_client,fake_db,organizer_headers):
    did,teams,players=seed(fake_db,3)
    for pid in players[:2]:
        fake_db.collection('draft_players').document(pid).update({'siblingGroupId':'family'})
    post(app_client,organizer_headers,did+'/sibling-groups/family/review',{'action':'mark_separate'})
    post(app_client,organizer_headers,did+'/start')
    pick=post(app_client,organizer_headers,did+'/picks',{'player_id':players[0]})
    assert pick['assigned_player_ids']==[players[0]]
