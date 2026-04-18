# MyFleet — Frontend

Create React App (CRA) single-page application for the deliverer dashboard: vehicles, drivers, customers, contractors, jobs, rates, analytics (Nivo charts), and reports.

**Parent project:** [README.md](../README.md) · [docs/PROJECT_REFERENCE.md](../docs/PROJECT_REFERENCE.md)

---

## Tech stack

- **React 18**, **react-router-dom v6**
- **Material UI (MUI) v5**, Emotion, **MUI X Data Grid** and **Date Pickers**
- **Redux Toolkit**, **React Redux**
- **Axios** (API calls with **`withCredentials: true`** for cookies)
- **Day.js**, **react-datepicker**
- **Nivo** (`@nivo/bar`, `line`, `pie`) for charts
- **react-hot-toast**, **html2pdf.js**, **mui-file-input**

---

## Requirements

- **Node.js** (LTS recommended)
- **npm**
- A running **MyFleet API** (see [backend/README.md](../backend/README.md))

---

## API base URL

The frontend does **not** use CRA `proxy` for the API in this repo. The base URL is defined in **`src/server.js`**:

```javascript
export const server = "http://localhost:5050/api/v2";
```

For another host (staging, production), change this constant (or refactor to an env-based build variable). The value **must** match:

- Backend **PORT** (default local setup: **5050**)
- The **`/api/v2`** prefix used in [backend/app.js](../backend/app.js)

Axios calls use **`withCredentials: true`** so the **httpOnly** JWT cookie is sent. The backend CORS config must allow your frontend origin and credentials (see `origin` in `backend/app.js`).

---

## Scripts

Run from **`frontend/`**:

| Command | Description |
|---------|-------------|
| **`npm start`** | Dev server at [http://localhost:3000](http://localhost:3000) (hot reload). |
| **`npm run build`** | Production build to **`build/`**. |
| **`npm test`** | Jest test runner (interactive). |
| **`npm run eject`** | Irreversible CRA eject — avoid unless required. |

---

## Folder structure (`src/`)

| Path | Role |
|------|------|
| **App.js** | Routes, theme, layout, initial dispatches (`loadUser`, `getRates`, etc.). |
| **index.js** / **index.css** | React root, global styles. |
| **theme.js** | MUI theme settings. |
| **server.js** | API base URL export. |
| **route/delRoutes.js** | Page component exports used by `App.js`. |
| **route/delProtectedRoutes.js** | Wrapper for routes that require authentication. |
| **redux/store.js** | Redux store configuration. |
| **redux/actions/** | Async thunks and API calls per domain. |
| **redux/reducers/** | State slices per domain. |
| **pages/deliverer/** | Dashboard, CRUD pages, analytics, reports, login/register. |
| **component/deliverer/** | Layout (navbar, shell), charts, grids, dialogs. |
| **providers/** | e.g. toast provider. |

---

## Cookies and local development

The API sets the auth cookie with **`Secure`** and **`SameSite=None`**. On **http://localhost** some browsers treat secure cookies strictly; if login succeeds but subsequent requests are unauthenticated, use HTTPS locally or align cookie options on the server for development.

---

## Learn more (CRA)

This app was bootstrapped with [Create React App](https://github.com/facebook/create-react-app). Official CRA docs: [getting started](https://facebook.github.io/create-react-app/docs/getting-started).
