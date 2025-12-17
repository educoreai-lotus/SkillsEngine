#!/bin/bash

# Skills Engine - Complete Setup Script
# This script automates the entire setup process for Skills Engine microservice

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Skills Engine - Complete Setup Script              ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print step
print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================
print_step "Step 1: Checking Prerequisites"

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    echo "Please install Node.js 18+ from: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    print_error "Node.js version 20+ is required. Current version: $(node -v)"
    exit 1
fi
print_success "Node.js $(node -v) found"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi
print_success "npm $(npm -v) found"

# Check Git
if ! command -v git &> /dev/null; then
    print_warning "Git is not installed (optional for development)"
else
    print_success "Git $(git --version | cut -d' ' -f3) found"
fi

# Check PostgreSQL client (optional)
if command -v psql &> /dev/null; then
    print_success "PostgreSQL client (psql) found"
else
    print_warning "PostgreSQL client (psql) not found - needed for database migrations"
fi

# ============================================================================
# STEP 2: Backend Setup
# ============================================================================
print_step "Step 2: Setting up Backend"

cd backend

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_info "Creating .env file from template..."
    if [ -f "env.example" ]; then
        cp env.example .env
        print_success ".env file created from env.example"
        print_warning "Please edit backend/.env with your configuration"
    else
        print_warning "env.example not found, creating basic .env file"
        cat > .env << EOF
# Database Configuration (Supabase PostgreSQL)
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres

# Server Configuration
NODE_ENV=development
PORT=8080
API_BASE_URL=http://localhost:8080

# Authentication
JWT_SECRET=your_jwt_secret_here_change_in_production
JWT_EXPIRES_IN=24h

# External Services - Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_FLASH_MODEL=gemini-1.5-flash
GEMINI_DEEP_SEARCH_MODEL=gemini-1.5-pro

# Logging
LOG_LEVEL=debug
EOF
        print_success "Basic .env file created"
    fi
else
    print_success ".env file already exists"
fi

# Install dependencies
print_info "Installing backend dependencies..."
if npm install; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

cd ..

# ============================================================================
# STEP 3: Frontend Setup
# ============================================================================
print_step "Step 3: Setting up Frontend"

cd frontend

# Create .env.local file if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_info "Creating .env.local file..."
    if [ -f ".env.local.example" ]; then
        cp .env.local.example .env.local
        print_success ".env.local file created from .env.local.example"
    else
        echo "NEXT_PUBLIC_API_URL=http://localhost:8080" > .env.local
        print_success "Basic .env.local file created"
    fi
    print_warning "Please edit frontend/.env.local with your API URL"
else
    print_success ".env.local file already exists"
fi

# Install dependencies
print_info "Installing frontend dependencies..."
if npm install; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

cd ..

# ============================================================================
# STEP 4: Database Setup Instructions
# ============================================================================
print_step "Step 4: Database Setup"

print_info "Database setup is required before running the application"
echo ""
echo "Choose your database option:"
echo ""
echo "  Option A: Supabase (Recommended)"
echo "    1. Go to https://supabase.com and create a new project"
echo "    2. Get your connection string from: Settings > Database > Connection string"
echo "    3. Update DATABASE_URL in backend/.env"
echo "    4. Run migrations:"
echo "       export DATABASE_URL='your-connection-string'"
echo "       ./scripts/migrate-supabase.sh"
echo ""
echo "  Option B: Local PostgreSQL"
echo "    1. Install PostgreSQL locally"
echo "    2. Create database: createdb skills_engine"
echo "    3. Update DATABASE_URL in backend/.env"
echo "    4. Run migrations:"
echo "       psql -d skills_engine -f database/migrations/000_initial_schema.sql"
echo ""

# Ask if user wants to run migrations now
read -p "Do you want to run database migrations now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL environment variable is not set"
        read -p "Enter your Supabase connection string: " db_url
        export DATABASE_URL="$db_url"
    fi
    
    if [ -f "scripts/migrate-supabase.sh" ]; then
        print_info "Running database migrations..."
        chmod +x scripts/migrate-supabase.sh
        if ./scripts/migrate-supabase.sh; then
            print_success "Database migrations completed"
        else
            print_error "Database migrations failed"
            print_info "You can run migrations manually later using: ./scripts/migrate-supabase.sh"
        fi
    else
        print_warning "Migration script not found, skipping..."
    fi
else
    print_info "Skipping database migrations. Run them manually when ready."
fi

# ============================================================================
# STEP 5: Verify Installation
# ============================================================================
print_step "Step 5: Verifying Installation"

# Check backend structure
if [ -d "backend/src" ]; then
    print_success "Backend structure verified"
else
    print_error "Backend structure incomplete"
fi

# Check frontend structure
if [ -d "frontend/src" ]; then
    print_success "Frontend structure verified"
else
    print_error "Frontend structure incomplete"
fi

# Check if node_modules exist
if [ -d "backend/node_modules" ]; then
    print_success "Backend dependencies installed"
else
    print_error "Backend dependencies missing"
fi

if [ -d "frontend/node_modules" ]; then
    print_success "Frontend dependencies installed"
else
    print_error "Frontend dependencies missing"
fi

# ============================================================================
# STEP 6: Next Steps
# ============================================================================
print_step "Setup Complete! 🎉"

echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. ${YELLOW}Configure Environment Variables:${NC}"
echo "     • Edit backend/.env with your database URL and API keys"
echo "     • Edit frontend/.env.local with your API URL"
echo ""
echo "  2. ${YELLOW}Set up Database:${NC}"
echo "     • Create Supabase project or local PostgreSQL database"
echo "     • Run migrations: ./scripts/migrate-supabase.sh"
echo ""
echo "  3. ${YELLOW}Start Development Servers:${NC}"
echo "     • Backend:  cd backend && npm run dev"
echo "     • Frontend: cd frontend && npm run dev"
echo ""
echo "  4. ${YELLOW}Verify Installation:${NC}"
echo "     • Backend health: curl http://localhost:8080/health"
echo "     • Frontend: http://localhost:3000"
echo ""
echo "  5. ${YELLOW}Run Tests:${NC}"
echo "     • Backend:  cd backend && npm test"
echo "     • Frontend: cd frontend && npm test"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "📚 Documentation:"
echo "   • Setup Guide: docs/SETUP_GUIDE.md"
echo "   • Deployment: docs/DEPLOYMENT.md"
echo "   • Supabase: docs/SUPABASE_DEPLOYMENT.md"
echo ""
echo -e "${GREEN}Happy Coding! 🚀${NC}"
echo ""

