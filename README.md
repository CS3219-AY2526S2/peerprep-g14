[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/HpD0QZBI)

# PeerPrep — Collaborative Peer Programming Platform

**CS3219 Software Engineering Principles and Patterns — AY2526S2 | Group G14**

PeerPrep is a microservices-based web application that matches students for real-time collaborative coding practice. Users are paired by difficulty, topic, and language preference, then dropped into a shared code editor where they solve coding problems together with live synchronization, sandboxed code execution, and AI-powered assistance.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Services](#services)
  - [Frontend](#frontend)
  - [Gateway (Nginx)](#gateway-nginx)
  - [Auth Service](#auth-service)
  - [User Service](#user-service)
  - [Question Service](#question-service)
  - [Matching Service](#matching-service)
  - [Collaboration Service](#collaboration-service)
  - [Code Execution Service](#code-execution-service)
  - [AI Service](#ai-service)
- [Inter-Service Communication](#inter-service-communication)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)

---

## Tech Stack

### Frontend

| Technology | Purpose | Why |
|-----------|---------|-----|
| React 19 + TypeScript | UI framework | Component-based architecture with type safety for a large, multi-page application |
| Vite | Build tool and dev server | Near-instant hot module replacement during development; fast production builds |
| Monaco Editor | Code editor | The same editor engine that powers VS Code — provides syntax highlighting, IntelliSense, and multi-language support out of the box |
| Yjs + y-monaco + y-websocket | Real-time collaboration | Yjs is a CRDT library that enables conflict-free concurrent editing without a central server deciding merge order; y-monaco binds it directly to the editor |
| React Router DOM | Client-side routing | Hash-based routing for SPA navigation with role-based protected routes |
| TanStack React Query | Server state management | Handles caching, background refetching, and loading/error states for API calls |
| Supabase | Authentication provider | Provides Github OAuth integration on the frontend |

### Backend

| Technology | Purpose | Why |
|-----------|---------|-----|
| Node.js + Express | Auth, User, Matching, Collaboration, AI services | Lightweight and well-suited for I/O-heavy microservices; large middleware ecosystem (JWT, CORS, proxy) |
| Go + Gin | Question and Code Execution services | High performance for CPU-bound work (code execution orchestration); strong concurrency primitives (goroutines, channels) for managing parallel container executions |
| PostgreSQL (Supabase) | Relational data (users, match requests, sessions) | ACID transactions for match state management; Prisma ORM provides type-safe queries and migrations |
| Firebase | Storage question of images | Easy to setup and lightweight |
| MongoDB Atlas | Document data (questions, test cases, completions) | Flexible schema for questions with varying fields; `$addToSet` and `$inc` atomic operators simplify completion tracking |
| Redis | Caching | In-memory caching of frequently matched questions reduces MongoDB load on the hot path |
| RabbitMQ | Asynchronous messaging | Decouples matching from session creation; topic exchange enables event-driven architecture without tight coupling |
| Docker | Containerization and sandboxed code execution | Consistent development/production environments; ephemeral containers provide secure isolation for running untrusted user code |
| Nginx | API gateway and reverse proxy | Single entry point for all client requests; path-based routing to backend services |

### Infrastructure

| Technology | Purpose |
|-----------|---------|
| Docker Compose | Local multi-service orchestration |
| AWS ECS (Fargate) | Production container orchestration |
| AWS ECR | Container image registry |
| GitHub Actions | CI/CD pipeline — builds and deploys all services on push to `main` |

---

## Architecture Overview

### Request Flow

```
Browser (React SPA)
  |
  v
Nginx Gateway (port 80)
  |
  |-- /                         --> Frontend (static files, port 5173)
  |-- /user/auth/github         --> User Service (port 3001)  [public, no JWT]
  |-- /user/user/login          --> User Service (port 3001)  [GitHub OAuth callback]
  |-- /user/admin/login         --> User Service (port 3001)  [admin login]
  |-- /api/*                    --> Auth Service (port 3000)  [JWT verification]
  |     |-- /api/user/*         --> User Service (port 3001)
  |     |-- /api/questions/*    --> Question Service (port 3002)
  |     |-- /api/matching/*     --> Matching Service (port 3003)
  |     |-- /api/collaboration/* --> Collaboration Service (port 3004)
  |     |-- /api/execute        --> Code Execution Service (port 3006)
  |     |-- /api/ai/*           --> AI Service (port 3005)
```

### Async Communication (RabbitMQ)

```
Matching Service                          Collaboration Service
  |                                         |
  |-- publishes "match.found" event ------->|-- consumes from queue
      (topic exchange: matching.events)         (queue: collaboration.match_found)
                                                 |
                                                 +--> Creates collaboration session
```

---

## Services

### Frontend

**Directory:** `Peerprep-app/` | **Port:** 5173

The single-page React application that users interact with. It handles authentication, match request creation, the collaborative workspace, and admin question management.

**Key features:**
- **Authentication** — GitHub OAuth login for users; email/password login for admins. Session state managed via httpOnly cookies.
- **Matching UI** — Users select a topic, difficulty, programming language, and time availability. An SSE (Server-Sent Events) stream provides real-time match status updates, including fallback suggestions when an exact match is not found.
- **Collaborative Workspace** — Monaco Editor bound to a Yjs document via y-monaco. Both peers see each other's edits in real time through CRDT synchronization over WebSocket. The workspace includes code execution (with peer approval), AI-powered code translation, and AI-powered code explanation.
- **Admin Panel** — Role-gated pages for managing questions, users, and admin accounts.

**Key libraries:** `@monaco-editor/react`, `yjs`, `y-websocket`, `y-monaco`, `@tanstack/react-query`, `react-router-dom`, `firebase`, `lucide-react`

---

### Gateway (Nginx)

**Directory:** `gateway/` | **Port:** 80

A lightweight Nginx reverse proxy that acts as the single entry point for all client traffic. It routes requests to the appropriate backend service based on URL path.

**Why Nginx:** Nginx handles path-based routing, WebSocket upgrades, and SSE streaming with minimal overhead. It eliminates the need for the frontend to know individual service URLs — all requests go to the same origin, avoiding CORS issues.

**Routing rules:**
- Public auth routes (`/user/*`) go directly to the User Service, bypassing JWT verification
- All `/api/*` routes go through the Auth Service, which verifies the JWT before proxying to the target service
- WebSocket connections (`/api/collaboration/*`) are upgraded via `proxy_set_header Upgrade/Connection` directives
- SSE connections (`/api/matching/*`) have buffering disabled (`proxy_buffering off`) so events flush immediately

---

### Auth Service

**Directory:** `services/auth-service/` | **Port:** 3000 | **Language:** Node.js + Express

A stateless authentication gateway that sits between Nginx and all protected backend services. It does not contain business logic — its sole purpose is to verify JWTs and proxy authenticated requests.

**How it works:**
1. Reads `accessToken` from the request's httpOnly cookie
2. Verifies the token against `ACCESS_TOKEN_SECRET` using the `jsonwebtoken` library
3. If the token is expired, attempts a silent refresh by calling `POST http://user-service:3001/auth/refresh` with the refresh token
4. On success, injects `x-user-id` and `x-user-role` headers into the request and proxies it to the target service
5. On failure, returns 401 Unauthorized

**Why a separate auth service:** Centralizing JWT verification in one service means backend services never handle tokens directly. They simply read trusted headers (`x-user-id`, `x-user-role`), keeping them stateless and decoupled from the authentication mechanism.

**Proxied routes and their targets:**

| Incoming Path | Target Service | Notes |
|--------------|----------------|-------|
| `/api/user/*` | User Service (3001) | Profile and user management |
| `/api/questions/*` | Question Service (3002) | Question CRUD |
| `/api/matching/*` | Matching Service (3003) | 1-hour timeout for SSE streams |
| `/api/collaboration/*` | Collaboration Service (3004) | WebSocket upgrade support |
| `/api/execute` | Code Execution Service (3006) | 5-minute timeout for image pulls |
| `/api/ai/*` | AI Service (3005) | Code translation/explanation |

---

### User Service

**Directory:** `services/user-service/` | **Port:** 3001 | **Language:** Node.js + Express

Handles user registration, authentication, and profile management. It is the only service that interacts with user credentials and issues JWTs.

**Authentication flows:**
- **GitHub OAuth** — Redirects users to GitHub's authorization page. On callback, exchanges the authorization code for a GitHub access token, fetches the user's profile and primary email, creates or retrieves the user record in PostgreSQL, and issues a JWT access token (15-minute expiry) and refresh token (7-day expiry) as httpOnly cookies.
- **Admin login** — Email/password authentication for admin accounts.
- **Token refresh** — Accepts a refresh token, verifies it against a hashed copy in the database, and issues a new access token.

**Database:** PostgreSQL via Prisma ORM. Stores user profiles (`id`, `email`, `name`, `role`, `experienceLevel`, `learningPurpose`, `bio`) and refresh token hashes.

**Why Prisma:** Provides type-safe database queries generated from the schema, automatic migration management, and a GUI (Prisma Studio) for inspecting data during development.

---

### Question Service

**Directory:** `services/question-service/` | **Port:** 3002 | **Language:** Go + Gin

Manages coding questions, tracks question completion, and serves test cases for the code execution service. Uses MongoDB as its primary data store and Redis for caching frequently accessed questions.

**Key features:**
- **CRUD operations** — Create, read, update, and delete questions. Write operations are gated behind admin-only middleware that checks the `X-User-Role` header.
- **Available question selection** — `GET /available` returns a question that neither user in a session has previously completed. It first checks a Redis cache of the top 5 most-matched questions, filters by difficulty/topic/completed exclusions, and picks one at random. On cache miss, it falls back to a full MongoDB query.
- **Completion tracking** — `POST /completed` marks a question as completed for both users using MongoDB's `$addToSet` (idempotent, prevents duplicates) with upsert. It also atomically increments the question's `Matched` popularity counter via `$inc`.
- **Test case serving** — `GET /testcases/:questionId` returns all test cases for a question. This is an internal endpoint consumed by the code-execution-service.
- **Background cache refresh** — A goroutine with a 15-minute ticker queries MongoDB for the top 5 most-matched questions and stores them in Redis with a 20-minute TTL.
- **Graceful degradation** — If MongoDB is unreachable, the service returns three hardcoded fallback questions instead of failing entirely.

**Why Go:** The question service benefits from Go's low memory footprint and fast startup time. Goroutines provide a lightweight mechanism for the background cache refresh without thread management overhead.

**Why Redis caching:** The `GET /available` endpoint is called on every match. Caching the most popular questions avoids repeated MongoDB queries for the most common case. The background refresh pattern ensures the cache is always warm.

---

### Matching Service

**Directory:** `services/matching-service/` | **Port:** 3003 | **Language:** Node.js + Express

Pairs users for collaborative coding sessions based on their preferences. Implements a multi-criteria matching algorithm and uses Server-Sent Events for real-time status updates.

**Matching algorithm:**
1. **Hard constraints** — Groups pending requests by `(topic, programmingLanguage)`. Users must share the same topic and language.
2. **Longest-waiting-first** — Within each group, requests are processed in FIFO order by `createdAt` for fairness.
3. **Same-difficulty preference** — First attempts to match users at the same difficulty level.
4. **Downward flexibility** — If a user opts in (`allowLowerDifficultyMatch`), the algorithm considers partners at a lower difficulty. It never matches upward.
5. **Time availability** — Among eligible partners at the same difficulty, prefers users with matching `timeAvailableMinutes`.
6. **Deterministic tie-breaking** — Uses `createdAt`, then `userId`, then `id` for stable, reproducible ordering.

**Real-time updates (SSE):**
- When a user submits a match request, the frontend opens an SSE connection to `GET /matching/requests/:id/events`
- An in-memory SSE hub tracks active connections per match request
- When a match is found, the hub broadcasts the result to all subscribers
- SSE was chosen over WebSocket here because the communication is one-directional (server to client) — there is no need for the client to send messages back on this channel

**RabbitMQ integration:**
- A durable work queue (`matching.match.work`) triggers the matching engine at configurable intervals
- When a match is found, the service publishes a `match.found` event to the `matching.events` topic exchange
- The collaboration service consumes this event to create a session

**Database:** PostgreSQL via Prisma. Stores match request state with fields for status tracking, peer linkage, and disconnect handling.

**Disconnect/reconnect handling:** If a user briefly disconnects (e.g., page refresh), their request enters a grace period. They can reconnect within 2 minutes without losing their place in the queue.

---

### Collaboration Service

**Directory:** `services/collaboration-service/` | **Port:** 3004 | **Language:** Node.js + Express

Manages real-time collaborative editing sessions between matched peers. Uses Yjs CRDT for conflict-free code synchronization over WebSocket.

**How it works:**
1. **Session creation** — Listens for `match.found` events on RabbitMQ. When received, creates a session record in PostgreSQL with both user IDs, topic, difficulty, and language.
2. **WebSocket connection** — When both users open the workspace, the frontend establishes a WebSocket connection to `/api/collaboration/ws/:sessionId`. The service creates a Yjs document for the session and applies any persisted state from the database.
3. **Real-time sync** — Yjs handles all conflict resolution. When User A types, the Yjs update is sent via WebSocket to User B's client, which applies it to their local document. Because Yjs is a CRDT, both documents converge to the same state regardless of operation order.
4. **State persistence** — Document state is debounced (2-second delay) and saved as a binary Yjs update to PostgreSQL. If a user reconnects, the persisted state is loaded into a fresh Yjs document.
5. **Session termination** — The `sys` Yjs shared map carries a `terminated` flag. When a user ends the session, this flag is set and propagated to the peer via CRDT sync.

**Why Yjs CRDT:** Traditional Operational Transform (OT) requires a central server to order operations, creating a bottleneck. CRDTs guarantee eventual consistency without centralized ordering — each peer can apply operations independently, and the results always converge. This makes the system resilient to network partitions and reduces server-side complexity.

**Session management:**
- **Inactivity timeout** — 30 minutes of no edits triggers automatic session termination
- **Disconnect grace period** — 2 minutes to rejoin if a peer disconnects unexpectedly
- **Connection tracking** — The service tracks how many WebSocket connections are active per session

**Database:** PostgreSQL via Prisma. Stores session metadata and binary Yjs document state.

---

### Code Execution Service

**Directory:** `services/code-execution-service/` | **Port:** 3006 | **Language:** Go + Gin

Executes user-submitted code in sandboxed Docker containers and evaluates it against predefined test cases. Supports Python, JavaScript, TypeScript, Java, C++, C, and Go.

**How it works:**
1. **Receives request** — `POST /execute` with `code`, `language`, and `questionId`
2. **Fetches test cases** — Makes an internal HTTP call to `GET http://question-service:3002/testcases/:questionId`
3. **Generates a runner script** — Wraps the user's code in a language-specific test harness that calls the user's function with each test case's inputs and outputs one JSON result per line to stdout
4. **Creates a sandboxed Docker container** — Pulls the appropriate language image if needed, creates a container with strict security constraints, and injects the runner script via Docker's copy API (no host filesystem bind mounts)
5. **Runs and waits** — Starts the container with a 30-second timeout. If it exceeds the limit, the container is killed with SIGKILL
6. **Parses results** — Reads stdout line-by-line, parsing each JSON line into a test case result
7. **Cleans up** — Force-removes the container regardless of outcome

**Sandbox security constraints:**

| Constraint | Value | Purpose |
|-----------|-------|---------|
| Network | Disabled | Prevents data exfiltration and attacks on internal services |
| Memory | 512MB | Prevents memory bombs; kernel OOM-kills on breach |
| CPU | 1 core | Prevents CPU starvation of other executions |
| Timeout | 30 seconds | Kills infinite loops and long-running code |
| Filesystem | tmpfs only (64MB) | No persistent writes; ephemeral scratch space |
| Concurrency | 5 max | Channel-based semaphore prevents container sprawl |
| Cleanup | Always force-remove | No zombie containers accumulate |

**Why Go:** Container orchestration involves managing multiple concurrent executions with strict timeouts. Go's goroutines and channels provide lightweight concurrency, and the Docker SDK for Go is first-class.

**Why sibling containers (not Docker-in-Docker):** The service mounts the host's Docker socket (`/var/run/docker.sock`) and creates peer containers on the same Docker daemon. This avoids the complexity and security issues of nested Docker daemons.

---

### AI Service

**Directory:** `services/ai-service/` | **Port:** 3005 | **Language:** Node.js + Express

Provides AI-powered code assistance during collaboration sessions using Google's Gemini model (gemma-3-27b-it).

**Features:**
- **Code Translation** (`POST /translate`) — Converts code between supported languages (JavaScript, TypeScript, Python, Java, C++, Go) while preserving logic and structure
- **Code Explanation** (`POST /explain`) — Generates human-readable explanations of code, optionally incorporating the original problem question and user preferences for explanation style

**Rate limiting:** In-memory per-user rate limiting (1 request per 10 seconds per `x-user-id`). A cleanup job runs every 5 minutes to remove stale entries.

**Why a separate service:** Isolating AI calls into its own service prevents slow LLM responses from blocking other services. It can be independently scaled or swapped to a different model without affecting the rest of the platform.

---

## Inter-Service Communication

### Synchronous (HTTP)

All service-to-service HTTP calls use Docker Compose's built-in DNS resolution. Services reference each other by container name (e.g., `http://user-service:3001`).

```
Auth Service ----HTTP----> User Service         (token refresh)
Auth Service ----proxy---> All backend services  (authenticated request forwarding)
Code Execution --HTTP----> Question Service      (fetch test cases)
Collaboration ---HTTP----> Matching Service      (verify match on session creation)
```

### Asynchronous (RabbitMQ)

RabbitMQ decouples the matching and collaboration services. The matching service does not need to know how sessions are created — it publishes an event and moves on.

```
Exchange: matching.events (topic)
  |
  |-- Routing key: match.found
  |     |
  |     +--> Queue: collaboration.match_found (durable)
  |            Consumer: Collaboration Service
  |            Action: Creates a new collaboration session
  |
  |-- Routing key: match_request.*
        Used internally by the matching service
```

**Why RabbitMQ over direct HTTP:** If the collaboration service is temporarily unavailable, the message remains in the queue and is processed when the service recovers. With direct HTTP, the match would be lost. The durable queue provides delivery guarantees that HTTP calls do not.

### Real-Time (WebSocket + SSE)

| Protocol | Used By | Direction | Purpose |
|---------|---------|-----------|---------|
| SSE | Matching Service | Server -> Client | Stream match status updates (found, timed out, fallback) |
| WebSocket | Collaboration Service | Bidirectional | Yjs CRDT document synchronization between peers |

**Why SSE for matching:** Match updates are server-to-client only — the client does not need to send messages back on this channel. SSE is simpler than WebSocket for unidirectional streaming and automatically reconnects on disconnection.

**Why WebSocket for collaboration:** Code editing requires bidirectional, low-latency communication. Both peers send and receive Yjs updates simultaneously. WebSocket provides a persistent full-duplex connection, which is necessary for CRDT synchronization.

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine + Docker Compose)
- [Git](https://git-scm.com/)

For code execution, the following Docker images must be available on the host:
```bash
docker pull python:3-slim node:20-slim gcc:latest openjdk:21-slim golang:1.22-alpine
```

### Running the Full Stack

1. **Clone the repository**
   ```bash
   git clone https://github.com/CS3219-AY2526S2/peerprep-g14.git
   cd peerprep-g14
   ```

2. **Start all services**
   ```bash
   docker compose up -d
   ```
   This builds and starts all 9 services (frontend, gateway, auth, user, question, matching, collaboration, code-execution, ai) plus RabbitMQ.

3. **Open the application**
   ```
   http://localhost
   ```
   Nginx serves the frontend on port 80 and routes API requests to the appropriate backend service.

4. **View logs for a specific service**
   ```bash
   docker compose logs -f <service-name>
   ```
   Example: `docker compose logs -f matching-service`

5. **Stop all services**
   ```bash
   docker compose down
   ```

### Service Startup Order

Docker Compose handles dependency ordering:

```
RabbitMQ (healthcheck: ping)
  |
  +--> Matching Service (depends on: rabbitmq healthy)
  |      |
  |      +--> Auth Service (depends on: user-service, matching-service)
  |
  +--> Collaboration Service (depends on: rabbitmq healthy, matching-service started)

User Service (no dependencies)
Question Service (depends on: auth-service)
Code Execution Service (depends on: question-service)
AI Service (no dependencies)

Gateway/Nginx (depends on: all services)
  |
  +--> Frontend
```

### Environment Variables

Each service has its own `.env` file in its directory with the required configuration (database URLs, API keys, secrets). These are pre-configured for the cloud-hosted databases (Supabase, MongoDB Atlas, Redis Labs, CloudAMQP).

**Key environment variables by service:**

| Service | Key Variables |
|---------|--------------|
| User Service | `DATABASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` |
| Question Service | `MONGODB_URI`, `REDIS_ADDR`, `REDIS_USERNAME`, `REDIS_PW` |
| Matching Service | `DATABASE_URL`, `RABBITMQ_URL`, `FRONTEND_ORIGIN` |
| Collaboration Service | `DATABASE_URL`, `RABBITMQ_URL`, `MATCHING_SERVICE_URL`, `QUESTION_SERVICE_URL` |
| Code Execution Service | `QUESTION_SERVICE_URL` |
| AI Service | `GEMINI_API_KEY` |
| Auth Service | `ACCESS_TOKEN_SECRET` |

### Running Individual Services (Development)

Each service can be run independently for development. See the `Dockerfile.dev` in each service directory, or run natively:

**Node.js services** (auth, user, matching, collaboration, ai):
```bash
cd services/<service-name>
npm install
npm run dev
```

**Go services** (question, code-execution):
```bash
cd services/<service-name>
go run .
# Or with hot reload:
air -c .air.toml
```

**Frontend:**
```bash
cd Peerprep-app
npm install
npm run dev
```

### Database Migrations

For services using Prisma (user, matching, collaboration):
```bash
cd services/<service-name>
npx prisma generate    # Generate Prisma client
npx prisma migrate dev # Run pending migrations
npx prisma studio      # Open database GUI
```

---

## Project Structure

```
peerprep-g14/
|
|-- Peerprep-app/                    # Frontend (React + Vite)
|   |-- src/
|   |   |-- pages/                   # Page components (Login, Dashboard, Workspace, Matching, Admin*)
|   |   |-- components/              # Reusable UI components (CodeEditor, Modal, Button, etc.)
|   |   |-- context/                 # React context (AuthContext)
|   |   |-- layouts/                 # Layout wrappers (UserLayout, AdminLayout)
|   |   +-- App.tsx                  # Route definitions
|   |-- Dockerfile.dev
|   +-- Dockerfile.prod
|
|-- gateway/
|   +-- nginx.conf                   # Reverse proxy routing rules
|
|-- services/
|   |-- auth-service/                # JWT verification + request proxy
|   |   +-- src/index.ts
|   |
|   |-- user-service/                # User auth, profile, GitHub OAuth
|   |   +-- src/routes/user.ts
|   |
|   |-- question-service/            # Question CRUD, Redis caching, test cases
|   |   |-- handler/handler.go
|   |   |-- question/
|   |   |   |-- repository/crud.go
|   |   |   |-- redisCache/redisCache.go
|   |   |   +-- validation/validation.go
|   |   +-- server.go
|   |
|   |-- matching-service/            # Matching algorithm, SSE, RabbitMQ publisher
|   |   +-- src/
|   |       |-- services/matchingEngine.ts
|   |       |-- messaging/rabbitMatchQueue.ts
|   |       |-- sse/matchRequestSseHub.ts
|   |       +-- routes/matchingRoutes.ts
|   |
|   |-- collaboration-service/       # Yjs CRDT, WebSocket, session management
|   |   +-- src/
|   |       |-- services/SessionManager.ts
|   |       +-- messaging/matchConsumer.ts
|   |
|   |-- code-execution-service/      # Sandboxed Docker execution
|   |   |-- handler/handler.go
|   |   +-- executor/
|   |       |-- executor.go          # Container lifecycle
|   |       +-- runners.go           # Per-language runner generation
|   |
|   +-- ai-service/                  # Gemini-powered code translation/explanation
|       +-- src/routes/
|           |-- translate.ts
|           +-- explain.ts
|
|-- compose.yaml                     # Docker Compose (local development)
|-- go.work                          # Go workspace (question + code-execution modules)
+-- .github/workflows/main.yml       # CI/CD pipeline (build + deploy to AWS ECS)
```
