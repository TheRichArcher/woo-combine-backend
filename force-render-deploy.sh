#!/bin/bash

# Force Render Deployment
# Run this if backend isn't showing the new response shape

echo "🚀 Forcing Render deployment for commit 67a250e..."
echo ""

cd /Users/richarcher/Desktop/WooCombine\ App

echo "📝 Creating empty commit to trigger Render..."
git commit --allow-empty -m "Force Render redeploy - verify league/event fix (67a250e)"

echo ""
echo "📤 Pushing to main branch..."
git push origin main

echo ""
echo "✅ Push complete!"
echo ""
echo "📊 Next steps:"
echo "   1. Go to https://dashboard.render.com"
echo "   2. Click 'woo-combine-backend' service"
echo "   3. Watch 'Events' tab for deployment (usually 2-3 minutes)"
echo "   4. Look for 'Deploy succeeded' message"
echo "   5. Test the backend response shape again"
echo ""
echo "💡 Or manually deploy:"
echo "   Render Dashboard → woo-combine-backend → Manual Deploy → Deploy latest commit"

