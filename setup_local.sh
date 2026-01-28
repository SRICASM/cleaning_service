#!/bin/bash
set -e

echo "🚀 Starting Cleaning Service Setup..."

# Backend Setup
echo "📦 Setting up Backend..."
cd backend

# Create virtual environment if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

echo "Activating virtual environment..."
source venv/bin/activate

# Check for Postgres (support multiple versions)
if command -v brew &> /dev/null; then
    if ! brew services list | grep -q "postgresql.*started"; then
        echo "⚠️  PostgreSQL does not seem to be running!"
        echo "   Attempting to start it..."
        # Try common PostgreSQL versions
        if brew services list | grep -q "postgresql@16"; then
            brew services start postgresql@16
        elif brew services list | grep -q "postgresql@15"; then
            brew services start postgresql@15
        elif brew services list | grep -q "postgresql@14"; then
            brew services start postgresql@14
        elif brew services list | grep -q "postgresql "; then
            brew services start postgresql
        else
            echo "   Please install and start PostgreSQL manually"
        fi
    fi
fi

echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create .env file from .env.example if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Creating backend .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please update backend/.env with your actual configuration values"
fi

cd ..

# Frontend Setup
echo "📦 Setting up Frontend..."
cd frontend

# Create .env file from .env.example if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    echo "Creating frontend .env file from .env.example..."
    cp .env.example .env
    echo "⚠️  Please verify frontend/.env has correct backend URL"
fi

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
