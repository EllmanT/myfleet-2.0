import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth, useClerk } from "@clerk/clerk-react";

/**
 * Shown instead of a redirect when someone is signed in with Clerk but we could
 * not load their account. Redirecting to /login here would bounce straight back
 * (Clerk sends signed-in people to the dashboard), which looks like a glitch.
 */
const ClerkSignedInGuard = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const error = useSelector((state) => state.user.error);

  if (!isLoaded) return null;
  if (!isSignedIn) return <Navigate to="/login" replace />;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: 24,
        textAlign: "center",
      }}
    >
      <h2 style={{ margin: 0 }}>We couldn't finish setting up your account</h2>
      <p style={{ margin: 0, maxWidth: 420, opacity: 0.75 }}>
        {error || "Something went wrong while loading your company."} Your data is safe. Try again, or sign out and back in.
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <button type="button" onClick={() => signOut({ redirectUrl: "/login" })}>
          Sign out
        </button>
      </div>
    </div>
  );
};

export default ClerkSignedInGuard;
