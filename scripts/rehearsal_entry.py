"""Fail-closed entry point for the separate draft rehearsal service only."""
import json
import os
import sys
from pathlib import Path


def validate_environment(env):
    expected = env.get('REHEARSAL_FIREBASE_PROJECT')
    if not expected or expected == 'woo-combine':
        raise ValueError('A non-production rehearsal Firebase project is required')
    credentials = json.loads(env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON', '{}'))
    if credentials.get('project_id') != expected:
        raise ValueError('Service account must belong to the rehearsal project')
    if any(env.get(key) != expected for key in ('GOOGLE_CLOUD_PROJECT', 'FIREBASE_PROJECT_ID')):
        raise ValueError('Backend project IDs must match the rehearsal project')
    if env.get('FIRESTORE_EMULATOR_HOST') or env.get('FIREBASE_AUTH_EMULATOR_HOST'):
        raise ValueError('Remote rehearsal must use real Firebase, not emulator authentication')
    origins = env.get('ALLOWED_ORIGINS', '').split(',')
    if not origins or any(not x.startswith('https://woo-draft-qa-') for x in origins):
        raise ValueError('Rehearsal must allow only its separate HTTPS frontend')
    return expected


if __name__ == '__main__':
    validate_environment(os.environ)
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import uvicorn
    uvicorn.run('backend.main:app', host='0.0.0.0', port=int(os.getenv('PORT', '10000')))
