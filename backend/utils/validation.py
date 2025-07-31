"""
Comprehensive input validation utilities for consistent data validation
"""
import re
from typing import Any, List, Dict, Optional, Union
from datetime import datetime
from .error_handling import ValidationError

# Regex patterns for common validations
PATTERNS = {
    'phone': re.compile(r'^\+?[1-9]\d{1,14}$'),  # E.164 format
    'email': re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'),
    'league_id': re.compile(r'^[a-zA-Z0-9]{10,50}$'),
    'event_id': re.compile(r'^[a-zA-Z0-9]{10,50}$'),
    'player_id': re.compile(r'^[a-zA-Z0-9]{10,50}$'),
    'user_id': re.compile(r'^[a-zA-Z0-9]{10,50}$'),
    'age_group': re.compile(r'^(7-8|9-10|11-12|13-14|15-16|17-18|U\d+|\d+U)$'),
    'player_name': re.compile(r'^[a-zA-Z\s\-\'\.]{2,50}$'),
    'league_name': re.compile(r'^[a-zA-Z0-9\s\-\'\.\(\)]{2,100}$'),
    'event_name': re.compile(r'^[a-zA-Z0-9\s\-\'\.\(\)]{2,100}$')
}

# Valid ranges for drill scores
DRILL_SCORE_RANGES = {
    '40m_dash': {'min': 3.0, 'max': 30.0, 'unit': 'seconds'},
    'vertical_jump': {'min': 0.0, 'max': 60.0, 'unit': 'inches'},
    'catching': {'min': 0, 'max': 100, 'unit': 'points'},
    'throwing': {'min': 0, 'max': 100, 'unit': 'points'},
    'agility': {'min': 0, 'max': 100, 'unit': 'points'}
}

# Valid roles
VALID_ROLES = ['organizer', 'coach', 'viewer', 'player']

# Specific validation functions for individual fields (used by routes)
def validate_player_name(name: str) -> str:
    """Validate player name format and length"""
    if not name or not isinstance(name, str):
        raise ValidationError("Player name is required")
    
    name = name.strip()
    if len(name) < 2:
        raise ValidationError("Player name must be at least 2 characters long")
    if len(name) > 50:
        raise ValidationError("Player name must be no more than 50 characters long")
    
    if not PATTERNS['player_name'].match(name):
        raise ValidationError("Player name contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed")
    
    return name

def validate_league_name(name: str) -> str:
    """Validate league name format and length"""
    if not name or not isinstance(name, str):
        raise ValidationError("League name is required")
    
    name = name.strip()
    if len(name) < 2:
        raise ValidationError("League name must be at least 2 characters long")
    if len(name) > 100:
        raise ValidationError("League name must be no more than 100 characters long")
    
    if not PATTERNS['league_name'].match(name):
        raise ValidationError("League name contains invalid characters. Only letters, numbers, spaces, hyphens, apostrophes, periods, and parentheses are allowed")
    
    return name

def validate_user_role(role: str) -> str:
    """Validate user role"""
    if not role or not isinstance(role, str):
        raise ValidationError("User role is required")
    
    role = role.strip().lower()
    if role not in VALID_ROLES:
        raise ValidationError(f"Invalid user role. Must be one of: {', '.join(VALID_ROLES)}")
    
    return role

def validate_age_group(age_group: str) -> str:
    """Validate age group format"""
    if not age_group or not isinstance(age_group, str):
        raise ValidationError("Age group is required")
    
    age_group = age_group.strip()
    if not PATTERNS['age_group'].match(age_group):
        raise ValidationError("Invalid age group format. Examples: 7-8, 9-10, U12, 12U")
    
    return age_group

def validate_drill_score(score: float, drill_type: str) -> float:
    """Validate drill score is within valid range for the drill type"""
    if drill_type not in DRILL_SCORE_RANGES:
        raise ValidationError(f"Unknown drill type: {drill_type}")
    
    if not isinstance(score, (int, float)):
        raise ValidationError(f"Drill score must be a number")
    
    ranges = DRILL_SCORE_RANGES[drill_type]
    if score < ranges['min'] or score > ranges['max']:
        raise ValidationError(
            f"{drill_type} score must be between {ranges['min']} and {ranges['max']} {ranges['unit']}"
        )
    
    return float(score)

class Validator:
    """Main validation class with comprehensive validation methods"""
    
    @staticmethod
    def required(value: Any, field_name: str) -> Any:
        """Validate that a field is required (not None, empty string, or empty list)"""
        if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
            raise ValidationError(f"{field_name} is required")
        return value
    
    @staticmethod
    def string_length(value: str, field_name: str, min_length: int = 0, max_length: int = None) -> str:
        """Validate string length"""
        if not isinstance(value, str):
            raise ValidationError(f"{field_name} must be a string")
        
        if len(value) < min_length:
            raise ValidationError(f"{field_name} must be at least {min_length} characters")
        
        if max_length and len(value) > max_length:
            raise ValidationError(f"{field_name} must be no more than {max_length} characters")
        
        return value
    
    @staticmethod
    def pattern_match(value: str, field_name: str, pattern_name: str) -> str:
        """Validate against predefined patterns"""
        if pattern_name not in PATTERNS:
            raise ValidationError(f"Unknown validation pattern: {pattern_name}")
        
        pattern = PATTERNS[pattern_name]
        if not pattern.match(value):
            raise ValidationError(f"Invalid {field_name} format")
        
        return value
    
    @staticmethod
    def number_range(value: Union[int, float], field_name: str, min_val: float = None, max_val: float = None) -> Union[int, float]:
        """Validate number is within specified range"""
        if not isinstance(value, (int, float)):
            raise ValidationError(f"{field_name} must be a number")
        
        if min_val is not None and value < min_val:
            raise ValidationError(f"{field_name} must be at least {min_val}")
        
        if max_val is not None and value > max_val:
            raise ValidationError(f"{field_name} must be no more than {max_val}")
        
        return value
    
    @staticmethod
    def one_of(value: Any, field_name: str, valid_values: List[Any]) -> Any:
        """Validate value is one of the allowed values"""
        if value not in valid_values:
            raise ValidationError(f"{field_name} must be one of: {', '.join(map(str, valid_values))}")
        return value
    
    @staticmethod
    def drill_score(value: float, drill_type: str) -> float:
        """Validate drill score is within valid range for the drill type"""
        if drill_type not in DRILL_SCORE_RANGES:
            raise ValidationError(f"Unknown drill type: {drill_type}")
        
        ranges = DRILL_SCORE_RANGES[drill_type]
        Validator.number_range(value, f"{drill_type} score", ranges['min'], ranges['max'])
        
        return value
    
    @staticmethod
    def weights_sum_to_one(weights: Dict[str, float]) -> Dict[str, float]:
        """Validate that drill weights sum to approximately 1.0"""
        total = sum(weights.values())
        if abs(total - 1.0) > 0.001:  # Allow small floating point errors
            raise ValidationError("Drill weights must sum to 1.0")
        
        for drill, weight in weights.items():
            Validator.number_range(weight, f"{drill} weight", 0.0, 1.0)
        
        return weights
    
    @staticmethod
    def iso_datetime(value: str, field_name: str) -> str:
        """Validate ISO format datetime string"""
        try:
            datetime.fromisoformat(value.replace('Z', '+00:00'))
            return value
        except ValueError:
            raise ValidationError(f"{field_name} must be a valid ISO datetime format")

# Specific validation functions for common use cases
def validate_player_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate player creation/update data"""
    validated = {}
    
    # Required fields
    validated['name'] = Validator.required(data.get('name'), 'name')
    validated['name'] = Validator.pattern_match(validated['name'], 'name', 'player_name')
    
    # Optional fields
    if 'number' in data and data['number'] is not None:
        validated['number'] = Validator.number_range(int(data['number']), 'number', 1, 9999)
    
    if 'age_group' in data and data['age_group']:
        validated['age_group'] = Validator.pattern_match(data['age_group'], 'age_group', 'age_group')
    
    # Drill scores (optional)
    for drill_type in DRILL_SCORE_RANGES.keys():
        if drill_type in data and data[drill_type] is not None:
            validated[drill_type] = Validator.drill_score(float(data[drill_type]), drill_type)
    
    return validated

def validate_league_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate league creation data"""
    validated = {}
    
    validated['name'] = Validator.required(data.get('name'), 'name')
    validated['name'] = Validator.pattern_match(validated['name'], 'name', 'league_name')
    
    return validated

def validate_event_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate event creation/update data"""
    validated = {}
    
    validated['name'] = Validator.required(data.get('name'), 'name')
    validated['name'] = Validator.pattern_match(validated['name'], 'name', 'event_name')
    
    if 'date' in data and data['date']:
        validated['date'] = Validator.iso_datetime(data['date'], 'date')
    
    if 'location' in data and data['location']:
        validated['location'] = Validator.string_length(data['location'], 'location', 0, 200)
    
    return validated

def validate_drill_weights(weights: Dict[str, float]) -> Dict[str, float]:
    """Validate drill weight data for ranking calculations"""
    expected_drills = set(DRILL_SCORE_RANGES.keys())
    provided_drills = set(weights.keys())
    
    if provided_drills != expected_drills:
        missing = expected_drills - provided_drills
        extra = provided_drills - expected_drills
        error_parts = []
        
        if missing:
            error_parts.append(f"Missing weights for: {', '.join(missing)}")
        if extra:
            error_parts.append(f"Unexpected weights for: {', '.join(extra)}")
        
        raise ValidationError(". ".join(error_parts))
    
    return Validator.weights_sum_to_one(weights)

def validate_role(role: str) -> str:
    """Validate user role"""
    return Validator.one_of(role, 'role', VALID_ROLES)

def validate_pagination(page: int = 1, limit: int = 50) -> Dict[str, int]:
    """Validate pagination parameters"""
    validated_page = Validator.number_range(page, 'page', 1, 1000)
    validated_limit = Validator.number_range(limit, 'limit', 1, 500)
    
    return {'page': validated_page, 'limit': validated_limit} 