/*
 * Test double for "@clerk/express", used ONLY by e2e/stack/start.js.
 *
 * It is injected with a Module._load hook inside the throwaway e2e server process. Nothing in
 * backend/ or frontend/ knows about it, and production never loads this file, so there is no
 * switch that could be flipped on in production by mistake.
 *
 * A "session token" is the string  e2e-clerk.<base64url JSON {userId, orgId, orgRole}>.
 * It is not signed: anyone can mint one, which is exactly why this stub must never be reachable
 * outside the e2e process (start.js binds the control API to localhost and refuses real
 * database URLs).
 */
const users = new Map(); // clerkUserId -> { firstName, lastName, email, verified }
const orgs = new Map(); // orgId -> { name }

function mintToken({ userId, orgId, orgRole }) {
  const body = Buffer.from(JSON.stringify({ userId, orgId, orgRole })).toString("base64url");
  return `e2e-clerk.${body}`;
}

function parse(req) {
  const h = String((req.headers && req.headers.authorization) || "");
  if (!h.startsWith("Bearer e2e-clerk.")) return null;
  try {
    const json = JSON.parse(Buffer.from(h.slice("Bearer e2e-clerk.".length), "base64url").toString("utf8"));
    return json && json.userId ? json : null;
  } catch (e) {
    return null;
  }
}

const stub = {
  clerkMiddleware: () => (req, res, next) => next(),
  getAuth: (req) => parse(req) || { userId: null },
  clerkClient: {
    users: {
      getUser: async (id) => {
        const u = users.get(id);
        if (!u) throw new Error(`stub: unknown clerk user ${id}`);
        return {
          id,
          firstName: u.firstName,
          lastName: u.lastName,
          primaryEmailAddressId: "em_1",
          emailAddresses: [
            { id: "em_1", emailAddress: u.email, verification: { status: u.verified ? "verified" : "unverified" } },
          ],
        };
      },
    },
    organizations: {
      getOrganization: async ({ organizationId }) => {
        const o = orgs.get(organizationId);
        if (!o) throw new Error(`stub: unknown clerk org ${organizationId}`);
        return { id: organizationId, name: o.name };
      },
    },
  },
};

module.exports = { stub, users, orgs, mintToken };
