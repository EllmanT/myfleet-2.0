import React from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";

const DelProtectedRoutes = ({ children }) => {
  const { isAuthenticated, loading, user } = useSelector((state) => state.user);

  if (!loading) {
    if(!isAuthenticated){
      <Navigate to="/login"/>
    }
  }

  return children;
};

export default DelProtectedRoutes;
