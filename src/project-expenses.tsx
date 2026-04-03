import React, { useCallback, useEffect, useMemo, useState } from "react";

type PageSize = 10 | 25 | 50 | 100;
type AnyObj = Record<string, any>;

type SummaryRow = {
  projectId: string;
  projectName: string;
  county: string;
  houseModelNumber: string;
  contractValue: number;
  totalExpenses: number;
  variance: number;
  percentSpent: number;
  invoiceCount: number;
  finModelReferenceId: string | null;
};

type ExpenseType = "vendor_bill" | "stock_valuation" | "stock_return" | "other";

type DetailItem = {
  projectId: string;
  projectName: string;
  county: string;
  houseModelNumber: string;
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  productId: string | number;
  productTitle: string;
  quantity: number;
  actualCost: number;
  budgetGroup: string;
  budgetedCost: number;
  variance: number;
  classificationStatus: "Classified" | "Unclassified";
  contractValue: number;
  financialModelReferenceId: string | null;
  costCenterFound: boolean;
  financialModelFound: boolean;
  expenseType: ExpenseType;
};

type DetailGroup = {
  groupName: string;
  totalActual: number;
  totalBudget: number;
  totalVariance: number;
  itemCount: number;
  items: DetailItem[];
};

type DetailData = {
  projectId: string;
  projectName: string;
  county: string;
  houseModelNumber: string;
  contractValue: number;
  financialModelReferenceId: string | null;
  costCenterFound: boolean;
  financialModelFound: boolean;
  groups: DetailGroup[];
  totals: {
    totalActual: number;
    totalBudget: number;
    totalVariance: number;
    itemCount: number;
  };
};

type SummaryApiResponse = {
  ok?: boolean;
  action?: string;
  data?: AnyObj[];
  message?: string;
};

type DetailApiResponse = {
  ok?: boolean;
  action?: string;
  data?: AnyObj;
  message?: string;
};

type Filters = {
  project: string;
  product: string;
  county: string;
  houseModelNumber: string;
  vendor: string;
  startDate: string;
  endDate: string;
  pageSize: PageSize;
};

type DetailFlatRow = DetailItem & {
  typeLabel: string;
};

type DetailFilters = {
  type: string;
  service: string;
  vendor: string;
  status: "All" | "Classified" | "Unclassified";
  startDate: string;
  endDate: string;
};

type DetailModalState = {
  open: boolean;
  loading: boolean;
  data: DetailData | null;
};

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];

const PROJECT_EXPENSES_API_BASE =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/finance-project-expenses";

function toStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function round2(v: unknown) {
  return Math.round((toNum(v) + Number.EPSILON) * 100) / 100;
}

function formatMoney(v: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNum(v));
}

function formatPercent(v: unknown) {
  return `${round2(v).toFixed(2)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toStr(value);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${yyyy}`;
}

function normalizeExpenseType(value: unknown): ExpenseType {
  const raw = toStr(value).trim().toLowerCase();
  if (raw === "vendor_bill") return "vendor_bill";
  if (raw === "stock_valuation") return "stock_valuation";
  if (raw === "stock_return") return "stock_return";
  return "other";
}

function formatExpenseTypeLabel(value: ExpenseType) {
  if (value === "vendor_bill") return "Vendor Bills";
  if (value === "stock_valuation") return "Stock Valuation";
  if (value === "stock_return") return "Stock Return";
  return "Other";
}

function inferExpenseType(item: AnyObj): ExpenseType {
  const explicitType = normalizeExpenseType(item?.type);
  if (explicitType !== "other") return explicitType;

  const invoiceNumber = toStr(item?.invoiceNumber).toUpperCase();
  const vendor = toStr(item?.vendor).toUpperCase();

  if (invoiceNumber.startsWith("WH/IN/")) return "stock_return";
  if (invoiceNumber.startsWith("WH/OUT/")) return "stock_valuation";
  if (vendor.includes("ESTOQUE/DEVOLUCAO")) return "stock_return";
  if (vendor.includes("ESTOQUE/OUTROS")) return "stock_valuation";
  if (invoiceNumber.startsWith("BILL/") || invoiceNumber.startsWith("BILL-")) return "vendor_bill";

  return "other";
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      message: rawText || "Invalid API response.",
      rawText,
    };
  }
}

function parseSummaryRows(data: SummaryApiResponse | AnyObj): SummaryRow[] {
  const rows = Array.isArray((data as AnyObj)?.data) ? (data as AnyObj).data : [];

  return rows.map((row: AnyObj) => ({
    projectId: toStr(row?.projectId ?? row?._id),
    projectName: toStr(row?.projectName),
    county: toStr(row?.county),
    houseModelNumber: toStr(row?.houseModelNumber),
    contractValue: round2(row?.contractValue),
    totalExpenses: round2(row?.totalExpenses),
    variance: round2(row?.variance),
    percentSpent: round2(row?.percentSpent),
    invoiceCount: toNum(row?.invoiceCount),
    finModelReferenceId: row?.finModelReferenceId ? toStr(row.finModelReferenceId) : null,
  }));
}

function parseDetailData(payload: DetailApiResponse | AnyObj): DetailData | null {
  const data = (payload as AnyObj)?.data;
  if (!data || typeof data !== "object") return null;

  const groups = Array.isArray(data.groups) ? data.groups : [];

  return {
    projectId: toStr(data.projectId),
    projectName: toStr(data.projectName),
    county: toStr(data.county),
    houseModelNumber: toStr(data.houseModelNumber),
    contractValue: round2(data.contractValue),
    financialModelReferenceId: data.financialModelReferenceId
      ? toStr(data.financialModelReferenceId)
      : null,
    costCenterFound: !!data.costCenterFound,
    financialModelFound: !!data.financialModelFound,
    groups: groups.map((group: AnyObj) => ({
      groupName: toStr(group?.groupName || "To Classify"),
      totalActual: round2(group?.totalActual),
      totalBudget: round2(group?.totalBudget),
      totalVariance: round2(group?.totalVariance),
      itemCount: toNum(group?.itemCount),
      items: Array.isArray(group?.items)
        ? group.items.map((item: AnyObj) => ({
            projectId: toStr(item?.projectId),
            projectName: toStr(item?.projectName),
            county: toStr(item?.county),
            houseModelNumber: toStr(item?.houseModelNumber),
            vendor: toStr(item?.vendor),
            invoiceNumber: toStr(item?.invoiceNumber),
            invoiceDate: toStr(item?.invoiceDate),
            productId: item?.productId ?? "",
            productTitle: toStr(item?.productTitle),
            quantity: toNum(item?.quantity),
            actualCost: round2(item?.actualCost),
            budgetGroup: toStr(item?.budgetGroup),
            budgetedCost: round2(item?.budgetedCost),
            variance: round2(item?.variance),
            classificationStatus:
              item?.classificationStatus === "Unclassified" ? "Unclassified" : "Classified",
            contractValue: round2(item?.contractValue),
            financialModelReferenceId: item?.financialModelReferenceId
              ? toStr(item?.financialModelReferenceId)
              : null,
            costCenterFound: !!item?.costCenterFound,
            financialModelFound: !!item?.financialModelFound,
            expenseType: inferExpenseType(item),
          }))
        : [],
    })),
    totals: {
      totalActual: round2(data?.totals?.totalActual),
      totalBudget: round2(data?.totals?.totalBudget),
      totalVariance: round2(data?.totals?.totalVariance),
      itemCount: toNum(data?.totals?.itemCount),
    },
  };
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
      <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(17,24,39,0.70)" }}>
        {subtitle}
      </div>
    </div>
  );
}

function ClassificationBadge({ status }: { status: "Classified" | "Unclassified" }) {
  const isClassified = status === "Classified";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 104,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 11,
        background: isClassified ? "rgba(22,163,74,0.12)" : "rgba(245,158,11,0.14)",
        color: isClassified ? "#15803d" : "#b45309",
        border: isClassified
          ? "1px solid rgba(22,163,74,0.18)"
          : "1px solid rgba(245,158,11,0.20)",
      }}
    >
      {status}
    </span>
  );
}

function SpendBadge({ value }: { value: number }) {
  let background = "rgba(22,163,74,0.12)";
  let color = "#15803d";
  let border = "1px solid rgba(22,163,74,0.18)";

  if (value >= 90) {
    background = "rgba(220,38,38,0.12)";
    color = "#b91c1c";
    border = "1px solid rgba(220,38,38,0.18)";
  } else if (value >= 70) {
    background = "rgba(245,158,11,0.14)";
    color = "#b45309";
    border = "1px solid rgba(245,158,11,0.20)";
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 78,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 11,
        background,
        color,
        border,
      }}
    >
      {formatPercent(value)}
    </span>
  );
}

export default function ProjectExpenses() {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [filters, setFilters] = useState<Filters>({
    project: "",
    product: "",
    county: "",
    houseModelNumber: "",
    vendor: "",
    startDate: "",
    endDate: "",
    pageSize: 25,
  });
  const [page, setPage] = useState(1);
  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    loading: false,
    data: null,
  });
  const [detailFilters, setDetailFilters] = useState<DetailFilters>({
    type: "All",
    service: "",
    vendor: "",
    status: "All",
    startDate: "",
    endDate: "",
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
    titleWrap: {
      display: "grid",
      gap: 6,
    },
    title: {
      margin: 0,
      fontSize: 22,
      fontWeight: 900,
      color: "#111827",
    },
    subtitle: {
      margin: 0,
      color: "rgba(17,24,39,0.68)",
      fontSize: 13,
    },
    filtersCard: {
      border: "1px solid rgba(17,24,39,0.08)",
      borderRadius: 16,
      padding: 16,
      background: "linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%)",
      marginBottom: 16,
    },
    filtersGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 12,
      alignItems: "end",
    },
    field: {
      display: "grid",
      gap: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: 800,
      color: "rgba(17,24,39,0.72)",
    },
    input: {
      height: 40,
      borderRadius: 10,
      border: "1px solid rgba(17,24,39,0.12)",
      padding: "0 12px",
      background: "#fff",
      color: "#111827",
      outline: "none",
      fontWeight: 600,
    },
    actions: {
      display: "flex",
      gap: 10,
      justifyContent: "flex-end",
      marginTop: 14,
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
    btnSecondary: {
      background: "#fff",
      color: "#374151",
      border: "1px solid rgba(17,24,39,0.12)",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "pointer",
      height: 42,
      whiteSpace: "nowrap",
    },
    cardsGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 14,
      marginBottom: 16,
    },
    tableWrap: {
      overflow: "auto",
      border: "1px solid rgba(17,24,39,0.08)",
      borderRadius: 16,
      background: "#fff",
    },
    detailTableWrap: {
      overflow: "auto",
      maxHeight: "calc(100vh - 360px)",
      border: "1px solid rgba(17,24,39,0.08)",
      borderRadius: 16,
      background: "#fff",
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: 1100,
    },
    detailTable: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: 1250,
    },
    th: {
      position: "sticky",
      top: 0,
      background: "#faf8f5",
      color: "#374151",
      textAlign: "left",
      fontSize: 12,
      fontWeight: 900,
      padding: "12px 14px",
      borderBottom: "1px solid rgba(17,24,39,0.08)",
      zIndex: 1,
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid rgba(17,24,39,0.06)",
      fontSize: 13,
      color: "#111827",
      verticalAlign: "top",
    },
    empty: {
      textAlign: "center",
      padding: 28,
      color: "rgba(17,24,39,0.60)",
      fontWeight: 700,
    },
    pager: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginTop: 14,
      flexWrap: "wrap",
    },
    modalBackdrop: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,0.42)",
      display: "flex",
      justifyContent: "flex-end",
      zIndex: 2000,
    },
    modalPanel: {
      width: "min(1400px, 98vw)",
      height: "100vh",
      background: "#F6F7F9",
      boxShadow: "-20px 0 50px rgba(15,23,42,0.18)",
      display: "flex",
      flexDirection: "column",
    },
    modalHeader: {
      padding: 18,
      borderBottom: "1px solid rgba(17,24,39,0.08)",
      background: "#fff",
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "flex-start",
    },
    modalBody: {
      padding: 18,
      overflow: "auto",
      display: "grid",
      gap: 16,
    },
    groupCard: {
      background: "#fff",
      borderRadius: 16,
      border: "1px solid rgba(17,24,39,0.08)",
      overflow: "hidden",
    },
    chipRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      height: 30,
      padding: "0 12px",
      borderRadius: 999,
      background: "rgba(122,90,58,0.12)",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.18)",
      fontWeight: 800,
      fontSize: 12,
    },
    error: {
      background: "rgba(220,38,38,0.08)",
      color: "#991b1b",
      border: "1px solid rgba(220,38,38,0.16)",
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 14,
      fontWeight: 700,
    },
  };

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const body = {
        action: "summary",
        project: filters.project.trim() || undefined,
        product: filters.product.trim() || undefined,
        county: filters.county.trim() || undefined,
        houseModelNumber: filters.houseModelNumber.trim() || undefined,
        vendor: filters.vendor.trim() || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      };

      const response = await fetch(PROJECT_EXPENSES_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await parseApiResponse(response);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || "Failed to load project expenses.");
      }

      setRows(parseSummaryRows(data));
      setPage(1);
    } catch (e: any) {
      console.error(e);
      setRows([]);
      setError(e?.message || "Failed to load project expenses.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const openDetails = useCallback(
    async (row: SummaryRow) => {
      setDetailModal({ open: true, loading: true, data: null });
      setDetailError("");
      setDetailFilters({
        type: "All",
        service: "",
        vendor: "",
        status: "All",
        startDate: filters.startDate || "",
        endDate: filters.endDate || "",
      });

      try {
        const response = await fetch(PROJECT_EXPENSES_API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "details",
            projectId: row.projectId,
            product: filters.product.trim() || undefined,
            vendor: filters.vendor.trim() || undefined,
            startDate: filters.startDate || undefined,
            endDate: filters.endDate || undefined,
          }),
        });

        const data = await parseApiResponse(response);
        if (!response.ok || data?.ok === false) {
          throw new Error(data?.message || "Failed to load project expense details.");
        }

        setDetailModal({ open: true, loading: false, data: parseDetailData(data) });
      } catch (e: any) {
        console.error(e);
        setDetailModal({ open: true, loading: false, data: null });
        setDetailError(e?.message || "Failed to load project expense details.");
      }
    },
    [filters]
  );

  const closeDetails = useCallback(() => {
    setDetailModal({ open: false, loading: false, data: null });
    setDetailError("");
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      project: "",
      product: "",
      county: "",
      houseModelNumber: "",
      vendor: "",
      startDate: "",
      endDate: "",
      pageSize: 25,
    });
    setPage(1);
  }, []);

  const resetDetailFilters = useCallback(() => {
    setDetailFilters({
      type: "All",
      service: "",
      vendor: "",
      status: "All",
      startDate: "",
      endDate: "",
    });
  }, []);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(rows.length / filters.pageSize));
  }, [rows.length, filters.pageSize]);

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * filters.pageSize;
    return rows.slice(start, start + filters.pageSize);
  }, [page, rows, filters.pageSize]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.contractValue += row.contractValue;
        acc.totalExpenses += row.totalExpenses;
        acc.variance += row.variance;
        acc.invoiceCount += row.invoiceCount;
        return acc;
      },
      {
        contractValue: 0,
        totalExpenses: 0,
        variance: 0,
        invoiceCount: 0,
      }
    );
  }, [rows]);

  const detailRows = useMemo<DetailFlatRow[]>(() => {
    if (!detailModal.data) return [];
    return detailModal.data.groups.flatMap((group) =>
      group.items.map((item) => ({
        ...item,
        typeLabel: formatExpenseTypeLabel(item.expenseType),
      }))
    );
  }, [detailModal.data]);

  const detailTypeOptions = useMemo(() => {
    const availableTypes = new Set(detailRows.map((row) => row.expenseType));
    const options = [
      { value: "All", label: "All" },
      { value: "vendor_bill", label: "Vendor Bills" },
      { value: "stock_valuation", label: "Stock Valuation" },
      { value: "stock_return", label: "Stock Return" },
    ];
    const filtered = options.filter(
      (option) => option.value === "All" || availableTypes.has(option.value as ExpenseType)
    );
    return filtered.length > 1 ? filtered : options;
  }, [detailRows]);

  const filteredDetailRows = useMemo(() => {
    return detailRows.filter((item) => {
      const matchesType =
        detailFilters.type === "All" || item.expenseType === detailFilters.type;

      const matchesService =
        !detailFilters.service ||
        item.productTitle.toLowerCase().includes(detailFilters.service.toLowerCase());

      const matchesVendor =
        !detailFilters.vendor ||
        item.vendor.toLowerCase().includes(detailFilters.vendor.toLowerCase());

      const matchesStatus =
        detailFilters.status === "All" || item.classificationStatus === detailFilters.status;

      const itemTime = item.invoiceDate ? new Date(item.invoiceDate).getTime() : null;

      const matchesStart =
        !detailFilters.startDate ||
        (itemTime !== null &&
          itemTime >= new Date(`${detailFilters.startDate}T00:00:00`).getTime());

      const matchesEnd =
        !detailFilters.endDate ||
        (itemTime !== null &&
          itemTime <= new Date(`${detailFilters.endDate}T23:59:59`).getTime());

      return (
        matchesType &&
        matchesService &&
        matchesVendor &&
        matchesStatus &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [detailRows, detailFilters]);

  const filteredDetailTotals = useMemo(() => {
    return filteredDetailRows.reduce(
      (acc, row) => {
        acc.totalActual += row.actualCost;
        acc.totalBudget += row.budgetedCost;
        acc.totalVariance += row.variance;
        acc.itemCount += 1;
        return acc;
      },
      {
        totalActual: 0,
        totalBudget: 0,
        totalVariance: 0,
        itemCount: 0,
      }
    );
  }, [filteredDetailRows]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleWrap}>
          <h2 style={S.title}>Project Expenses</h2>
          <p style={S.subtitle}>
            Consulte despesas por projeto, compare com contract value e veja os detalhes
            classificados por grupo do financial model.
          </p>
        </div>
      </div>

      {error ? <div style={S.error}>{error}</div> : null}

      <div style={S.filtersCard}>
        <div style={S.filtersGrid}>
          <div style={S.field}>
            <label style={S.label}>Project</label>
            <input
              style={S.input}
              value={filters.project}
              onChange={(e) => setFilters((prev) => ({ ...prev, project: e.target.value }))}
              placeholder="Project name"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Product / Service</label>
            <input
              style={S.input}
              value={filters.product}
              onChange={(e) => setFilters((prev) => ({ ...prev, product: e.target.value }))}
              placeholder="Product or service name"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>County</label>
            <input
              style={S.input}
              value={filters.county}
              onChange={(e) => setFilters((prev) => ({ ...prev, county: e.target.value }))}
              placeholder="County"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>House Model</label>
            <input
              style={S.input}
              value={filters.houseModelNumber}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, houseModelNumber: e.target.value }))
              }
              placeholder="House model"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Vendor</label>
            <input
              style={S.input}
              value={filters.vendor}
              onChange={(e) => setFilters((prev) => ({ ...prev, vendor: e.target.value }))}
              placeholder="Vendor"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Date From</label>
            <input
              type="date"
              style={S.input}
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Date To</label>
            <input
              type="date"
              style={S.input}
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Page Size</label>
            <select
              style={S.input}
              value={filters.pageSize}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  pageSize: Number(e.target.value) as PageSize,
                }))
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

        <div style={S.actions}>
          <button type="button" style={S.btnSecondary} onClick={resetFilters}>
            Clear
          </button>
          <button type="button" style={S.btnPrimary} onClick={() => void loadSummary()} disabled={loading}>
            {loading ? "Loading..." : "Search"}
          </button>
        </div>
      </div>

      <div style={S.cardsGrid}>
        <SummaryCard
          title="Projects"
          value={rows.length}
          subtitle="Projects returned by current filters"
        />
        <SummaryCard
          title="Contract Value"
          value={formatMoney(totals.contractValue)}
          subtitle="Sum of project contract values"
        />
        <SummaryCard
          title="Total Expenses"
          value={formatMoney(totals.totalExpenses)}
          subtitle="Sum of invoice expenses"
        />
        <SummaryCard
          title="Invoices"
          value={totals.invoiceCount}
          subtitle="Invoices counted in the summary"
        />
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Project</th>
              <th style={S.th}>County</th>
              <th style={S.th}>House Model</th>
              <th style={S.th}>Contract Value</th>
              <th style={S.th}>Total Expenses</th>
              <th style={S.th}>Variance</th>
              <th style={S.th}>% Spent</th>
              <th style={S.th}>Invoices</th>
              <th style={S.th}>Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={S.empty} colSpan={9}>
                  Loading project expenses...
                </td>
              </tr>
            ) : paginatedRows.length === 0 ? (
              <tr>
                <td style={S.empty} colSpan={9}>
                  No projects found.
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr key={row.projectId}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 900 }}>{row.projectName || row.projectId}</div>
                    <div style={{ color: "rgba(17,24,39,0.55)", fontSize: 12 }}>{row.projectId}</div>
                  </td>
                  <td style={S.td}>{row.county || "-"}</td>
                  <td style={S.td}>{row.houseModelNumber || "-"}</td>
                  <td style={S.td}>{formatMoney(row.contractValue)}</td>
                  <td style={S.td}>{formatMoney(row.totalExpenses)}</td>
                  <td style={S.td}>{formatMoney(row.variance)}</td>
                  <td style={S.td}>
                    <SpendBadge value={row.percentSpent} />
                  </td>
                  <td style={S.td}>{row.invoiceCount}</td>
                  <td style={S.td}>
                    <button type="button" style={S.btnPrimary} onClick={() => void openDetails(row)}>
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={S.pager}>
        <div style={{ color: "rgba(17,24,39,0.72)", fontSize: 13, fontWeight: 700 }}>
          Showing {paginatedRows.length} of {rows.length} projects.
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            style={S.btnSecondary}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Previous
          </button>
          <div style={{ fontWeight: 800, minWidth: 90, textAlign: "center" }}>
            Page {page} / {totalPages}
          </div>
          <button
            type="button"
            style={S.btnSecondary}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {detailModal.open ? (
        <div style={S.modalBackdrop} onClick={closeDetails}>
          <div style={S.modalPanel} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 20, fontWeight: 900 }}>
                  {detailModal.data?.projectName || "Project Expense Details"}
                </div>
                <div style={{ color: "rgba(17,24,39,0.68)", fontSize: 13 }}>
                  {detailModal.data?.projectId || ""}
                </div>
                {detailModal.data ? (
                  <div style={S.chipRow}>
                    <span style={S.chip}>County: {detailModal.data.county || "-"}</span>
                    <span style={S.chip}>House Model: {detailModal.data.houseModelNumber || "-"}</span>
                    <span style={S.chip}>Contract: {formatMoney(detailModal.data.contractValue)}</span>
                    <span style={S.chip}>Items: {filteredDetailTotals.itemCount}</span>
                  </div>
                ) : null}
              </div>

              <button type="button" style={S.btnSecondary} onClick={closeDetails}>
                Close
              </button>
            </div>

            <div style={S.modalBody}>
              {detailError ? <div style={S.error}>{detailError}</div> : null}

              {detailModal.loading ? (
                <div style={S.groupCard}>
                  <div style={S.empty}>Loading details...</div>
                </div>
              ) : detailModal.data ? (
                <>
                  <div style={S.cardsGrid}>
                    <SummaryCard
                      title="Actual Cost"
                      value={formatMoney(filteredDetailTotals.totalActual)}
                      subtitle="Sum of actual invoice items"
                    />
                    <SummaryCard
                      title="Budgeted Cost"
                      value={formatMoney(filteredDetailTotals.totalBudget)}
                      subtitle="Estimated amount from financial model"
                    />
                    <SummaryCard
                      title="Variance"
                      value={formatMoney(filteredDetailTotals.totalVariance)}
                      subtitle="Actual minus budgeted"
                    />
                    <SummaryCard
                      title="Classification"
                      value={
                        detailModal.data.financialModelFound
                          ? "Financial Model Found"
                          : "No Financial Model"
                      }
                      subtitle={
                        detailModal.data.financialModelReferenceId || "No financial model linked"
                      }
                    />
                  </div>

                  <div style={S.filtersCard}>
                    <div style={S.filtersGrid}>
                      <div style={S.field}>
                        <label style={S.label}>Type</label>
                        <select
                          style={S.input}
                          value={detailFilters.type}
                          onChange={(e) =>
                            setDetailFilters((prev) => ({ ...prev, type: e.target.value }))
                          }
                        >
                          {detailTypeOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div style={S.field}>
                        <label style={S.label}>Service / Product</label>
                        <input
                          style={S.input}
                          value={detailFilters.service}
                          onChange={(e) =>
                            setDetailFilters((prev) => ({ ...prev, service: e.target.value }))
                          }
                          placeholder="Service or product name"
                        />
                      </div>

                      <div style={S.field}>
                        <label style={S.label}>Vendor</label>
                        <input
                          style={S.input}
                          value={detailFilters.vendor}
                          onChange={(e) =>
                            setDetailFilters((prev) => ({ ...prev, vendor: e.target.value }))
                          }
                          placeholder="Vendor"
                        />
                      </div>

                      <div style={S.field}>
                        <label style={S.label}>Status</label>
                        <select
                          style={S.input}
                          value={detailFilters.status}
                          onChange={(e) =>
                            setDetailFilters((prev) => ({
                              ...prev,
                              status: e.target.value as DetailFilters["status"],
                            }))
                          }
                        >
                          <option value="All">All</option>
                          <option value="Classified">Classified</option>
                          <option value="Unclassified">Unclassified</option>
                        </select>
                      </div>

                      <div style={S.field}>
                        <label style={S.label}>Date From</label>
                        <input
                          type="date"
                          style={S.input}
                          value={detailFilters.startDate}
                          onChange={(e) =>
                            setDetailFilters((prev) => ({ ...prev, startDate: e.target.value }))
                          }
                        />
                      </div>

                      <div style={S.field}>
                        <label style={S.label}>Date To</label>
                        <input
                          type="date"
                          style={S.input}
                          value={detailFilters.endDate}
                          onChange={(e) =>
                            setDetailFilters((prev) => ({ ...prev, endDate: e.target.value }))
                          }
                        />
                      </div>
                    </div>

                    <div style={S.actions}>
                      <button type="button" style={S.btnSecondary} onClick={resetDetailFilters}>
                        Clear
                      </button>
                    </div>
                  </div>

                  <div style={S.detailTableWrap}>
                    <table style={S.detailTable}>
                      <thead>
                        <tr>
                          <th style={S.th}>Type</th>
                          <th style={S.th}>Invoice Date</th>
                          <th style={S.th}>Vendor</th>
                          <th style={S.th}>Service / Product</th>
                          <th style={S.th}>Actual</th>
                          <th style={S.th}>Budgeted</th>
                          <th style={S.th}>Variance</th>
                          <th style={S.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDetailRows.length === 0 ? (
                          <tr>
                            <td style={S.empty} colSpan={8}>
                              No detail rows found with the selected filters.
                            </td>
                          </tr>
                        ) : (
                          filteredDetailRows.map((item, idx) => (
                            <tr key={`${item.expenseType}-${item.invoiceNumber}-${item.productId}-${idx}`}>
                              <td style={S.td}>
                                <div style={{ fontWeight: 800 }}>{item.typeLabel}</div>
                              </td>
                              <td style={S.td}>{formatDate(item.invoiceDate)}</td>
                              <td style={S.td}>
                                <div style={{ fontWeight: 800 }}>{item.vendor || "-"}</div>
                                <div style={{ color: "rgba(17,24,39,0.55)", fontSize: 12 }}>
                                  {item.invoiceNumber || "-"}
                                </div>
                              </td>
                              <td style={S.td}>
                                <div style={{ fontWeight: 800 }}>{item.productTitle || "-"}</div>
                                <div style={{ color: "rgba(17,24,39,0.55)", fontSize: 12 }}>
                                  Product Id: {toStr(item.productId) || "-"}
                                </div>
                              </td>
                              <td style={S.td}>{formatMoney(item.actualCost)}</td>
                              <td style={S.td}>{formatMoney(item.budgetedCost)}</td>
                              <td style={S.td}>{formatMoney(item.variance)}</td>
                              <td style={S.td}>
                                <ClassificationBadge status={item.classificationStatus} />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={S.groupCard}>
                  <div style={S.empty}>No detail available.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}