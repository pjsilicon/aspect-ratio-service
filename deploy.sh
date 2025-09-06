#!/bin/bash

# Simple deployment script
echo "🚀 Deploying Aspect Ratio Service to Vercel..."

# Initialize git repo if not exists
if [ ! -d ".git" ]; then
    git init
    git add .
    git commit -m "Initial commit"
fi

# Deploy to Vercel
vercel --prod --yes

echo "✅ Deployment initiated! Check your Vercel dashboard for the URL."
echo "📝 Next: Add environment variables in Vercel dashboard"