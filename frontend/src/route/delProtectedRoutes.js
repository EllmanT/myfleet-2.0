import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import ClerkSignedInGuard from "component/auth/ClerkSignedInGuard";
import { clerkEnabled } from "utils/clerk";

const DelProtectedRoutes = ({ children }) => {
  const { isAuthenticated, loading } = useSelector((state) => state.user);

  if (loading) {
    return null;
  }
  if (!isAuthenticated) {
    // With Clerk, a signed-in person whose account failed to load sees a clear
    // message instead of being bounced between /login and the dashboard.
    if (clerkEnabled) return <ClerkSignedInGuard />;
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default DelProtectedRoutes;
