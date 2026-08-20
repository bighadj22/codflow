#!/bin/bash

echo "🔍 Setting up Lighthouse Testing Suite for Theme01"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully!"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Create reports directory
mkdir -p reports
echo "📁 Created reports directory"

# Make scripts executable
chmod +x run-lighthouse.js
chmod +x serve-local.js

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Build your Astro site: cd .. && npm run build"
echo "2. Start local server: npm run serve"
echo "3. Run Lighthouse tests: npm run test"
echo ""
echo "Available commands:"
echo "  npm run serve       # Start local server"
echo "  npm run test        # Test all pages (mobile + desktop)"
echo "  npm run test:mobile # Test mobile only"
echo "  npm run test:desktop # Test desktop only"
echo ""
echo "Happy testing! 🚀"