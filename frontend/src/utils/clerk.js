// Clerk sign-in is switched on by the publishable key. Without it the app keeps
// using the existing email/password login, so nothing changes until it is set.
export const CLERK_PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY || "";
export const clerkEnabled = Boolean(CLERK_PUBLISHABLE_KEY);
