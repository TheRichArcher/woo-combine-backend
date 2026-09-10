import json
import pytest
from scripts.rehearsal_entry import validate_environment


def valid():
    return {'REHEARSAL_FIREBASE_PROJECT':'tosh-woo-combine','GOOGLE_CLOUD_PROJECT':'tosh-woo-combine',
            'FIREBASE_PROJECT_ID':'tosh-woo-combine','GOOGLE_APPLICATION_CREDENTIALS_JSON':json.dumps({'project_id':'tosh-woo-combine'}),
            'ALLOWED_ORIGINS':'https://woo-draft-qa-20260909.onrender.com'}


def test_rehearsal_requires_nonproduction_matching_project():
    assert validate_environment(valid())=='tosh-woo-combine'
    for patch in [ {'REHEARSAL_FIREBASE_PROJECT':'woo-combine'},
                   {'GOOGLE_APPLICATION_CREDENTIALS_JSON':json.dumps({'project_id':'woo-combine'})},
                   {'FIREBASE_PROJECT_ID':'woo-combine'}, {'ALLOWED_ORIGINS':'https://woo-combine.com'},
                   {'FIREBASE_AUTH_EMULATOR_HOST':'127.0.0.1:9099'}]:
        with pytest.raises(ValueError): validate_environment({**valid(),**patch})
