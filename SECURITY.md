# Security policy

## Reporting a vulnerability

Email **[SECURITY EMAIL]** with what you found and how to reproduce it. Please don't open a
public GitHub issue for security problems. We'll acknowledge within 3 working days and keep you
updated until it's fixed. We won't take legal action against good-faith research that avoids
accessing other people's data and doesn't disrupt the service.

## How Glowtrace is protected

| Layer              | Protection                                                                                                                                            | Where                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Browser            | Strict content security policy, HSTS, no framing, no third-party scripts, fonts or trackers                                                           | `src/lib/security-headers.ts`                              |
| Data on the device | Scans and photos never leave the device; validated with Zod on every load                                                                             | `src/lib/vault.ts`                                         |
| Database           | Row-level security on every table; admin actions only through functions that check the admin role; functions closed to signed-out visitors            | `supabase/migrations/`                                     |
| Audit              | Every change to access, requests, admin rights and feedback status is logged by database triggers; the log is append-only and admin-read-only         | `20261118150000_audit_log.sql`, Beta dashboard → Audit log |
| Code               | Typecheck, lint, tests and build on every pull request; dependency vulnerability scan; secret scanning of the full history; weekly Dependabot updates | `.github/`                                                 |
| Hosting            | Vercel (HTTPS, DDoS protection, firewall); Supabase in London with its own network protections                                                        | `docs/deploy.md`                                           |

## Accepted dependency advisories

Each exception must have a reason and be removed as soon as a fixed version exists.

| Advisory                       | Package         | Why it is accepted                                                                                                                             |
| ------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GHSA-fc5q-39xc-vjpf (high)     | picomatch 4.0.7 | Used only by build tools to match file paths in this repository. Never shipped to users and never given untrusted input. No fixed version yet. |
| GHSA-g3hv-75wg-m249 (moderate) | minimatch       | Lint and build tooling only, same reasoning. Below the CI threshold.                                                                           |

## If something goes wrong (incident response)

1. **Contain:** revoke affected access in the Beta dashboard, rotate Supabase keys
   (Project Settings → API) and redeploy, or pause the project.
2. **Assess:** use the Supabase audit log and the dashboard's Audit log to see what changed
   and whose data is involved.
3. **Notify on time:**
   - **South Africa (POPIA s22):** the Information Regulator and affected people "as soon as
     reasonably possible".
   - **EU/UK GDPR:** the supervisory authority within **72 hours** of becoming aware; affected
     people without undue delay if the risk to them is high.
   - **Australia:** assess within 30 days; notify the OAIC and people if serious harm is likely.
   - **US:** state breach laws, typically within 30-60 days.
4. **Fix and review:** patch, add a test or rule so it can't recur, and write up what happened.
