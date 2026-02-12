import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import { Navigate, useLocation } from "react-router-dom";

type Props = {
  /** Grupos permitidos. Ex: ["Investors"] */
  allow: string[];
  /** Se true, permite AdminRewards também (bypass de admin) */
  allowAdminRewards?: boolean;
  /** Para quando estiver carregando */
  loadingFallback?: React.ReactNode;
  /** Conteúdo protegido */
  children: React.ReactNode;
};

function normalizeGroups(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return [v];
  return [];
}

export default function RequireGroup({
  allow,
  allowAdminRewards = false,
  loadingFallback = <div style={{ padding: 24 }}>Carregando...</div>,
  children,
}: Props) {
  const [state, setState] = useState<"loading" | "allowed" | "denied">("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        const session = await fetchAuthSession();
        const payload: any = session.tokens?.idToken?.payload;

        const groups = normalizeGroups(payload?.["cognito:groups"]);
        const allowedSet = new Set(allow);

        const ok =
          groups.some((g) => allowedSet.has(g)) ||
          (allowAdminRewards && groups.includes("AdminRewards"));

        if (!mounted) return;
        setState(ok ? "allowed" : "denied");
      } catch (e) {
        // se não tem sessão/logado, nega
        if (!mounted) return;
        setState("denied");
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [allow, allowAdminRewards]);

  if (state === "loading") return <>{loadingFallback}</>;
  if (state === "denied") return <Navigate to="/sign-in" replace state={{ from: location }} />;

  return <>{children}</>;
}