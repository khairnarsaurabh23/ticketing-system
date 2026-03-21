# Ticketing System

A production-grade, high-concurrency ticketing system built with **Node.js**, designed to handle **50 K concurrent requests**.

---

## Architecture

```
                       ┌──────────────────────────────────────────────────┐
                       │              CLIENT  (browser / mobile / API)     │
                       └──────────────────────┬───────────────────────────┘
                                              │ HTTPS  :3000
                       ┌──────────────────────▼───────────────────────────┐
                       │               API  GATEWAY  (clustered)          │
                       │  • JWT verification (jsonwebtoken)                │
                       │  • Redis-backed rate limiter (per-IP + per-user) │
                       │  • http-proxy-middleware → upstream services      │
                       │  • Node cluster — 1 worker / CPU core            │
                       └───────┬──────────────────────────┬───────────────┘
                               │ :3001                    │ :3002
              ┌────────────────▼──────────┐  ┌───────────▼────────────────┐
              │    AUTH  SERVICE           │  │    TICKET  SERVICE          │
              │  (clustered)               │  │  (clustered)               │
              │  • register / login        │  │  • CRUD tickets            │
              │  • JWT issue & refresh     │  │  • assign / claim          │
              │  • bcrypt password hash    │  │  • comments                │
              │  • refresh token in Redis  │  │  • Redis Redlock (concurrent│
              └──────────┬────────────────┘  │    assign / claim guard)   │
                         │                   │  • Redis cache (read hits)  │
                         │                   │  • Atomic ticket numbers   │
                         │                   └───────────┬────────────────┘
                         │                               │
               ┌─────────▼───────────────────────────────▼───────────────┐
               │                       MySQL 8                            │
               │   users  │  tickets  │  ticket_comments  │  audit_log   │
               └─────────────────────────────────────────────────────────┘
                         │                               │
               ┌─────────▼───────────────────────────────▼───────────────┐
               │                      Redis 7                             │
               │  refresh tokens │ rate-limit counters │ Redlock locks   │
               │  ticket cache   │ ticket number INCR  │                  │
               └─────────────────────────────────────────────────────────┘
```

---

## Key Design Decisions

| Concern | Solution |
|---|---|
| **50 K concurrent requests** | Node.js `cluster` module — 1 worker per CPU core. Each worker runs a full Express app with a MySQL pool (25 conn each). |
| **Rate Limiting** | `express-rate-limit` + `rate-limit-redis`. All gateway workers share counters in Redis → fair limiting across instances. Two tiers: global (200 req/min) and auth-endpoint (20 req/15 min). |
| **JWT Authentication** | Gateway verifies token on every request before proxying. Downstream services trust `X-User-*` headers injected by the gateway. |
| **Distributed Locking (Redlock)** | `redlock` library used to guard `assign` and `claim` ticket operations. Prevents two workers simultaneously assigning the same ticket. |
| **MySQL** | `mysql2/promise` pooled connections. `withTransaction` helper for atomic multi-step operations. Per-worker pool tuned to 25 connections. |
| **Redis caching** | Individual ticket reads cached for 60 s. Cache invalidated on every write through `DEL`. |
| **Atomic ticket numbering** | Redis `INCR` counter → zero-collision TKT-000001 style numbers even under cluster concurrency. |

---

## Project Structure

```
ticketing-system/
├── api-gateway/              # API Gateway — port 3000
│   └── src/
│       ├── app.js
│       ├── index.js          # cluster entry
│       ├── server.js
│       ├── middleware/
│       │   ├── auth.js       # JWT verification
│       │   └── rateLimiter.js
│       └── routes/
│           ├── proxy.js      # http-proxy-middleware
│           └── health.js
├── auth-service/             # Auth Service — port 3001
│   └── src/
│       ├── app.js
│       ├── index.js
│       ├── server.js
│       ├── controllers/
│       ├── services/         # authService.js — JWT, bcrypt, Redis tokens
│       ├── models/
│       ├── routes/
│       ├── middleware/
│       └── db/migrate.js
├── ticket-service/           # Ticket Service — port 3002
│   └── src/
│       ├── app.js
│       ├── index.js
│       ├── server.js
│       ├── controllers/
│       ├── services/         # ticketService.js — Redlock, cache, CRUD
│       ├── models/
│       ├── routes/
│       ├── middleware/
│       └── db/migrate.js
├── shared/                   # Shared utilities (npm workspace)
│   └── src/
│       ├── cluster.js        # startCluster() helper
│       ├── errors.js         # AppError hierarchy + errorHandler
│       ├── logger.js         # Winston logger factory
│       ├── mysqlPool.js      # Singleton MySQL pool + withTransaction
│       ├── redisClient.js    # Singleton ioredis client
│       └── redlock.js        # Redlock singleton + withLock helper
├── db/
│   ├── init.sql              # DB bootstrap (Docker entrypoint)
│   └── seed.js               # Seed test users
├── load-test/
│   └── run.js                # autocannon load test
├── docker-compose.yml
├── .env
└── package.json              # npm workspaces root
```

---

## Quick Start (Docker)

```bash
# 1. Clone and enter
git clone <repo> ticketing-system && cd ticketing-system

# 2. Configure environment
cp .env.example .env
# edit .env — change JWT_SECRET values!

# 3. Start all services
docker-compose up -d

# 4. Check logs
docker-compose logs -f

# 5. Health check
curl http://localhost:3000/health
```

---

## Quick Start (Local Development)

**Prerequisites:** Node.js 20+, MySQL 8, Redis 7

```bash
# 1. Install dependencies
npm install

# 2. Start MySQL + Redis (or configure .env to point to existing instances)
docker-compose up -d mysql redis

# 3. Run migrations
npm run migrate

# 4. Seed test users
node db/seed.js

# 5. Start all services in watch mode
npm run dev
```

---

## API Reference

All requests go through `http://localhost:3000`.

### Auth (public — no JWT needed)

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | `{email, password, name}` | Create account |
| `POST` | `/auth/login` | `{email, password}` | Returns `accessToken` + `refreshToken` |

### Auth (protected — Bearer JWT)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Current user profile |
| `POST` | `/auth/refresh` | `{refreshToken}` → new token pair |
| `POST` | `/auth/logout` | Revokes refresh token |

### Tickets (protected — Bearer JWT)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List tickets (paged, filterable) |
| `POST` | `/tickets` | Create ticket |
| `GET` | `/tickets/:id` | Get single ticket (cached) |
| `PATCH` | `/tickets/:id` | Update ticket (Redlock guarded) |
| `POST` | `/tickets/:id/assign` | Assign to agent (Redlock) |
| `POST` | `/tickets/:id/claim` | Self-assign open ticket (Redlock) |
| `POST` | `/tickets/:id/comments` | Add comment |
| `GET` | `/tickets/:id/comments` | List comments |
| `POST` | `/tickets/:id/close` | Close ticket |
| `DELETE` | `/tickets/:id` | Delete (admin only) |

---

## Load Testing

```bash
cd load-test
npm install

# runs health, login, list-tickets and create-tickets scenarios
node run.js
```

The test uses `autocannon` with **500 connections × 10 pipelining = 5 000 concurrent** requests per scenario. Scale `connections` to `50000` for the full 50 K test on beefy hardware behind a cluster.

---

## Environment Variables

See [.env.example](.env.example) for the full list.

| Variable | Default | Description |
|---|---|---|
| `GATEWAY_WORKERS` | `0` (= CPU count) | Gateway cluster workers |
| `AUTH_WORKERS` | `0` | Auth service workers |
| `TICKET_WORKERS` | `0` | Ticket service workers |
| `JWT_SECRET` | — | **Must be changed** |
| `MYSQL_CONNECTION_LIMIT` | `25` | Pool size per worker |
| `RATE_LIMIT_MAX` | `200` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `REDLOCK_RETRY_COUNT` | `10` | Lock acquisition retries |

---

## Concurrency Flow — Claiming a Ticket

```
Worker A                    Redis               Worker B
   │                          │                    │
   │── CLAIM ticket:abc ──────►│                    │
   │   SET lock:ticket:abc     │                    │
   │   NX PX 8000 ─────────────► lock acquired      │
   │                          │                    │
   │                          │ ◄── CLAIM ticket:abc│
   │                          │  SET lock:ticket:abc│
   │                          │  NX PX 8000 ────────► lock BUSY
   │                          │                    │ retry (up to 10x)
   │── UPDATE assigned_to=A ──►│                    │
   │── DEL lock:ticket:abc ───►│                    │
   │                          │  lock acquired ─────►
   │                          │                    │── ticket already
   │                          │                    │   assigned → 409
```

---

## Scaling to 50 K req/s

| Layer | Technique |
|---|---|
| Gateway | Cluster (N CPU cores) × keep-alive connections |
| Auth / Ticket | Cluster (N CPU cores) per service |
| MySQL | Per-worker pool; adjust `MYSQL_CONNECTION_LIMIT` per worker size |
| Redis | Single node sufficient to 500 K ops/s; use Redis Cluster for more |
| Horizontal | Add more Docker replicas behind an Nginx/HAProxy upstream |
