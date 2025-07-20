#!/bin/bash
set -e

DB_USER=${1:-xrpl}
DB_NAME=${2:-xrpl_dex_test}
SCHEMA_FILE=${3:-/schema.sql}
INIT_FILE=${4:-/init_db.sql}
CONTAINER=${5:-postgres_test}

# Copy schema.sql and init_db.sql into the container (if not already mounted)
docker cp $(dirname "$0")/schema.sql $CONTAINER:/schema.sql
docker cp $(dirname "$0")/init_db.sql $CONTAINER:/init_db.sql

# Load the schema into the test database inside the container
docker-compose exec $CONTAINER psql -U "$DB_USER" -d "$DB_NAME" -f "$SCHEMA_FILE"
# Load the initial tracked pairs
if [ -f $(dirname "$0")/init_db.sql ]; then
  docker-compose exec $CONTAINER psql -U "$DB_USER" -d "$DB_NAME" -f "$INIT_FILE"
fi

echo "Test database '$DB_NAME' initialized with schema from '$SCHEMA_FILE' and pairs from '$INIT_FILE' in container '$CONTAINER'." 