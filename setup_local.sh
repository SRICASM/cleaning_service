#!/bin/bash
set -e

echo "🚀 Starting Cleaning Service Setup..."

# Backend Setup
echo "📦 Setting up Backend..."
cd backend
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

echo "Installing Python dependencies..."
pip install -r requirements.txt

# Seed Data (requires server to be running, skipping for now or handle later)
# We can't seed until the server is up.

cd ..

# Frontend Setup
echo "📦 Setting up Frontend..."
cd frontend
if command -v yarn &> /dev/null; then
    echo "Installing frontend dependencies with Yarn..."
    yarn install
else
    echo "Installing frontend dependencies with NPM..."
    npm install --legacy-peer-deps
fi

cd ..

echo "✅ Setup Complete!"
echo ""
echo "To run the backend:"
echo "  cd backend"
echo "  source venv/bin/activate"
echo "  uvicorn server:app --reload --port 8000"
echo ""
echo "To run the frontend:"
echo "  cd frontend"
echo "  yarn start (or npm start)"
echo ""
