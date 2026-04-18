# MyFleet 2.0

Fleet and delivery operations dashboard: manage customers, contractors, drivers, vehicles, jobs, rates, expenses, and analytics for a transport company (**deliverer**).

**Stack:** React (Create React App) + Material UI + Redux Toolkit · Express · MongoDB (Mongoose) · JWT auth (httpOnly cookie).

**Full technical reference:** [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md)

**Package READMEs:** [frontend/README.md](frontend/README.md) · [backend/README.md](backend/README.md)

---

## Prerequisites

- **Node.js** (LTS recommended; matches CRA 5 and Express 4)
- **MongoDB** (local or Atlas) and a connection string
- **npm**

---

## Quick start (local development)

### 1. MongoDB

Start MongoDB locally or create a cluster and note the connection string.

### 2. Backend environment

From the repo root:

```bash
cd backend
```

Create **`config/.env`** (this path is gitignored). Copy variable names from [backend/config/.env.example](backend/config/.env.example).

**Important:** load env by running commands with **current working directory = `backend/`**, so `config/.env` resolves to `backend/config/.env`. See [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md#71-where-env-is-loaded).

Set at least:

- **`PORT=5050`** (must match [frontend/src/server.js](frontend/src/server.js))
- **`OFFLINE_DB_URL`** — your Mongo connection string for development
- **`JWT_SECRET_KEY`**, **`JWT_EXPIRES`**, **`ACTIVATION_SECRET`**
- **`SMPT_*`** variables if you use email activation (spellings match code: `SMPT_`)

### 3. Install and run API

```bash
cd backend
npm install
npm run dev
```

The server logs the port (for example `http://localhost:5050`).

### 4. Install and run frontend

In a **second** terminal:

```bash
cd frontend
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The app calls the API at **`http://localhost:5050/api/v2`** with credentials (cookies).

---

## Architecture (overview)

```mermaid
flowchart LR
  subgraph client [React SPA]
    UI[MUI pages]
    Redux[Redux store]
    Axios[Axios withCredentials]
  end
  subgraph api [Express backend]
    Routes["/api/v2/*"]
    Auth[JWT cookie auth]
    Models[Mongoose models]
  end
  DB[(MongoDB)]
  UI --> Redux --> Axios --> Routes
  Routes --> Auth
  Routes --> Models --> DB
```

---

## npm scripts (repository root)

| Script | Description |
|--------|-------------|
| **`npm run dev`** | Runs `nodemon backend/server.js` from **repo root**. Note: dotenv may look for **`./config/.env` at repo root** unless you only use `backend/` as cwd. Prefer **`cd backend && npm run dev`** for local API. |
| **`npm start`** | Runs `node backend/server.js` (same cwd consideration). |
| **`npm run build`** | Installs root + frontend dependencies and runs **`npm run build`** in **`frontend/`** (production bundle). |

---

## Production-style run (API + built SPA)

1. Build the frontend: `cd frontend && npm install && npm run build`
2. Ensure **`frontend/build`** exists at the path expected by [backend/app.js](backend/app.js) (relative to where you start Node).
3. Set **`NODE_ENV=production`**, **`DB_URL`**, and other secrets on the host.
4. Start the server from a cwd where static and API paths resolve correctly (see [docs/PROJECT_REFERENCE.md](docs/PROJECT_REFERENCE.md#9-build-and-deployment-notes)).

---

## License

ISC (see package.json author field).
