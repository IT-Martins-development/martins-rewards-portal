import React, { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

type HoldType = "Finance" | "Supplies" | "Utilities" | "Permit" | "Field" | "Final";
type PageSize = 10 | 25 | 50 | 100;
type AnyObj = Record<string, any>;

type HoldUser = {
  userId: string;
  name: string;
  email: string;
};

type HoldRecord = {
  _id: string;
  projectId: string;
  projectTitle: string;
  parcelId: string;
  type: HoldType;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  observation: string;
  createdAt: string | null;
  updatedAt: string | null;
  deletedAt?: string | null;
  createdBy?: HoldUser | null;
  updatedBy?: HoldUser | null;
};

type ProjectRow = {
  projectId: string;
  title: string;
  parcelId: string;
  currentPhase: string | null;
  holdsCount: number;
  activeHoldsCount: number;
  lastHoldType: HoldType | "";
  lastHoldStartDate: string | null;
  hasActiveHold: boolean;
  raw: AnyObj;
};

type DashboardData = {
  projectsInHold: number;
  totalActiveHolds: number;
  totalHolds: number;
  activeHoldsByType: { type: HoldType; count: number }[];
  daysByType: { type: HoldType; days: number }[];
};

type ListApiResponse = {
  data?: AnyObj[];
  total?: number;
  page?: number;
  pageSize?: number;
  ok?: boolean;
  message?: string;
};

type DetailApiResponse = {
  projectId?: string;
  title?: string;
  parcelId?: string;
  currentPhase?: string | null;
  holds?: AnyObj[];
  ok?: boolean;
  message?: string;
};

type DashboardApiResponse = DashboardData & {
  ok?: boolean;
  message?: string;
};

type Filters = {
  title: string;
  parcelId: string;
  holdType: "" | HoldType;
  activeOnly: boolean;
  pageSize: PageSize;
};

type DetailModalState = {
  open: boolean;
  loading: boolean;
  row: ProjectRow | null;
  title: string;
  parcelId: string;
  currentPhase: string | null;
  holds: HoldRecord[];
};

type HoldFormState = {
  type: HoldType;
  startDate: string;
  endDate: string;
  observation: string;
};

type HoldModalState = {
  open: boolean;
  saving: boolean;
  mode: "create" | "edit";
  projectId: string;
  holdId: string;
};

const HOLD_TYPES: HoldType[] = ["Finance", "Supplies", "Utilities", "Permit", "Field", "Final"];
const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];

const MANAGEMENT_HOLDS_API_BASE =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/management-holds";

function toStr(v: unknown) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

function normalizeHoldType(value: unknown): HoldType {
  if (
    value === "Finance" ||
    value === "Supplies" ||
    value === "Utilities" ||
    value === "Permit" ||
    value === "Field" ||
    value === "Final"
  ) {
    return value;
  }
  return "Finance";
}

function normalizeDateForInput(value?: string | null): string {
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

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

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toStr(value);

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${mm}-${dd}-${yyyy} ${hh}:${mi}`;
}

function getHoldIsActive(hold: AnyObj) {
  if (typeof hold?.isActive === "boolean") return hold.isActive;
  return !hold?.endDate;
}

function parseApiResponseText(rawText: string) {
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      message: rawText || "Resposta inválida da API.",
      rawText,
    };
  }
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();
  return parseApiResponseText(rawText);
}

async function getLoggedUser() {
  try {
    const session = await fetchAuthSession();
    const idPayload = session.tokens?.idToken?.payload || {};
    const accessPayload = session.tokens?.accessToken?.payload || {};

    return {
      userId: String(idPayload?.sub || accessPayload?.sub || ""),
      name: String(idPayload?.name || idPayload?.email || accessPayload?.username || ""),
      email: String(idPayload?.email || ""),
    };
  } catch (e) {
    console.warn("Unable to get logged user", e);
    return { userId: "", name: "", email: "" };
  }
}

function parseProjectRows(data: ListApiResponse | AnyObj): ProjectRow[] {
  const rows = Array.isArray((data as AnyObj)?.data) ? (data as AnyObj).data : [];

  return rows.map((row: AnyObj) => ({
    projectId: toStr(row?.projectId ?? row?._id),
    title: toStr(row?.title ?? row?.projectTitle),
    parcelId: toStr(row?.parcelId),
    currentPhase: row?.currentPhase ? toStr(row.currentPhase) : null,
    holdsCount: toNum(row?.holdsCount),
    activeHoldsCount: toNum(row?.activeHoldsCount),
    lastHoldType: row?.lastHoldType ? normalizeHoldType(row.lastHoldType) : "",
    lastHoldStartDate: row?.lastHoldStartDate ? toStr(row.lastHoldStartDate) : null,
    hasActiveHold:
      typeof row?.hasActiveHold === "boolean"
        ? row.hasActiveHold
        : toNum(row?.activeHoldsCount) > 0,
    raw: row,
  }));
}

function parseHolds(data: DetailApiResponse | AnyObj, projectId: string, title: string, parcelId: string) {
  const holds = Array.isArray((data as AnyObj)?.holds) ? (data as AnyObj).holds : [];

  return holds.map((hold: AnyObj) => ({
    _id: toStr(hold?._id),
    projectId: toStr(hold?.projectId || projectId),
    projectTitle: toStr(hold?.projectTitle || title),
    parcelId: toStr(hold?.parcelId || parcelId),
    type: normalizeHoldType(hold?.type),
    startDate: toStr(hold?.startDate),
    endDate: hold?.endDate ? toStr(hold.endDate) : null,
    isActive: getHoldIsActive(hold),
    observation: toStr(hold?.observation),
    createdAt: hold?.createdAt ? toStr(hold.createdAt) : null,
    updatedAt: hold?.updatedAt ? toStr(hold.updatedAt) : null,
    deletedAt: hold?.deletedAt ? toStr(hold.deletedAt) : null,
    createdBy: hold?.createdBy || null,
    updatedBy: hold?.updatedBy || null,
  })) as HoldRecord[];
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 88,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 11,
        background: active ? "rgba(22,163,74,0.12)" : "rgba(107,114,128,0.12)",
        color: active ? "#15803d" : "#4b5563",
        border: active ? "1px solid rgba(22,163,74,0.18)" : "1px solid rgba(107,114,128,0.18)",
      }}
    >
      {active ? "Active" : "Closed"}
    </span>
  );
}

function TypeBadge({ type }: { type: HoldType | "" }) {
  if (!type) return <span style={{ color: "rgba(17,24,39,0.55)" }}>-</span>;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 90,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 11,
        background: "rgba(122,90,58,0.12)",
        color: "#7A5A3A",
        border: "1px solid rgba(122,90,58,0.18)",
      }}
    >
      {type}
    </span>
  );
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

function SimpleBars({
  title,
  data,
  valueLabel,
}: {
  title: string;
  data: { label: string; value: number }[];
  valueLabel: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));

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
      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827", marginBottom: 14 }}>
        {title}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {data.length === 0 ? (
          <div style={{ color: "rgba(17,24,39,0.55)", fontSize: 12 }}>Sem dados.</div>
        ) : (
          data.map((item) => {
            const width = `${Math.max(6, (item.value / max) * 100)}%`;

            return (
              <div key={item.label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 800, color: "#111827" }}>{item.label}</div>
                  <div style={{ color: "rgba(17,24,39,0.72)", fontWeight: 800 }}>
                    {item.value} {valueLabel}
                  </div>
                </div>

                <div
                  style={{
                    height: 12,
                    width: "100%",
                    background: "rgba(122,90,58,0.10)",
                    borderRadius: 999,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width,
                      height: "100%",
                      background: "#7A5A3A",
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ManagementHolds() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData>({
    projectsInHold: 0,
    totalActiveHolds: 0,
    totalHolds: 0,
    activeHoldsByType: [],
    daysByType: [],
  });

  const [loading, setLoading] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [holdError, setHoldError] = useState("");
  const [page, setPage] = useState(1);
  const [totalFromApi, setTotalFromApi] = useState(0);

  const [filters, setFilters] = useState<Filters>({
    title: "",
    parcelId: "",
    holdType: "",
    activeOnly: true,
    pageSize: 25,
  });

  const [detailModal, setDetailModal] = useState<DetailModalState>({
    open: false,
    loading: false,
    row: null,
    title: "",
    parcelId: "",
    currentPhase: null,
    holds: [],
  });

  const [holdModal, setHoldModal] = useState<HoldModalState>({
    open: false,
    saving: false,
    mode: "create",
    projectId: "",
    holdId: "",
  });

  const [holdForm, setHoldForm] = useState<HoldFormState>({
    type: "Finance",
    startDate: "",
    endDate: "",
    observation: "",
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
    textarea: {
      width: "100%",
      minHeight: 110,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.14)",
      outline: "none",
      color: "#111827",
      backgroundColor: "#fff",
      fontSize: 13,
      boxSizing: "border-box",
      fontFamily: "inherit",
      resize: "vertical" as const,
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

  const buildQueryString = useCallback(
    (includePage = true) => {
      const params = new URLSearchParams();

      if (filters.title) params.append("title", filters.title);
      if (filters.parcelId) params.append("parcelId", filters.parcelId);
      if (filters.holdType) params.append("holdType", filters.holdType);
      if (filters.activeOnly) params.append("activeOnly", "true");
      if (includePage) {
        params.append("page", String(page));
        params.append("pageSize", String(filters.pageSize));
      }

      return params.toString();
    },
    [filters.title, filters.parcelId, filters.holdType, filters.activeOnly, filters.pageSize, page]
  );

  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);

    try {
      const qs = buildQueryString(false);
      const url = qs
        ? `${MANAGEMENT_HOLDS_API_BASE}/dashboard?${qs}`
        : `${MANAGEMENT_HOLDS_API_BASE}/dashboard`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await parseApiResponse(response)) as DashboardApiResponse;

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || `Erro ao carregar dashboard (${response.status})`);
      }

      setDashboard({
        projectsInHold: toNum(data?.projectsInHold),
        totalActiveHolds: toNum(data?.totalActiveHolds),
        totalHolds: toNum(data?.totalHolds),
        activeHoldsByType: Array.isArray(data?.activeHoldsByType) ? data.activeHoldsByType : [],
        daysByType: Array.isArray(data?.daysByType) ? data.daysByType : [],
      });
    } catch (e: any) {
      console.error("Erro ao carregar dashboard", e);
      setDashboard({
        projectsInHold: 0,
        totalActiveHolds: 0,
        totalHolds: 0,
        activeHoldsByType: [],
        daysByType: [],
      });
    } finally {
      setLoadingDashboard(false);
    }
  }, [buildQueryString]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const qs = buildQueryString(true);
      const url = qs
        ? `${MANAGEMENT_HOLDS_API_BASE}/projects?${qs}`
        : `${MANAGEMENT_HOLDS_API_BASE}/projects`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      const data = (await parseApiResponse(response)) as ListApiResponse;

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || `Erro ao carregar projects (${response.status})`);
      }

      setRows(parseProjectRows(data));
      setTotalFromApi(toNum(data?.total));
    } catch (e: any) {
      console.error("Erro ao carregar holds", e);
      setError(e?.message || "Erro ao carregar management holds.");
      setRows([]);
      setTotalFromApi(0);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    fetchDashboard();
    fetchProjects();
  }, [fetchDashboard, fetchProjects]);

  useEffect(() => {
    setPage(1);
  }, [filters.title, filters.parcelId, filters.holdType, filters.activeOnly, filters.pageSize]);

  const totalPages = Math.max(1, Math.ceil(totalFromApi / filters.pageSize));

  const chartDaysData = useMemo(
    () =>
      HOLD_TYPES.map((type) => {
        const row = dashboard.daysByType.find((item) => item.type === type);
        return { label: type, value: toNum(row?.days) };
      }),
    [dashboard.daysByType]
  );

  const chartCountData = useMemo(
    () =>
      HOLD_TYPES.map((type) => {
        const row = dashboard.activeHoldsByType.find((item) => item.type === type);
        return { label: type, value: toNum(row?.count) };
      }),
    [dashboard.activeHoldsByType]
  );

  async function openProjectDetail(row: ProjectRow) {
    setDetailError("");
    setDetailModal({
      open: true,
      loading: true,
      row,
      title: row.title,
      parcelId: row.parcelId,
      currentPhase: row.currentPhase,
      holds: [],
    });

    try {
      const response = await fetch(
        `${MANAGEMENT_HOLDS_API_BASE}/projects/${encodeURIComponent(row.projectId)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = (await parseApiResponse(response)) as DetailApiResponse;

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || `Erro ao carregar detalhe (${response.status})`);
      }

      setDetailModal((prev) => ({
        ...prev,
        loading: false,
        title: toStr(data?.title || row.title),
        parcelId: toStr(data?.parcelId || row.parcelId),
        currentPhase: data?.currentPhase ? toStr(data.currentPhase) : row.currentPhase,
        holds: parseHolds(data, row.projectId, row.title, row.parcelId),
      }));
    } catch (e: any) {
      console.error("Erro ao carregar detalhe", e);
      setDetailError(e?.message || "Erro ao carregar detalhe do projeto.");
      setDetailModal((prev) => ({
        ...prev,
        loading: false,
        holds: [],
      }));
    }
  }

  function closeDetailModal() {
    setDetailModal({
      open: false,
      loading: false,
      row: null,
      title: "",
      parcelId: "",
      currentPhase: null,
      holds: [],
    });
    setDetailError("");
  }

  function openCreateHoldModal() {
    if (!detailModal.row) return;

    setHoldError("");
    setHoldForm({
      type: "Finance",
      startDate: new Date().toISOString().slice(0, 10),
      endDate: "",
      observation: "",
    });
    setHoldModal({
      open: true,
      saving: false,
      mode: "create",
      projectId: detailModal.row.projectId,
      holdId: "",
    });
  }

  function openEditHoldModal(hold: HoldRecord) {
    setHoldError("");
    setHoldForm({
      type: hold.type,
      startDate: normalizeDateForInput(hold.startDate),
      endDate: normalizeDateForInput(hold.endDate),
      observation: hold.observation || "",
    });
    setHoldModal({
      open: true,
      saving: false,
      mode: "edit",
      projectId: hold.projectId,
      holdId: hold._id,
    });
  }

  function closeHoldModal() {
    setHoldModal({
      open: false,
      saving: false,
      mode: "create",
      projectId: "",
      holdId: "",
    });
    setHoldError("");
  }

  async function saveHold() {
    if (!holdModal.projectId) {
      setHoldError("ProjectId inválido.");
      return;
    }

    if (!holdForm.type) {
      setHoldError("Type é obrigatório.");
      return;
    }

    if (!holdForm.startDate) {
      setHoldError("Start Date é obrigatório.");
      return;
    }

    if (holdForm.endDate && new Date(holdForm.endDate).getTime() < new Date(holdForm.startDate).getTime()) {
      setHoldError("End Date deve ser maior ou igual ao Start Date.");
      return;
    }

    try {
      setHoldModal((prev) => ({ ...prev, saving: true }));
      setHoldError("");

      const user = await getLoggedUser();
      if (!user.userId) {
        throw new Error("Não foi possível identificar o usuário logado.");
      }

      const payload = {
        type: holdForm.type,
        startDate: holdForm.startDate,
        endDate: holdForm.endDate || null,
        observation: holdForm.observation || "",
        userId: user.userId,
        userName: user.name,
        userEmail: user.email,
      };

      const isEdit = holdModal.mode === "edit";
      const url = isEdit
        ? `${MANAGEMENT_HOLDS_API_BASE}/projects/${encodeURIComponent(
            holdModal.projectId
          )}/holds/${encodeURIComponent(holdModal.holdId)}`
        : `${MANAGEMENT_HOLDS_API_BASE}/projects/${encodeURIComponent(holdModal.projectId)}/holds`;

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await parseApiResponse(response);

      if (!response.ok || (data as AnyObj)?.ok === false) {
        throw new Error((data as AnyObj)?.message || `Erro ao salvar hold (${response.status})`);
      }

      closeHoldModal();
      await fetchDashboard();
      await fetchProjects();

      if (detailModal.row) {
        await openProjectDetail(detailModal.row);
      }
    } catch (e: any) {
      console.error("Erro ao salvar hold", e);
      setHoldError(e?.message || "Erro ao salvar hold.");
    } finally {
      setHoldModal((prev) => ({ ...prev, saving: false }));
    }
  }

  function exportCurrentViewCsv() {
    const headers = [
      "Project Title",
      "Parcel Id",
      "Current Phase",
      "Active Holds",
      "Total Holds",
      "Last Hold Type",
      "Last Hold Start Date",
      "Has Active Hold",
    ];

    const csvEscape = (value: unknown) => {
      const text = String(value ?? "");
      if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const lines = rows.map((row) =>
      [
        row.title,
        row.parcelId,
        row.currentPhase || "",
        row.activeHoldsCount,
        row.holdsCount,
        row.lastHoldType || "",
        formatDisplayDate(row.lastHoldStartDate),
        row.hasActiveHold ? "Yes" : "No",
      ]
        .map(csvEscape)
        .join(",")
    );

    const csv = [headers.map(csvEscape).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "management_holds.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", padding: 16 }}>
      <div style={S.page}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Management Hold</div>
            <div style={{ marginTop: 6, color: "rgba(17,24,39,0.60)", fontSize: 13 }}>
              Gestão de holds por projeto, com dashboard, filtros, detalhe e edição.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button style={S.btnGhost} onClick={exportCurrentViewCsv}>
              Exportar CSV
            </button>
            <button
              style={S.btnPrimary}
              onClick={() => {
                fetchDashboard();
                fetchProjects();
              }}
              disabled={loading || loadingDashboard}
            >
              {loading || loadingDashboard ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr 1fr 1fr 180px",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <div>
            <span style={S.label}>Project Title</span>
            <input
              style={S.input}
              placeholder="Buscar projeto"
              value={filters.title}
              onChange={(e) => setFilters((p) => ({ ...p, title: e.target.value }))}
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
            <span style={S.label}>Hold Type</span>
            <select
              style={S.input}
              value={filters.holdType}
              onChange={(e) =>
                setFilters((p) => ({ ...p, holdType: e.target.value as Filters["holdType"] }))
              }
            >
              <option value="">Todos</option>
              {HOLD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Only Active</span>
            <select
              style={S.input}
              value={filters.activeOnly ? "true" : "false"}
              onChange={(e) => setFilters((p) => ({ ...p, activeOnly: e.target.value === "true" }))}
            >
              <option value="true">Yes</option>
              <option value="false">All</option>
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
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <SummaryCard
            title="Projects in Hold"
            value={loadingDashboard ? "..." : dashboard.projectsInHold}
            subtitle="Projetos com pelo menos um hold ativo"
          />
          <SummaryCard
            title="Active Holds"
            value={loadingDashboard ? "..." : dashboard.totalActiveHolds}
            subtitle="Quantidade total de holds ativos"
          />
          <SummaryCard
            title="Total Holds"
            value={loadingDashboard ? "..." : dashboard.totalHolds}
            subtitle="Abertos e encerrados"
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0,1fr))",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <SimpleBars title="Days by Hold Type" data={chartDaysData} valueLabel="days" />
          <SimpleBars title="Active Holds by Type" data={chartCountData} valueLabel="holds" />
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
          <div
            style={{
              overflowX: "auto",
              overflowY: "auto",
              maxHeight: "72vh",
              position: "relative",
            }}
          >
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: 1450,
                width: "100%",
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...S.th, minWidth: 260 }}>Project Title</th>
                  <th style={{ ...S.th, minWidth: 160 }}>Parcel Id</th>
                  <th style={{ ...S.th, minWidth: 180 }}>Current Phase</th>
                  <th style={{ ...S.th, minWidth: 120 }}>Active Holds</th>
                  <th style={{ ...S.th, minWidth: 110 }}>Total Holds</th>
                  <th style={{ ...S.th, minWidth: 140 }}>Last Type</th>
                  <th style={{ ...S.th, minWidth: 140 }}>Last Start Date</th>
                  <th style={{ ...S.th, minWidth: 110 }}>Status</th>
                  <th style={{ ...S.th, minWidth: 110, textAlign: "center" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: "center" }}>
                      Carregando...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: "center" }}>
                      Nenhum resultado encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.projectId}>
                      <td style={{ ...S.td, minWidth: 260 }}>{row.title || "-"}</td>
                      <td style={{ ...S.td, minWidth: 160 }}>{row.parcelId || "-"}</td>
                      <td style={{ ...S.td, minWidth: 180 }}>{row.currentPhase || "-"}</td>
                      <td style={{ ...S.td, minWidth: 120 }}>{row.activeHoldsCount}</td>
                      <td style={{ ...S.td, minWidth: 110 }}>{row.holdsCount}</td>
                      <td style={{ ...S.td, minWidth: 140 }}>
                        <TypeBadge type={row.lastHoldType} />
                      </td>
                      <td style={{ ...S.td, minWidth: 140 }}>
                        {formatDisplayDate(row.lastHoldStartDate)}
                      </td>
                      <td style={{ ...S.td, minWidth: 110 }}>
                        <StatusBadge active={row.hasActiveHold} />
                      </td>
                      <td style={{ ...S.td, minWidth: 110, textAlign: "center" }}>
                        <button style={S.btnGhost} onClick={() => openProjectDetail(row)}>
                          Details
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

      {detailModal.open ? (
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
              maxWidth: 1320,
              background: "#fff",
              borderRadius: 18,
              boxShadow: "0 30px 80px rgba(0,0,0,0.24)",
              overflow: "hidden",
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: 18,
                borderBottom: "1px solid rgba(0,0,0,0.08)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "flex-start",
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 900 }}>Project Holds</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(17,24,39,0.60)" }}>
                  {detailModal.title || "-"} • {detailModal.parcelId || "-"} • Phase:{" "}
                  {detailModal.currentPhase || "-"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnGhost} onClick={closeDetailModal}>
                  Close
                </button>
                <button style={S.btnPrimary} onClick={openCreateHoldModal}>
                  New Hold
                </button>
              </div>
            </div>

            <div style={{ padding: 18, overflow: "auto" }}>
              {detailError ? (
                <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 800 }}>
                  {detailError}
                </div>
              ) : null}

              {detailModal.loading ? (
                <div style={{ padding: 24, textAlign: "center" }}>Carregando detalhe...</div>
              ) : detailModal.holds.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center" }}>Nenhum hold encontrado.</div>
              ) : (
                <div
                  style={{
                    background: "white",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.08)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        borderCollapse: "separate",
                        borderSpacing: 0,
                        minWidth: 1600,
                        width: "100%",
                      }}
                    >
                      <thead>
                        <tr>
                          <th style={{ ...S.th, minWidth: 120 }}>Type</th>
                          <th style={{ ...S.th, minWidth: 110 }}>Status</th>
                          <th style={{ ...S.th, minWidth: 120 }}>Start Date</th>
                          <th style={{ ...S.th, minWidth: 120 }}>End Date</th>
                          <th style={{ ...S.th, minWidth: 260 }}>Observation</th>
                          <th style={{ ...S.th, minWidth: 180 }}>Created By</th>
                          <th style={{ ...S.th, minWidth: 150 }}>Created At</th>
                          <th style={{ ...S.th, minWidth: 180 }}>Updated By</th>
                          <th style={{ ...S.th, minWidth: 150 }}>Updated At</th>
                          <th style={{ ...S.th, minWidth: 110, textAlign: "center" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailModal.holds.map((hold) => (
                          <tr key={hold._id}>
                            <td style={{ ...S.td, minWidth: 120 }}>
                              <TypeBadge type={hold.type} />
                            </td>
                            <td style={{ ...S.td, minWidth: 110 }}>
                              <StatusBadge active={hold.isActive} />
                            </td>
                            <td style={{ ...S.td, minWidth: 120 }}>
                              {formatDisplayDate(hold.startDate)}
                            </td>
                            <td style={{ ...S.td, minWidth: 120 }}>
                              {formatDisplayDate(hold.endDate)}
                            </td>
                            <td
                              style={{
                                ...S.td,
                                minWidth: 260,
                                whiteSpace: "normal",
                                lineHeight: 1.4,
                              }}
                            >
                              {hold.observation || "-"}
                            </td>
                            <td style={{ ...S.td, minWidth: 180 }}>
                              {hold.createdBy?.name || hold.createdBy?.email || "-"}
                            </td>
                            <td style={{ ...S.td, minWidth: 150 }}>
                              {formatDateTime(hold.createdAt)}
                            </td>
                            <td style={{ ...S.td, minWidth: 180 }}>
                              {hold.updatedBy?.name || hold.updatedBy?.email || "-"}
                            </td>
                            <td style={{ ...S.td, minWidth: 150 }}>
                              {formatDateTime(hold.updatedAt)}
                            </td>
                            <td style={{ ...S.td, minWidth: 110, textAlign: "center" }}>
                              <button style={S.btnGhost} onClick={() => openEditHoldModal(hold)}>
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {holdModal.open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            display: "grid",
            placeItems: "center",
            zIndex: 60,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 820,
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>
                  {holdModal.mode === "create" ? "New Hold" : "Edit Hold"}
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(17,24,39,0.60)" }}>
                  {detailModal.title || "-"} • {detailModal.parcelId || "-"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  style={S.btnGhost}
                  onClick={closeHoldModal}
                  disabled={holdModal.saving}
                >
                  Cancelar
                </button>
                <button
                  style={S.btnPrimary}
                  onClick={saveHold}
                  disabled={holdModal.saving}
                >
                  {holdModal.saving ? "Salvando..." : "Save"}
                </button>
              </div>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 18 }}>
              {holdError ? (
                <div style={{ color: "#b91c1c", fontWeight: 800 }}>{holdError}</div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                  gap: 12,
                }}
              >
                <div>
                  <span style={S.label}>Type</span>
                  <select
                    style={S.input}
                    value={holdForm.type}
                    onChange={(e) =>
                      setHoldForm((prev) => ({
                        ...prev,
                        type: e.target.value as HoldType,
                      }))
                    }
                  >
                    {HOLD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span style={S.label}>Project</span>
                  <input style={S.input} readOnly value={detailModal.title || ""} />
                </div>

                <div>
                  <span style={S.label}>Start Date</span>
                  <input
                    type="date"
                    style={S.input}
                    value={holdForm.startDate}
                    onChange={(e) =>
                      setHoldForm((prev) => ({ ...prev, startDate: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <span style={S.label}>End Date</span>
                  <input
                    type="date"
                    style={S.input}
                    value={holdForm.endDate}
                    onChange={(e) =>
                      setHoldForm((prev) => ({ ...prev, endDate: e.target.value }))
                    }
                  />
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <span style={S.label}>Observation</span>
                  <textarea
                    style={S.textarea}
                    value={holdForm.observation}
                    placeholder="Descreva o motivo do hold"
                    onChange={(e) =>
                      setHoldForm((prev) => ({
                        ...prev,
                        observation: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}