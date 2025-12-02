from typing import Dict, Any, List
from ..firestore_client import db
from ..utils.validation import DRILL_SCORE_RANGES

def calculate_event_stats(event_id: str) -> Dict[str, Any]:
    """
    Calculate comprehensive statistics for an event.
    Returns participant count, per-drill metrics, top performers, etc.
    """
    # Fetch players
    players_ref = db.collection("events").document(event_id).collection("players")
    players_stream = players_ref.stream()
    player_data = [dict(p.to_dict(), id=p.id) for p in players_stream]
    
    stats = {
        "participant_count": len(player_data),
        "drills": {},
        "overall_ranking_distribution": {}, 
        "missing_values": {},
        "anomalies": []
    }
    
    # Define drill sort directions (True = Lower is Better, False = Higher is Better)
    LOWER_IS_BETTER = {
        "40m_dash": True,
        "agility": True,
        "vertical_jump": False,
        "throwing": False,
        "catching": False
    }
    
    for key in DRILL_SCORE_RANGES.keys():
        drill_stats = {
            "min": None,
            "max": None,
            "sum": 0,
            "count": 0,
            "mean": None,
            "top_performers": []
        }
        
        values = []
        missing_count = 0
        
        # Collect values
        for p in player_data:
            val = p.get(key)
            if val is not None and str(val).strip() != "":
                try:
                    v = float(val)
                    values.append({
                        "value": v,
                        "player_name": f"{p.get('first_name', '')} {p.get('last_name', '')}",
                        "jersey_number": p.get("jersey_number", ""),
                        "id": p.get("id", "")
                    })
                    
                    # Update aggregations
                    if drill_stats["min"] is None or v < drill_stats["min"]:
                        drill_stats["min"] = v
                    if drill_stats["max"] is None or v > drill_stats["max"]:
                        drill_stats["max"] = v
                        
                    drill_stats["sum"] += v
                    drill_stats["count"] += 1
                except ValueError:
                    pass # Ignore non-numeric trash
            else:
                missing_count += 1
                
        stats["missing_values"][key] = missing_count
        
        if drill_stats["count"] > 0:
            drill_stats["mean"] = drill_stats["sum"] / drill_stats["count"]
            
            # Sort values
            lower_better = LOWER_IS_BETTER.get(key, False) # Default to higher is better
            
            # If lower is better, sort ASC (reverse=False). If higher is better, sort DESC (reverse=True).
            # Wait, sort(reverse=False) is ASC (small to large).
            # Lower is better -> Small values are best -> ASC sort -> Take first N.
            # Higher is better -> Large values are best -> DESC sort -> Take first N.
            
            reverse_sort = not lower_better
            
            values.sort(key=lambda x: x["value"], reverse=reverse_sort)
            
            drill_stats["top_performers"] = values[:3]
        else:
            drill_stats["min"] = 0
            drill_stats["max"] = 0
            drill_stats["mean"] = 0
            
        stats["drills"][key] = drill_stats
        
    return stats

