import React, { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";

import { fetchMe } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export const AuthContext = React.createContext({ user: null });

export default function RequireAuth() {
  const [status, setStatus] = useState("checking");
  const [user, setUser] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        setUser(data);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "checking") {
    return <BootSkeleton />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return (
    <AuthContext.Provider value={{ user }}>
      <Outlet />
    </AuthContext.Provider>
  );
}

function BootSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden w-60 shrink-0 border-r border-border p-4 md:block">
        <Skeleton className="mb-6 h-7 w-32" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-9 w-full" />
        ))}
      </div>
      <div className="flex-1 p-8">
        <Skeleton className="mb-4 h-8 w-56" />
        <Skeleton className="mb-2 h-4 w-80" />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
