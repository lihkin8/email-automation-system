import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

/**
 * Wraps a route and redirects to / if the user is not authenticated.
 * Auth check: GET /auth/me — succeeds if the JWT cookie is valid.
 */
export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("checking"); // "checking" | "auth" | "unauth"

  useEffect(() => {
    axios
      .get(`${BACKEND_URL}/auth/me`, { withCredentials: true })
      .then(() => setStatus("auth"))
      .catch(() => setStatus("unauth"));
  }, []);

  if (status === "checking") return null;
  if (status === "unauth") return <Navigate to="/" replace />;
  return children;
}
