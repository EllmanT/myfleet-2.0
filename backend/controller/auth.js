const express = require("express");
const router = express.Router();
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const ErrorHandler = require("../utils/ErrorHandler");
const { clerkAuthOf } = require("../middleware/auth");
const {
  clerkConfigured,
  resolveLocalIdentity,
} = require("../services/clerkAuth");

// Asks Clerk (server to server) who this user is and which organization is
// active, instead of trusting anything the browser sends beyond the session.
async function loadClerkProfile(auth) {
  const { clerkClient } = require("@clerk/express");
  const clerkUser = await clerkClient.users.getUser(auth.userId);

  const primary =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ||
    clerkUser.emailAddresses[0];

  let orgName;
  if (auth.orgId) {
    const org = await clerkClient.organizations.getOrganization({
      organizationId: auth.orgId,
    });
    orgName = org.name;
  }

  return {
    clerkUserId: auth.userId,
    email: primary && primary.emailAddress,
    emailVerified: Boolean(primary && primary.verification && primary.verification.status === "verified"),
    name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || undefined,
    orgId: auth.orgId || undefined,
    orgName,
    orgRole: auth.orgRole || undefined,
  };
}
exports.loadClerkProfile = loadClerkProfile;

// POST /api/v2/auth/bootstrap
// Called by the app right after Clerk sign-in, and again after switching
// organization. Idempotent.
router.post(
  "/bootstrap",
  catchAsyncErrors(async (req, res, next) => {
    if (!clerkConfigured()) {
      return next(new ErrorHandler("Sign-in service is not configured", 503));
    }
    const auth = clerkAuthOf(req);
    if (!auth) {
      return next(new ErrorHandler("Login to continue!", 401));
    }

    const profile = await loadClerkProfile(auth);
    const result = await resolveLocalIdentity(profile);

    res.status(200).json({
      success: true,
      needsOrganization: result.needsOrganization,
      linkedExistingAccount: result.linkedLegacy,
      user: result.user,
      delivererName: result.company ? result.company.companyName : undefined,
    });
  })
);

module.exports = router;
