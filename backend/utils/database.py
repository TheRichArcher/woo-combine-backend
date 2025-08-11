import logging
from fastapi import HTTPException
import concurrent.futures

def execute_with_timeout(func, timeout=5, operation_name="database operation", *args, **kwargs):
    """
    Execute a potentially-blocking function with a hard timeout. Designed to
    protect cold-start sequences from hanging on first Firestore calls.

    Args:
        func: Callable to execute
        timeout: Max seconds to wait
        operation_name: For logs and error messages
        *args, **kwargs: Forwarded to func

    Returns:
        The function's return value

    Raises:
        HTTPException 504 on timeout, 500 on other failures
    """
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(func, *args, **kwargs)
            try:
                return future.result(timeout=timeout)
            except concurrent.futures.TimeoutError:
                logging.warning(f"{operation_name} timed out after {timeout}s")
                raise HTTPException(status_code=504, detail=f"{operation_name} timed out")
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"{operation_name} failed: {getattr(func, '__name__', 'callable')} - {str(e)}")
        raise HTTPException(status_code=500, detail=f"{operation_name} failed: {str(e)}")