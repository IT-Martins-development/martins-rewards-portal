import React, { useMemo, useState } from "react";
import { Amplify } from "aws-amplify";
import awsExports from "./aws-exports";
import "./index.css";

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import RewardsCRUD from "./RewardsCrud";
import RewardsApprovals from "./RewardsApprovals";
import RewardsReport from "./RewardsReport";
import RewardsBalancesReport from "./RewardsBalancesReport"; // ✅ EDITÁVEL
import type { Lang } from "./types/lang";

export type { Lang } from "./types/lang";

Amplify.configure(awsExports);

type Page = "crud" | "approvals" | "report" | "balances";

const shell: React.CSSProperties = {
  minHeight: "100vh",
  background: "#111",
  color: "#fff",
};

const layout: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: 0,
  minHeight: "100vh",
};

const sidebar: React.CSSProperties = {
  background: "linear-gradient(180deg,#1b1b1b,#111)",
  padding: 16,
  borderRight: "1px solid rgba(255,255,255,.06)",
};

const brand: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 18,
  marginBottom: 18,
};

const menuTitle: React.CSSProperties = {
  opacity: 0.6,
  fontSize: 12,
  letterSpacing: 1,
  marginBottom: 10,
};

const btn: React.CSSProperties = {
  width: "100%",
  textAlign: "left",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.10)",
  background: "transparent",
  color: "#fff",
  cursor: "pointer",
  marginBottom: 8,
};

const btnActive: React.CSSProperties = {
  ...btn,
  border: "1px solid rgba(255,255,255,.30)",
  background: "rgba(255,255,255,.06)",
};

const contentWrap: React.CSSProperties = {
  padding: 18,
  position: "relative",
};

const topbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  marginBottom: 10,
};

const logoutBtn: React.CSSProperties = {
  border: "0",
  borderRadius: 999,
  padding: "8px 14px",
  background: "#6b5a2b",
  color: "#fff",
  cursor: "pointer",
};

function AppShell({ signOut }: { signOut?: () => void }) {
  const [page, setPage] = useState<Page>("crud");
  const [lang, setLang] = useState<Lang>("pt");

  const langLabel = useMemo<Uppercase<Lang>>(() => {
    const m: Record<Lang, Uppercase<Lang>> = { pt: "PT", en: "EN", es: "ES" };
    return m[lang];
  }, [lang]);

  return (
    <div style={shell}>
      <div style={layout}>
        <aside style={sidebar}>
          <div style={brand}>• Martins Rewards</div>

          <div style={menuTitle}>MENU</div>

          <button
            style={page === "crud" ? btnActive : btn}
            onClick={() => setPage("crud")}
          >
            Rewards (CRUD)
          </button>

          <button
            style={page === "approvals" ? btnActive : btn}
            onClick={() => setPage("approvals")}
          >
            Aprovações
          </button>

          <button
            style={page === "report" ? btnActive : btn}
            onClick={() => setPage("report")}
          >
            Relatório
          </button>

          {/* ✅ NOVO/EDITÁVEL: relatório de saldos */}
          <button
            style={page === "balances" ? btnActive : btn}
            onClick={() => setPage("balances")}
          >
            Saldos
          </button>

          <div style={{ height: 18 }} />

          <div style={menuTitle}>IDIOMA</div>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as Lang)}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              background: "#fff",
              color: "#111",
              border: "0",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            <option value="pt">PT</option>
            <option value="en">EN</option>
            <option value="es">ES</option>
          </select>

          <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
            Selecionado: {langLabel}
          </div>
        </aside>

        <main style={contentWrap}>
          <div style={topbar}>
            <button style={logoutBtn} onClick={() => signOut?.()}>
              Sair
            </button>
          </div>

          {page === "crud" && <RewardsCRUD lang={lang} />}
          {page === "approvals" && <RewardsApprovals lang={lang} />}
          {page === "report" && <RewardsReport lang={langLabel} />}

          {/* ✅ Aqui chama o componente EDITÁVEL */}
          {page === "balances" && <RewardsBalancesReport lang={langLabel} />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Authenticator>
      {({ signOut }) => <AppShell signOut={signOut} />}
    </Authenticator>
  );
}