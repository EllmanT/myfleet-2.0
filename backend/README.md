# MyFleet — Backend

Express REST API for MyFleet: MongoDB via Mongoose, JWT in httpOnly cookies, file uploads, and optional Nodemailer for user activation.

**Parent project:** [README.md](../README.md) · [docs/PROJECT_REFERENCE.md](../docs/PROJECT_REFERENCE.md)

---

## Entry points

| File | Role |
|------|------|
| **server.js** | Loads **dotenv** when `NODE_ENV !== "PRODUCTION"`, connects MongoDB, listens on **`process.env.PORT`**. |
| **app.js** | Creates Express app: **CORS**, **cookie-parser**, JSON body, **`/uploads`** static, mounts **`/api/v2/*`** routers, error handler, serves **`frontend/build`** for SPA fallback. |

---

## Run locally

```bash
cd backend
npm install
```

Create **`config/.env`** (see [config/.env.example](config/.env.example)). Then:

```bash
npm run dev
```

Use **`cd backend`** first so **`config/.env`** resolves to **`backend/config/.env`** (matches [.gitignore](../.gitignore)).

**PORT:** set **`PORT`** to match the frontend API URL in [frontend/src/server.js](../frontend/src/server.js) (default **5050**).

---

## Environment variables

| Variable | Required | Description |
|----------|------------|-------------|
| **PORT** | Yes | HTTP port (e.g. **5050**). |
| **OFFLINE_DB_URL** | Dev / non-production | Mongo connection string when `NODE_ENV` is not **`production`**. |
| **DB_URL** | Production | Mongo connection string when **`NODE_ENV=production`**. |
| **JWT_SECRET_KEY** | Yes | Secret for signing and verifying session JWT. |
| **JWT_EXPIRES** | Yes | Expiry for JWT (e.g. `7d`). |
| **ACTIVATION_SECRET** | For email activation | Secret for short-lived activation tokens. |
| **SMPT_HOST** | If sending mail | Nodemailer host (note: **`SMPT`** spelling in code). |
| **SMPT_PORT** | If sending mail | Port. |
| **SMPT_SERVICE** | If sending mail | Service name when applicable. |
| **SMPT_MAIL** | If sending mail | From / auth user. |
| **SMPT_PASSWORD** | If sending mail | SMTP password. |

**NODE_ENV nuances:**

- Dotenv is skipped when **`NODE_ENV === "PRODUCTION"`** (all caps) in **server.js** / **app.js**.
- **Database.js** uses **`DB_URL`** only when **`NODE_ENV === "production"`** (lowercase).

Use **`production`** (lowercase) for production DB selection; set secrets on the host when dotenv is not loaded.

---

## API layout

All routes are under **`/api/v2`**.

| Path prefix | File |
|-------------|------|
| `/user` | controller/user.js |
| `/customer` | controller/customer.js |
| `/deliverer` | controller/deliverer.js |
| `/contractor` | controller/contractor.js |
| `/vehicle` | controller/vehicle.js |
| `/driver` | controller/driver.js |
| `/job` | controller/job.js |
| `/rate` | controller/rate.js |
| `/overallStats` | controller/overallStats.js |
| `/vehicleStats` | controller/vehicleStats.js |
| `/driverStats` | controller/driverStats.js |
| `/contractorStats` | controller/contractorStats.js |
| `/expenses/vehicle` | controller/vehicleExpenses.js |
| `/expenses/employee` | controller/employeeExpenses.js |

---

## Models

Schemas live in **`model/`**: user, deliverer, customer, contractor, driver, vehicle, job, rate, payment, overallStats, vehicleStats, driverStats, contractorStats, vehicleExpense, employeeExpenses.

---

## Auth

- **middleware/auth.js** — **`isAuthenticated`**: verifies **`token`** cookie with **`JWT_SECRET_KEY`**, loads **User** into **`req.user`**.
- **utils/jwtToken.js** — sets **`token`** cookie on successful login (**httpOnly**, **sameSite: none**, **secure: true**).

---

## File uploads

**multer.js** writes to **`uploads/`** relative to the process cwd. **app.js** exposes them at **`/`** via `express.static` for the uploads directory. Ensure the server cwd is consistent so uploads land in the expected folder.

---

## Static frontend (production)

**app.js** serves **`frontend/build`** and sends **`index.html`** for non-API `GET` requests. Run Node from a working directory where **`./frontend/build`** exists, or adjust paths for your deployment layout.

---

## CORS

**app.js** currently allows **`http://localhost:3000`** with credentials. Change **`origin`** for deployed frontends.

---

## Offline scripts

**controller/populateStats.js** and **controller/popstats2.0.js** contain hardcoded Mongo URIs and are **not** mounted as routes. They are for manual maintenance or one-off aggregation; edit URIs before running.

---

## Dependencies

Install with **`npm install`** in **`backend/`**. The repository root **package.json** may list extra packages; the backend code paths use the dependencies declared in **this** `package.json`.
