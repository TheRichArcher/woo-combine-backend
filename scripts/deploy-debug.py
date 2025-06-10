#!/usr/bin/env python3
"""
Deployment debug script for WooCombine
Run this to check if everything is set up correctly for deployment
"""

import os
import sys
import json
from pathlib import Path

def check_environment():
    """Check environment variables"""
    print("🔍 Checking Environment Variables...")
    
    required_vars = [
        "GOOGLE_CLOUD_PROJECT",
        "FIREBASE_PROJECT_ID", 
        "GOOGLE_APPLICATION_CREDENTIALS_JSON"
    ]
    
    optional_vars = [
        "FIREBASE_AUTH_DOMAIN",
        "FIREBASE_API_KEY",
        "VITE_API_BASE"
    ]
    
    missing_required = []
    
    for var in required_vars:
        value = os.getenv(var)
        if value:
            print(f"  ✅ {var}: configured")
            if var == "GOOGLE_APPLICATION_CREDENTIALS_JSON":
                try:
                    json.loads(value)
                    print(f"    ✅ Valid JSON format")
                except:
                    print(f"    ❌ Invalid JSON format")
        else:
            print(f"  ❌ {var}: NOT SET")
            missing_required.append(var)
    
    for var in optional_vars:
        value = os.getenv(var)
        if value:
            print(f"  ✅ {var}: configured")
        else:
            print(f"  ⚠️  {var}: not set (optional)")
    
    return len(missing_required) == 0

def check_frontend_build():
    """Check if frontend was built correctly"""
    print("\n🏗️  Checking Frontend Build...")
    
    frontend_dir = Path(__file__).parent.parent / "frontend"
    dist_dir = frontend_dir / "dist"
    
    if not frontend_dir.exists():
        print(f"  ❌ Frontend directory not found: {frontend_dir}")
        return False
    
    if not dist_dir.exists():
        print(f"  ❌ Frontend dist directory not found: {dist_dir}")
        print(f"     Run: cd frontend && npm install && npm run build")
        return False
    
    index_file = dist_dir / "index.html"
    if not index_file.exists():
        print(f"  ❌ index.html not found in dist directory")
        return False
    
    print(f"  ✅ Frontend build found: {dist_dir}")
    
    # Check for common build artifacts
    assets_dir = dist_dir / "assets"
    if assets_dir.exists():
        js_files = list(assets_dir.glob("*.js"))
        css_files = list(assets_dir.glob("*.css"))
        print(f"  ✅ Found {len(js_files)} JS files, {len(css_files)} CSS files")
    
    return True

def check_backend_deps():
    """Check if backend dependencies are available"""
    print("\n📦 Checking Backend Dependencies...")
    
    try:
        import fastapi
        print(f"  ✅ FastAPI: {fastapi.__version__}")
    except ImportError:
        print(f"  ❌ FastAPI not installed")
        return False
    
    try:
        import firebase_admin
        print(f"  ✅ Firebase Admin SDK available")
    except ImportError:
        print(f"  ❌ Firebase Admin SDK not installed")
        return False
    
    try:
        from google.cloud import firestore
        print(f"  ✅ Google Cloud Firestore available")
    except ImportError:
        print(f"  ❌ Google Cloud Firestore not installed")
        return False
    
    return True

def test_firestore_connection():
    """Test Firestore connection"""
    print("\n🔥 Testing Firestore Connection...")
    
    try:
        # Add the backend to the path
        backend_path = Path(__file__).parent.parent / "backend"
        sys.path.insert(0, str(backend_path.parent))
        
        from backend.firestore_client import get_firestore_client
        client = get_firestore_client()
        
        # Test basic operations
        test_collection = client.collection("deployment_test")
        print(f"  ✅ Firestore client initialized successfully")
        
        return True
        
    except Exception as e:
        print(f"  ⚠️  Firestore connection issue: {e}")
        print(f"     This is normal for local development without credentials")
        return False

def main():
    """Run all checks"""
    print("🚀 WooCombine Deployment Debug")
    print("=" * 50)
    
    checks = [
        ("Environment Variables", check_environment),
        ("Backend Dependencies", check_backend_deps),
        ("Frontend Build", check_frontend_build),
        ("Firestore Connection", test_firestore_connection),
    ]
    
    results = []
    for name, check_func in checks:
        result = check_func()
        results.append((name, result))
    
    print("\n" + "=" * 50)
    print("📋 Summary:")
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status} {name}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All checks passed! Ready for deployment.")
    else:
        print("\n⚠️  Some checks failed. See output above for details.")
        print("\n🔧 To fix:")
        print("  1. Set required environment variables in Render dashboard")
        print("  2. Ensure frontend is built: cd frontend && npm run build")
        print("  3. Install backend dependencies: pip install -r requirements.txt")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main()) 