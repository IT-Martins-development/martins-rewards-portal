import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./lib/amplifyClient";



type UserType = "CLIENT" | "BROKER" | "PARTNER" | "BOTH";

type BalanceRow = {
  userId: string;
  userName?: string | null;
  userType?: "CLIENT" | "BROKER" | "PARTNER" | null;
  userEmail?: string | null;
  userPhone?: string | null;

  availablePoints: number;
  redeemedPoints: number;
  updatedAt?: string | null;
};

const LIST_BALANCES = /* GraphQL */ `
  query MongoRewardsBalancesList(
    $limit: Int
    $nextToken: String
    $name: String
    $userType: String
  ) {
    mongoRewardsBalancesList(
      limit: $limit
      nextToken: $nextToken
      name: $name
      userType: $userType
    ) {
      items {
        userId
        userName
        userType
        userEmail
        userPhone
        availablePoints
        redeemedPoints
        updatedAt
      }
      nextToken
    }
  }
`;

const UPDATE_BALANCE = /* GraphQL */ `
  mutation MongoRewardsBalanceSet(
    $userId: ID!
    $availablePoints: Int
    $redeemedPoints: Int
    $reason: String
  ) {
    mongoRewardsBalanceSet(
      userId: $userId
      availablePoints: $availablePoints
      redeemedPoints: $redeemedPoints
      reason: $reason
    ) {
      userId
      availablePoints
      redeemedPoints
      updatedAt
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

export default function RewardsBalancesReport({ lang }: { lang?: "PT" | "EN" | "ES" } ) {
  const isNarrow = useIsNarrow(820);

  const safeLang = (lang === "PT" || lang === "EN" || lang === "ES") ? lang : "PT";
  const L = useMemo(() => {
    const dict = {
      PT: {
        title: "Saldos (Manutenção)",
        apply: "Aplicar",
        clear: "Limpar filtros",
        export: "Exportar CSV",
        loading: "Carregando...",
        empty: "Nenhum registro.",
        rowsPerPage: "Registros por página",
        prev: "Anterior",
        next: "Próximo",
        page: "Página",
        of: "de",
        userName: "Nome do usuário",
        userType: "Tipo de usuário",
        userTypeAll: "Todos",
        userTypeClient: "Cliente",
        userTypeBroker: "Corretor",
        userTypePartner: "Parceiro",
        namePlaceholder: "Buscar por nome",
        cName: "Nome",
        cUserType: "Tipo usuário",
        cUserSub: "Usuário (sub)",
        cEmail: "Email",
        cPhone: "Telefone",
        cAvail: "Disponíveis",
        cRedeemed: "Resgatados",
        cTotal: "Total",
        cUpdated: "Atualizado em",
        cActions: "Ações",
        reason: "Motivo",
        reasonPlaceholder: "Ex.: ajuste manual / correção saldo",
        save: "Salvar",
        cancel: "Cancelar",
        saved: "Salvo ✅",
      },
      EN: {
        title: "Balances (Maintenance)",
        apply: "Apply",
        clear: "Clear filters",
        export: "Export CSV",
        loading: "Loading...",
        empty: "No records.",
        rowsPerPage: "Rows per page",
        prev: "Prev",
        next: "Next",
        page: "Page",
        of: "of",
        userName: "User name",
        userType: "User type",
        userTypeAll: "All",
        userTypeClient: "Client",
        userTypeBroker: "Broker",
        userTypePartner: "Partner",
        namePlaceholder: "Search by name",
        cName: "Name",
        cUserType: "User type",
        cUserSub: "User (sub)",
        cEmail: "Email",
        cPhone: "Phone",
        cAvail: "Available",
        cRedeemed: "Redeemed",
        cTotal: "Total",
        cUpdated: "Updated at",
        cActions: "Actions",
        reason: "Reason",
        reasonPlaceholder: "e.g. manual adjustment / correction",
        save: "Save",
        cancel: "Cancel",
        saved: "Saved ✅",
      },
      ES: {
        title: "Saldos (Mantenimiento)",
        apply: "Aplicar",
        clear: "Limpiar filtros",
        export: "Exportar CSV",
        loading: "Cargando...",
        empty: "Sin registros.",
        rowsPerPage: "Registros por página",
        prev: "Anterior",
        next: "Siguiente",
        page: "Página",
        of: "de",
        userName: "Nombre del usuario",
        userType: "Tipo de usuario",
        userTypeAll: "Todos",
        userTypeClient: "Cliente",
        userTypeBroker: "Corredor",
        userTypePartner: "Socio",
        namePlaceholder: "Buscar por nombre",
        cName: "Nombre",
        cUserType: "Tipo usuario",
        cUserSub: "Usuario (sub)",
        cEmail: "Email",
        cPhone: "Teléfono",
        cAvail: "Disponibles",
        cRedeemed: "Canjeados",
        cTotal: "Total",
        cUpdated: "Actualizado en",
        cActions: "Acciones",
        reason: "Motivo",
        reasonPlaceholder: "Ej.: ajuste manual / corrección",
        save: "Guardar",
        cancel: "Cancelar",
        saved: "Guardado ✅",
      },
    } as const;
    return dict[safeLang];
  }, [safeLang]);

  // filtros
  const [userName, setUserName] = useState("");
  const [userType, setUserType] = useState<UserType>("BOTH");

  // data
  const [items, setItems] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // paginação local
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

  // edição
  const [editing, setEditing] = useState<Record<string, { availablePoints: number; redeemedPoints: number }>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [savedFlag, setSavedFlag] = useState<Record<string, boolean>>({});

  function clearFilters() {
    setUserName("");
    setUserType("BOTH");
    setPage(1);
    // recarrega
    void load({ resetPaging: true });
  }

  async function load(opts?: { resetPaging?: boolean }) {
    setLoading(true);
    setError("");
    try {
      const name = userName.trim() || null;
      const uType = userType === "BOTH" ? null : userType;

      let nextToken: string | null | undefined = null;
      const all: BalanceRow[] = [];
      const PAGE_SIZE = 250;
      const MAX_ITEMS = 5000;

      do {
        const res: any = await gqlClient.graphql({
          query: LIST_BALANCES,
          variables: {
            limit: PAGE_SIZE,
            nextToken,
            name,
            userType: uType,
          },
        });

        const block = res?.data?.mongoRewardsBalancesList;
        const list: BalanceRow[] = block?.items ?? [];
        all.push(...list.filter(Boolean));
        nextToken = block?.nextToken ?? null;
      } while (nextToken && all.length < MAX_ITEMS);

      // ordena por updatedAt desc
      all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

      setItems(all);

      if (opts?.resetPaging) setPage(1);
    } catch (e: any) {
      setError(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  // filtros locais (nome já vai pro backend, mas mantemos safe)
  const filtered = useMemo(() => {
    const q = userName.trim().toLowerCase();
    return items.filter((r) => {
      const okName =
        !q ||
        (r.userName || "").toLowerCase().includes(q) ||
        (r.userId || "").toLowerCase().includes(q) ||
        (r.userEmail || "").toLowerCase().includes(q);

      const okType =
        userType === "BOTH" ||
        (userType === "CLIENT" && r.userType === "CLIENT") ||
        (userType === "BROKER" && r.userType === "BROKER") ||
        (userType === "PARTNER" && r.userType === "PARTNER");

      return okName && okType;
    });
  }, [items, userName, userType]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize))),
    [filtered.length, pageSize]
  );

  const pageItems = useMemo(() => {
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize, totalPages]);

  function startEdit(row: BalanceRow) {
    setSavedFlag((m) => ({ ...m, [row.userId]: false }));
    setEditing((m) => ({
      ...m,
      [row.userId]: {
        availablePoints: Number(row.availablePoints || 0),
        redeemedPoints: Number(row.redeemedPoints || 0),
      },
    }));
  }

  function cancelEdit(userId: string) {
    setEditing((m) => {
      const copy = { ...m };
      delete copy[userId];
      return copy;
    });
    setReason((m) => {
      const copy = { ...m };
      delete copy[userId];
      return copy;
    });
    setSaving((m) => ({ ...m, [userId]: false }));
  }

  async function saveRow(userId: string) {
    const edit = editing[userId];
    if (!edit) return;

    setSaving((m) => ({ ...m, [userId]: true }));
    setSavedFlag((m) => ({ ...m, [userId]: false }));
    try {
      const avail = Number(edit.availablePoints);
      const red = Number(edit.redeemedPoints);
      if (!Number.isFinite(avail) || !Number.isFinite(red)) throw new Error("Pontuação inválida.");
      if (avail < 0 || red < 0) throw new Error("Pontuação não pode ser negativa.");

      const res: any = await gqlClient.graphql({
        query: UPDATE_BALANCE,
        variables: {
          userId,
          availablePoints: Math.trunc(avail),
          redeemedPoints: Math.trunc(red),
          reason: (reason[userId] || "").trim() || null,
        },
      });

      const updated = res?.data?.mongoRewardsBalanceSet;
      if (updated?.userId) {
        setItems((prev) =>
          prev.map((r) =>
            r.userId === userId
              ? {
                  ...r,
                  availablePoints: updated.availablePoints ?? r.availablePoints,
                  redeemedPoints: updated.redeemedPoints ?? r.redeemedPoints,
                  updatedAt: updated.updatedAt ?? r.updatedAt,
                }
              : r
          )
        );
      }

      cancelEdit(userId);
      setSavedFlag((m) => ({ ...m, [userId]: true }));
      // limpa flag depois de um tempinho
      setTimeout(() => setSavedFlag((m) => ({ ...m, [userId]: false })), 2000);
    } catch (e: any) {
      alert(pickErr(e));
    } finally {
      setSaving((m) => ({ ...m, [userId]: false }));
    }
  }

  function exportCsv() {
    const headers = [
      L.cName,
      L.cUserType,
      L.cUserSub,
      L.cEmail,
      L.cPhone,
      L.cAvail,
      L.cRedeemed,
      L.cTotal,
      L.cUpdated,
    ];

    const rows = filtered.map((r) => [
      r.userName ?? "",
      r.userType ?? "",
      r.userId ?? "",
      r.userEmail ?? "",
      r.userPhone ?? "",
      r.availablePoints ?? 0,
      r.redeemedPoints ?? 0,
      (r.availablePoints || 0) + (r.redeemedPoints || 0),
      fmtDateTime(r.updatedAt),
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadTextFile(`rewards-balances_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  useEffect(() => {
    void load();
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
    table: { width: "100%", borderCollapse: "collapse", minWidth: 1100 },
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

    tinyBtn: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "8px 10px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 900,
      height: 36,
      minWidth: 90,
    },
    tinyGhost: {
      background: "white",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.35)",
      padding: "8px 10px",
      borderRadius: 10,
      cursor: "pointer",
      fontWeight: 900,
      height: 36,
      minWidth: 90,
    },
    ok: {
      background: "#DCFCE7",
      color: "#166534",
      border: "1px solid rgba(22,101,52,0.2)",
      padding: "6px 10px",
      borderRadius: 10,
      fontWeight: 900,
      fontSize: 12,
      display: "inline-block",
    },
  };

  return (
    <div style={S.page}>
      <div style={S.headerRow}>
        <div>
          <h2 style={S.title}>{L.title}</h2>
          <div style={S.subtle}>
            Total: <b>{filtered.length}</b>
          </div>
        </div>

        <div style={S.btnRow}>
          <button onClick={exportCsv} style={S.btnGhost} disabled={loading || filtered.length === 0}>
            {L.export}
          </button>
          <button onClick={clearFilters} style={S.btnGhost} disabled={loading}>
            {L.clear}
          </button>
          <button onClick={() => load({ resetPaging: true })} style={S.btnPrimary} disabled={loading}>
            {loading ? L.loading : L.apply}
          </button>
        </div>
      </div>

      <div style={S.filterGrid}>
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
            <option value="PARTNER">{L.userTypePartner}</option>
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
              <th style={S.th}>{L.cName}</th>
              <th style={S.th}>{L.cUserType}</th>
              <th style={S.th}>{L.cUserSub}</th>
              <th style={S.th}>{L.cEmail}</th>
              <th style={S.th}>{L.cPhone}</th>
              <th style={S.th}>{L.cAvail}</th>
              <th style={S.th}>{L.cRedeemed}</th>
              <th style={S.th}>{L.cTotal}</th>
              <th style={S.th}>{L.cUpdated}</th>
              <th style={S.th}>{L.cActions}</th>
            </tr>
          </thead>

          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td style={S.td} colSpan={10}>
                  {loading ? L.loading : L.empty}
                </td>
              </tr>
            ) : (
              pageItems.map((r) => {
                const edit = editing[r.userId];
                const total = (edit ? edit.availablePoints + edit.redeemedPoints : (r.availablePoints || 0) + (r.redeemedPoints || 0));
                return (
                  <tr key={r.userId}>
                    <td style={S.td}>
                      {r.userName ?? "-"}{" "}
                      {savedFlag[r.userId] ? <span style={S.ok}>{L.saved}</span> : null}
                    </td>
                    <td style={S.td}>{r.userType ?? "-"}</td>
                    <td style={{ ...S.td, ...S.mono }}>{r.userId}</td>
                    <td style={S.td}>{r.userEmail ?? "-"}</td>
                    <td style={S.td}>{r.userPhone ?? "-"}</td>

                    <td style={S.td}>
                      {edit ? (
                        <input
                          type="number"
                          value={edit.availablePoints}
                          onChange={(e) =>
                            setEditing((m) => ({
                              ...m,
                              [r.userId]: { ...m[r.userId], availablePoints: Number(e.target.value) },
                            }))
                          }
                          style={{ ...S.input, height: 36, borderRadius: 10 }}
                        />
                      ) : (
                        r.availablePoints ?? 0
                      )}
                    </td>

                    <td style={S.td}>
                      {edit ? (
                        <input
                          type="number"
                          value={edit.redeemedPoints}
                          onChange={(e) =>
                            setEditing((m) => ({
                              ...m,
                              [r.userId]: { ...m[r.userId], redeemedPoints: Number(e.target.value) },
                            }))
                          }
                          style={{ ...S.input, height: 36, borderRadius: 10 }}
                        />
                      ) : (
                        r.redeemedPoints ?? 0
                      )}
                    </td>

                    <td style={S.td}>{total}</td>
                    <td style={S.td}>{fmtDateTime(r.updatedAt)}</td>

                    <td style={S.td}>
                      {!edit ? (
                        <button style={S.tinyBtn} onClick={() => startEdit(r)}>
                          Editar
                        </button>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input
                            value={reason[r.userId] || ""}
                            onChange={(e) => setReason((m) => ({ ...m, [r.userId]: e.target.value }))}
                            placeholder={L.reasonPlaceholder}
                            style={{ ...S.input, height: 36, borderRadius: 10 }}
                          />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={S.tinyBtn} onClick={() => saveRow(r.userId)} disabled={!!saving[r.userId]}>
                              {saving[r.userId] ? L.loading : L.save}
                            </button>
                            <button style={S.tinyGhost} onClick={() => cancelEdit(r.userId)} disabled={!!saving[r.userId]}>
                              {L.cancel}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={S.footerRow}>
        <div style={S.pageInfo}>
          Total: <b>{filtered.length}</b>
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