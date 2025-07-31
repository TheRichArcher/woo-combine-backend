import logging
from fastapi import HTTPException

def execute_with_timeout(func, timeout=10, operation_name="database operation", *args, **kwargs):
    """
    Execute a database function with error handling.
    
    Note: ThreadPoolExecutor removed as it was causing delays in cold starts.
    For Firestore operations, direct execution is much faster.
    
    Args:
        func: Function to execute
        timeout: Timeout in seconds (unused now, kept for API compatibility)
        operation_name: Description for error logging
        *args, **kwargs: Arguments to pass to func
        
    Returns:
        Result of func execution
        
    Raises:
        HTTPException: On execution failure
    """
    try:
        # Direct execution - much faster than ThreadPoolExecutor for Firestore ops
        return func(*args, **kwargs)
    except Exception as e:
        logging.error(f"{operation_name} failed: {func.__name__} - {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"{operation_name} failed: {str(e)}"
        ) 