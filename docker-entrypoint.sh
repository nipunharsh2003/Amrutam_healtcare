#!/bin/sh
set -eu
npm run db:migrate
exec node src/server.js