# Prowider — Mini Lead Distribution System

A full-stack lead distribution system built with **Next.js 14**, **PostgreSQL**, and **Prisma**.

## Live Demo

> Add your deployed URL here

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router) |
| Database | PostgreSQL + Prisma ORM |
| Real-time | Server-Sent Events (SSE) |
| Styling | Custom CSS (no UI lib) |

---

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL database (local or hosted — e.g. [Neon](https://neon.tech), Supabase, Railway)

### 1. Clone & Install

```bash
git clone <your-repo>
cd prowider
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local and set your DATABASE_URL
```

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/prowider"
```

### 3. Set Up Database

```bash
npx prisma generate        # Generate Prisma client
npx prisma db push         # Push schema to database
node prisma/seed.js        # Seed services, providers & allocation pointers
```

### 4. Run Locally

```bash
npm run dev
# Visit http://localhost:3000
```

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/request-service` | Customer enquiry form |
| `/dashboard` | Real-time provider dashboard |
| `/test-tools` | Webhook & concurrency testing panel |

---

## Architecture

### Allocation Algorithm

Every new lead triggers `assignProvidersToLead()` which runs inside a **Serializable PostgreSQL transaction**:

1. **Mandatory providers** are picked first based on service:
   - Service 1 → Provider 1 always gets it
   - Service 2 → Provider 5 always gets it
   - Service 3 → Provider 1 AND Provider 4 always get it

2. **Optional pool** fills the remaining slots (up to 3 total) using **round-robin**:
   - Service 1 pool: Providers 2, 3, 4
   - Service 2 pool: Providers 6, 7, 8
   - Service 3 pool: Providers 2, 3, 5, 6, 7, 8

3. The round-robin **pointer is stored in the database** (`ServiceAllocationPointer` table) and persists across server restarts.

4. Providers that have hit their **monthly quota (10)** are skipped.

### Concurrency Handling

All lead assignment logic runs inside a **`Serializable` isolation level transaction** via Prisma:

```ts
await prisma.$transaction(async (tx) => { ... }, {
  isolationLevel: 'Serializable',
  timeout: 10000,
});
```

This means:
- Two simultaneous requests cannot both read the same pointer value and advance it the same way
- Quota checks are atomic — no provider can exceed 10 even under concurrent load
- The DB-level unique constraint on `(phone, serviceId)` provides a second safety net against duplicate leads

### Webhook Idempotency

Each webhook call must include an `idempotencyKey`. The server:

1. Checks if the key already exists in `WebhookEvent` table
2. If yes → returns `200 { idempotent: true }` immediately (no side effects)
3. If no → creates the `WebhookEvent` record AND resets quotas inside a single transaction
4. A unique constraint on `idempotencyKey` handles race conditions where two identical webhooks arrive simultaneously

This guarantees quota resets happen **exactly once** regardless of retries or duplicate calls.

### Real-Time Updates

- Server uses **Node.js Server-Sent Events** via a `ReadableStream` at `/api/sse`
- An in-process pub/sub bus (`SSEBus` singleton) is notified after every lead creation or quota reset
- The dashboard subscribes with `new EventSource('/api/sse')` and re-fetches provider data on each event
- Newly assigned provider cards are visually highlighted with a glow animation

> For multi-instance production deployments, replace the in-process `SSEBus` with Redis pub/sub (e.g. `ioredis` with `subscribe`/`publish`).

---

## Database Schema

```
services              → id, name
providers             → id, name, monthlyQuota, leadsReceived
leads                 → id, name, phone, city, serviceId, description, createdAt
                        UNIQUE(phone, serviceId)
lead_assignments      → id, leadId, providerId, assignedAt
                        UNIQUE(leadId, providerId)
service_allocation_pointers → id, serviceId (UNIQUE), pointer
webhook_events        → id, idempotencyKey (UNIQUE), eventType, processedAt
```

---

## Testing Checklist

- ✅ Submit duplicate leads (same phone + same service) → rejected
- ✅ Submit same phone with different service → allowed
- ✅ Exactly 3 providers assigned per lead
- ✅ Mandatory providers always included (when quota available)
- ✅ Round-robin rotates fairly across optional pool
- ✅ Generate 10 concurrent leads → no double-assignment, no quota overflow
- ✅ Dashboard updates in real time without refresh
- ✅ Webhook resets quota exactly once even when called 5× simultaneously
- ✅ Allocation pointer persists after server restart
