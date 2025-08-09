from fastapi import APIRouter, HTTPException, Request
from typing import List, Dict, Any
from datetime import datetime
import os
import logging
import random
import statistics

from ..firestore_client import db
from ..utils.database import execute_with_timeout

router = APIRouter(prefix="/demo", tags=["Demo"])


def _require_demo_enabled_and_token(request: Request):
    if os.getenv("ENABLE_DEMO_SEED", "false").lower() not in ("1", "true", "yes"): 
        raise HTTPException(status_code=404, detail="Not Found")
    expected = os.getenv("DEMO_SEED_TOKEN")
    provided = request.headers.get("X-DEMO-SEED-TOKEN") or request.headers.get("x-demo-seed-token")
    if not expected:
        raise HTTPException(status_code=500, detail="Demo seeding not configured (missing DEMO_SEED_TOKEN)")
    if provided != expected:
        raise HTTPException(status_code=403, detail="Invalid or missing demo seed token")


def _canonical_age_groups() -> List[str]:
    return ["12U", "14U", "16U"]


def _random_player_name() -> str:
    first_names = [
        "Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Drew", "Quinn", "Cameron", "Reese",
        "Peyton", "Avery", "Rowan", "Emerson", "Hayden", "Logan", "Skyler", "Charlie", "Sage", "Elliot",
    ]
    last_names = [
        "Johnson", "Smith", "Brown", "Davis", "Williams", "Martinez", "Miller", "Garcia", "Rodriguez", "Lee",
        "Walker", "Young", "Allen", "King", "Wright", "Scott", "Green", "Baker", "Adams", "Nelson",
    ]
    return f"{random.choice(first_names)} {random.choice(last_names)}"


def _drill_types() -> List[str]:
    return ["40m_dash", "vertical_jump", "catching", "throwing", "agility"]


def _generate_value_for_drill(drill: str, age_group: str) -> float:
    # Reasonable demo distributions by drill
    if drill == "40m_dash":
        # seconds, lower is better. Slightly slower for older ages in youth context
        base = {"12U": 6.5, "14U": 6.2, "16U": 5.8}.get(age_group, 6.2)
        val = random.normalvariate(base, 0.35)
        return max(3.5, min(12.0, round(val, 2)))
    if drill == "vertical_jump":
        base = {"12U": 18, "14U": 22, "16U": 26}.get(age_group, 22)
        val = random.normalvariate(base, 4)
        return max(6, min(40, round(val, 1)))
    if drill in ("catching", "throwing", "agility"):
        base = {"12U": 55, "14U": 65, "16U": 72}.get(age_group, 65)
        val = random.normalvariate(base, 12)
        return max(0, min(100, round(val, 1)))
    return 0.0


def _compute_aggregated(scores: List[float]) -> Dict[str, Any]:
    if not scores:
        return {
            "average_score": 0,
            "median_score": 0,
            "score_variance": 0,
            "final_score": 0,
            "attempts_count": 0,
        }
    avg = statistics.mean(scores)
    med = statistics.median(scores)
    var = statistics.variance(scores) if len(scores) > 1 else 0
    return {
        "average_score": avg,
        "median_score": med,
        "score_variance": var,
        "final_score": avg,
        "attempts_count": len(scores),
    }


@router.post("/seed")
def seed_demo(request: Request):
    """
    Seed a demo league with two events, ~100 players across 3 age groups,
    and 5–8 evaluator submissions per drill.
    Enabled only when ENABLE_DEMO_SEED=true and protected by X-DEMO-SEED-TOKEN.
    """
    _require_demo_enabled_and_token(request)

    try:
        now = datetime.utcnow().isoformat()

        # 1) Create or get Demo League
        leagues_ref = db.collection("leagues")
        # Try to find existing by name to avoid duplicates
        existing = list(leagues_ref.where("name", "==", "Demo League").limit(1).stream())
        if existing:
            league_ref = leagues_ref.document(existing[0].id)
            league_id = existing[0].id
        else:
            league_ref = leagues_ref.document()
            league_id = league_ref.id
            league_data = {
                "name": "Demo League",
                "created_by_user_id": "system-demo",
                "created_at": now,
            }
            execute_with_timeout(lambda: league_ref.set(league_data), timeout=10)

            # Add a system member so UI that lists members does not break
            member_ref = league_ref.collection("members").document("system-demo")
            execute_with_timeout(lambda: member_ref.set({
                "role": "organizer",
                "joined_at": now,
                "email": "demo@woo-combine.com",
                "name": "Demo Organizer"
            }), timeout=10)

        # 2) Create two demo events under the league and in top-level events
        event_specs = [
            {"name": "Spring Showcase", "location": "Memorial Field"},
            {"name": "Elite Combine", "location": "River Park"},
        ]
        event_ids: List[str] = []
        for spec in event_specs:
            events_ref = league_ref.collection("events")
            # dedupe by name
            existing_evt = list(events_ref.where("name", "==", spec["name"]).limit(1).stream())
            if existing_evt:
                evt_id = existing_evt[0].id
                event_ids.append(evt_id)
                continue

            evt_ref = events_ref.document()
            evt_id = evt_ref.id
            event_data = {
                "name": spec["name"],
                "date": now.split("T")[0],
                "location": spec["location"],
                "league_id": league_id,
                "drillTemplate": "football",
                "created_at": now,
            }
            # Write into league subcollection and top-level events for compatibility
            execute_with_timeout(lambda: evt_ref.set(event_data), timeout=10)
            top_level_event_ref = db.collection("events").document(evt_id)
            execute_with_timeout(lambda: top_level_event_ref.set(event_data), timeout=10)
            event_ids.append(evt_id)

        # 3) Seed 100 players across 3 age groups, split across events (roughly even)
        total_players = 100
        age_groups = _canonical_age_groups()
        per_event = total_players // len(event_ids)

        all_players_by_event: Dict[str, List[Dict[str, Any]]] = {eid: [] for eid in event_ids}

        jersey_counter = 1
        for idx, eid in enumerate(event_ids):
            players_ref = db.collection("events").document(eid).collection("players")
            count_for_event = per_event if idx < len(event_ids) - 1 else total_players - per_event * (len(event_ids) - 1)
            for _ in range(count_for_event):
                name = _random_player_name()
                age_group = random.choice(age_groups)
                player_doc = players_ref.document()
                player_data = {
                    "name": name,
                    "number": jersey_counter,
                    "age_group": age_group,
                    "event_id": eid,
                    "created_at": now,
                }
                jersey_counter += 1
                execute_with_timeout(lambda d=player_data: player_doc.set(d), timeout=10)
                all_players_by_event[eid].append({"id": player_doc.id, **player_data})

        # 4) Add 3–4 evaluators per event
        for eid in event_ids:
            evaluators_ref = db.collection("events").document(eid).collection("evaluators")
            num_eval = random.randint(3, 4)
            for i in range(num_eval):
                ev_doc = evaluators_ref.document()
                ev_data = {
                    "name": f"Evaluator {i+1}",
                    "email": f"evaluator{i+1}@demo.local",
                    "role": "coach",
                    "event_id": eid,
                    "added_by": "system-demo",
                    "added_at": now,
                    "active": True,
                }
                execute_with_timeout(lambda d=ev_data: ev_doc.set(d), timeout=10)

        # 5) Create 5–8 evaluations per drill per player and update aggregates and snapshots
        for eid in event_ids:
            evaluations_ref = db.collection("events").document(eid).collection("drill_evaluations")
            aggregated_ref = db.collection("events").document(eid).collection("aggregated_drill_results")
            players = all_players_by_event[eid]
            for p in players:
                player_id = p["id"]
                age_group = p["age_group"]
                snapshot_updates: Dict[str, Any] = {}
                for drill in _drill_types():
                    attempts = random.randint(5, 8)
                    scores: List[float] = []
                    for _ in range(attempts):
                        value = _generate_value_for_drill(drill, age_group)
                        scores.append(value)
                        eval_doc = evaluations_ref.document()
                        eval_data = {
                            "player_id": player_id,
                            "type": drill,
                            "value": value,
                            "unit": "seconds" if drill == "40m_dash" else ("inches" if drill == "vertical_jump" else "points"),
                            "evaluator_id": "system-demo",
                            "evaluator_name": "Demo Evaluator",
                            "notes": "", 
                            "created_at": now,
                            "recorded_at": now,
                            "event_id": eid,
                        }
                        execute_with_timeout(lambda d=eval_data: eval_doc.set(d), timeout=10)

                    agg = _compute_aggregated(scores)
                    agg_doc_id = f"{player_id}_{drill}"
                    agg_payload = {
                        "player_id": player_id,
                        "drill_type": drill,
                        "evaluations": [],  # keep minimal to save write time; FE uses summary stats
                        "average_score": agg["average_score"],
                        "median_score": agg["median_score"],
                        "score_count": agg["attempts_count"],
                        "score_variance": agg["score_variance"],
                        "final_score": agg["final_score"],
                        "attempts_count": agg["attempts_count"],
                        "last_updated": now,
                    }
                    execute_with_timeout(lambda d=agg_payload: aggregated_ref.document(agg_doc_id).set(d), timeout=10)

                    # Update player snapshot field with the average measured value
                    # For 40m_dash we store time in seconds (lower is better)
                    snapshot_updates[drill] = agg["final_score"]

                # Write snapshot updates to player document
                player_ref = db.collection("events").document(eid).collection("players").document(player_id)
                execute_with_timeout(lambda u=snapshot_updates: player_ref.update(u), timeout=10)

        logging.info(f"[DEMO] Seed complete league={league_id} events={event_ids}")
        return {"status": "ok", "league_id": league_id, "event_ids": event_ids}

    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"[DEMO] Seed failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to seed demo data")


