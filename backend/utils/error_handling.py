"""
Standardized error handling utilities for consistent error responses
"""
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from enum import Enum

class ErrorCategory(Enum):
    """Error categories for consistent classification"""
    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    NOT_FOUND = "not_found"
    CONFLICT = "conflict"
    RATE_LIMIT = "rate_limit"
    DATABASE = "database"
    EXTERNAL_SERVICE = "external_service"
    INTERNAL = "internal"

class StandardError(Exception):
    """Base class for application errors"""
    def __init__(
        self, 
        message: str, 
        category: ErrorCategory,
        status_code: int,
        details: Optional[Dict[str, Any]] = None,
        log_level: str = "error"
    ):
        self.message = message
        self.category = category
        self.status_code = status_code
        self.details = details or {}
        self.log_level = log_level
        super().__init__(message)

class ValidationError(StandardError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            category=ErrorCategory.VALIDATION,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
            log_level="warning"
        )

class AuthenticationError(StandardError):
    def __init__(self, message: str = "Authentication required", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            category=ErrorCategory.AUTHENTICATION,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
            log_level="warning"
        )

class AuthorizationError(StandardError):
    def __init__(self, message: str = "Access denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            category=ErrorCategory.AUTHORIZATION,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
            log_level="warning"
        )

class NotFoundError(StandardError):
    def __init__(self, resource: str, identifier: str = "", details: Optional[Dict[str, Any]] = None):
        message = f"{resource} not found"
        if identifier:
            message += f": {identifier}"
        super().__init__(
            message=message,
            category=ErrorCategory.NOT_FOUND,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
            log_level="info"
        )

class ConflictError(StandardError):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            category=ErrorCategory.CONFLICT,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
            log_level="warning"
        )

class DatabaseError(StandardError):
    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            category=ErrorCategory.DATABASE,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
            log_level="error"
        )

def handle_standard_error(error: StandardError) -> HTTPException:
    """Convert StandardError to HTTPException with proper logging"""
    
    # Log the error with appropriate level
    log_data = {
        "category": error.category.value,
        "message": error.message,
        "status_code": error.status_code,
        "details": error.details
    }
    
    if error.log_level == "error":
        logging.error(f"[{error.category.value.upper()}] {error.message}", extra=log_data)
    elif error.log_level == "warning":
        logging.warning(f"[{error.category.value.upper()}] {error.message}", extra=log_data)
    else:
        logging.info(f"[{error.category.value.upper()}] {error.message}", extra=log_data)
    
    # Create response with consistent format
    response_data = {
        "detail": error.message,
        "category": error.category.value,
        "timestamp": None  # Will be added by middleware
    }
    
    # Include details in development/debug mode only
    if error.details and logging.getLogger().level <= logging.DEBUG:
        response_data["debug_details"] = error.details
    
    return HTTPException(
        status_code=error.status_code,
        detail=response_data
    )

def safe_execute(func, error_message: str = "Operation failed", error_category: ErrorCategory = ErrorCategory.INTERNAL):
    """
    Safely execute a function with consistent error handling
    
    Args:
        func: Function to execute
        error_message: Default error message if function fails
        error_category: Error category for classification
        
    Returns:
        Function result or raises StandardError
    """
    try:
        return func()
    except StandardError:
        # Re-raise our custom errors
        raise
    except ValueError as e:
        raise ValidationError(f"Invalid input: {str(e)}")
    except PermissionError as e:
        raise AuthorizationError(f"Permission denied: {str(e)}")
    except FileNotFoundError as e:
        raise NotFoundError("File", str(e))
    except Exception as e:
        # Log unexpected errors
        logging.error(f"Unexpected error in {func.__name__}: {str(e)}", exc_info=True)
        raise StandardError(
            message=error_message,
            category=error_category,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details={"original_error": str(e)}
        ) 