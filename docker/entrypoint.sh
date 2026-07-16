#!/bin/sh

set -eu

echo "Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Starting SupportMind API..."
exec node dist/src/main.js