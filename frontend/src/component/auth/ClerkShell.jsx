import React from "react";
import { ClerkProvider } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import ClerkBridge from "./ClerkBridge";
import { CLERK_PUBLISHABLE_KEY, clerkEnabled } from "utils/clerk";

// Wraps the app in Clerk when it is configured; otherwise renders children as-is.
// Must sit inside the router so Clerk can navigate without a full page reload.
const ClerkShell = ({ children }) => {
  const navigate = useNavigate();
  if (!clerkEnabled) return children;
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      afterSignOutUrl="/login"
    >
      <ClerkBridge />
      {children}
    </ClerkProvider>
  );
};

export default ClerkShell;
