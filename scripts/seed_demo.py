#!/usr/bin/env python3
"""
Seed dev/staging with a Demo League, two demo events, and 100 demo players
across 3 age groups, plus 5–8 evaluator submissions per drill.

Usage:
  ENABLE_DEMO_SEED=true DEMO_SEED_TOKEN=... python3 scripts/seed_demo.py --base-url https://your-host

Defaults to http://localhost:8000
"""
import argparse
import os
import sys
import json
import urllib.request
import urllib.error


def request_json(method: str, url: str, headers: dict | None = None, data: dict | None = None):
    req = urllib.request.Request(url, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if data is not None:
        payload = json.dumps(data).encode("utf-8")
        req.add_header("Content-Type", "application/json")
        req.data = payload
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default=os.environ.get("BASE_URL", "http://localhost:8000"))
    parser.add_argument("--token", default=os.environ.get("DEMO_SEED_TOKEN"))
    args = parser.parse_args()

    if not args.token:
        print("DEMO_SEED_TOKEN is required (env or --token)", file=sys.stderr)
        return 2

    url = args.base_url.rstrip("/") + "/api/demo/seed"
    headers = {"X-DEMO-SEED-TOKEN": args.token}
    try:
        result = request_json("POST", url, headers=headers)
        print(json.dumps(result, indent=2))
        return 0
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8')}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())


