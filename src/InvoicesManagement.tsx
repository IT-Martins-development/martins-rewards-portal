import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

type InvoiceStatus = "Created" | "InPayment" | "Paid";
type PageSize = 10 | 25 | 50 | 100;
type AnyObj = Record<string, any>;

type InvoiceRow = {
  invoiceId: string;
  projectId: string;
  projectTitle: string;
  parcelId: string;
  dueDate: string | null;
  amount: number;
  invoiceTitle: string;
  externalTitle: string;
  status: InvoiceStatus;
  raw: AnyObj;
};

type Filters = {
  projectTitle: string;
  parcelId: string;
  status: "" | InvoiceStatus;
  pageSize: PageSize;
};

type InvoiceModalState = {
  open: boolean;
  row: InvoiceRow | null;
};

type InvoiceFormState = {
  dueDate: string;
  amount: string;
  invoiceTitle: string;
  externalTitle: string;
  status: InvoiceStatus;
};

type InvoicesApiResponse = {
  ok: boolean;
  rows: InvoiceRow[];
};
const INVOICES_API_URL =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/invoices";

const UPDATE_INVOICE_API_URL =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/invoices-update";

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];
const STATUS_OPTIONS: InvoiceStatus[] = ["Created", "InPayment", "Paid"];

function toStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function parseApiRows(data: InvoicesApiResponse | AnyObj): InvoiceRow[] {
  if (Array.isArray((data as any)?.rows)) return (data as any).rows;
  return [];
}

function normalizeMoney(value: any): number {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return n;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(normalizeMoney(value));
}

function normalizeDateForInput(value?: string | null): string {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [mm, dd, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(value?: string | null): string {
  if (!value) return "-";

  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) return value;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("-");
    return `${mm}-${dd}-${yyyy}`;
  }

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toStr(value);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${yyyy}`;
}

async function getLoggedUserId(): Promise<string> {
  try {
    const session = await fetchAuthSession();
    const idTokenSub = session.tokens?.idToken?.payload?.sub;
    const accessTokenSub = session.tokens?.accessToken?.payload?.sub;
    return String(idTokenSub || accessTokenSub || "");
  } catch (e) {
    console.warn("Unable to get logged user", e);
    return "";
  }
}

function SummaryCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string | number;
  subtitle: string;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #faf8f5 100%)",
        border: "1px solid rgba(122,90,58,0.10)",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 8px 30px rgba(15,23,42,0.05)",
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "rgba(17,24,39,0.65)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "#111827",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "rgba(17,24,39,0.70)",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

export default function InvoicesManagement() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState<Filters>({
    projectTitle: "",
    parcelId: "",
    status: "",
    pageSize: 25,
  });

  const [invoiceModal, setInvoiceModal] = useState<InvoiceModalState>({
    open: false,
    row: null,
  });

  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormState>({
    dueDate: "",
    amount: "",
    invoiceTitle: "",
    externalTitle: "",
    status: "Created",
  });

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#fff",
      borderRadius: 12,
      padding: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: 1800,
      margin: "0 auto",
      color: "#111827",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 12,
      flexWrap: "wrap",
    },
    btnPrimary: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "pointer",
      height: 42,
      whiteSpace: "nowrap",
    },
    btnGhost: {
      background: "white",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.35)",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "pointer",
      height: 42,
      whiteSpace: "nowrap",
    },
    input: {
      width: "100%",
      height: 42,
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.14)",
      outline: "none",
      color: "#111827",
      backgroundColor: "#fff",
      fontSize: 13,
      boxSizing: "border-box",
    },
    label: {
      fontSize: 11,
      color: "rgba(17,24,39,0.75)",
      fontWeight: 800,
      marginBottom: 4,
      display: "block",
    },
    th: {
      position: "sticky",
      top: 0,
      zIndex: 2,
      background: "#FBFBFC",
      padding: "10px 10px",
      textAlign: "left",
      fontSize: 10,
      color: "rgba(17,24,39,0.7)",
      fontWeight: 900,
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "10px 10px",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      fontSize: 12,
      color: "#111827",
      verticalAlign: "middle",
      whiteSpace: "nowrap",
    },
  };

async function fetchData() {
  setLoading(true);
  setError("");

  try {
    const params = new URLSearchParams();

    if (filters.projectTitle) params.append("projectTitle", filters.projectTitle);
    if (filters.parcelId) params.append("parcelId", filters.parcelId);
    if (filters.status) params.append("status", filters.status);

    const response = await fetch(`${INVOICES_API_URL}?${params.toString()}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const data: InvoicesApiResponse = await response.json();

    if (!response.ok || data?.ok === false) {
      throw new Error((data as any)?.message || `Erro ao carregar invoices (${response.status})`);
    }

    setRows(parseApiRows(data));
  } catch (e: any) {
    console.error("Erro ao carregar invoices", e);
    setError(e?.message || "Erro ao carregar invoices.");
    setRows([]);
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
    fetchData();
  }, [filters.projectTitle, filters.parcelId, filters.status]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (
        filters.projectTitle &&
        !toStr(row.projectTitle).toLowerCase().includes(filters.projectTitle.toLowerCase())
      ) {
        return false;
      }

      if (
        filters.parcelId &&
        !toStr(row.parcelId).toLowerCase().includes(filters.parcelId.toLowerCase())
      ) {
        return false;
      }

      if (filters.status && row.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [rows, filters]);

  const metrics = useMemo(() => {
    let created = 0;
    let inPayment = 0;
    let paid = 0;
    let totalAmount = 0;

    filteredRows.forEach((row) => {
      totalAmount += normalizeMoney(row.amount);
      if (row.status === "Created") created += 1;
      if (row.status === "InPayment") inPayment += 1;
      if (row.status === "Paid") paid += 1;
    });

    return {
      created,
      inPayment,
      paid,
      totalAmount: formatCurrency(totalAmount),
    };
  }, [filteredRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / filters.pageSize));

  const pagedRows = useMemo(() => {
    return filteredRows.slice((page - 1) * filters.pageSize, page * filters.pageSize);
  }, [filteredRows, page, filters.pageSize]);

  function openInvoiceModal(row: InvoiceRow) {
    setEditError("");
    setInvoiceModal({ open: true, row });
    setInvoiceForm({
      dueDate: normalizeDateForInput(row.dueDate),
      amount: String(normalizeMoney(row.amount)),
      invoiceTitle: toStr(row.invoiceTitle),
      externalTitle: toStr(row.externalTitle),
      status: row.status,
    });
  }

  function closeInvoiceModal() {
    setInvoiceModal({ open: false, row: null });
    setEditError("");
  }

  async function saveInvoice() {
    if (!invoiceModal.row?.invoiceId) {
      setEditError("Invoice inválida para edição.");
      return;
    }

    if (!invoiceForm.dueDate) {
      setEditError("Due Date é obrigatório.");
      return;
    }

    if (invoiceForm.amount === "" || Number.isNaN(Number(invoiceForm.amount))) {
      setEditError("Amount inválido.");
      return;
    }

    try {
      setSavingInvoice(true);
      setEditError("");

      const userId = await getLoggedUserId();
      if (!userId) {
        throw new Error("Não foi possível identificar o usuário logado.");
      }

      const response = await fetch(UPDATE_INVOICE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: invoiceModal.row.invoiceId,
          projectId: invoiceModal.row.projectId,
          userId,
          status: invoiceForm.status,
          dueDate: invoiceForm.dueDate,
          amount: Number(invoiceForm.amount),
          invoiceTitle: invoiceForm.invoiceTitle,
          externalTitle: invoiceForm.externalTitle,
        }),
      });

          const text = await response.text();

          let data: any = {};

          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = { raw: text };
          }

          if (!response.ok || data?.ok === false) {
            throw new Error(data?.message || `Erro ao salvar invoice (${response.status})`);
          }

      closeInvoiceModal();
      await fetchData();
    } catch (e: any) {
      console.error("Erro ao salvar invoice", e);
      setEditError(e?.message || "Erro ao salvar invoice.");
    } finally {
      setSavingInvoice(false);
    }
  }

  function exportCurrentViewCsv() {
    const headers = [
      "Project Title",
      "Parcel Id",
      "Due Date",
      "Amount",
      "Invoice Title",
      "External Title",
      "Status",
    ];

    const csvEscape = (value: unknown) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const lines = filteredRows.map((row) =>
      [
        row.projectTitle,
        row.parcelId,
        formatDisplayDate(row.dueDate),
        row.amount,
        row.invoiceTitle,
        row.externalTitle,
        row.status,
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = [headers.map(csvEscape).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "invoices_management.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: 16 }}>
      <div style={S.page}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Invoices Management</div>
            <div style={{ marginTop: 6, color: "rgba(17,24,39,0.60)", fontSize: 13 }}>
              Gestão de invoices com edição direta e histórico de alterações.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={S.btnGhost} onClick={exportCurrentViewCsv}>
              Exportar CSV
            </button>
            <button style={S.btnPrimary} onClick={fetchData}>
              Atualizar
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 180px",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div>
            <span style={S.label}>Project Title</span>
            <input
              style={S.input}
              placeholder="Buscar projeto"
              value={filters.projectTitle}
              onChange={(e) => setFilters((p) => ({ ...p, projectTitle: e.target.value }))}
            />
          </div>

          <div>
            <span style={S.label}>Parcel Id</span>
            <input
              style={S.input}
              placeholder="Buscar parcel"
              value={filters.parcelId}
              onChange={(e) => setFilters((p) => ({ ...p, parcelId: e.target.value }))}
            />
          </div>

          <div>
            <span style={S.label}>Status</span>
            <select
              style={S.input}
              value={filters.status}
              onChange={(e) =>
                setFilters((p) => ({ ...p, status: e.target.value as Filters["status"] }))
              }
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Itens por página</span>
            <select
              style={S.input}
              value={filters.pageSize}
              onChange={(e) =>
                setFilters((p) => ({ ...p, pageSize: Number(e.target.value) as PageSize }))
              }
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <SummaryCard
            title="Invoices filtradas"
            value={filteredRows.length}
            subtitle="Base da visão atual"
          />
          <SummaryCard
            title="Created"
            value={metrics.created}
            subtitle="Invoices criadas"
          />
          <SummaryCard
            title="InPayment"
            value={metrics.inPayment}
            subtitle="Invoices em pagamento"
          />
          <SummaryCard
            title="Paid"
            value={metrics.paid}
            subtitle="Invoices pagas"
          />
          <SummaryCard
            title="Valor total"
            value={metrics.totalAmount}
            subtitle="Soma dos filtros atuais"
          />
        </div>

        {error ? (
          <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 800 }}>{error}</div>
        ) : null}

        <div
          style={{
            background: "white",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "72vh", position: "relative" }}>
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 1400,
                width: "100%",
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth: 260 }}>Project Title</th>
                  <th style={{ ...S.th, minWidth: 180 }}>Parcel Id</th>
                  <th style={{ ...S.th, minWidth: 120 }}>Due Date</th>
                  <th style={{ ...S.th, minWidth: 140 }}>Amount</th>
                  <th style={{ ...S.th, minWidth: 260 }}>Invoice Title</th>
                  <th style={{ ...S.th, minWidth: 220 }}>External Title</th>
                  <th style={{ ...S.th, minWidth: 120 }}>Status</th>
                  <th style={{ ...S.th, minWidth: 100, textAlign: "center" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: "center" }}>
                      Carregando...
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: "center" }}>
                      Nenhum resultado encontrado.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.invoiceId}>
                      <td style={{ ...S.td, minWidth: 260 }}>{row.projectTitle || "-"}</td>
                      <td style={{ ...S.td, minWidth: 180 }}>{row.parcelId || "-"}</td>
                      <td style={{ ...S.td, minWidth: 120 }}>{formatDisplayDate(row.dueDate)}</td>
                      <td style={{ ...S.td, minWidth: 140 }}>{formatCurrency(row.amount)}</td>
                      <td style={{ ...S.td, minWidth: 260 }}>{row.invoiceTitle || "-"}</td>
                      <td style={{ ...S.td, minWidth: 220 }}>{row.externalTitle || "-"}</td>
                      <td style={{ ...S.td, minWidth: 120 }}>
                        <span
                          style={{
                            fontWeight: 800,
                            color:
                              row.status === "Paid"
                                ? "#16a34a"
                                : row.status === "InPayment"
                                ? "#2563eb"
                                : "#7a5a3a",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ ...S.td, minWidth: 100, textAlign: "center" }}>
                        <button
                          style={S.btnGhost}
                          onClick={() => openInvoiceModal(row)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderTop: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <button
              style={S.btnGhost}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ◀ Anterior
            </button>
            <div style={{ fontSize: 12, fontWeight: 800 }}>
              Página {page} de {totalPages}
            </div>
            <button
              style={S.btnGhost}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima ▶
            </button>
          </div>
        </div>
      </div>

      {invoiceModal.open && invoiceModal.row ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 980,
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 30px 80px rgba(0,0,0,0.24)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Edit invoice</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(17,24,39,0.60)" }}>
                  {invoiceModal.row.projectTitle} • {invoiceModal.row.externalTitle}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnGhost} onClick={closeInvoiceModal}>
                  Cancelar
                </button>
                <button style={S.btnPrimary} onClick={saveInvoice} disabled={savingInvoice}>
                  {savingInvoice ? "Salvando..." : "Save"}
                </button>
              </div>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 18 }}>
              {editError ? (
                <div style={{ color: "#b91c1c", fontWeight: 800 }}>{editError}</div>
              ) : null}

              <div>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>About the invoice</div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                    gap: 12,
                  }}
                >
                  <div>
                    <span style={S.label}>Project Title</span>
                    <input style={S.input} value={invoiceModal.row.projectTitle} readOnly />
                  </div>

                  <div>
                    <span style={S.label}>Parcel Id</span>
                    <input style={S.input} value={invoiceModal.row.parcelId || ""} readOnly />
                  </div>

                  <div>
                    <span style={S.label}>Due Date</span>
                    <input
                      type="date"
                      style={S.input}
                      value={invoiceForm.dueDate}
                      onChange={(e) =>
                        setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <span style={S.label}>Amount</span>
                    <input
                      type="number"
                      step="0.01"
                      style={S.input}
                      value={invoiceForm.amount}
                      onChange={(e) =>
                        setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <span style={S.label}>Invoice Title</span>
                    <input
                      style={S.input}
                      value={invoiceForm.invoiceTitle}
                      onChange={(e) =>
                        setInvoiceForm((prev) => ({ ...prev, invoiceTitle: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <span style={S.label}>External Title</span>
                    <input
                      style={S.input}
                      value={invoiceForm.externalTitle}
                      onChange={(e) =>
                        setInvoiceForm((prev) => ({ ...prev, externalTitle: e.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <span style={S.label}>Status</span>
                    <select
                      style={S.input}
                      value={invoiceForm.status}
                      onChange={(e) =>
                        setInvoiceForm((prev) => ({
                          ...prev,
                          status: e.target.value as InvoiceStatus,
                        }))
                      }
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <span style={S.label}>Invoice ID</span>
                    <input style={S.input} value={invoiceModal.row.invoiceId} readOnly />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}