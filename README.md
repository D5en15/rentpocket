# RentPocket — Property & Room Setup

Screen 2 lives at `/setup`. The repository includes Next.js App Router, Tailwind,
Supabase browser/server clients, email/password authentication, property editing,
single/batch room creation, global quota display and an accessible package dialog.

## Configuration

The application requires real project values in `.env.local`:
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
The public browser client uses only the publishable key. Slip completion requires
`SUPABASE_SERVICE_ROLE_KEY` and `EASYSLIP_API_KEY` in the server environment only.
Missing configuration produces a setup error, never fabricated data.
Enable Supabase Email Auth and set Site URL to the application's origin.

## Database

Migrations are ordered: initial schema, auth profile/trial trigger, quota trigger fix.
Use `npm run db:migrate` with `SUPABASE_DB_URL` provided through the environment.
This is a PostgreSQL connection URL, not the public Supabase API URL.
The runner requires verified TLS, records applied migrations and uses an advisory
lock to prevent concurrent deployments. Existing schemas without migration history
must be reconciled first; it will not automatically overwrite them.
Do not run the initial migration again against an already-created schema.
The auth trigger applies to newly created users; existing accounts need backfill.

Quota checks run in server actions and again in the database under a subscription
row lock. Batch inserts are atomic. Room moves also run through the trigger.
Both expired timestamp fields block creation as explicitly requested. When converting
Trial to ACTIVE, clear `trial_ends_at` and set a future `current_period_end` in the
trusted subscription-management process. Null expiry for the applicable status is
rejected. Trigger execution is granted only to postgres, not exposed as a client RPC.

## QA security hardening (migration 005)

Run `202610060005_qa_security_hardening.sql` after migrations 000–004;
`npm run db:migrate` includes it. Deploy the matching application immediately
after migration: the meter RPC now expects `current`, `old_final`, and
`new_initial`; old clients sending only calculated carry are rejected.

New billing cycles are limited to the inclusive Bangkok month range from
12 months before the current month through 1 month after it. Existing cycles
outside that window can be read, but this RPC never creates or refreshes their
drafts. Missing out-of-range cycles return `BILLING_CYCLE_OUT_OF_RANGE`.
Replacement readings are validated and calculated independently in PostgreSQL.
Direct DELETE privileges on profiles, properties and rooms are revoked for
anonymous/authenticated roles; account deletion must use a trusted workflow.

Slip uploads accept one multipart image up to 4 MiB, with a 4300 KiB overall
Server Action body limit. Base64 is produced only server-side for EasySlip.
Unit regression tests run with `npm test`; database regression tests require a
disposable migrated staging database and `QA_DB_URL`, then run:
`node --test tests/qa-hardening.integration.mjs`. The fixtures are rolled back.

## EasySlip daily cost guard (migration 006)

Migration `202610060006_slip_daily_limit.sql` adds an atomic limit of 15 reserved
verifications per property per Bangkok calendar day, across all rooms/cycles.
The existing three-attempt bill limit still applies. Failed/provider-timeout
attempts consume daily quota; rejected reservations consume neither quota.
Manual approval remains available. The counter is private and cannot be changed
by browser clients. Existing attempts are backfilled so deployment does not reset
today's usage. This is a property limit, not a combined account/global budget.

For staging, add quoted connection URLs to `.env.local` (ignored by Git):

```dotenv
SUPABASE_DB_URL="<staging direct or session-mode PostgreSQL URL>"
QA_DB_URL="<same staging admin connection URL>"
```

Both commands below load `.env.local` automatically, preserving variables already
set in the process environment. Migrations now run 000–006 in order; previously
applied 000–005 are skipped. Do not use transaction-mode pooling for this runner.

```sh
npm run db:migrate
node --test tests/qa-hardening.integration.mjs
```

The opt-in staging test includes the 15th/16th reservation boundary, failed-attempt
charging, previous-day quota separation, property isolation, manual fallback and
rejection without consuming the bill counter. It must run against migrated staging.

The package dialog displays specification pricing. Payment/upgrade processing is
outside this sprint and no payment or upgrade operation is simulated.

## Verification

`npm run test`, `npm run typecheck`, `npm run lint`, `npm run build`.
Tests cover money validation, UUID validation, inactive subscriptions and both
expiry timestamps. Live RLS, concurrent transactions and Auth triggers require
an actual configured Supabase database; unit tests do not claim to verify these.
For development: `npm run dev` (http://localhost:3000/setup).

## Sprint 3 — Fast Meter Entry

Open `/meters`, choose a property and month, then open the cycle. All property
rooms are listed (including VACANT rooms); the owner chooses which rooms to bill.
Drafts inherit meter readings from the immediately preceding **issued** month.
When that month has no issued bill, meters start at zero and the ratio warning
has no comparison baseline. The >500-unit warning still applies.
Default due date is the fifth of the following month and is editable before issue.

The shared integer-hundredths engine previews charges without floating-point
rounding drift. PostgreSQL independently computes authoritative charges using
numeric round(..., 2). Rollover uses 10000. For replacements, the UI computes
carry = old_final - previous - new_initial and the engine uses carry + current,
including signed carry when the new meter starts above zero.

Migration `202610060003_meter_billing.sql` adds rate snapshots and two authenticated
RPCs. Batch saves lock subscriptions and bills, reject stale updates, and either
issue all requested bills or none. Warning results write nothing; confirmation
resubmits the exact readings. Issued bills cannot be edited through these actions.
Direct client bill writes are revoked, and bills retain owner-only SELECT RLS.
Subscription expiry permits viewing existing cycles but prevents new drafts/issue.

Run the migration before using `/meters`. The migration runner includes it.
Existing bill rates are backfilled from current room rates because the original
schema did not preserve historical rates. Historical stored amounts are untouched.
Live Supabase/RLS/concurrency verification remains pending project credentials.

## Sprint 4 — Dashboard and Slip Payments

`/dashboard` summarizes issued bills by billing month and property. The three
traffic-light tabs derive overdue status when Bangkok's calendar date is after
the due date; the entire due day remains payable. This display calculation does
not require a scheduled job to mutate every bill. Sharing uses the native Web
Share menu with a text bill (select LINE); unsupported devices fall back to a
copyable message. Reminders include the full amount and PromptPay details.

Apply `202610060004_slip_payments.sql` before using payment actions. It adds a
private attempt ledger and RPCs for reservation, payment completion and manual
approval. Reservation increments the three-attempt counter in a committed
transaction before the provider request. Concurrent requests for one bill are
blocked while a reservation is active. Failed/timed-out checks consume attempts;
invalid images and missing configuration do not call the provider. Reservations
expire after 30 seconds so a lost request cannot leave the bill permanently busy.

Server-only credentials required: `EASYSLIP_API_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`, in addition to the public project configuration.
Never prefix these secrets with `NEXT_PUBLIC_`. The service-role client is used
only after authenticating the owner and only to finalize/release the reserved
provider result. Payment completion is unavailable to authenticated browser RPC
callers. Slip insertion and PAID update are one transaction; global trans_ref
uniqueness rejects duplicate slips with 23505. Manual approval locks the same bill
and is available without EasySlip credentials or remaining quota, including for
existing bills after subscription expiry. Draft bills cannot be marked paid.

EasySlip uses `POST https://api.easyslip.com/v2/verify/bank` with an eight-second
request/body deadline, `matchAmount`, `matchAccount` and image Base64. The app
accepts JPEG/PNG/GIF/WebP up to 4 MB and validates file signatures on the server.
The Server Action body limit is 6 MB to accommodate Base64 overhead.

Automatic receiver checks require a fully disclosed PromptPay proxy matching the
property. Masked digits and account names are never treated as sufficient proof.
For masked slips, optionally configure `EASYSLIP_RECEIVER_ACCOUNTS` as a JSON
object keyed by actual property UUID. Each entry contains `bankCode` (3 digits)
and `bankNumber` (full account number). Register/link that bank account in the
EasySlip application/branch. The provider's matchedAccount must match the exact
configured bank and number for that property, or the raw unmasked bank account
must match. Otherwise manual approval is required. No partial-match bypass exists.
Provider-side duplicate tracking is disabled so a rejected verification does not
poison a later retry; the database remains the global duplicate authority.

Verification: 30 unit/contract tests cover calculations, date/status boundaries,
summary cents, reminder contents, image validation, exact receiver matching,
masked/incorrect recipients, duplicate mapping, bad amounts, malformed provider
responses and timeout behavior. Transport tests stub fetch and never contact the
paid provider. Live Supabase migrations, RLS/concurrency and real EasySlip slips
remain untested until real credentials are configured.

Official protocol reference: https://document.easyslip.com/en/v2/verify/bank/

## Sprint 5 — Public Free Bill Generator

`/` is the mobile-first SaaS landing page, with feature highlights, package pricing,
and signup calls to action. `/calculator` is the public 1–2 room calculator; it
does not authenticate or query Supabase. The landing page dashboard and QR are
clearly labelled illustrations, not a payable bill.
Each room has independent rent, electricity meters/rate, unit/flat water charges,
other fees and rollover calculation. Preview updates immediately and refuses
invalid readings. The shared engine rounds money exactly as the private workflow.

PromptPay QR payloads include dynamic initiation method 12, the full Thai phone
or 13-digit ID proxy, THB currency, an exact two-decimal amount and CRC16-CCITT.
A local QR Model 2 version 6/M encoder renders SVG modules with a four-module
quiet zone. No image-generation API, analytics or remote QR service is used.
The QR embeds the amount; final payment behavior is controlled by the bank app.

The preview prepares a high-resolution 1080×1640 PNG using browser canvas and
local fonts. The embedded QR uses integer-sized pixels to avoid interpolation.
A matching PNG is prepared before sharing so Web Share stays within the user's
activation gesture. New input invalidates the old PNG immediately. Native share
opens the device's target picker (choose LINE); the website cannot force a LINE
chat destination. Devices supporting text-only share receive the complete bill
text; devices with no native share can download the PNG and attach it manually.

`/signup` and `/login` reuse real Supabase Auth with a post-login destination.
The sticky trial CTA links to `/signup`. These account routes still need Supabase
configuration/migrations; the free calculator itself works without credentials.

Verification now includes public calculations, two-room isolation, invalid
readings/recipients, amount precision, payload TLV/CRC, QR format bits, independent
codeword decoding and all Reed–Solomon syndromes. Current default suite: 39 passed,
1 optional native decoder test skipped. Apple image processing cannot initialize
inside the execution sandbox. On unrestricted macOS, set
`RENTPOCKET_NATIVE_QR_TEST=1` to run the Vision image decoding integration check.
Actual bank-app scanning and mobile PNG download/Web Share behavior have not been
verified in this sandbox. No authenticated/live payment integration is claimed.

Thai QR specification reference:
https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/EngPDF/25620084.pdf

## Landing page support contact

Set `NEXT_PUBLIC_LINE_SUPPORT_URL` to the real team LINE contact URL before
building/deploying to enable the FAQ contact link. When it is absent, the page
displays a contact-availability message rather than linking to a fictitious account.

## Local development mock

`npm run dev` enables an isolated in-memory demo whenever `NODE_ENV` is
`development`. On `/login`, submit or press Enter without credentials to open
`/dashboard`. `/setup` and `/meters` use the same demo store (four rooms, one
paid bill, one pending bill, one overdue bill and one draft per initial cycle).
Property edits, room creation, meter calculation/warnings and manual collection
work in memory. Slip attempts simulate provider unavailability; no image is sent
to EasySlip. The store resets when the server process restarts and may reset on
hot reload. It is shared by local visitors, so use this mode only for local testing.
Production (`npm run build` / `npm start`) retains real Auth and database actions.
