#!/bin/bash

# Skills Engine Setup Script
# This script automates the initial setup process

set -e

echo "🚀 Skills Engine Setup Script"
echo "=============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node -v) found${NC}"
echo ""

# Setup Backend
echo "🔧 Setting up Backend..."
cd backend

if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your configuration${NC}"
else
    echo "✅ .env file already exists"
fi

echo "📦 Installing backend dependencies..."
npm install

cd ..
echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""

# Setup Frontend
echo "🔧 Setting up Frontend..."
cd frontend

if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local file from template..."
    cp .env.local.example .env.local 2>/dev/null || echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
    echo -e "${YELLOW}⚠️  Please edit frontend/.env.local with your API URL${NC}"
else
    echo "✅ .env.local file already exists"
fi

echo "📦 Installing frontend dependencies..."
npm install

cd ..
echo -e "${GREEN}✅ Frontend setup complete${NC}"
echo ""

# Database reminder
echo "📊 Database Setup Reminder:"
echo "  1. Create a PostgreSQL database (Supabase recommended)"
echo "  2. Run: psql -h <host> -U <user> -d <database> -f database/migrations/000_initial_schema.sql"
echo "  3. Update DATABASE_URL in backend/.env"
echo ""

echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Configure environment variables (backend/.env, frontend/.env.local)"
echo "  2. Set up database and run migrations"
echo "  3. Start backend: cd backend && npm run dev"
echo "  4. Start frontend: cd frontend && npm run dev"
echo ""

