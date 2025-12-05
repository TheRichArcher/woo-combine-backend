import hashlib
from typing import Optional
import logging

def generate_player_id(event_id: str, first: str, last: str, number: Optional[int]) -> str:
    """
    Generate a deterministic, unique ID for a player based on their identity.
    Used for deduplication across the platform.
    """
    # Normalize inputs
    f = (first or "").strip().lower()
    l = (last or "").strip().lower()
    
    # Clean invisible characters (like Zero Width Space \u200b) from names
    # Remove non-printable characters to ensure "John\u200b" == "John"
    f = "".join(c for c in f if c.isprintable())
    l = "".join(c for c in l if c.isprintable())
    
    # Normalize number - if it's an integer or string representation of integer
    n = "nonum"
    if number is not None:
        # Handle if number is passed as string "12.0" or float 12.0
        try:
            # Convert to float first to handle "12.0", then int
            n_val = int(float(str(number).strip()))
            n = str(n_val)
        except (ValueError, TypeError):
            # If parsing fails, keep original string normalized? 
            # Or should we treat invalid numbers as "nonum"?
            # Current logic in players.py validates numbers before calling this.
            # But for safety, let's stick to string rep if int conversion fails 
            # provided it's not empty.
            s_num = str(number).strip()
            if s_num:
                 n = s_num
    
    # Create raw string for hashing
    raw = f"{event_id}:{f}:{l}:{n}"
    
    # Log exactly as requested for investigation
    logging.info(f"[ID RAW] {raw}")
    
    # Return SHA-256 hash hex digest (truncated to 20 chars for ID-like length)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()[:20]
