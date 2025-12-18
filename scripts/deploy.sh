#!/bin/bash

# Deploy script for speaking-english app
# Usage: ./scripts/deploy.sh

set -e  # Exit on error

echo "=========================================="
echo "  Speaking English - Deploy Script"
echo "=========================================="
echo ""

# Check if running on server
if [ ! -d "/home/speaking-english" ]; then
    echo "❌ Error: This script should run on the server in /home/speaking-english"
    exit 1
fi

cd /home/speaking-english

# Backup database
echo "📦 Backing up database..."
if [ -f "database/exam_system.db" ]; then
    cp database/exam_system.db database/exam_system.db.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Database backed up"
else
    echo "⚠️  No database found, skipping backup"
fi

# Install dependencies
echo ""
echo "📚 Installing dependencies..."
npm install

# Build TypeScript
echo ""
echo "🔨 Building TypeScript..."
npm run build

# Check if build succeeded
if [ ! -f "dist/app.js" ]; then
    echo "❌ Build failed! dist/app.js not found"
    exit 1
fi

echo "✅ Build successful"

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p uploads/audio
mkdir -p uploads/temp
mkdir -p database
echo "✅ Directories created"

# Check if .env exists
if [ ! -f ".env" ]; then
    echo ""
    echo "⚠️  Warning: .env file not found!"
    echo "Please create .env file from .env.example"
    echo "cp .env.example .env"
    echo "nano .env"
    exit 1
fi

# Restart PM2
echo ""
echo "🔄 Restarting PM2 app..."
if pm2 describe speaking-english > /dev/null 2>&1; then
    pm2 restart speaking-english
    echo "✅ App restarted"
else
    echo "⚠️  App not found in PM2, starting new instance..."
    pm2 start ecosystem.config.js
    pm2 save
    echo "✅ App started"
fi

# Show status
echo ""
echo "📊 PM2 Status:"
pm2 list

echo ""
echo "📝 Recent logs:"
pm2 logs speaking-english --lines 20 --nostream

echo ""
echo "=========================================="
echo "  ✅ Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  pm2 logs speaking-english    - View logs"
echo "  pm2 restart speaking-english - Restart app"
echo "  pm2 monit                    - Monitor app"
echo ""
