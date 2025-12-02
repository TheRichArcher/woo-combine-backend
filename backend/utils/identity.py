import hashlib
from typing import Optional

def generate_player_id(event_id: str, first: str, last: str, number: Optional[int]) -> str:
    """
    Generate a deterministic, unique ID for a player based on their identity.
    Used for deduplication across the platform.
    """
    # Normalize inputs
    f = (first or "").strip().lower()
    l = (last or "").strip().lower()
    n = str(number).strip() if number is not None else "nonum"
    
    # Create raw string for hashing
    raw = f"{event_id}:{f}:{l}:{n}"
    
    # Return SHA-256 hash hex digest (truncated to 20 chars for ID-like length)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:20]

