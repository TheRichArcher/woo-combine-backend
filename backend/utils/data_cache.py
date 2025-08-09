import time
from functools import lru_cache
from ..middleware.observability import add_cache_deltas


def cache_with_metrics(maxsize: int = 256):
    """Decorator: like lru_cache but increments hit/miss counters per request.

    Note: This is a thin wrapper over functools.lru_cache. It calls add_cache_deltas
    on each invocation to record a hit or miss in the current request context.
    """

    def decorator(func):
        cached = lru_cache(maxsize=maxsize)(func)

        def wrapper(*args, **kwargs):
            key = args + tuple(sorted(kwargs.items())) if kwargs else args
            try:
                # Probe using cache info by calling and comparing hits delta
                hits_before, misses_before = cached.cache_info().hits, cached.cache_info().misses
                result = cached(*args, **kwargs)
                info = cached.cache_info()
                if info.hits > hits_before:
                    add_cache_deltas(hits_delta=1)
                elif info.misses > misses_before:
                    add_cache_deltas(misses_delta=1)
                return result
            except Exception:
                return cached(*args, **kwargs)

        wrapper.cache_info = cached.cache_info  # type: ignore[attr-defined]
        wrapper.cache_clear = cached.cache_clear  # type: ignore[attr-defined]
        return wrapper

    return decorator


