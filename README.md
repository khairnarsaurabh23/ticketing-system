<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=32&pause=1000&color=00D9FF&center=true&vCenter=true&width=700&lines=High-Performance+Ticketing+System;50K+Concurrent+Requests;Node.js+%7C+Redis+%7C+MySQL+%7C+JWT" alt="Typing SVG" />

<br/>

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Auth-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)

<br/>

> A **production-grade microservices ticketing system** engineered to handle **50,000 concurrent requests** using Node.js clustering, Redis Redlock distributed locking, JWT-secured API gateway, and Redis-backed rate limiting.

</div>

---

## What I Built & Why

This project was built as a deep-dive into **Node.js concurrency architecture**  not just writing CRUD, but engineering a system that holds up under real load.

### The Challenge
Most Node.js tutorials show single-process Express apps. I wanted to build something that answers: *"What does a production system that handles 50K concurrent requests actually look like?"*

### How I Implemented It

**1. Microservices with npm Workspaces**
Split into three independently deployable services (`api-gateway`, `auth-service`, `ticket-service`) sharing a `@ticketing/shared` utilities package via npm workspaces. Each service can be scaled, deployed, and restarted independently without affecting the others.

**2. Node.js Cluster for True Parallelism**
Node.js is single-threaded  but a machine has multiple CPUs. I built a `startCluster()` helper in `shared/src/cluster.js` that forks one worker per CPU core using Node's built-in `cluster` module. The OS load-balances incoming connections across workers, giving true multi-core utilisation without switching to a different runtime.

**3. JWT at the Gateway  Not the Services**
The API Gateway intercepts every request, verifies the JWT, and injects `X-User-Id` / `X-User-Role` headers before proxying downstream. Auth logic lives in exactly one place. The `auth-service` and `ticket-service` are kept behind the gateway and simply trust those headers  they never touch raw JWTs.

**4. Redis Redlock for Distributed Locking**
When two workers race to claim the same ticket simultaneously, only one should win. I used the `redlock` library to acquire an 8-second distributed lock keyed on the ticket ID before any assign/claim/close operation. The lock is backed by Redis `SET NX PX`, making it atomic. The loser retries up to 10 times with jitter, then returns a `409 Conflict`.

**5. Redis-backed Rate Limiting**
Because the gateway runs across N workers, a naive in-process rate limiter would give each worker its own counter  effectively multiplying the limit by N. I wired `express-rate-limit` to a `RedisStore` so all workers share a single counter in Redis. Two tiers: 200 req/min globally and 20 req/15 min on auth endpoints.

**6. Atomic Ticket Numbering**
UUID primary keys are used internally, but users see friendly `TKT-000001` numbers. I used Redis `INCR` on a single key to generate collision-free sequential numbers  even with 50K concurrent create requests, Redis processes `INCR` atomically. No database sequence, no locking needed.

**7. Read-through Caching**
Individual ticket reads (`GET /tickets/:id`) are cached in Redis for 60 seconds. Any write (update, assign, comment, close) calls `DEL ticket:{id}` to invalidate. This dramatically reduces MySQL load for read-heavy workloads.

---

## Architecture

```
                       +--------------------------------------------------+
                       |        CLIENT  (browser / mobile / API)          |
                       +----------------------+---------------------------+
                                              | HTTPS  :3000
                       +----------------------v---------------------------+
                       |            API  GATEWAY  (clustered)            |
                       |  * JWT verification (jsonwebtoken)              |
                       |  * Redis-backed rate limiter (per-IP + per-user)|
                       |  * http-proxy-middleware -> upstream services   |
                       |  * Node cluster -- 1 worker / CPU core         |
                       +-------+---------------------------+-------------+
                               | :3001                    | :3002
              +----------------v----------+  +------------v---------------+
              |    AUTH  SERVICE          |  |    TICKET  SERVICE         |
              |  (clustered)              |  |  (clustered)               |
              |  * register / login       |  |  * CRUD tickets            |
              |  * JWT issue & refresh    |  |  * assign / claim          |
              |  * bcrypt password hash   |  |  * comments                |
              |  * refresh token in Redis |  |  * Redis Redlock           |
              +----------+----------------+  |  * Redis cache (reads)     |
                         |                   |  * Atomic ticket numbers   |
                         |                   +------------+---------------+
                         |                               |
               +---------v-------------------------------v---------------+
               |                     MySQL 8                             |
               |  users | tickets | ticket_comments | audit_log         |
               +---------------------------------------------------------+
                         |                               |
               +---------v-------------------------------v---------------+
               |                     Redis 7                             |
               |  refresh tokens | rate-limit counters | Redlock locks  |
               |  ticket cache   | ticket number INCR  |                |
               +---------------------------------------------------------+
```

---

## Tech Stack

<div align="center">

| Layer | Technology | Why |
|---|---|---|
| **Runtime** | Node.js 20 + `cluster` | Multi-core concurrency without threads |
| **Framework** | Express 4 | Minimal, composable, battle-tested |
| **Database** | MySQL 8 + `mysql2/promise` | ACID transactions, pooled connections |
| **Cache / Lock** | Redis 7 + `ioredis` | Sub-ms latency, atomic ops |
| **Distributed Lock** | `redlock` v5 | Safe multi-worker ticket state changes |
| **Auth** | JWT (HS256) + `bcrypt` | Stateless auth, secure password hashing |
| **Rate Limiting** | `express-rate-limit` + `rate-limit-redis` | Shared counters across all workers |
| **Proxy** | `http-proxy-middleware` v3 | Gateway to service routing |
| **Logging** | Winston | Structured JSON logs per service |
| **Containers** | Docker Compose | One-command full-stack startup |
| **Load Testing** | `autocannon` | Simulates thousands of concurrent clients |

</div>

---

## Key Design Decisions

| Concern | Solution |
|---|---|
| **50K concurrent requests** | Node.js `cluster` module -- 1 worker per CPU core. Each worker runs a full Express app with a MySQL pool (25 conn each). |
| **Rate Limiting** | `express-rate-limit` + `rate-limit-redis`. All gateway workers share counters in Redis. Two tiers: global (200 req/min) and auth-endpoint (20 req/15 min). |
| **JWT Authentication** | Gateway verifies token on every request before proxying. Downstream services trust `X-User-*` headers injected by the gateway. |
| **Distributed Locking** | `redlock` guards assign/claim/close operations. Prevents two workers simultaneously assigning the same ticket. |
| **MySQL** | `mysql2/promise` pooled connections. `withTransaction` helper for atomic multi-step operations. |
| **Redis caching** | Ticket reads cached for 60s. Cache invalidated on every write via `DEL`. |
| **Atomic ticket numbering** | Redis `INCR` counter -- zero-collision TKT-000001 style numbers under cluster concurrency. |

---

## Project Structure

```
ticketing-system/
+-- api-gateway/              # API Gateway -- port 3000
|   +-- src/
|       +-- app.js
|       +-- index.js          # cluster entry
|       +-- server.js
|       +-- middleware/
|       |   +-- auth.js       # JWT verification
|       |   +-- rateLimiter.js
|       +-- routes/
|           +-- proxy.js      # http-proxy-middleware
|           +-- health.js
+-- auth-service/             # Auth Service -- port 3001
|   +-- src/
|       +-- app.js / index.js / server.js
|       +-- controllers/ services/ models/ routes/ middleware/
|       +-- db/migrate.js
+-- ticket-service/           # Ticket Service -- port 3002
|   +-- src/
|       +-- app.js / index.js / server.js
|       +-- controllers/ services/ models/ routes/ middleware/
|       +-- db/migrate.js
+-- shared/                   # Shared utilities (npm workspace)
|   +-- src/
|       +-- cluster.js        # startCluster() helper
|       +-- errors.js         # AppError hierarchy + errorHandler
|       +-- logger.js         # Winston logger factory
|       +-- mysqlPool.js      # Singleton MySQL pool + withTransaction
|       +-- redisClient.js    # Singleton ioredis client
|       +-- redlock.js        # Redlock singleton + withLock helper
+-- db/
|   +-- init.sql              # DB bootstrap (Docker entrypoint)
|   +-- seed.js               # Seed test users
+-- load-test/
|   +-- run.js                # autocannon load test
+-- docker-compose.yml
+-- .env.example
+-- package.json              # npm workspaces root
```

---

## Quick Start (Docker)

```bash
# 1. Clone and enter
git clone <repo> ticketing-system && cd ticketing-system

# 2. Configure environment
cp .env.example .env
# edit .env -- change JWT_SECRET values!

# 3. Start all services
docker-compose up -d

# 4. Health check
curl http://localhost:3000/health
```

---

## Quick Start (Local Development)

**Prerequisites:** Node.js 20+, MySQL 8, Redis 7

```bash
npm install
docker-compose up -d mysql redis
npm run migrate
node db/seed.js
npm run dev
```

---

## API Reference

All requests go through `http://localhost:3000`.

### Auth -- Public

| Method | Path | Body | Description |
|--------|------|------|-------------|
| `POST` | `/auth/register` | `{email, password, name}` | Create account |
| `POST` | `/auth/login` | `{email, password}` | Returns `accessToken` + `refreshToken` |

### Auth -- Protected `Bearer <token>`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Current user profile |
| `POST` | `/auth/refresh` | `{refreshToken}` -> new token pair |
| `POST` | `/auth/logout` | Revokes refresh token |

### Tickets -- Protected `Bearer <token>`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tickets` | List tickets (paged, filterable) |
| `POST` | `/tickets` | Create ticket |
| `GET` | `/tickets/:id` | Get single ticket (cached 60s) |
| `PATCH` | `/tickets/:id` | Update ticket (Redlock guarded) |
| `POST` | `/tickets/:id/assign` | Assign to agent (Redlock) |
| `POST` | `/tickets/:id/claim` | Self-assign open ticket (Redlock) |
| `POST` | `/tickets/:id/comments` | Add comment |
| `GET` | `/tickets/:id/comments` | List comments |
| `POST` | `/tickets/:id/close` | Close ticket |
| `DELETE` | `/tickets/:id` | Delete (admin only) |

---

## Concurrency Flow -- Claiming a Ticket

```
Worker A                    Redis               Worker B
   |                          |                    |
   |-- CLAIM ticket:abc ------>|                    |
   |   SET lock:ticket:abc     |                    |
   |   NX PX 8000 ------------> lock acquired       |
   |                          |                    |
   |                          | <-- CLAIM ticket:abc|
   |                          |   NX PX 8000 -------> lock BUSY
   |                          |                    | retry (up to 10x)
   |-- UPDATE assigned_to=A -->|                    |
   |-- DEL lock:ticket:abc --->|                    |
   |                          | lock acquired ------>
   |                          |                    |-- ticket already
   |                          |                    |   assigned -> 409
```

---

## Load Testing

```bash
cd load-test && npm install

# runs health, login, list-tickets and create-tickets scenarios
node run.js
```

Scale `connections` to `50000` in `load-test/run.js` for the full 50K test on beefy hardware.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GATEWAY_WORKERS` | `0` (= CPU count) | Gateway cluster workers |
| `AUTH_WORKERS` | `0` | Auth service workers |
| `TICKET_WORKERS` | `0` | Ticket service workers |
| `JWT_SECRET` | -- | **Must be changed in production** |
| `MYSQL_CONNECTION_LIMIT` | `25` | Pool size per worker |
| `RATE_LIMIT_MAX` | `200` | Max requests per window per IP |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `REDLOCK_RETRY_COUNT` | `10` | Lock acquisition retries |

---

## Scaling to 50K req/s

| Layer | Technique |
|---|---|
| Gateway | Cluster (N CPU cores) x keep-alive connections |
| Auth / Ticket | Cluster (N CPU cores) per service |
| MySQL | Per-worker pool; tune `MYSQL_CONNECTION_LIMIT` per worker count |
| Redis | Single node handles ~500K ops/s; use Redis Cluster for more |
| Horizontal | Add Docker replicas behind an Nginx/HAProxy upstream |

---

## Future Scope

> Areas identified for the next evolution of this system

### Near-term
- **WebSocket / SSE notifications** -- Push real-time ticket status updates to connected clients instead of polling
- **Role-based access control (RBAC)** -- Granular permissions (admin, agent, viewer) enforced at the gateway level
- **Refresh token rotation** -- One-time-use refresh tokens with automatic family invalidation on reuse detection
- **Request tracing** -- Inject a `X-Request-Id` correlation header at the gateway and propagate it through all service logs

### Medium-term
- **Event sourcing / audit log** -- Publish every ticket state transition to a message queue (Kafka / RabbitMQ) for a full immutable event history
- **Search service** -- Elasticsearch-backed full-text search across ticket titles, descriptions, and comments
- **SLA & escalation engine** -- Time-based rules that automatically escalate overdue tickets and notify assignees
- **File attachments** -- S3-compatible object storage for ticket attachments with pre-signed URL generation

### Long-term
- **Multi-tenancy** -- Tenant isolation at the database (schema-per-tenant) and Redis (key-prefix-per-tenant) levels
- **GraphQL API** -- Optional GraphQL layer on top of the REST services for flexible client queries
- **Kubernetes deployment** -- Helm charts for each service with horizontal pod autoscaling (HPA) driven by custom metrics
- **Service mesh** -- Istio/Linkerd for mTLS between services, circuit breaking, and automatic retries without application-level code

---

<div align="center">

Built with focus on **concurrency**, **correctness**, and **production readiness**.

![Made with Node.js](https://img.shields.io/badge/Made%20with-Node.js-339933?style=flat-square&logo=nodedotjs)
![Redis Powered](https://img.shields.io/badge/Powered%20by-Redis-DC382D?style=flat-square&logo=redis)
![MySQL](https://img.shields.io/badge/Database-MySQL-4479A1?style=flat-square&logo=mysql)

</div>