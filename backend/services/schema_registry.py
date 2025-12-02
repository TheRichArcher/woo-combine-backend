from typing import Dict, List, Optional
from ..schemas import SportSchema, DrillDefinition, PresetDefinition

# --- FOOTBALL DEFAULT SCHEMA (Matches Production) ---
FOOTBALL_DEFAULT = SportSchema(
    id="football",
    sport="Football",
    name="Football Combine",
    description="Traditional football combine drills",
    drills=[
        DrillDefinition(
            key="40m_dash", 
            label="40-Yard Dash", 
            unit="sec", 
            lower_is_better=True, 
            category="speed",
            min_value=3.0,
            max_value=15.0,
            default_weight=0.3
        ),
        DrillDefinition(
            key="vertical_jump", 
            label="Vertical Jump", 
            unit="in", 
            lower_is_better=False, 
            category="power",
            min_value=0.0,
            max_value=50.0,
            default_weight=0.2
        ),
        DrillDefinition(
            key="catching", 
            label="Catching", 
            unit="pts", 
            lower_is_better=False, 
            category="skills",
            min_value=0.0,
            max_value=100.0,
            default_weight=0.15
        ),
        DrillDefinition(
            key="throwing", 
            label="Throwing", 
            unit="pts", 
            lower_is_better=False, 
            category="skills",
            min_value=0.0,
            max_value=100.0,
            default_weight=0.15
        ),
        DrillDefinition(
            key="agility", 
            label="Agility", 
            unit="pts", 
            lower_is_better=False, 
            category="agility",
            min_value=0.0,
            max_value=100.0,
            default_weight=0.2
        ),
    ],
    presets={
        "balanced": PresetDefinition(
            name="Balanced",
            description="Equal emphasis on all skills",
            weights={"40m_dash": 0.2, "vertical_jump": 0.2, "catching": 0.2, "throwing": 0.2, "agility": 0.2}
        ),
        "speed": PresetDefinition(
            name="Speed Focused",
            description="Emphasizes speed and athleticism",
            weights={"40m_dash": 0.4, "vertical_jump": 0.3, "catching": 0.1, "throwing": 0.1, "agility": 0.1}
        ),
        "skills": PresetDefinition(
            name="Skills Focused",
            description="Emphasizes catching and throwing",
            weights={"40m_dash": 0.1, "vertical_jump": 0.1, "catching": 0.35, "throwing": 0.35, "agility": 0.1}
        ),
        "athletic": PresetDefinition(
            name="Athletic",
            description="Emphasizes physical abilities",
            weights={"40m_dash": 0.25, "vertical_jump": 0.25, "catching": 0.15, "throwing": 0.15, "agility": 0.2}
        )
    }
)

# --- SOCCER SCHEMA (Example for Multi-Sport) ---
SOCCER_DEFAULT = SportSchema(
    id="soccer",
    sport="Soccer",
    name="Soccer Combine",
    description="Comprehensive soccer skills evaluation",
    drills=[
        DrillDefinition(key="sprint_speed", label="20m Sprint", unit="sec", lower_is_better=True, category="speed", default_weight=0.15),
        DrillDefinition(key="ball_control", label="Ball Control", unit="pts", lower_is_better=False, category="technical", default_weight=0.25),
        DrillDefinition(key="passing_accuracy", label="Passing Accuracy", unit="pts", lower_is_better=False, category="technical", default_weight=0.25),
        DrillDefinition(key="shooting_power", label="Shooting Power", unit="mph", lower_is_better=False, category="technical", default_weight=0.15),
        DrillDefinition(key="agility_cones", label="Agility (Cones)", unit="sec", lower_is_better=True, category="agility", default_weight=0.1),
        DrillDefinition(key="endurance", label="Endurance (Beep Test)", unit="level", lower_is_better=False, category="fitness", default_weight=0.1),
    ],
    presets={
        "balanced": PresetDefinition(
            name="Balanced",
            description="Equal emphasis on all areas",
            weights={"sprint_speed": 0.15, "ball_control": 0.2, "passing_accuracy": 0.2, "shooting_power": 0.15, "agility_cones": 0.15, "endurance": 0.15}
        ),
        "technical": PresetDefinition(
            name="Technical Focus",
            description="Emphasizes ball skills and accuracy",
            weights={"sprint_speed": 0.05, "ball_control": 0.35, "passing_accuracy": 0.35, "shooting_power": 0.15, "agility_cones": 0.05, "endurance": 0.05}
        )
    }
)

# --- BASKETBALL SCHEMA ---
BASKETBALL_DEFAULT = SportSchema(
    id="basketball",
    sport="Basketball",
    name="Basketball Combine",
    description="Basketball skills and athleticism evaluation",
    drills=[
        DrillDefinition(key="lane_agility", label="Lane Agility", unit="sec", lower_is_better=True, category="agility", default_weight=0.15),
        DrillDefinition(key="vertical_jump", label="Vertical Jump", unit="in", lower_is_better=False, category="power", default_weight=0.2),
        DrillDefinition(key="free_throws", label="Free Throw %", unit="%", lower_is_better=False, category="shooting", default_weight=0.2),
        DrillDefinition(key="three_point", label="3-Point Shooting %", unit="%", lower_is_better=False, category="shooting", default_weight=0.2),
        DrillDefinition(key="dribbling", label="Ball Handling", unit="pts", lower_is_better=False, category="skills", default_weight=0.15),
        DrillDefinition(key="defensive_slide", label="Defensive Slides", unit="sec", lower_is_better=True, category="defense", default_weight=0.1),
    ],
    presets={
        "shooter": PresetDefinition(
            name="Shooter Focus",
            description="Emphasizes shooting abilities",
            weights={"lane_agility": 0.1, "vertical_jump": 0.1, "free_throws": 0.35, "three_point": 0.35, "dribbling": 0.05, "defensive_slide": 0.05}
        )
    }
)

# --- BASEBALL SCHEMA ---
BASEBALL_DEFAULT = SportSchema(
    id="baseball",
    sport="Baseball",
    name="Baseball Combine",
    description="Baseball skills and athletic evaluation",
    drills=[
        DrillDefinition(key="sprint_60", label="60-Yard Sprint", unit="sec", lower_is_better=True, category="speed", default_weight=0.2),
        DrillDefinition(key="exit_velocity", label="Exit Velocity", unit="mph", lower_is_better=False, category="hitting", default_weight=0.3),
        DrillDefinition(key="throwing_velocity", label="Throwing Velocity", unit="mph", lower_is_better=False, category="throwing", default_weight=0.25),
        DrillDefinition(key="fielding_accuracy", label="Fielding Accuracy", unit="pts", lower_is_better=False, category="fielding", default_weight=0.15),
        DrillDefinition(key="pop_time", label="Pop Time (Catchers)", unit="sec", lower_is_better=True, category="catching", default_weight=0.1),
    ],
    presets={
        "hitter": PresetDefinition(
            name="Hitter Focus",
            description="Emphasizes hitting abilities",
            weights={"sprint_60": 0.15, "exit_velocity": 0.5, "throwing_velocity": 0.15, "fielding_accuracy": 0.15, "pop_time": 0.05}
        )
    }
)

# --- TRACK SCHEMA ---
TRACK_DEFAULT = SportSchema(
    id="track",
    sport="Track & Field",
    name="Track & Field",
    description="Track and field athletic evaluation",
    drills=[
        DrillDefinition(key="sprint_100", label="100m Sprint", unit="sec", lower_is_better=True, category="sprint", default_weight=0.25),
        DrillDefinition(key="sprint_400", label="400m Sprint", unit="sec", lower_is_better=True, category="sprint", default_weight=0.15),
        DrillDefinition(key="long_jump", label="Long Jump", unit="ft", lower_is_better=False, category="field", default_weight=0.2),
        DrillDefinition(key="high_jump", label="High Jump", unit="ft", lower_is_better=False, category="field", default_weight=0.15),
        DrillDefinition(key="shot_put", label="Shot Put", unit="ft", lower_is_better=False, category="field", default_weight=0.15),
        DrillDefinition(key="mile_time", label="Mile Run", unit="min", lower_is_better=True, category="distance", default_weight=0.1),
    ],
    presets={
        "sprinter": PresetDefinition(
            name="Sprinter Focus",
            description="Short distance speed events",
            weights={"sprint_100": 0.45, "sprint_400": 0.25, "long_jump": 0.15, "high_jump": 0.1, "shot_put": 0.025, "mile_time": 0.025}
        )
    }
)

# --- VOLLEYBALL SCHEMA ---
VOLLEYBALL_DEFAULT = SportSchema(
    id="volleyball",
    sport="Volleyball",
    name="Volleyball Combine",
    description="Volleyball skills evaluation",
    drills=[
        DrillDefinition(key="vertical_jump", label="Vertical Jump", unit="in", lower_is_better=False, category="power", default_weight=0.2),
        DrillDefinition(key="approach_jump", label="Approach Jump", unit="in", lower_is_better=False, category="power", default_weight=0.2),
        DrillDefinition(key="serving_accuracy", label="Serving Accuracy", unit="pts", lower_is_better=False, category="skills", default_weight=0.15),
        DrillDefinition(key="passing_accuracy", label="Passing Accuracy", unit="pts", lower_is_better=False, category="skills", default_weight=0.15),
        DrillDefinition(key="attack_power", label="Attack Power", unit="mph", lower_is_better=False, category="offense", default_weight=0.15),
        DrillDefinition(key="blocking_reach", label="Blocking Reach", unit="in", lower_is_better=False, category="defense", default_weight=0.15),
    ],
    presets={
        "hitter": PresetDefinition(
            name="Hitter Focus",
            description="Outside hitter/attacker focus",
            weights={"vertical_jump": 0.25, "approach_jump": 0.3, "serving_accuracy": 0.1, "passing_accuracy": 0.1, "attack_power": 0.2, "blocking_reach": 0.05}
        )
    }
)

class SchemaRegistry:
    _schemas: Dict[str, SportSchema] = {
        "football": FOOTBALL_DEFAULT,
        "soccer": SOCCER_DEFAULT,
        "basketball": BASKETBALL_DEFAULT,
        "baseball": BASEBALL_DEFAULT,
        "track": TRACK_DEFAULT,
        "volleyball": VOLLEYBALL_DEFAULT,
    }
    
    @classmethod
    def get_schema(cls, sport_or_id: str) -> Optional[SportSchema]:
        # Normalize ID (e.g., "Football" -> "football")
        key = sport_or_id.lower()
        
        # Direct lookup
        if key in cls._schemas:
            return cls._schemas[key]
            
        # Search by sport name if not found by ID
        for schema in cls._schemas.values():
            if schema.sport.lower() == key:
                return schema
                
        return None

    @classmethod
    def get_all_schemas(cls) -> List[SportSchema]:
        return list(cls._schemas.values())

# Global instance
registry = SchemaRegistry()

