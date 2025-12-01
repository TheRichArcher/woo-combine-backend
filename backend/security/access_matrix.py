from __future__ import annotations

import asyncio
import logging
from functools import wraps
from typing import Any, Awaitable, Callable, Dict, Iterable, Literal, Optional, Set, Tuple

from fastapi import HTTPException

from ..utils.authorization import ensure_event_access, ensure_league_access

RoleSet = Set[str]
ResourceKey = Tuple[str, str]

VIEW_ROLES: RoleSet = {"organizer", "coach", "viewer"}
MANAGE_ROLES: RoleSet = {"organizer", "coach"}
ADMIN_ROLES: RoleSet = {"organizer"}

ACCESS_MATRIX: Dict[ResourceKey, RoleSet] = {
    ("events", "list"): VIEW_ROLES,
    ("events", "create"): ADMIN_ROLES,
    ("events", "read"): VIEW_ROLES,
    ("events", "update"): ADMIN_ROLES,
    ("events", "delete"): ADMIN_ROLES,
    ("players", "read"): VIEW_ROLES,
    ("players", "create"): MANAGE_ROLES,
    ("players", "update"): MANAGE_ROLES,
    ("players", "upload"): ADMIN_ROLES,
    ("players", "reset"): ADMIN_ROLES,
    ("players", "rankings"): VIEW_ROLES,
    ("league_players", "read"): VIEW_ROLES,
    ("league_players", "create"): MANAGE_ROLES,
    ("league_players", "drill_results"): VIEW_ROLES,
    ("drills", "create_result"): MANAGE_ROLES,
    ("evaluators", "list"): VIEW_ROLES,
    ("evaluators", "add"): MANAGE_ROLES,
    ("evaluators", "submit_evaluation"): MANAGE_ROLES,
    ("evaluators", "player_evaluations"): VIEW_ROLES,
    ("evaluators", "aggregated_results"): VIEW_ROLES,
    ("batch", "players"): MANAGE_ROLES,
    ("batch", "events"): MANAGE_ROLES,
    ("batch", "events_by_ids"): MANAGE_ROLES,
    ("batch", "dashboard"): MANAGE_ROLES,
    ("invitations", "list"): ADMIN_ROLES,
    ("teams", "list"): VIEW_ROLES,
    ("league_members", "list"): ADMIN_ROLES,
    ("league_members", "update"): ADMIN_ROLES,
}

REGISTERED_PERMISSIONS: list[Dict[str, Any]] = []


def get_allowed_roles(resource: str, action: str) -> RoleSet:
    key = (resource, action)
    if key not in ACCESS_MATRIX:
        raise RuntimeError(f"No access matrix entry defined for {resource}:{action}")
    return ACCESS_MATRIX[key]


def _ensure_target_access(
    *,
    user_id: str,
    target: Literal["event", "league"],
    target_id: str,
    allowed_roles: Iterable[str],
    operation_name: str,
) -> None:
    if target == "event":
        ensure_event_access(
            user_id,
            target_id,
            allowed_roles=allowed_roles,
            operation_name=operation_name,
        )
    else:
        ensure_league_access(
            user_id,
            target_id,
            allowed_roles=allowed_roles,
            operation_name=operation_name,
        )


def require_permission(
    resource: str,
    action: str,
    *,
    target: Literal["event", "league"],
    target_param: Optional[str] = None,
    target_getter: Optional[Callable[[Dict[str, Any]], Any]] = None,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator that enforces RBAC matrix permissions for league/event scoped routes.
    Automatically checks membership via ensure_league/event_access and records metadata
    for auditing/tests.
    """
    allowed_roles = get_allowed_roles(resource, action)
    operation_name = f"{resource}:{action}"

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        async def async_wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required")

            target_id = None
            if target_getter:
                try:
                    target_id = target_getter(kwargs)
                except Exception as exc:
                    raise HTTPException(status_code=400, detail="Unable to determine target context") from exc
            elif target_param:
                target_id = kwargs.get(target_param)

            if not target_id:
                raise HTTPException(status_code=400, detail="Target identifier is required")

            _ensure_target_access(
                user_id=current_user["uid"],
                target=target,
                target_id=str(target_id),
                allowed_roles=allowed_roles,
                operation_name=operation_name,
            )
            return await func(*args, **kwargs)

        def sync_wrapper(*args, **kwargs):
            current_user = kwargs.get("current_user")
            if not current_user:
                raise HTTPException(status_code=401, detail="Authentication required")

            target_id = None
            if target_getter:
                try:
                    target_id = target_getter(kwargs)
                except Exception as exc:
                    raise HTTPException(status_code=400, detail="Unable to determine target context") from exc
            elif target_param:
                target_id = kwargs.get(target_param)

            if not target_id:
                raise HTTPException(status_code=400, detail="Target identifier is required")

            _ensure_target_access(
                user_id=current_user["uid"],
                target=target,
                target_id=str(target_id),
                allowed_roles=allowed_roles,
                operation_name=operation_name,
            )
            return func(*args, **kwargs)

        if asyncio.iscoroutinefunction(func):
            wrapper = async_wrapper
        else:
            wrapper = sync_wrapper

        wraps(func)(wrapper)
        metadata = {
            "endpoint": f"{func.__module__}.{func.__name__}",
            "resource": resource,
            "action": action,
            "allowed_roles": sorted(allowed_roles),
            "target": target,
            "target_param": target_param or getattr(target_getter, "__name__", "callable"),
        }
        setattr(wrapper, "__required_permission__", metadata)
        REGISTERED_PERMISSIONS.append(metadata)
        logging.debug(
            "[RBAC] Registered permission %s for %s", operation_name, metadata["endpoint"]
        )
        return wrapper

    return decorator


__all__ = ["require_permission", "ACCESS_MATRIX", "REGISTERED_PERMISSIONS"]

