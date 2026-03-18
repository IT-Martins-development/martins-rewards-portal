import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";
import "./index.css";

import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

import RewardsCRUD from "./RewardsCrud";
import RewardsApprovals from "./RewardsApprovals";
import RewardsReport from "./RewardsReport";
import RewardsBalancesReport from "./RewardsBalancesReport";
import RewardsUser from "./RewardsUser";
import ProjectControl from "./ProjectControl";
import ProjectTimelineByPhase from "./ProjectTimelineByPhase";

import type { Lang } from "./types/lang";
export type { Lang } from "./types/lang";

type Role = "ADMIN" | "INVESTOR" | "NONE";

type Page =
  | "crud"
  | "approvals"
  | "report"
  | "balances"
  | "projects"
  | "timeline"
  | "invoices"
  | "management-hold"
  | "future-approvals";

type MenuGroupKey =
  | "rewards-admin"
  | "project-management-master"
  | "finance"
  | "approvals";

const shell: React.CSSProperties = {
  minHeight: "100vh",
  background: "#F6F7F9",
  color: "#111827",
};

const brand: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 22,
  color: "#111827",
};

const menuTitle: React.CSSProperties = {
  color: "#6B7280",
  fontSize: 11,
  letterSpacing: 0.8,
  marginBottom: 10,
  fontWeight: 900,
};

const contentWrap: React.CSSProperties = {
  padding: 22,
  position: "relative",
  background: "#F6F7F9",
};

const topbar: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  alignItems: "center",
  marginBottom: 12,
  flexWrap: "wrap",
};

const logoutBtn: React.CSSProperties = {
  border: "0",
  borderRadius: 999,
  padding: "9px 16px",
  background: "#7A5A3A",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 800,
};

const selectLight: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(17,24,39,.12)",
  background: "#fff",
  color: "#111827",
  padding: "0 10px",
  fontWeight: 800,
  outline: "none",
};

const placeholderCard: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(17,24,39,.08)",
  borderRadius: 16,
  padding: 24,
  color: "#111827",
  boxShadow: "0 8px 30px rgba(15,23,42,.04)",
};

function normalizeGroups(groups?: string[]) {
  return (groups || []).map((g) => String(g).trim().toLowerCase());
}

function roleFromGroups(groups?: string[]): Role {
  const g = normalizeGroups(groups);
  const isAdmin = g.includes("adminrewards");
  const isInvestor = g.includes("investor");
  if (isAdmin) return "ADMIN";
  if (isInvestor) return "INVESTOR";
  return "NONE";
}

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div style={placeholderCard}>
      <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>{title}</div>
      <div style={{ color: "#6B7280", fontSize: 14 }}>{description}</div>
    </div>
  );
}

function MenuGroup({
  title,
  shortLabel,
  open,
  active,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  shortLabel: string;
  open: boolean;
  active: boolean;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const groupButtonBase: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    textAlign: "left",
    padding: collapsed ? "12px 8px" : "12px 14px",
    borderRadius: 12,
    border: "1px solid rgba(17,24,39,.08)",
    background: "#F9FAFB",
    color: "#111827",
    cursor: "pointer",
    marginBottom: 8,
    fontWeight: 800,
    transition: "all .2s ease",
  };

  const groupButtonActive: React.CSSProperties = {
    ...groupButtonBase,
    background: "#F3EFE8",
    border: "1px solid rgba(122,90,58,.22)",
  };

  const subMenuWrap: React.CSSProperties = {
    margin: "2px 0 12px 0",
    paddingLeft: 10,
  };

  return (
    <div>
      <button
        type="button"
        title={collapsed ? title : undefined}
        style={active || open ? groupButtonActive : groupButtonBase}
        onClick={onToggle}
      >
        <span>{collapsed ? shortLabel : title}</span>
        {!collapsed ? <span style={{ fontSize: 14 }}>{open ? "▾" : "▸"}</span> : null}
      </button>

      {open && !collapsed ? <div style={subMenuWrap}>{children}</div> : null}
    </div>
  );
}

function AppShell({ signOut }: { signOut?: () => void }) {
  const [page, setPage] = useState<Page>("crud");
  const [lang, setLang] = useState<Lang>("pt");
  const [role, setRole] = useState<Role>("NONE");
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  const [openGroups, setOpenGroups] = useState<Record<MenuGroupKey, boolean>>({
    "rewards-admin": true,
    "project-management-master": true,
    finance: false,
    approvals: false,
  });

  const layout: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: collapsed ? "88px 1fr" : "280px 1fr",
    transition: "grid-template-columns 0.25s ease",
    gap: 0,
    minHeight: "100vh",
  };

  const sidebar: React.CSSProperties = {
    background: "#FFFFFF",
    padding: collapsed ? "18px 10px" : "18px",
    borderRight: "1px solid rgba(17,24,39,.08)",
    boxShadow: "4px 0 24px rgba(15,23,42,.04)",
    transition: "all 0.25s ease",
  };

  const subBtnBase: React.CSSProperties = {
    width: "100%",
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid transparent",
    background: "transparent",
    color: "#374151",
    cursor: "pointer",
    marginBottom: 6,
    fontWeight: 700,
  };

  const subBtnActive: React.CSSProperties = {
    ...subBtnBase,
    background: "#7A5A3A",
    color: "#fff",
    border: "1px solid #7A5A3A",
  };

  const langLabel = useMemo<Uppercase<Lang>>(() => {
    const m: Record<Lang, Uppercase<Lang>> = { pt: "PT", en: "EN", es: "ES" };
    return m[lang];
  }, [lang]);

  const pageGroup: Record<Page, MenuGroupKey> = {
    crud: "rewards-admin",
    approvals: "rewards-admin",
    report: "rewards-admin",
    balances: "rewards-admin",
    projects: "project-management-master",
    timeline: "project-management-master",
    invoices: "finance",
    "management-hold": "finance",
    "future-approvals": "approvals",
  };

  function toggleGroup(group: MenuGroupKey) {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  }

  function openPage(nextPage: Page) {
    setPage(nextPage);
    const group = pageGroup[nextPage];
    setOpenGroups((prev) => ({ ...prev, [group]: true }));
  }

  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      setChecking(true);
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.idToken?.payload?.["cognito:groups"] as string[] | undefined) || [];
        const r = roleFromGroups(groups);
        if (!cancelled) setRole(r);
      } catch {
        if (!cancelled) setRole("NONE");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div style={{ minHeight: "100vh", background: "#F6F7F9", padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", color: "#111827", fontWeight: 800 }}>
          Carregando…
        </div>
      </div>
    );
  }

  if (role === "INVESTOR") {
    return (
      <div style={{ minHeight: "100vh", background: "#F6F7F9" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            padding: 14,
            maxWidth: 1200,
            margin: "0 auto",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111827" }}>Martins Development</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              style={selectLight}
              aria-label="Language"
            >
              <option value="pt">PT</option>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
            <button style={logoutBtn} onClick={() => signOut?.()}>
              Sair
            </button>
          </div>
        </div>
        <RewardsUser lang={langLabel} />
      </div>
    );
  }

  if (role === "NONE") {
    return (
      <div style={{ minHeight: "100vh", background: "#F6F7F9", padding: 24 }}>
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 12,
            padding: 18,
            color: "#111827",
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Acesso negado</div>
          <div style={{ opacity: 0.75, marginBottom: 14 }}>
            Seu usuário não tem permissão de acesso.
          </div>
          <button style={logoutBtn} onClick={() => signOut?.()}>
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={shell}>
      <div style={layout}>
        <aside style={sidebar}>
          <div
            style={{
              display: "flex",
              justifyContent: collapsed ? "center" : "space-between",
              alignItems: "center",
              marginBottom: 18,
              gap: 10,
            }}
          >
            {!collapsed ? <div style={brand}>• Martins Development</div> : null}

            <button
              type="button"
              title={collapsed ? "Expandir menu" : "Recolher menu"}
              onClick={() => setCollapsed((v) => !v)}
              style={{
                border: "1px solid rgba(17,24,39,.08)",
                background: "#F3EFE8",
                borderRadius: 10,
                padding: "7px 10px",
                cursor: "pointer",
                fontWeight: 900,
                color: "#7A5A3A",
              }}
            >
              {collapsed ? "☰" : "⟨"}
            </button>
          </div>

          {!collapsed ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
              <div
                style={{ color: "#6B7280", fontSize: 12, fontWeight: 900, letterSpacing: 0.6 }}
              >
                LANG
              </div>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                style={selectLight}
              >
                <option value="pt">PT</option>
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                style={{ ...selectLight, width: 56, padding: "0 4px", fontSize: 12 }}
                title="Idioma"
              >
                <option value="pt">PT</option>
                <option value="en">EN</option>
                <option value="es">ES</option>
              </select>
            </div>
          )}

          {!collapsed ? <div style={menuTitle}>MENU</div> : null}

          <MenuGroup
            title="Modulo Rewards ADMIN"
            shortLabel="R"
            open={openGroups["rewards-admin"]}
            active={pageGroup[page] === "rewards-admin"}
            collapsed={collapsed}
            onToggle={() => toggleGroup("rewards-admin")}
          >
            <button
              style={page === "crud" ? subBtnActive : subBtnBase}
              onClick={() => openPage("crud")}
            >
              Rewards (CRUD)
            </button>
            <button
              style={page === "approvals" ? subBtnActive : subBtnBase}
              onClick={() => openPage("approvals")}
            >
              Aprovações
            </button>
            <button
              style={page === "report" ? subBtnActive : subBtnBase}
              onClick={() => openPage("report")}
            >
              Relatório
            </button>
            <button
              style={page === "balances" ? subBtnActive : subBtnBase}
              onClick={() => openPage("balances")}
            >
              Saldos
            </button>
          </MenuGroup>

          <MenuGroup
            title="Project Management Master"
            shortLabel="P"
            open={openGroups["project-management-master"]}
            active={pageGroup[page] === "project-management-master"}
            collapsed={collapsed}
            onToggle={() => toggleGroup("project-management-master")}
          >
            <button
              style={page === "projects" ? subBtnActive : subBtnBase}
              onClick={() => openPage("projects")}
            >
              Projetos
            </button>
            <button
              style={page === "timeline" ? subBtnActive : subBtnBase}
              onClick={() => openPage("timeline")}
            >
              Timeline by Phase
            </button>
          </MenuGroup>

          <MenuGroup
            title="Finance"
            shortLabel="F"
            open={openGroups.finance}
            active={pageGroup[page] === "finance"}
            collapsed={collapsed}
            onToggle={() => toggleGroup("finance")}
          >
            <button
              style={page === "invoices" ? subBtnActive : subBtnBase}
              onClick={() => openPage("invoices")}
            >
              Invoices
            </button>
            <button
              style={page === "management-hold" ? subBtnActive : subBtnBase}
              onClick={() => openPage("management-hold")}
            >
              Management Hold
            </button>
          </MenuGroup>

          <MenuGroup
            title="Approvals"
            shortLabel="A"
            open={openGroups.approvals}
            active={pageGroup[page] === "approvals"}
            collapsed={collapsed}
            onToggle={() => toggleGroup("approvals")}
          >
            <button
              style={page === "future-approvals" ? subBtnActive : subBtnBase}
              onClick={() => openPage("future-approvals")}
            >
              Aprovações Futuras
            </button>
          </MenuGroup>
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
          {page === "balances" && <RewardsBalancesReport lang={langLabel} />}
          {page === "projects" && <ProjectControl />}
          {page === "timeline" && <ProjectTimelineByPhase />}

          {page === "invoices" && (
            <PlaceholderPage
              title="Invoices"
              description="Área reservada para o módulo de invoices."
            />
          )}

          {page === "management-hold" && (
            <PlaceholderPage
              title="Management Hold"
              description="Área reservada para o módulo de management hold."
            />
          )}

          {page === "future-approvals" && (
            <PlaceholderPage
              title="Approvals"
              description="Área reservada para futuros módulos de aprovação."
            />
          )}
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