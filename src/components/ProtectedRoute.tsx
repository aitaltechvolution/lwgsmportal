import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Role } from "@/types";
import { ReactNode } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";

export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { session, profile, loading } = useAuth();
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <LoadingSpinner size="lg" label="Loading your portal…" />
    </div>
  );
  if (!session) return <Navigate to="/login" replace />;
  if (roles && profile && !roles.includes(profile.role)) {
    const target = profile.role === "admin" ? "/admin" : profile.role === "lecturer" ? "/lecturer" : "/student";
    return <Navigate to={target} replace />;
  }
  return <>{children}</>;
}
