from backend.tests.test_draft_engine_regressions import seed, post, records


def test_registration_import_preserves_reports_without_measured_scores(app_client, fake_db, organizer_headers):
    did,_,_=seed(fake_db,0)
    row={'name':'Synthetic Athlete','registration_source':'SportsConnect','registration_source_id':'synthetic-1',
         'parent_reported_ability':'5 (strongest)', 'registration_previous_team':'Falcons',
         'parent_reported_experience':'3 seasons','registration_division':'2nd Down','registration_program':'Synthetic Fall'}
    result=post(app_client,organizer_headers,did+'/players/bulk',{'players':[row]})
    for key,value in row.items(): assert result['players'][0][key]==value
    assert 'composite_score' not in result['players'][0]
    r=app_client.post('/api/drafts/'+did+'/players/bulk',json={'players':[row]},headers=organizer_headers)
    assert r.status_code==409
    assert len(records(fake_db,'draft_players',did))==1


def test_registration_duplicate_late_row_writes_nothing(app_client,fake_db,organizer_headers):
    did,_,_=seed(fake_db,0)
    rows=[{'name':'Synthetic Same','registration_source':'SportsConnect'}]*2
    r=app_client.post('/api/drafts/'+did+'/players/bulk',json={'players':rows},headers=organizer_headers)
    assert r.status_code==409
    assert records(fake_db,'draft_players',did)==[]


def test_registration_import_closed_after_start(app_client,fake_db,organizer_headers):
    did,_,_=seed(fake_db,2)
    post(app_client,organizer_headers,did+'/start')
    r=app_client.post('/api/drafts/'+did+'/players/bulk',json={'players':[{'name':'Too Late'}]},headers=organizer_headers)
    assert r.status_code==400
    assert len(records(fake_db,'draft_players',did))==2
