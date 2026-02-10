import React, { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";
import type { Lang } from "./types/lang";


const client = generateClient();

/* =======================
   GraphQL
======================= */

const LIST_REDEMPTIONS = /* GraphQL */ `
  query MongoRewardRedemptionsList($status: String!, $limit: Int) {
    mongoRewardRedemptionsList(status: $status, limit: $limit) {
      items {
        id
        userId
        userName
        rewardCode
        pointsCost
        status
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

const UPDATE_STATUS = /* GraphQL */ `
  mutation MongoRewardRedemptionUpdateStatus($id: ID!, $status: String!) {
    mongoRewardRedemptionUpdateStatus(id: $id, status: $status) {
      id
      status
      updatedAt
    }
  }
`;

/* =======================
   Types
======================= */

type Redemption = {
  id: string;
  userId: string | null;
  userName?: string | null;
  rewardCode: string;
  pointsCost: number;
  status: string;
  createdAt: string | null;
  updatedAt?: string | null;
};

type RewardsApprovalsProps = {
  lang: Lang;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function uiStatusLabel(statusRaw: string) {
  const s = String(statusRaw || "").toUpperCase();
  if (s === "PENDING" || s === "REQUESTED") return "SOLICITADO";
  if (s === "APPROVED") return "APROVADO";
  if (s === "REJECTED") return "REJEITADO";
  if (s === "FULFILLED") return "ENTREGUE";
  return s || "-";
}

function badgeStyle(statusRaw: string): React.CSSProperties {
  const s = String(statusRaw || "").toUpperCase();
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.3,
    border: "1px solid rgba(0,0,0,0.08)",
  };
  if (s === "PENDING" || s === "REQUESTED") {
    return { ...base, background: "#efefef", color: "#444" };
  }
  if (s === "APPROVED") {
    return { ...base, background: "#e8f5e9", color: "#1b5e20" };
  }
  if (s === "REJECTED") {
    return { ...base, background: "#ffebee", color: "#b71c1c" };
  }
  return { ...base, background: "#f5f5f5", color: "#333" };
}

/* =======================
   Component
======================= */

export default function RewardsApprovals({ lang: _lang }: RewardsApprovalsProps) {
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = useMemo(() => items.length, [items]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res: any = await client.graphql({
        query: LIST_REDEMPTIONS,
        variables: { status: "REQUESTED", limit: 500 },
      });

      // ✅ trata erro real
      if (res?.errors?.length) {
        throw new Error(res.errors[0]?.message || "Erro GraphQL");
      }

      const list = res?.data?.mongoRewardRedemptionsList;
      const arr: Redemption[] = Array.isArray(list?.items) ? list.items : [];

      // ✅ lista vazia NÃO é erro
      setItems(arr);
    } catch (err: any) {
      console.error("Erro ao carregar aprovações:", err);
      setError(err?.message || "Erro inesperado");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function update(id: string, status: "APPROVED" | "REJECTED", meta: { rewardCode: string; pointsCost: number }) {
    const ok = window.confirm(
      `Confirmar ${status === "APPROVED" ? "APROVAÇÃO" : "REJEIÇÃO"}?\n\nReward: ${meta.rewardCode}\nPontos: ${meta.pointsCost}`
    );
    if (!ok) return;

    try {
      const res: any = await client.graphql({
        query: UPDATE_STATUS,
        variables: { id, status },
      });

      if (res?.errors?.length) {
        throw new Error(res.errors[0]?.message || "Erro ao atualizar status");
      }

      await load();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Erro ao atualizar status");
    }
  }

  // ====== Styles (mantém o layout “igual” ao seu) ======
  const card: React.CSSProperties = {
    background: "#f6f6f6",
    borderRadius: 14,
    padding: "14px 14px 10px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.06)",
  };

  const tableWrap: React.CSSProperties = {
    background: "#ffffff",
    borderRadius: 12,
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.08)",
  };

  const th: React.CSSProperties = {
    textAlign: "left",
    fontSize: 12,
    fontWeight: 800,
    color: "#111", // ✅ garante legibilidade (evita “tela branca”)
    padding: "10px 12px",
    background: "#f2f2f2",
  };

  const td: React.CSSProperties = {
    fontSize: 12,
    color: "#111", // ✅ garante legibilidade
    padding: "12px 12px",
    borderTop: "1px solid #eee",
    verticalAlign: "middle",
  };

  const btnApprove: React.CSSProperties = {
    background: "#111",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    fontWeight: 800,
    cursor: "pointer",
    marginRight: 8,
  };

  const btnReject: React.CSSProperties = {
    background: "#a53a2a",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "8px 14px",
    fontWeight: 800,
    cursor: "pointer",
  };

  const btnReload: React.CSSProperties = {
    background: "#fff",
    color: "#111",
    border: "none",
    borderRadius: 999,
    padding: "10px 18px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
  };

  return (
    <div style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 2 }}>
            Aprovações de Resgate
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            Pendentes: {pendingCount} · Total carregado: {items.length}
          </div>
        </div>
        <button onClick={load} style={btnReload} disabled={loading}>
          Recarregar
        </button>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(165,58,42,0.25)",
            border: "1px solid rgba(165,58,42,0.7)",
            color: "#ffd6cf",
            borderRadius: 10,
            padding: "10px 12px",
            marginBottom: 12,
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          Erro ao carregar aprovações: {error}
        </div>
      )}

      <div style={card}>
        <div style={tableWrap}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Data</th>
                <th style={th}>Reward ID</th>
                <th style={th}>Pontos</th>
                <th style={th}>Usuário</th>
                <th style={th}>Status</th>
                <th style={th}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && (
                <tr>
                  <td style={td} colSpan={6}>
                    Nenhum resgate pendente (REQUESTED).
                  </td>
                </tr>
              )}

              {items.map((r) => {
                const userLabel =
                  (r.userName && r.userName.trim() !== "" ? r.userName : null) ||
                  (r.userId ?? "-");

                return (
                  <tr key={r.id}>
                    <td style={td}>{formatDate(r.createdAt)}</td>
                    <td style={td}>{r.rewardCode || "-"}</td>
                    <td style={td}>{typeof r.pointsCost === "number" ? r.pointsCost : 0}</td>
                    <td style={td}>{userLabel}</td>
                    <td style={td}>
                      <span style={badgeStyle(r.status)}>{uiStatusLabel(r.status)}</span>
                    </td>
                    <td style={td}>
                      <button
                        style={btnApprove}
                        onClick={() => update(r.id, "APPROVED", { rewardCode: r.rewardCode, pointsCost: r.pointsCost })}
                      >
                        Aprovar
                      </button>
                      <button
                        style={btnReject}
                        onClick={() => update(r.id, "REJECTED", { rewardCode: r.rewardCode, pointsCost: r.pointsCost })}
                      >
                        Rejeitar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {loading && (
          <div style={{ padding: "10px 4px", fontSize: 12, fontWeight: 800, color: "#333" }}>
            Carregando...
          </div>
        )}
      </div>
    </div>
  );
}