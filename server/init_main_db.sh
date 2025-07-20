#!/bin/bash

# Initialize main xrpl_dex database
echo "Setting up main xrpl_dex database..."

# Create the database
echo "Creating xrpl_dex database..."
docker-compose exec postgres_test psql -U xrpl -d postgres -c "CREATE DATABASE xrpl_dex;" 2>/dev/null || echo "Database xrpl_dex already exists or error occurred"

# Copy schema and init files to container
echo "Copying schema and init files to container..."
docker cp server/schema.sql postgres_test:/schema.sql
docker cp server/init_db.sql postgres_test:/init_db.sql

# Load schema
echo "Loading database schema..."
docker-compose exec postgres_test psql -U xrpl -d xrpl_dex -f /schema.sql

# Load initial data
echo "Loading initial tracked pairs..."
docker-compose exec postgres_test psql -U xrpl -d xrpl_dex -f /init_db.sql

echo "Main database setup complete!"
echo "Database: xrpl_dex"
echo "User: xrpl"
echo "Port: 5433" 