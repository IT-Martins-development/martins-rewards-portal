import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./lib/amplifyClient";


type RedemptionStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "FULFILLED" | "CANCELED";
type UserType = "CLIENT" | "BROKER" | "BOTH";


// Removed unused L useMemo block to resolve 'lang' not defined and type errors.

type Redemption = {
  id: string;
  userId?: string | null;
  rewardId: string;
  pointsSpent: number;
  status: RedemptionStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
 
  // placeholders (virão do Mongo depois)
  rewardName?: string | null;
  deliveryType?: string | null;

  userName?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  userType?: "CLIENT" | "BROKER" | null;
};

type Props = {
  lang?: "PT" | "EN" | "ES";
  pageStyle?: React.CSSProperties;
};

const LIST_REDEMPTIONS = /* GraphQL */ `
  query MongoRewardsLedgerReport(
    $from: AWSDateTime
    $to: AWSDateTime
    $statuses: [String]
    $limit: Int
    $nextToken: String
    $lang: String
  ) {
    mongoRewardsLedgerReport(
      from: $from
      to: $to
      statuses: $statuses
      limit: $limit
      nextToken: $nextToken
      lang: $lang
    ) {
      items {
        id
        userId
        rewardId
        pointsSpent
        status
        createdAt
        updatedAt
        rewardName
        deliveryType
        userName
        userEmail
        userPhone
        userType
      }
      nextToken
    }
  }
`;

function pickErr(e: any) {
  return (
    e?.errors?.[0]?.message ||
    e?.message ||
    (typeof e === "string" ? e : JSON.stringify(e, null, 2))
  );
}

function fmtDateTime(s?: string | null) {
  if (!s) return "-";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString();
}

function isoDateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Garantir que o value do input date seja sempre YYYY-MM-DD.
 * Se vier "12/29/2025" ou "12-29-2025", tenta normalizar.
 */
function ensureYmd(v: string) {
  if (!v) return v;

  // já está YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // tenta MM/DD/YYYY ou M/D/YYYY
  const m1 = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) {
    const mm = String(Number(m1[1])).padStart(2, "0");
    const dd = String(Number(m1[2])).padStart(2, "0");
    const yyyy = m1[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // tenta MM-DD-YYYY
  const m2 = v.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) {
    const mm = String(Number(m2[1])).padStart(2, "0");
    const dd = String(Number(m2[2])).padStart(2, "0");
    const yyyy = m2[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // fallback: tenta Date parse
  const d = new Date(v);
  if (!Number.isNaN(d.getTime())) return isoDateOnly(d);

  return v; // deixa como está (melhor do que quebrar)
}

function tryShowPicker(el: HTMLInputElement) {
  // Safari/Chrome suportam showPicker em alguns cenários
  // @ts-ignore
  if (typeof el.showPicker === "function") {
    try {
      // @ts-ignore
      el.showPicker();
    } catch {
      // ignore
    }
  }
}

function statusBadgeStyle(status: RedemptionStatus): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };

  switch (status) {
    case "APPROVED":
      return { ...base, background: "#DCFCE7", color: "#166534" };
    case "REJECTED":
      return { ...base, background: "#FEE2E2", color: "#7F1D1D" };
    case "FULFILLED":
      return { ...base, background: "#DBEAFE", color: "#1E3A8A" };
    case "CANCELED":
      return { ...base, background: "#E5E7EB", color: "#111827" };
    default:
      return { ...base, background: "#F3F4F6", color: "#374151" };
  }
}

function csvEscape(v: any) {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function useIsNarrow(breakpoint = 820) {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);

  return isNarrow;
}

export default function RewardsReport({ lang }: { lang?: "PT" | "EN" | "ES" }) {
  const isNarrow = useIsNarrow(820);
  const safeLang = (lang === "PT" || lang === "EN" || lang === "ES") ? lang : "EN";
  const L = useMemo(() => {
    const dict = {
      PT: {
        title: "Relatório",
        apply: "Aplicar",
        clear: "Limpar filtros",
        export: "Exportar CSV",
        from: "De",
        to: "Até",
        status: "Status",
        userName: "Nome do usuário",
        userType: "Tipo de usuário",
        userTypeAll: "Todos",
        userTypeClient: "Cliente",
        userTypeBroker: "Corretor",
        statusBoth: "Aprovado + Rejeitado",
        statusApproved: "Aprovado",
        statusRejected: "Rejeitado",
        statsApproved: "Aprovados",
        statsRejected: "Rejeitados",
        statsTotal: "Total",
        statsPoints: "Pontos (somatório)",
        empty: "Nenhum registro no período/filtro.",
        loading: "Carregando...",
        rowsPerPage: "Registros por página",
        prev: "Anterior",
        next: "Próximo",
        page: "Página",
        of: "de",
        cDate: "Data",
        cRewardName: "Nome do reward",
        cDelivery: "Tipo entrega",
        cRewardId: "Reward ID",
        cPoints: "Pontos",
        cUserName: "Nome",
        cUserEmail: "Email",
        cUserPhone: "Telefone",
        cUserSub: "Usuário (sub)",
        cUserType: "Tipo usuário",
        cStatus: "Status",
        namePlaceholder: "Buscar por nome",
      },
      EN: {
        title: "Report",
        apply: "Apply",
        clear: "Clear filters",
        export: "Export CSV",
        from: "From",
        to: "To",
        status: "Status",
        userName: "User name",
        userType: "User type",
        userTypeAll: "All",
        userTypeClient: "Client",
        userTypeBroker: "Broker",
        statusBoth: "Approved + Rejected",
        statusApproved: "Approved",
        statusRejected: "Rejected",
        statsApproved: "APPROVED",
        statsRejected: "REJECTED",
        statsTotal: "Total",
        statsPoints: "Points (sum)",
        empty: "No records for the selected period/filter.",
        loading: "Loading...",
        rowsPerPage: "Rows per page",
        prev: "Prev",
        next: "Next",
        page: "Page",
        of: "of",
        cDate: "Date",
        cRewardName: "Reward name",
        cDelivery: "Delivery type",
        cRewardId: "Reward ID",
        cPoints: "Points",
        cUserName: "Name",
        cUserEmail: "Email",
        cUserPhone: "Phone",
        cUserSub: "User (sub)",
        cUserType: "User type",
        cStatus: "Status",
        namePlaceholder: "Search by name",
      },
      ES: {
        title: "Informe",
        apply: "Aplicar",
        clear: "Limpiar filtros",
        export: "Exportar CSV",
        from: "Desde",
        to: "Hasta",
        status: "Estado",
        userName: "Nombre del usuario",
        userType: "Tipo de usuario",
        userTypeAll: "Todos",
        userTypeClient: "Cliente",
        userTypeBroker: "Corredor",
        statusBoth: "Aprobado + Rechazado",
        statusApproved: "Aprobado",
        statusRejected: "Rechazado",
        statsApproved: "APROBADOS",
        statsRejected: "RECHAZADOS",
        statsTotal: "Total",
        statsPoints: "Puntos (suma)",
        empty: "No hay registros para el período/filtro.",
        loading: "Cargando...",
        rowsPerPage: "Registros por página",
        prev: "Anterior",
        next: "Siguiente",
        page: "Página",
        of: "de",
        cDate: "Fecha",
        cRewardName: "Nombre del reward",
        cDelivery: "Tipo de entrega",
        cRewardId: "Reward ID",
        cPoints: "Puntos",
        cUserName: "Nombre",
        cUserEmail: "Email",
        cUserPhone: "Teléfono",
        cUserSub: "Usuario (sub)",
        cUserType: "Tipo usuario",
        cStatus: "Estado",
        namePlaceholder: "Buscar por nombre",
      },
    } as const;

    return dict[safeLang];
  }, [safeLang]);

  const today = useMemo(() => new Date(), []);
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return isoDateOnly(d);
  }, []);
  const defaultTo = useMemo(() => isoDateOnly(today), [today]);

  // filtros (sempre YYYY-MM-DD!)
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);
  const [status, setStatus] = useState<"APPROVED" | "REJECTED" | "BOTH">("BOTH");
  const [userName, setUserName] = useState<string>("");
  const [userType, setUserType] = useState<UserType>("BOTH");

  // data
  const [items, setItems] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // paginação
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

function clearFilters() {
  const f = defaultFrom;
  const t = defaultTo;

  setFromDate(f);
  setToDate(t);
  setStatus("BOTH");
  setUserName("");
  setUserType("BOTH");
  setPage(1);

  // recarrega usando os valores default (sem depender do setState assíncrono)
  void loadWithParams({
    fromDate: f,
    toDate: t,
    status: "BOTH",
  });
}

async function loadWithParams(p: { fromDate: string; toDate: string; status: "APPROVED" | "REJECTED" | "BOTH" }) {
  setLoading(true);
  setError("");

  try {
    const f = ensureYmd(p.fromDate);
    const t = ensureYmd(p.toDate);

    const fromIso = `${f}T00:00:00.000Z`;
    const toIso = `${t}T23:59:59.999Z`;

    const statuses = p.status === "BOTH" ? ["APPROVED", "REJECTED"] : [p.status];

    let nextToken: string | null | undefined = null;
    const all: Redemption[] = [];
    const PAGE_SIZE = 200;
    const MAX_ITEMS = 2000;

    do {
      const res: any = await gqlClient.graphql({
        query: LIST_REDEMPTIONS,
        variables: {
          from: fromIso,
          to: toIso,
          statuses,
          limit: PAGE_SIZE,
          nextToken,
          lang: safeLang,
        },
      });

      if (res?.errors?.length) throw new Error(res.errors[0]?.message || "Erro GraphQL");

      const block = res?.data?.mongoRewardsLedgerReport;
      const list: Redemption[] = block?.items ?? [];
      all.push(...list.filter(Boolean));
      nextToken = block?.nextToken ?? null;
    } while (nextToken && all.length < MAX_ITEMS);

    const cleaned = all.sort((a, b) =>
      (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
    );

    setItems(cleaned);
    setPage(1);
  } catch (e: any) {
    setError(pickErr(e));
    setItems([]);
  } finally {
    setLoading(false);
  }
}

async function load() {
  setLoading(true);
  setError("");

  try {
    // garante YYYY-MM-DD (por segurança)
    const f = ensureYmd(fromDate);
    const t = ensureYmd(toDate);

    const fromIso = `${f}T00:00:00.000Z`;
    const toIso = `${t}T23:59:59.999Z`;

    // status -> array para o resolver Mongo
    const statuses =
      status === "BOTH" ? ["APPROVED", "REJECTED"] : [status];

    let nextToken: string | null | undefined = null;
    const all: Redemption[] = [];
    const PAGE_SIZE = 200;
    const MAX_ITEMS = 2000; // evita loop infinito

    do {
      const res: any = await gqlClient.graphql({
        query: LIST_REDEMPTIONS,
        variables: {
          from: fromIso,
          to: toIso,
          statuses,
          limit: PAGE_SIZE,
          nextToken,
          lang: safeLang, // usa o idioma atual (PT/EN/ES)
        },
      });

      // se vier erro GraphQL, explode com msg real
      if (res?.errors?.length) {
        throw new Error(res.errors[0]?.message || "Erro GraphQL");
      }

      const block = res?.data?.mongoRewardsLedgerReport;
      const list: Redemption[] = block?.items ?? [];

      all.push(...list.filter(Boolean));
      nextToken = block?.nextToken ?? null;
    } while (nextToken && all.length < MAX_ITEMS);

    // ordena por createdAt (ou updatedAt se existir)
    const cleaned = all.sort((a, b) =>
      (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "")
    );

    setItems(cleaned);
    setPage(1); // opcional: volta para página 1 ao aplicar filtros
  } catch (e: any) {
    setError(pickErr(e));
    setItems([]);
  } finally {
    setLoading(false);
  }
}
  // filtros locais (porque ainda não vem do AppSync)
  const filtered = useMemo(() => {
    const q = userName.trim().toLowerCase();

    return items.filter((r) => {
      const okName =
        !q ||
        (r.userName || "").toLowerCase().includes(q) ||
        (r.userEmail || "").toLowerCase().includes(q) ||
        (r.userPhone || "").toLowerCase().includes(q);

      const okType =
        userType === "BOTH" ||
        (userType === "CLIENT" && r.userType === "CLIENT") ||
        (userType === "BROKER" && r.userType === "BROKER");

      return okName && okType;
    });
  }, [items, userName, userType]);

  const stats = useMemo(() => {
    const approved = filtered.filter((i) => i.status === "APPROVED").length;
    const rejected = filtered.filter((i) => i.status === "REJECTED").length;
    const totalPts = filtered.reduce((acc, i) => acc + (i.pointsSpent || 0), 0);
    return { approved, rejected, total: filtered.length, totalPts };
  }, [filtered]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize))), [
    filtered.length,
    pageSize,
  ]);

  const pageItems = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  function exportCsv() {
    const headers = [
      L.cDate,
      L.cRewardName,
      L.cDelivery,
      L.cRewardId,
      L.cPoints,
      L.cUserName,
      L.cUserEmail,
      L.cUserPhone,
      L.cUserSub,
      L.cUserType,
      L.cStatus,
    ];

    const rows = filtered.map((r) => [
      fmtDateTime(r.createdAt),
      r.rewardName ?? "",
      r.deliveryType ?? "",
      r.rewardId ?? "",
      r.pointsSpent ?? "",
      r.userName ?? "",
      r.userEmail ?? "",
      r.userPhone ?? "",
      r.userId ?? "",
      r.userType ?? "",
      r.status ?? "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    const filename = `rewards-report_${fromDate}_to_${toDate}_${status}.csv`;
    downloadTextFile(filename, csv);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#F6F7F9",
      borderRadius: 12,
      padding: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: 1200,
      margin: "0 auto",
    },
    headerRow: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 12,
      flexWrap: "wrap",
    },
    title: { margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" },
    subtle: { color: "rgba(17,24,39,0.65)", fontSize: 13, marginTop: 4 },

    btnRow: { display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" },
    btnPrimary: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 800,
      minWidth: 140,
      height: 42,
    },
    btnGhost: {
      background: "white",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.35)",
      padding: "10px 14px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 800,
      minWidth: 140,
      height: 42,
    },

    filterGrid: {
      display: "grid",
      gridTemplateColumns: isNarrow ? "repeat(1, minmax(0, 1fr))" : "repeat(6, minmax(0, 1fr))",
      gap: 12,
      marginBottom: 12,
    },
    labelWrap: { display: "flex", flexDirection: "column", gap: 6 },
    label: { fontSize: 12, color: "rgba(17,24,39,0.75)", fontWeight: 800 },
        input: {
        width: "100%",
        height: 42,
        padding: "0 12px",
        borderRadius: 12,
        border: "1px solid rgba(0,0,0,0.14)",
        outline: "none",
        backgroundColor: "white",
        color: "#111827",
        fontSize: 14,
        lineHeight: "42px",

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

    tableWrap: { background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflowX: "auto" },
    table: { width: "100%", borderCollapse: "collapse", minWidth: 1050 },
    th: {
      textAlign: "left",
      fontSize: 12,
      letterSpacing: 0.2,
      color: "rgba(17,24,39,0.7)",
      padding: "12px 12px",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      background: "#FBFBFC",
      whiteSpace: "nowrap",
      fontWeight: 900,
    },
    td: { padding: "12px 12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#111827" },
    mono: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" },

    footerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, gap: 10, flexWrap: "wrap" },
    pager: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
    pagerBtn: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 800,
      height: 42,
      minWidth: 110,
    },
    pagerBtnDisabled: { opacity: 0.5, cursor: "not-allowed" },
    pageInfo: { fontSize: 13, color: "rgba(17,24,39,0.75)", fontWeight: 800 },
  };

  return (
    <div style={S.page}>
      <div style={S.headerRow}>
        <div>
          <h2 style={S.title}>{L.title}</h2>
          <div style={S.subtle}>
            {L.statsApproved}: <b>{stats.approved}</b> • {L.statsRejected}: <b>{stats.rejected}</b> •{" "}
            {L.statsTotal}: <b>{stats.total}</b> • {L.statsPoints}: <b>{stats.totalPts}</b>
          </div>
        </div>

        <div style={S.btnRow}>
          <button onClick={exportCsv} style={S.btnGhost} disabled={loading || filtered.length === 0}>
            {L.export}
          </button>
          <button onClick={clearFilters} style={S.btnGhost} disabled={loading}>
            {L.clear}
          </button>
          <button onClick={load} style={S.btnPrimary} disabled={loading}>
            {loading ? L.loading : L.apply}
          </button>
        </div>
      </div>

      <div style={S.filterGrid}>
        <label style={S.labelWrap}>
          <div style={S.label}>{L.from}</div>
          <input
            type="date"
            value={ensureYmd(fromDate)}
            max={ensureYmd(toDate)}
            onChange={(e) => setFromDate(ensureYmd(e.target.value))}
            onClick={(e) => tryShowPicker(e.currentTarget)}
            onFocus={(e) => tryShowPicker(e.currentTarget)}
            style={S.input}
          />
        </label>

        <label style={S.labelWrap}>
          <div style={S.label}>{L.to}</div>
          <input
            type="date"
            value={ensureYmd(toDate)}
            min={ensureYmd(fromDate)}
            onChange={(e) => setToDate(ensureYmd(e.target.value))}
            onClick={(e) => tryShowPicker(e.currentTarget)}
            onFocus={(e) => tryShowPicker(e.currentTarget)}
            style={S.input}
          />
        </label>

        <label style={S.labelWrap}>
          <div style={S.label}>{L.status}</div>
          <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={S.input}>
            <option value="BOTH">{L.statusBoth}</option>
            <option value="APPROVED">{L.statusApproved}</option>
            <option value="REJECTED">{L.statusRejected}</option>
          </select>
        </label>

        <label style={S.labelWrap}>
          <div style={S.label}>{L.userName}</div>
          <input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder={L.namePlaceholder} style={S.input} />
        </label>

        <label style={S.labelWrap}>
          <div style={S.label}>{L.userType}</div>
          <select value={userType} onChange={(e) => setUserType(e.target.value as any)} style={S.input}>
            <option value="BOTH">{L.userTypeAll}</option>
            <option value="CLIENT">{L.userTypeClient}</option>
            <option value="BROKER">{L.userTypeBroker}</option>
          </select>
        </label>

        <label style={S.labelWrap}>
          <div style={S.label}>{L.rowsPerPage}</div>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            style={S.input}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {error && <div style={S.error}>{error}</div>}

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>{L.cDate}</th>
              <th style={S.th}>{L.cRewardName}</th>
              <th style={S.th}>{L.cDelivery}</th>
              <th style={S.th}>{L.cRewardId}</th>
              <th style={S.th}>{L.cPoints}</th>
              <th style={S.th}>{L.cUserName}</th>
              <th style={S.th}>{L.cUserEmail}</th>
              <th style={S.th}>{L.cUserPhone}</th>
              <th style={S.th}>{L.cUserSub}</th>
              <th style={S.th}>{L.cUserType}</th>
              <th style={S.th}>{L.cStatus}</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td style={S.td} colSpan={11}>
                  {loading ? L.loading : L.empty}
                </td>
              </tr>
            ) : (
              pageItems.map((r) => (
                <tr key={r.id}>
                  <td style={S.td}>{fmtDateTime(r.createdAt)}</td>
                  <td style={S.td}>{r.rewardName ?? "-"}</td>
                  <td style={S.td}>{r.deliveryType ?? "-"}</td>
                  <td style={{ ...S.td, ...S.mono }}>{r.rewardId}</td>
                  <td style={S.td}>{r.pointsSpent}</td>
                  <td style={S.td}>{r.userName ?? "-"}</td>
                  <td style={S.td}>{r.userEmail ?? "-"}</td>
                  <td style={S.td}>{r.userPhone ?? "-"}</td>
                  <td style={{ ...S.td, ...S.mono }}>{r.userId ?? "-"}</td>
                  <td style={S.td}>{r.userType ?? "-"}</td>
                  <td style={S.td}>
                    <span style={statusBadgeStyle(r.status)}>{r.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={S.footerRow}>
        <div style={S.pageInfo}>
          {L.statsTotal}: <b>{filtered.length}</b>
        </div>

        <div style={S.pager}>
          <button
            style={{ ...S.pagerBtn, ...(page <= 1 ? S.pagerBtnDisabled : {}) }}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            {L.prev}
          </button>

          <div style={S.pageInfo}>
            {L.page} <b>{Math.min(page, totalPages)}</b> {L.of} <b>{totalPages}</b>
          </div>

          <button
            style={{ ...S.pagerBtn, ...(page >= totalPages ? S.pagerBtnDisabled : {}) }}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            {L.next}
          </button>
        </div>
      </div>
    </div>
  );
}