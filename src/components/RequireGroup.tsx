import React, { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

type Props = {
  group: string;                 // ex: "Investor" ou "AdminRewards"
  children: React.ReactNode;
  redirectTo?: string;           // default "/"
  loadingFallback?: React.ReactNode; // opcional
};

export default function RequireGroup({
  group,
  children,
  redirectTo = "/",
  loadingFallback = null,
}: Props) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.idToken?.payload["cognito:groups"] as string[] | undefined) || [];

        const ok = groups.includes(group);

        if (!mounted) return;

        if (!ok) {
          setAllowed(false);
          // redireciona para home (ou /sign-in, /403 etc)
          window.location.replace(redirectTo);
          return;
        }

        setAllowed(true);
      } catch (e) {
        // sem sessão / token inválido -> volta para redirect
        if (!mounted) return;
        setAllowed(false);
        window.location.replace(redirectTo);
      }
    }

    check();

    return () => {
      mounted = false;
    };
  }, [group, redirectTo]);

  // null = checando
  if (allowed === null) return <>{loadingFallback}</>;

  // se não permitido, a gente já redirecionou
  if (allowed === false) return null;

  return <>{children}</>;
}