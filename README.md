# Amrutam Telemedicine API

Modular monolith for telemedicine workflows using Node.js CommonJS, Express, Sequelize, and MySQL 8. It does not use PostgreSQL, MongoDB, GraphQL, or a frontend.

## Scope and service limits

The API implements patient registration/login and MFA, doctor search/profile and availability, booking/cancellation, consultation lifecycle, encrypted prescriptions, audit events, admin aggregates, and a transactional outbox with an optional webhook worker. MySQL transactions, row locks, unique reservations, and idempotency keys protect booking writes.

This repository is a production-oriented foundation, not proof that the stated 99.95% availability or p95 targets are met. Payment provider integration, a trusted outbox consumer, production tracing export, managed key services, load validation, restore drills, and regulatory review remain launch work. See [architecture](docs/architecture.md) and [security](docs/security.md).

## Prerequisites

- Node.js 20+ and npm
- MySQL 8+
- Docker Compose (optional)

## Local setup

Create separate development and test databases:

```sql
CREATE DATABASE amrutam_telemedicine CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE amrutam_telemedicine_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'amrutam_api'@'127.0.0.1' IDENTIFIED BY 'use-a-unique-local-password';
GRANT ALL PRIVILEGES ON amrutam_telemedicine.* TO 'amrutam_api'@'127.0.0.1';
GRANT ALL PRIVILEGES ON amrutam_telemedicine_test.* TO 'amrutam_api'@'127.0.0.1';
```

In PowerShell, create `.env`, then set the database credentials and generated secrets:

```powershell
Copy-Item .env.example .env
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Use a fresh random 32-byte hex value for `APP_ENCRYPTION_KEY`, separate random strings (at least 32 characters) for `JWT_SECRET` and `METRICS_TOKEN`, and set a comma-separated explicit `CORS_ORIGINS` allowlist. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to a trusted OpenTelemetry Collector base URL (for example, `http://localhost:4318`). The example values are not production secrets. Never commit `.env`.

To deliver outbox events, set both `OUTBOX_WEBHOOK_URL` and `OUTBOX_WEBHOOK_TOKEN` to a trusted HTTPS endpoint and a random bearer secret. Delivery is disabled when either value is missing. Consumers must deduplicate using the `Idempotency-Key` header, which is the stable outbox event ID.

Install, migrate, and run:

```powershell
npm ci
npm run db:migrate
npm start
```

For the first administrator, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the current shell and run `npm run db:seed:admin` once after migrations. Immediately log in, enroll TOTP MFA, and remove the bootstrap password from the shell/environment. The seeder refuses to create another admin if one already exists; it is not run automatically by the API container.

Check service status:

```powershell
Invoke-RestMethod http://localhost:3000/health/live
Invoke-RestMethod http://localhost:3000/health/ready
```

`/health/live` is independent of MySQL. `/health/ready` and `/api/v1/health` return `503` if the database is unavailable. `/metrics` requires the `METRICS_TOKEN` bearer credential.

## Docker Compose

After creating `.env` with non-placeholder secrets:

```powershell
docker compose up --build
```

Compose starts MySQL, an OpenTelemetry collector, and Prometheus, then runs migrations before starting the API. Persistent MySQL and Prometheus data use named volumes. Prometheus is exposed at `http://localhost:9090`; local traces are summarized by the collector. Production needs managed services, TLS ingress, secrets management, network restrictions, and a tested HA/failover design; local Compose is not an HA deployment.

## Tests

Run unit and HTTP security tests:

```powershell
npm test
```

Run syntax validation across all source, migration, and test files with `npm run lint`.

MySQL integration tests are destructive and require a dedicated database ending in `_test`:

```powershell
$env:NODE_ENV = 'test'
$env:RUN_DB_INTEGRATION = 'true'
npm run db:migrate -- --env test
npm run test:integration
```

Run the migrations against the test database first. Integration tests verify that the expected migrated tables exist and clean only their test rows; never point `TEST_DB_NAME` at development or production data.

## API overview

All business routes use `/api/v1`. See [OpenAPI](docs/openapi.yaml).

- Auth: `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me`, `POST /auth/mfa/setup`, `POST /auth/mfa/verify`
- Doctors: `GET /doctors`, `GET /doctors/{doctorId}/slots`, `PUT /doctors/me/profile`
- Availability: `POST /availability`
- Consultations: `GET/POST /consultations`, `GET /consultations/{consultationId}`, and `POST` actions `/cancel`, `/start`, `/complete`
- Prescriptions: `GET /prescriptions`, `POST /prescriptions/{consultationId}`
- Admin: `GET /admin/analytics`, `GET /admin/audit-logs`, `PATCH /admin/users/{userId}/role`, `PATCH /admin/doctors/{doctorId}/verification`

Booking requires a bearer JWT and `Idempotency-Key`. Doctors and administrators must verify TOTP MFA before privileged writes. Authorization checks resource ownership as well as role.

## Operations

- JSON logs include request IDs; Pino redacts credentials, tokens, and prescription fields.
- Prometheus metrics are served from `/metrics` only with a bearer `METRICS_TOKEN`; OpenTelemetry auto-instrumentation exports traces to the configured OTLP HTTP endpoint.
- UTC is used for database timestamps and connections.
- CI runs unit/security checks and MySQL integration tests against a disposable database.
- [Five-minute demo script](docs/demo-script.md) covers the core workflow and security boundaries.

## Production launch gates

Configure TLS, CORS allowlisting, a managed secret/KMS service, key rotation, encrypted backups with restore drills, multi-zone MySQL and API replicas, alert routing, tracing collector/exporter, dependency/SAST/DAST scans, and realistic load tests. Establish data retention, immutable audit retention, access review, incident response, and applicable privacy/regulatory requirements with the responsible teams.