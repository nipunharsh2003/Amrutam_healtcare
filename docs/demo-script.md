# Five-Minute Demo Script

Use synthetic accounts and clinical data only. Run the demo after migrations and tests have succeeded.

## 0:00-0:40 | Start and health

Run `docker compose up --build`, then show `/health/live`, `/health/ready`, and Prometheus at `http://localhost:9090`. Note that local Compose demonstrates wiring, not production HA or SLO attainment.

## 0:40-1:30 | Patient account and MFA

Register a synthetic patient through `POST /api/v1/auth/register`, sign in, and show registration cannot assign a doctor/admin role. Demonstrate TOTP setup and verification. Explain short-lived JWT claims and live database role checks.

## 1:30-2:20 | Doctor and availability

Create synthetic doctor and patient identities, promote the doctor through the admin endpoint, enroll and verify MFA, create a doctor profile, then verify it as an MFA-authenticated admin. Add a UTC slot and show public doctor search and slot lookup.

## 2:20-3:30 | Booking safety

Book with an `Idempotency-Key`; repeat the same payload/key and show the same consultation response. Reuse the key with a different slot and show `409`. Run `npm run test:integration` to demonstrate concurrent contenders yield one active reservation and a failed audit transaction rolls back the slot.

## 3:30-4:15 | Consultation and prescription

Start and complete the assigned consultation with the doctor token. Issue a synthetic prescription, inspect storage to show ciphertext/IV/tag rather than plaintext, retrieve it as the owning patient, and show that another patient is denied.

## 4:15-5:00 | Audit, metrics, architecture

Show admin aggregates/audit events, JSON request IDs, and Prometheus request metrics. Close with launch gates: load and DR drills, managed key rotation, immutable audit retention, and production HA must be completed before claiming the target SLOs.