# Security Checklist and Threat Model

## Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| Public | Verified doctor name, specialization, published slots | Publish reviewed fields; protect integrity |
| Account | Email, profile, role, MFA state | TLS, least privilege, restricted DB access |
| Sensitive health | Prescription and consultation relationship/status | Prescription details use AES-256-GCM; never log clinical content; enforce ownership |
| Secrets | DB credentials, JWT key, data key, metrics token | Secret manager in production; do not source-control or log; rotate |

## Threats and controls

| Threat | Mitigation / remaining work |
| --- | --- |
| Credential stuffing / enumeration | Auth throttling, generic login failure, bcrypt cost 12, hashed identifier in audit; add edge/IP/account throttles |
| Forged or stolen tokens | HS256 allowlist, issuer/audience/expiry/subject/role validation, 15-minute JWT; require TLS, plan signing-key rotation and refresh-token revocation |
| Privilege escalation | Public registration forces PATIENT; MFA-protected admin role change, audit event, last-admin guard |
| BOLA / cross-user reads | Patient/doctor ownership checks; inaccessible IDs return 404; continue testing every object endpoint |
| Concurrent booking/retry | InnoDB row lock, unique active slot reservation, unique user/idempotency key, request hash, single transaction |
| Injection | Sequelize ORM and replacements; prohibit string-built SQL with user data |
| Request abuse | Helmet, JSON body cap, global/auth rate limit, bounded pagination, pool/timeouts; tune at edge after load tests |
| PHI in logs | Pino redact paths, generic production errors, allowlisted audit metadata; validate log sink and support access |
| Database disclosure/tampering | GCM authenticated encryption for prescription field; TLS, encrypted volume/backup and strict DB roles remain required |
| Supply-chain compromise | Lockfile and CI dependency audit; add SAST/DAST, provenance and image digest pinning to release pipeline |
| Insider abuse | RBAC/MFA and audit; add immutable external retention, access review, and alerts |

## Implemented checklist

- [x] bcrypt password hashing; registration cannot assign a role.
- [x] JWT signature algorithm, issuer, audience, subject, expiry, and role checks.
- [x] TOTP MFA enrollment; privileged doctor/admin writes require verified MFA.
- [x] Zod validation for implemented request bodies, queries, path IDs, and idempotency header.
- [x] Authentication and global rate limits, Helmet, parameterized Sequelize access.
- [x] Resource checks for consultation reads/lifecycle, bookings, and prescription issuance/access.
- [x] Non-clinical transactional audit events for main workflows.
- [x] AES-256-GCM prescription encryption.
- [x] Explicit CORS allowlist; production configuration fails without allowed origins.
- [x] Trace HTTP URLs and query strings are sanitized before OTLP export; UUID path identifiers are replaced.
- [ ] TLS/WAF/network policy, managed secrets and KMS, key rotation, immutable external audit sink, retention policy.
- [ ] SAST, DAST, penetration testing, dependency remediation, load test, privacy/regulatory assessment.

`npm audit` currently reports moderate findings in Jest's legacy `js-yaml`/`sprintf-js` test-tool dependency tree. The production dependency audit is clean after the Sequelize `uuid` override; CI fails on high/critical findings and reports the remaining development-only moderate findings for review.

## Key management

Production must use KMS/secret manager, separate JWT and data-encryption keys per environment, and never bake secrets into images. The application currently uses a single data key. Before launch, add versioned key IDs and a key ring: encrypt new data with active key, decrypt using retained old keys, re-encrypt in bounded batches, verify row counts/tags, and retire old keys only after backup retention expires.

## Audit and incident response

Audit metadata records actor/action/target/request ID and non-sensitive reason fields; it excludes passwords, tokens, MFA codes, and prescription text. Admin audit reads require MFA. Production must export to append-only storage and alert on role changes, repeated auth failures, anomalies, and audit write failures. Audit insertion shares the relevant transaction so a failed audit write rolls back the business action.