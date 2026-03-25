<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=30&pause=1000&color=00D9FF&center=true&vCenter=true&width=700&lines=Distributed+Ticketing+System;Node.js+%7C+Redis+%7C+MySQL+%7C+JWT" alt="Typing SVG" />

<br/>

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-7.0-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

<br/>

> A microservices-based ticketing system focused on handling concurrent workflows using Node.js clustering, Redis-based coordination, and a gateway-driven architecture.

</div>

---

## What I Built & Why

This project explores **backend system design concepts** such as concurrency control, service isolation, and performance optimization — going beyond basic CRUD APIs.

### Key Goals
- Handle concurrent ticket operations safely  
- Design a scalable service-oriented architecture  
- Reduce database load using caching strategies  
- Centralize authentication and request control  

---

## System Overview

### 1. Microservices Architecture
- API Gateway, Auth Service, Ticket Service  
- Shared utilities via npm workspaces  
- Services can scale and run independently  

---

### 2. Multi-core Processing with Node.js Cluster
- Utilizes multiple CPU cores  
- Each worker runs an isolated instance of the application  
- Improves throughput under concurrent requests  

---

### 3. Centralized Authentication (JWT)
- Gateway validates JWT and injects user context headers  
- Downstream services rely on trusted headers  
- Keeps authentication logic in one place  

---

### 4. Distributed Locking (Redis)
- Prevents race conditions during ticket operations  
- Ensures only one worker modifies a ticket at a time  
- Useful for assign/claim/update flows  

---

### 5. Shared Rate Limiting
- Redis-backed rate limiting across all workers  
- Prevents abuse and ensures consistent request control  

---

### 6. Caching Strategy
- Read-through caching for frequently accessed tickets  
- Cache invalidation on write operations  
- Reduces database load for read-heavy scenarios  

---

### 7. Atomic Ticket Number Generation
- Uses Redis `INCR` for unique sequential IDs  
- Ensures collision-free identifiers under concurrency  

---

## Architecture
Client → API Gateway → Services (Auth / Ticket) → MySQL + Redis

- Gateway handles auth, rate limiting, routing  
- Services handle business logic  
- Redis used for caching, locking, coordination  

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Database | MySQL |
| Cache / Lock | Redis |
| Auth | JWT |
| Rate Limiting | Redis-based |
| Containers | Docker |

---

## Key Design Decisions

| Concern | Approach |
|---|---|
| Concurrency handling | Node.js clustering + Redis locking |
| Authentication | Centralized at API Gateway |
| Rate limiting | Shared Redis store |
| Caching | Read-through with invalidation |
| Data consistency | Lock-based updates |

---

## Project Structure
ticketing-system/
├── api-gateway/
├── auth-service/
├── ticket-service/
├── shared/
├── db/
├── docker-compose.yml

---

## Getting Started

```bash
git clone <repo>
cd ticketing-system

cp .env.example .env
docker-compose up -d
