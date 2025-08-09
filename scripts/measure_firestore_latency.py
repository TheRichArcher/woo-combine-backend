import os
import time
import statistics
import json
from google.cloud import firestore
from google.oauth2 import service_account


def get_client():
    creds_json = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS_JSON")
    if creds_json:
        info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(info)
        return firestore.Client(credentials=creds, project=info.get("project_id"))
    return firestore.Client()


def measure_query_latency(iterations: int = 50):
    db = get_client()
    timings_ms = {
        "players_by_event": [],
        "agg_results_by_event": [],
        "drill_evals_by_event_player_drill": [],
        "events_by_league": [],
        "league_events_subcollection": [],
    }

    # Replace these with real ids in your dev project
    event_id = os.getenv("TEST_EVENT_ID", "dev_event")
    league_id = os.getenv("TEST_LEAGUE_ID", "dev_league")
    player_id = os.getenv("TEST_PLAYER_ID", "dev_player")
    drill_id = os.getenv("TEST_DRILL_ID", "40m_dash")

    for _ in range(iterations):
        # players (subcollection)
        start = time.perf_counter()
        list(db.collection("events").document(event_id).collection("players").limit(50).stream())
        timings_ms["players_by_event"].append((time.perf_counter() - start) * 1000)

        # aggregated_drill_results (subcollection)
        start = time.perf_counter()
        list(db.collection("events").document(event_id).collection("aggregated_drill_results").limit(50).stream())
        timings_ms["agg_results_by_event"].append((time.perf_counter() - start) * 1000)

        # drill_evaluations (by player and drill)
        # Try using spec field name 'drill_id'; fall back to 'type' if data shape differs
        try:
            start = time.perf_counter()
            list(
                db.collection("events")
                .document(event_id)
                .collection("drill_evaluations")
                .where("player_id", "==", player_id)
                .where("drill_id", "==", drill_id)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(50)
                .stream()
            )
            timings_ms["drill_evals_by_event_player_drill"].append((time.perf_counter() - start) * 1000)
        except Exception:
            start = time.perf_counter()
            list(
                db.collection("events")
                .document(event_id)
                .collection("drill_evaluations")
                .where("player_id", "==", player_id)
                .where("type", "==", drill_id)
                .order_by("created_at", direction=firestore.Query.DESCENDING)
                .limit(50)
                .stream()
            )
            timings_ms["drill_evals_by_event_player_drill"].append((time.perf_counter() - start) * 1000)

        # events by league (top-level collection)
        start = time.perf_counter()
        list(
            db.collection("events")
            .where("league_id", "==", league_id)
            .order_by("date", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        )
        timings_ms["events_by_league"].append((time.perf_counter() - start) * 1000)

        # leagues/{leagueId}/events subcollection ordered by date desc
        start = time.perf_counter()
        list(
            db.collection("leagues")
            .document(league_id)
            .collection("events")
            .order_by("date", direction=firestore.Query.DESCENDING)
            .limit(50)
            .stream()
        )
        timings_ms["league_events_subcollection"].append((time.perf_counter() - start) * 1000)

    summary = {}
    for key, values in timings_ms.items():
        if values:
            summary[key] = {
                "p50_ms": round(statistics.median(values), 2),
                "p95_ms": round(sorted(values)[int(len(values) * 0.95) - 1], 2),
                "avg_ms": round(statistics.mean(values), 2),
                "n": len(values),
            }
        else:
            summary[key] = {"p50_ms": None, "p95_ms": None, "avg_ms": None, "n": 0}

    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    iters = int(os.getenv("MEASURE_ITERATIONS", "50"))
    measure_query_latency(iters)


