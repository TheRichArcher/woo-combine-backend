#!/usr/bin/env python3
"""
Backfill scoped event assignments for viewer/coach league memberships.

What it does:
- Finds user_memberships entries where role is viewer/coach and event scope is empty
- Infers safe event assignments where possible
- Writes a JSON report with affected users, proposed updates, and manual-review items
- Supports dry-run mode by default
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Set, Tuple

# Allow running directly from repository root.
sys.path.append(os.getcwd())

from backend.firestore_client import get_firestore_client


TARGET_ROLES = {"viewer", "coach"}


@dataclass
class InferenceResult:
    event_ids: List[str]
    sources: List[str]
    reason: str


def _normalize_event_ids(values: Optional[Iterable[object]]) -> List[str]:
    if not isinstance(values, (list, tuple, set)):
        return []
    seen: Set[str] = set()
    normalized: List[str] = []
    for value in values:
        if value is None:
            continue
        item = str(value).strip()
        if not item or item in seen:
            continue
        seen.add(item)
        normalized.append(item)
    return normalized


def _extract_role_scope_ids(membership: dict, role: str) -> List[str]:
    if role == "viewer":
        role_field = "viewer_event_ids"
    else:
        role_field = "coach_event_ids"
    return _normalize_event_ids(membership.get(role_field))


def _extract_effective_scope_ids(membership: dict, role: str) -> List[str]:
    scoped = _extract_role_scope_ids(membership, role)
    if scoped:
        return scoped
    return _normalize_event_ids(membership.get("event_ids"))


def _build_league_event_map(db) -> Tuple[Dict[str, Set[str]], Set[str]]:
    league_event_map: Dict[str, Set[str]] = {}
    all_event_ids: Set[str] = set()

    for event_doc in db.collection("events").stream():
        event_data = event_doc.to_dict() or {}
        if event_data.get("deleted_at"):
            continue
        league_id = str(event_data.get("league_id") or "").strip()
        if not league_id:
            continue
        event_id = str(event_data.get("id") or event_doc.id).strip()
        if not event_id:
            continue
        all_event_ids.add(event_id)
        league_event_map.setdefault(league_id, set()).add(event_id)

    return league_event_map, all_event_ids


def _legacy_member_scope_ids(db, uid: str, league_id: str, role: str) -> List[str]:
    member_doc = (
        db.collection("leagues")
        .document(league_id)
        .collection("members")
        .document(uid)
        .get()
    )
    if not member_doc.exists:
        return []
    member_data = member_doc.to_dict() or {}
    return _extract_effective_scope_ids(member_data, role)


def _coach_assignment_event_ids(
    db, uid: str, league_id: str, draft_cache: Dict[str, dict]
) -> List[str]:
    event_ids: Set[str] = set()

    roster_query = (
        db.collection("team_rosters")
        .where("coach_user_id", "==", uid)
        .where("league_id", "==", league_id)
        .stream()
    )
    for roster_doc in roster_query:
        roster_data = roster_doc.to_dict() or {}
        event_ids.update(_normalize_event_ids(roster_data.get("event_ids")))
        legacy_event_id = roster_data.get("event_id")
        if legacy_event_id:
            event_ids.add(str(legacy_event_id).strip())

    team_query = db.collection("draft_teams").where("coach_user_id", "==", uid).stream()
    for team_doc in team_query:
        team_data = team_doc.to_dict() or {}
        draft_id = str(team_data.get("draft_id") or "").strip()
        if not draft_id:
            continue
        if draft_id not in draft_cache:
            draft_doc = db.collection("drafts").document(draft_id).get()
            draft_cache[draft_id] = draft_doc.to_dict() if draft_doc.exists else {}
        draft_data = draft_cache.get(draft_id) or {}
        if str(draft_data.get("league_id") or "").strip() != league_id:
            continue
        event_ids.update(_normalize_event_ids(draft_data.get("event_ids")))
        legacy_event_id = draft_data.get("event_id")
        if legacy_event_id:
            event_ids.add(str(legacy_event_id).strip())

    return sorted([event_id for event_id in event_ids if event_id])


def _infer_scope_for_membership(
    *,
    db,
    uid: str,
    league_id: str,
    role: str,
    membership: dict,
    league_event_ids: Set[str],
    all_event_ids: Set[str],
    draft_cache: Dict[str, dict],
) -> InferenceResult:
    candidates: Set[str] = set()
    sources: List[str] = []

    existing = _extract_effective_scope_ids(membership, role)
    if existing:
        candidates.update(existing)
        sources.append("user_memberships")

    legacy = _legacy_member_scope_ids(db, uid, league_id, role)
    if legacy:
        candidates.update(legacy)
        sources.append("legacy_member")

    if role == "coach":
        coach_events = _coach_assignment_event_ids(db, uid, league_id, draft_cache)
        if coach_events:
            candidates.update(coach_events)
            sources.append("coach_assignments")

    if not candidates:
        return InferenceResult(
            event_ids=[],
            sources=sources,
            reason="No trustworthy event-scope signals found",
        )

    valid_for_league = sorted(event_id for event_id in candidates if event_id in league_event_ids)
    if valid_for_league:
        return InferenceResult(
            event_ids=valid_for_league,
            sources=sources,
            reason="Resolved from existing scoped signals",
        )

    known_elsewhere = sorted(event_id for event_id in candidates if event_id in all_event_ids)
    if known_elsewhere:
        return InferenceResult(
            event_ids=[],
            sources=sources,
            reason="Candidate events exist but belong to a different league",
        )

    return InferenceResult(
        event_ids=[],
        sources=sources,
        reason="Candidate event IDs are unknown",
    )


def run_migration(*, apply_updates: bool, report_file: str, limit: Optional[int], user_id: Optional[str]) -> dict:
    db = get_firestore_client()
    league_event_map, all_event_ids = _build_league_event_map(db)
    draft_cache: Dict[str, dict] = {}

    affected: List[dict] = []
    update_plan: List[dict] = []
    manual_review: List[dict] = []

    user_docs = [db.collection("user_memberships").document(user_id).get()] if user_id else list(
        db.collection("user_memberships").stream()
    )

    scanned_users = 0
    for membership_doc in user_docs:
        if not membership_doc.exists:
            continue
        uid = membership_doc.id
        membership_data = membership_doc.to_dict() or {}
        leagues_map = membership_data.get("leagues", {}) or {}
        if not isinstance(leagues_map, dict):
            continue

        scanned_users += 1
        if limit is not None and scanned_users > limit:
            break

        for league_id, league_membership in leagues_map.items():
            if not isinstance(league_membership, dict):
                continue

            role = str(league_membership.get("role") or "").lower()
            if role not in TARGET_ROLES:
                continue

            existing_scope = _extract_effective_scope_ids(league_membership, role)
            if existing_scope:
                continue

            scope_field = "viewer_event_ids" if role == "viewer" else "coach_event_ids"
            league_events = league_event_map.get(str(league_id), set())
            inference = _infer_scope_for_membership(
                db=db,
                uid=uid,
                league_id=str(league_id),
                role=role,
                membership=league_membership,
                league_event_ids=league_events,
                all_event_ids=all_event_ids,
                draft_cache=draft_cache,
            )

            affected_entry = {
                "uid": uid,
                "league_id": str(league_id),
                "role": role,
                "scope_field": scope_field,
                "inferred_event_ids": inference.event_ids,
                "sources": inference.sources,
                "reason": inference.reason,
            }
            affected.append(affected_entry)

            if inference.event_ids:
                update_plan.append(affected_entry)
            else:
                manual_review.append(affected_entry)

    applied = {
        "user_memberships_updates": 0,
        "legacy_member_updates": 0,
    }

    if apply_updates and update_plan:
        batch = db.batch()
        pending = 0
        for item in update_plan:
            uid = item["uid"]
            league_id = item["league_id"]
            scope_field = item["scope_field"]
            event_ids = item["inferred_event_ids"]

            user_ref = db.collection("user_memberships").document(uid)
            batch.set(user_ref, {f"leagues.{league_id}.{scope_field}": event_ids}, merge=True)
            pending += 1
            applied["user_memberships_updates"] += 1

            member_ref = (
                db.collection("leagues")
                .document(league_id)
                .collection("members")
                .document(uid)
            )
            member_doc = member_ref.get()
            if member_doc.exists:
                batch.set(member_ref, {scope_field: event_ids}, merge=True)
                pending += 1
                applied["legacy_member_updates"] += 1

            if pending >= 380:
                batch.commit()
                batch = db.batch()
                pending = 0

        if pending > 0:
            batch.commit()

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "apply" if apply_updates else "dry-run",
        "summary": {
            "affected_memberships": len(affected),
            "proposed_updates": len(update_plan),
            "manual_review_required": len(manual_review),
            **applied,
        },
        "affected_users": affected,
        "proposed_updates": update_plan,
        "manual_review": manual_review,
    }

    with open(report_file, "w", encoding="utf-8") as handle:
        json.dump(report, handle, indent=2)

    return report


def _print_console_summary(report: dict, report_file: str) -> None:
    summary = report["summary"]
    print("=== Event Scope Membership Migration ===")
    print(f"Mode: {report['mode']}")
    print(f"Affected memberships: {summary['affected_memberships']}")
    print(f"Proposed updates: {summary['proposed_updates']}")
    print(f"Manual review required: {summary['manual_review_required']}")
    print(f"Report written: {report_file}")

    print("\nAffected users:")
    if not report["affected_users"]:
        print("- none")
    else:
        for item in report["affected_users"]:
            print(
                f"- uid={item['uid']} league={item['league_id']} role={item['role']} "
                f"inferred={item['inferred_event_ids'] or []} reason={item['reason']}"
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Backfill missing viewer/coach event scope in user memberships."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates (default is dry-run).",
    )
    parser.add_argument(
        "--report-file",
        default="membership_event_scope_migration_report.json",
        help="Path to write JSON report.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional max number of user_membership documents to scan.",
    )
    parser.add_argument(
        "--user-id",
        default=None,
        help="Optional single user ID to evaluate.",
    )
    args = parser.parse_args()

    try:
        report = run_migration(
            apply_updates=args.apply,
            report_file=args.report_file,
            limit=args.limit,
            user_id=args.user_id,
        )
    except Exception as exc:
        print("Migration failed before scan:")
        print(f"- {exc}")
        print(
            "- Ensure Firestore credentials are configured via "
            "GOOGLE_APPLICATION_CREDENTIALS_JSON or ADC."
        )
        raise SystemExit(1) from exc

    _print_console_summary(report, args.report_file)


if __name__ == "__main__":
    main()
