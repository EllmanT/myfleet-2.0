const trim = (s) =>
  s === undefined || s === null ? "" : String(s).trim().replace(/\/+$/, "");

// Production on Vercel (same-origin): leave unset so API base path is `/api/v2`.
// Local CRA dev: overrides default `localhost:5050` when `.env.development.local` defines this.
const fromEnv = trim(process.env.REACT_APP_API_ORIGIN);

export const server = fromEnv
  ? `${fromEnv}/api/v2`
  : process.env.NODE_ENV === "production"
    ? "/api/v2"
    : "http://localhost:5050/api/v2";
