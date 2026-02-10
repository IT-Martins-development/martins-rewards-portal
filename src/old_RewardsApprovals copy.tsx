import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./lib/amplifyClient";
import type { Lang } from "./lib/i18n";

// UI statuses (mantém a tela exatamente como está)
type RedemptionStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELED";

// Status na collection rewards_redemptions (Mongo)
type MongoRedemptionStatus = "PENDING" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELED";

type Redemption = {
  id: string;
  userId?: string | null;
  // na UI este campo aparece como "Reward ID" (a gente pode preencher com rewardCode do Mongo)
  rewardId: string;
  // na UI este campo aparece como "Pontos" (a gente preenche com pointsCost do Mongo)
  pointsSpent: number;
  status: RedemptionStatus;
  createdAt?: string | null;
};

type Props = {
  lang: Lang;
  pageStyle?: React.CSSProperties;

};

// ✅ NOVO: pega da collection rewards_redemptions (Mongo) via Lambda (pipeline resolver)
const LIST_REDEMPTIONS = /* GraphQL */ `
  query MongoRewardRedemptionsList($status: String, $limit: Int, $nextToken: String) {
    mongoRewardRedemptionsList(status: $status, limit: $limit, nextToken: $nextToken) {
      items {
        id
        userId
        rewardCode
        pointsCost
        status
        createdAt
      }
      nextToken
    }
  }
`;

// ✅ NOVO: atualiza status no Mongo
const UPDATE_REDEMPTION = /* GraphQL */ `
  mutation MongoRewardRedemptionUpdateStatus($id: ID!, $status: String!) {
    mongoRewardRedemptionUpdateStatus(id: $id, status: $status)
  }
`;

function mongoToUiStatus(s: MongoRedemptionStatus | string): RedemptionStatus {
  // Mongo usa PENDING; a UI usa REQUESTED
  if (s === "PENDING") return "REQUESTED";
  if (s === "APPROVED") return "APPROVED";
  if (s === "REJECTED") return "REJECTED";
  if (s === "FULFILLED") return "FULFILLED";
  if (s === "CANCELED") return "CANCELED";
  // fallback seguro
  return "REQUESTED";
}

function fmtDateTime(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function pickErr(e: any) {
  return (
    e?.errors?.[0]?.message ||
    e?.message ||
    (typeof e === "string" ? e : JSON.stringify(e, null, 2))
  );
}

function statusBadgeStyle(status: RedemptionStatus) {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  };

  switch (status) {
    case "REQUESTED":
      return { ...base, background: "#F3F4F6", color: "#374151" };
    case "APPROVED":
      return { ...base, background: "#DCFCE7", color: "#166534" };
    case "REJECTED":
      return { ...base, background: "#FEE2E2", color: "#7F1D1D" };
    case "FULFILLED":
      return { ...base, background: "#DBEAFE", color: "#1E3A8A" };
    case "CANCELED":
      return { ...base, background: "#E5E7EB", color: "#111827" };
    default:
      return base;
  }
}

export default function RewardsApprovals({ lang, pageStyle }: Props) {
  const t = useMemo(() => {
    const dict = {
      pt: {
        title: "Aprovações de Resgate",
        pending: "Pendentes",
        totalLoaded: "Total carregado",
        reload: "Recarregar",
        loading: "Carregando...",
        noPending: "Nenhum resgate pendente (REQUESTED).",
        date: "Data",
        rewardId: "Reward ID",
        points: "Pontos",
        userSub: "Usuário (sub)",
        status: "Status",
        actions: "Ações",
        approve: "Aprovar",
        reject: "Rejeitar",
        approving: "...",
        confirmApprove: (r: Redemption) =>
          `Aprovar este resgate?\n\nReward: ${r.rewardId}\nPontos: ${r.pointsSpent}`,
        confirmReject: (r: Redemption) =>
          `Rejeitar este resgate?\n\nReward: ${r.rewardId}\nPontos: ${r.pointsSpent}`,
        st: {
          REQUESTED: "Solicitado",
          APPROVED: "Aprovado",
          REJECTED: "Rejeitado",
          FULFILLED: "Entregue",
          CANCELED: "Cancelado",
        } as Record<RedemptionStatus, string>,
      },
      en: {
        title: "Redemption Approvals",
        pending: "Pending",
        totalLoaded: "Loaded",
        reload: "Reload",
        loading: "Loading...",
        noPending: "No pending redemptions (REQUESTED).",
        date: "Date",
        rewardId: "Reward ID",
        points: "Points",
        userSub: "User (sub)",
        status: "Status",
        actions: "Actions",
        approve: "Approve",
        reject: "Reject",
        approving: "...",
        confirmApprove: (r: Redemption) =>
          `Approve this redemption?\n\nReward: ${r.rewardId}\nPoints: ${r.pointsSpent}`,
        confirmReject: (r: Redemption) =>
          `Reject this redemption?\n\nReward: ${r.rewardId}\nPoints: ${r.pointsSpent}`,
        st: {
          REQUESTED: "Requested",
          APPROVED: "Approved",
          REJECTED: "Rejected",
          FULFILLED: "Fulfilled",
          CANCELED: "Canceled",
        } as Record<RedemptionStatus, string>,
      },
      es: {
        title: "Aprobaciones de Canje",
        pending: "Pendientes",
        totalLoaded: "Cargados",
        reload: "Recargar",
        loading: "Cargando...",
        noPending: "No hay canjes pendientes (REQUESTED).",
        date: "Fecha",
        rewardId: "ID de Reward",
        points: "Puntos",
        userSub: "Usuario (sub)",
        status: "Estado",
        actions: "Acciones",
        approve: "Aprobar",
        reject: "Rechazar",
        approving: "...",
        confirmApprove: (r: Redemption) =>
          `¿Aprobar este canje?\n\nReward: ${r.rewardId}\nPuntos: ${r.pointsSpent}`,
        confirmReject: (r: Redemption) =>
          `¿Rechazar este canje?\n\nReward: ${r.rewardId}\nPuntos: ${r.pointsSpent}`,
        st: {
          REQUESTED: "Solicitado",
          APPROVED: "Aprobado",
          REJECTED: "Rechazado",
          FULFILLED: "Entregado",
          CANCELED: "Cancelado",
        } as Record<RedemptionStatus, string>,
      },
    } as const;

    return dict[lang] ?? dict.pt;
  }, [lang]);




  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 720);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const stats = useMemo(() => {
    const requested = items.filter((i) => i.status === "REQUESTED").length;
    return { requested, total: items.length };
  }, [items]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res: any = await gqlClient.graphql({
        query: LIST_REDEMPTIONS,
        variables: {
          // pendentes no Mongo
          status: "PENDING",
          limit: 500,
          nextToken: null,
        },
      });

      // normaliza para o formato que a UI já espera (sem mudar layout)
      const raw: any[] = res?.data?.mongoRewardRedemptionsList?.items ?? [];
      const list: Redemption[] = (raw || [])
        .filter(Boolean)
        .map((r: any) => ({
          id: String(r.id),
          userId: r.userId ?? null,
          rewardId: String(r.rewardCode ?? r.rewardId ?? "-"),
          pointsSpent: Number(r.pointsCost ?? r.pointsSpent ?? 0),
          status: mongoToUiStatus(r.status),
          createdAt: r.createdAt ?? null,
        }));

      setItems(list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")));
    } catch (e: any) {
      setError(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(row: Redemption, nextStatus: "APPROVED" | "REJECTED") {
    const ok =
      nextStatus === "APPROVED" ? confirm(t.confirmApprove(row)) : confirm(t.confirmReject(row));
    if (!ok) return;

    setBusyId(row.id);
    setError("");
    try {
      await gqlClient.graphql({
        query: UPDATE_REDEMPTION,
        variables: { id: row.id, status: nextStatus },
      });

      // remove da fila REQUESTED
      setItems((prev) => prev.filter((x) => x.id !== row.id));
    } catch (e: any) {
      setError(pickErr(e));
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#F6F7F9",
      borderRadius: 14,
      padding: isMobile ? 12 : 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    headerRow: {
      display: "flex",
      alignItems: isMobile ? "flex-start" : "center",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 12,
      flexDirection: isMobile ? "column" : "row",
    },
    title: { margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" },
    subtle: { color: "rgba(17,24,39,0.65)", fontSize: 13 },
    topBtn: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 999,
      cursor: "pointer",
      fontWeight: 800,
      width: isMobile ? "100%" : "auto",
      maxWidth: isMobile ? 240 : undefined,
      alignSelf: isMobile ? "flex-end" : undefined,
    },
    error: {
      background: "#FFECEC",
      color: "#7F1D1D",
      border: "1px solid rgba(127,29,29,0.25)",
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
      whiteSpace: "pre-wrap",
    },
    tableWrap: {
      background: "white",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.08)",
      overflowX: "auto",
      width: "100%",
    },
    table: { width: "100%", borderCollapse: "collapse", minWidth: 780 },
    th: {
      textAlign: "left",
      fontSize: 12,
      letterSpacing: 0.2,
      color: "rgba(17,24,39,0.7)",
      padding: "12px 12px",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      background: "#FBFBFC",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "12px 12px",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      fontSize: 13,
      color: "#111827",
      verticalAlign: "middle",
    },
    actionsWrap: {
      display: "flex",
      gap: 8,
      flexDirection: isMobile ? "column" : "row",
      alignItems: "stretch",
    },
    approveBtn: {
      background: "#111827",
      color: "white",
      border: "1px solid #111827",
      borderRadius: 10,
      padding: "8px 10px",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      minWidth: 92,
    },
    rejectBtn: {
      background: "#DC2626",
      color: "white",
      border: "1px solid #DC2626",
      borderRadius: 10,
      padding: "8px 10px",
      cursor: "pointer",
      fontWeight: 900,
      fontSize: 12,
      minWidth: 92,
    },
  };

  return (
    <div style={S.page}>
      <div style={S.headerRow}>
        <div>
          <h2 style={S.title}>{t.title}</h2>
          <div style={S.subtle}>
            {t.pending}: <b>{stats.requested}</b> • {t.totalLoaded}: <b>{stats.total}</b>
          </div>
        </div>

        <button onClick={load} style={S.topBtn}>
          {loading ? t.loading : t.reload}
        </button>
      </div>

      {error && <div style={S.error}>{error}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>{t.date}</th>
              <th style={S.th}>{t.rewardId}</th>
              <th style={S.th}>{t.points}</th>
              <th style={S.th}>{t.userSub}</th>
              <th style={S.th}>{t.status}</th>
              <th style={S.th}>{t.actions}</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td style={S.td} colSpan={6}>
                  {loading ? t.loading : t.noPending}
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr key={r.id}>
                  <td style={S.td}>{fmtDateTime(r.createdAt)}</td>
                  <td style={S.td}>{r.rewardId}</td>
                  <td style={S.td}>{r.pointsSpent}</td>
                  <td style={S.td}>{r.userId ?? "-"}</td>
                  <td style={S.td}>
                    <span style={statusBadgeStyle(r.status)}>
                      {t.st[r.status] ?? r.status}
                    </span>
                  </td>
                  <td style={S.td}>
                    <div style={S.actionsWrap}>
                      <button
                        onClick={() => setStatus(r, "APPROVED")}
                        style={S.approveBtn}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? t.approving : t.approve}
                      </button>

                      <button
                        onClick={() => setStatus(r, "REJECTED")}
                        style={S.rejectBtn}
                        disabled={busyId === r.id}
                      >
                        {busyId === r.id ? t.approving : t.reject}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}