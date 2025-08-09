import os
import json
import sys


def main():
    # Make backend importable
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

    from backend.main import app  # type: ignore

    spec = app.openapi()
    out_dir = os.path.join(repo_root, "docs")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "openapi.json")
    with open(out_path, "w") as f:
        json.dump(spec, f, indent=2)
    print(f"Wrote OpenAPI spec to {out_path}")


if __name__ == "__main__":
    main()



