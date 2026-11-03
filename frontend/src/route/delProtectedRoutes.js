import React from "react";
import { useSelector } from "react-redux";
import { Navigate, Link } from "react-router-dom";
import ClerkSignedInGuard from "component/auth/ClerkSignedInGuard";
import { clerkEnabled } from "utils/clerk";

// `module` (optional): the page only shows when the company has that module on.
const DelProtectedRoutes = ({ children, module }) => {
  const { isAuthenticated, loading, modules, modulesLoaded } = useSelector(
    (state) => state.user
  );

  if (loading) {
    return null;
  }
  if (!isAuthenticated) {
    // With Clerk, a signed-in person whose account failed to load sees a clear
    // message instead of being bounced between /login and the dashboard.
    if (clerkEnabled) return <ClerkSignedInGuard />;
    return <Navigate to="/login" replace />;
  }

  if (module) {
    if (!modulesLoaded) return null;
    if (!modules || !modules[module]) {
      return (
        <div style={{ padding: "3rem 2rem", maxWidth: 520 }}>
          <h2 style={{ marginTop: 0 }}>This feature is switched off</h2>
          <p style={{ opacity: 0.75 }}>
            Your company has this part of the app turned off. You can turn it on
            from the Modules page.
          </p>
          <Link to="/del-modules">Go to Modules</Link>
        </div>
      );
    }
  }

  return children;
};

export default DelProtectedRoutes;
