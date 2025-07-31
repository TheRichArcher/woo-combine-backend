import concurrent.futures
import logging
from fastapi import HTTPException

def execute_with_timeout(func, timeout=10, operation_name="database operation", *args, **kwargs):
    """
    Execute a database function with timeout protection.
    
    Args:
        func: Function to execute
        timeout: Timeout in seconds (default: 10)
        operation_name: Description for error logging
        *args, **kwargs: Arguments to pass to func
        
    Returns:
        Result of func execution
        
    Raises:
        HTTPException: On timeout or execution failure
    """
    with concurrent.futures.ThreadPoolExecutor() as executor:
        future = executor.submit(func, *args, **kwargs)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError:
            logging.error(f"{operation_name} timed out after {timeout} seconds: {func.__name__}")
            raise HTTPException(
                status_code=504,
                detail=f"{operation_name} timed out after {timeout} seconds"
            )
        except Exception as e:
            logging.error(f"{operation_name} failed: {func.__name__} - {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"{operation_name} failed: {str(e)}"
            ) 