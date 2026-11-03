const User = require("../model/user");
const Deliverer = require("../model/deliverer");

// Clerk keeps the publishable key under different names depending on the
// framework. The server SDK reads CLERK_PUBLISHABLE_KEY.
function normaliseClerkEnv() {
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    const alt =
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
      process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;
    if (alt) process.env.CLERK_PUBLISHABLE_KEY = alt;
  }
}

function clerkConfigured() {
  normaliseClerkEnv();
  return Boolean(process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY);
}

// Clerk org role -> the role strings the rest of the app already checks.
// Company admins keep finance access; everyone else is a manager without it.
const roleForOrgRole = (orgRole) =>
  orgRole === "org:admin" ? "Deliverer Admin" : "Deliverer Manager";

const GLOBAL_ROLES = ["Super Admin", "Site Admin"];

// orgId -> companyId, so a signed-in request doesn't need an extra lookup of the
// company every time. Short-lived: org changes are picked up within a minute.
const orgCompanyCache = new Map();
const CACHE_MS = 60 * 1000;

async function companyIdForOrg(orgId) {
  const hit = orgCompanyCache.get(orgId);
  if (hit && hit.expires > Date.now()) return hit.companyId;
  const company = await Deliverer.findOne({ clerkOrgId: orgId }).select("_id").lean();
  const companyId = company ? String(company._id) : null;
  if (companyId) orgCompanyCache.set(orgId, { companyId, expires: Date.now() + CACHE_MS });
  return companyId;
}

function clearOrgCache() {
  orgCompanyCache.clear();
}

/**
 * Links a verified Clerk identity to our own records, creating what is missing.
 *
 * - A legacy user with the same VERIFIED email is linked, never duplicated.
 * - The first Clerk organization created by a legacy company admin adopts that
 *   existing company (this is how today's data becomes tenant #1).
 * - Any other new organization gets a fresh company, so a new signup starts empty.
 *
 * @param {object} identity
 * @param {string} identity.clerkUserId
 * @param {string} identity.email           primary email
 * @param {boolean} identity.emailVerified  only a verified email may link a legacy account
 * @param {string} [identity.name]
 * @param {string} [identity.orgId]
 * @param {string} [identity.orgName]
 * @param {string} [identity.orgRole]       e.g. "org:admin"
 */
async function resolveLocalIdentity(identity) {
  const { clerkUserId, email, emailVerified, name, orgId, orgName, orgRole } = identity;
  if (!clerkUserId) throw Object.assign(new Error("Missing Clerk user"), { statusCode: 401 });

  const normalisedEmail = String(email || "").trim().toLowerCase();

  let user = await User.findOne({ clerkUserId });
  let linkedLegacy = false;

  if (!user && normalisedEmail && emailVerified) {
    const legacy = await User.findOne({
      email: new RegExp(`^${normalisedEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      clerkUserId: { $exists: false },
    });
    if (legacy) {
      legacy.clerkUserId = clerkUserId;
      await legacy.save({ validateBeforeSave: false });
      user = legacy;
      linkedLegacy = true;
    }
  }

  if (!user) {
    user = await User.create({
      name: name || normalisedEmail || "New user",
      email: normalisedEmail || `${clerkUserId}@clerk.local`,
      clerkUserId,
      phoneNumber: "N/A",
      address: "N/A",
      city: "N/A",
    });
  }

  if (!orgId) {
    return { user, company: null, needsOrganization: true, linkedLegacy };
  }

  let company = await Deliverer.findOne({ clerkOrgId: orgId });

  if (!company) {
    const legacyCompany =
      user.companyId && orgRole === "org:admin" && !GLOBAL_ROLES.includes(user.role)
        ? await Deliverer.findOne({ _id: user.companyId, clerkOrgId: { $exists: false } })
        : null;

    if (legacyCompany && user.role === "Deliverer Admin") {
      legacyCompany.clerkOrgId = orgId;
      await legacyCompany.save();
      company = legacyCompany;
    } else {
      company = await Deliverer.create({
        companyName: orgName || "My company",
        address: "N/A",
        city: "N/A",
        goodsType: ["general"],
        clerkOrgId: orgId,
      });
    }
  }

  // Point the user at the active organization's company and sync their role
  // (platform admins keep theirs).
  const update = { companyId: company._id };
  if (!GLOBAL_ROLES.includes(user.role)) update.role = roleForOrgRole(orgRole);
  await User.updateOne({ _id: user._id }, { $set: update });
  await Deliverer.updateOne({ _id: company._id }, { $addToSet: { admin_ids: user._id } });
  orgCompanyCache.set(orgId, { companyId: String(company._id), expires: Date.now() + CACHE_MS });

  user = await User.findById(user._id);
  return { user, company, needsOrganization: false, linkedLegacy };
}

module.exports = {
  clerkConfigured,
  normaliseClerkEnv,
  roleForOrgRole,
  resolveLocalIdentity,
  companyIdForOrg,
  clearOrgCache,
};
