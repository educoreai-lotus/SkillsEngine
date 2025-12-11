
#!/bin/bash

# Script to run database migrations on Supabase
# Usage: ./scripts/migrate-supabase.sh

set -e

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL environment variable is not set"
  echo "Please set DATABASE_URL to your Supabase connection string"
  echo "Example: export DATABASE_URL='postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres'"
  exit 1
fi

# Check if migration file exists
MIGRATION_FILE="database/migrations/000_initial_schema.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ Error: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

echo "🚀 Running database migrations on Supabase..."
echo "📁 Migration file: $MIGRATION_FILE"

# Run migration using psql
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Database migrations completed successfully!"
else
  echo "❌ Database migrations failed!"
  exit 1
fi




