import React, { useEffect, useMemo, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

type AnyObj = Record<string, any>;
type PhaseKey =
  | "Pre Construction"
  | "Phase 1"
  | "Phase 2"
  | "Phase 3"
  | "Final Phase"
  | "Utilities"
  | "Supplies";
  type PageSize = 10 | 25 | 50 | 100;

type Filters = {
  phase: PhaseKey;
  operator: string;
  projectTitle: string;
  county: string;
  projectColor: string;
  currentPhase: string;
  phaseStatus: string;
  showConcluded: boolean;
  pageSize: PageSize;
};

type ProjectStatusRow = {
  projectId: string;
  title: string;
  operator: string;
  county: string;
  projectColor: string;
  currentPhase: string;
  phaseColor: string;
  phaseStatus: string;
  phaseDurationDays: number;
  raw: AnyObj;
};

type TaskDoc = {
  taskId: string;
  projectId: string;
  phase: PhaseKey;
  title: string;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  completedDate?: string | null;
  expectedStartDate?: string | null;
  workDays?: number;
  workdays?: number;
  operatorId?: string | null;
  managerId?: string | null;
  type?: string | null;
  subVendorIds?: string[];
  raw: AnyObj;
};

type SubvendorOption = {
  id: string;
  companyName: string;
};

type JoinedRow = ProjectStatusRow & {
  tasks: Record<string, TaskDoc | null>;
};

type TimelineApiResponse = {
  ok: boolean;
  phase: PhaseKey;
  taskOrder: string[];
  rows: Array<{
    projectId: string;
    project: string;
    operator: string;
    county: string;
    projectColor: string;
    currentPhase: string;
    phaseStatus: string | null;
    phaseDays: number;
    phaseColor: string | null;
    tasks: Record<string, any>;
  }>;
};

type TaskModalState = {
  open: boolean;
  row: JoinedRow | null;
  taskName: string;
  task: TaskDoc | null;
};

type TaskFormState = {
  status: "Todo" | "InProgress" | "Done";
  startDate: string;
  completedDate: string;
  subVendorIds: string[];
};

const TIMELINE_API_URL =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/projects-timeline-by-phase";
const SUBVENDORS_API_URL =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/subvendors-options";
const TASKS_UPDATE_API_URL =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/tasks-update";

const PHASES: PhaseKey[] = [
  "Pre Construction",
  "Phase 1",
  "Phase 2",
  "Phase 3",
  "Final Phase",
  "Utilities",
  "Supplies",
];
const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];
const COLOR_OPTIONS = ["Verde", "Amarelo", "Laranja", "Vermelho"];
const CURRENT_PHASE_OPTIONS = ["Pre Construction", "Phase 1", "Phase 2", "Phase 3", "Utilities", "Supplies", "Concluded"];
const PHASE_STATUS_OPTIONS = ["Todo", "Pending", "In Progress", "Done", "Delayed", "On Hold", "Concluded"];

const TASK_ORDER: Record<PhaseKey, string[]> = {
  "Pre Construction": [
    "Survey",
    "Energy/ Load Calculation",
    "Plans",
    "Septic Permit",
    "Truss Engineer",
    "Internal Plans Review",
    "Permit Application Send",
    "Application fee",
    "Review Plans - Gate Check",
    "Permit issued",
  ],
  "Phase 1": [
    "Lot clearing",
    "Elevation stakes",
    "Pad build",
    "Compaction test",
    "Hub and tack",
    "Railing",
    "Rough underground plumbing",
    "Order Dumpster & Toilet",
    "Inspection - Plumbing Underground",
    "Inspection - Water Service",
    "Order Rebar Pre Slab",
    "Delivery - Pre slab",
    "Pre Slab",
    "Inspection - Pre slab",
    "Slab pour",
    "Order Block & Rebars",
    "Delivery - Block rebars",
    "Block labor",
    "Truss layout labor",
    "Inspection - Lintel",
    "Electrical TUG Installation",
    "Lintel pour",
    "Inspection - Const ELE - TUG",
    "Stucco Grade",
  ],
  "Phase 2": [
    "Delivery - Trusses",
    "Delivery - Lumber",
    "Framing & Roof Assembly",
    "Inspection - Roof Assembly",
    "Inspection - Sub-siding",
    "2nd rough plumbing",
    "Roof Dry-in",
    "Delivery Windows & Doors",
    "Windows and doors installation",
    "HVAC Installation",
    "Inspection - Rough Plumbing",
    "Inspection - Roofing Dry-In",
    "Framing punch out",
    "Wire lath installation",
    "Eletrical Rough",
    "Inspection - Rough Mechanical",
    "Inspection - Wire Lath",
    "Stucco",
    "Order Paver Driveway",
    "Inspection - Rough Electric",
    "Delivery - Shingles & Vents",
    "Shingle installation",
    "Inspection - Frame Structural",
    "Delivery Insulation",
    "Insulation",
    "Inspection - Insulation",
  ],
  "Phase 3": [
    "Delivery - Drywall",
    "Drywall hanging and finish",
    "Interior Painting",
    "Exterior painting",
    "Garage Door installation",
    "Delivery - VinylTile",
    "Soffit installation",
    "Tile Installation",
    "Driveway Lot",
    "Delivery Blowing Insulation - Warehouse",
    "Delivery Metalita Tile, Finish Plumbing & Electric",
    "Vinyl Installation",
    "Driveway Railing / base",
    "Blowing insulation",
    "Cabinet installation",
    "Inspection - Flatwork Pre pavi",
    "Inspection - Driveway Apron Form Up",
    "Driveway Concrete or Paver",
    "Inspection Blowing Installation",
    "Countertop installation",
    "Final Grade",
    "Delivery - Interior Door and Trim",
    "HVAC Machine Installation",
    "Electric - For Power Installation",
    "Plumbing Trim",
    "Sod installation",
    "Doors And Trim Installation",
    "Inspection - Final Plumbing",
    "Blowing Door Test",
    "Termite bait system",
    "Inspection - Driveway Apron Final",
    "Hot Check",
    "Appliance Delivery",
    "Appliance install",
    "Turn on AC",
    "Inspection - Final Electric",
    "Trim and door & Final painting",
    "Remove Dumpster",
    "Inspection - Final Structural",
    "Inspection - Final Mechanical",
    "Quality check",
    "CO issued",
    "Final Cleaning",
    "Walktrough",
  ],
  Utilities: [
    "Electrical Request",
    "Water Install",
    "Electrical Payment",
    "Electrical - Inspection TUG",
    "Electrical Meter Install",
    "Septic Request",
    "Septic Install",
    "Inspection - Site Departure - Septic",
  ],
  Supplies: [
    "Order Trusses",
    "Order Windows & Door",
    "Order Insulation",
    "Order Lumber",
    "Choose Cabinet Tile & Vinyl",
    "Order Tub Bath Guest - Warehouse",
    "Order Shingles & Vents",
    "Order Drywall",
    "Request/Order Delivery Tile & Vinyl",
    "Order Trim Doors",
    "Order Appliances",
    "Request Bath Service",
  ],
  "Final Phase": [
  "Punch List",
  "Punch List/Out",
  "Final Survey",
  "Final Walkthrough",
  "Client Walkthrough",
  "Warranty Orientation",
  "Final Touch-up",
  "Final Repairs",
  "Final Approval",
  "Closeout",
],
};

function toStr(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function normalizePhaseName(value: string) {
  const s = value?.trim().toLowerCase();

  if (s.includes("pre")) return "Pre Construction";
  if (s.includes("phase 1")) return "Phase 1";
  if (s.includes("phase 2")) return "Phase 2";
  if (s.includes("phase 3")) return "Phase 3";
  if (s.includes("final")) return "Final Phase";

  return value;
}

function normalizeTaskName(value: any) {
  return toStr(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function parseApiArray(data: TimelineApiResponse | AnyObj): any[] {
  if (Array.isArray((data as any)?.rows)) return (data as any).rows;
  if (Array.isArray(data)) return data as any[];
  return [];
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy}`;
}

function formatIsoDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function todayInputValue(): string {
  return formatIsoDate(new Date().toISOString());
}

function daysUntil(dateLike?: string | null): number | null {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((a - b) / 86400000);
}
function taskVisual(task: TaskDoc | null) {
  if (!task) {
    return { className: "null", date: "-", label: "Nulo", severity: "none" as const };
  }

  const normalized = toStr(task.status || "Todo").trim().toLowerCase();
  const refDate = task.startDate || task.expectedStartDate || task.endDate || null;
  const delta = daysUntil(refDate);

  if (normalized === "done" || normalized === "completed") {
    const when = task.completedDate || task.endDate || task.startDate;
    return {
      className: "done",
      date: formatDate(when),
      label: "Concluída",
      severity: "done" as const,
    };
  }

  const isLateWarning = delta !== null && delta < 0 && delta >= -7;
  const isLateDanger = delta !== null && delta < -7;

  if (normalized === "in progress" || normalized === "inprogress") {
    if (isLateDanger) {
      return {
        className: "progress danger",
        date: formatDate(refDate),
        label: "Em andamento crítica",
        severity: "danger" as const,
      };
    }

    if (isLateWarning) {
      return {
        className: "progress warning",
        date: formatDate(refDate),
        label: "Em andamento vencida",
        severity: "warning" as const,
      };
    }

    return {
      className: "progress",
      date: formatDate(refDate),
      label: "Em andamento",
      severity: "progress" as const,
    };
  }

  if (
    normalized === "pending" ||
    normalized === "todo" ||
    normalized === "" ||
    normalized === "not started"
  ) {
    if (isLateDanger) {
      return {
        className: "todo danger",
        date: formatDate(refDate),
        label: "Não iniciada crítica",
        severity: "danger" as const,
      };
    }

    if (isLateWarning) {
      return {
        className: "todo warning",
        date: formatDate(refDate),
        label: "Não iniciada vencida",
        severity: "warning" as const,
      };
    }

    return {
      className: "todo",
      date: formatDate(refDate),
      label: "Não iniciada",
      severity: "todo" as const,
    };
  }

  if (isLateDanger) {
    return {
      className: "todo danger",
      date: formatDate(refDate),
      label: "Crítica",
      severity: "danger" as const,
    };
  }

  if (isLateWarning) {
    return {
      className: "todo warning",
      date: formatDate(refDate),
      label: "Vencida",
      severity: "warning" as const,
    };
  }

  return {
    className: "todo",
    date: formatDate(refDate),
    label: "Não iniciada",
    severity: "todo" as const,
  };
}

function StatusIcon({ task }: { task: TaskDoc | null }) {
  const visual = taskVisual(task);

  const base: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    position: "relative",
    background: "#fff",
    fontWeight: 900,
    margin: "0 auto",
    cursor: task?.taskId ? "pointer" : "not-allowed",
  };

  let style: React.CSSProperties = {
    ...base,
    border: "4px solid #cbd5e1",
    color: "#9aa3af",
    fontSize: 18,
  };

  let symbol = "•";

  if (visual.severity === "done") {
    style = {
      ...style,
      border: "4px solid #16a34a",
      color: "#16a34a",
    };
    symbol = "✓";
  } else if (visual.className.includes("progress") && visual.severity === "progress") {
    style = {
      ...style,
      border: "4px solid #2563eb",
      color: "#2563eb",
    };
    symbol = "◔";
  } else if (visual.severity === "warning") {
    style = {
      ...style,
      border: "4px solid #d97706",
      color: "#d97706",
    };
    symbol = "!";
  } else if (visual.severity === "danger") {
    style = {
      ...style,
      border: "4px solid #dc2626",
      color: "#dc2626",
    };
    symbol = "!";
  } else if (visual.severity === "todo") {
    style = {
      ...style,
      border: "4px solid #94a3b8",
      color: "#94a3b8",
    };
    symbol = "•";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 110 }}>
      <div style={style}>{symbol}</div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: "#111827",
          whiteSpace: "nowrap",
        }}
      >
        {visual.date}
      </div>

      <div
        style={{
          fontSize: 10,
          color: "rgba(17,24,39,0.65)",
          textAlign: "center",
          lineHeight: 1.2,
          maxWidth: 100,
        }}
      >
        {visual.label}
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
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
      <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(17,24,39,0.65)", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>{value}</div>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(17,24,39,0.70)" }}>{subtitle}</div>
    </div>
  );
}

function normalizeTimelineApiRow(row: any, phase: PhaseKey): { project: ProjectStatusRow; tasks: TaskDoc[] } {
  const tasksObj = row?.tasks || {};
  const taskDocs: TaskDoc[] = Object.keys(tasksObj).map((key) => {
    const t = tasksObj[key] || {};
    return {
      taskId: toStr(t.taskId || t._id || ""),
      projectId: toStr(row.projectId || t.projectId),
      phase,
      title: toStr(t.title || key),
      status: toStr(t.status || "Todo"),
      startDate: t.startDate || null,
      endDate: t.endDate || null,
      completedDate: t.completedDate || null,
      expectedStartDate: t.expectedStartDate || null,
      workDays: typeof t.workdays === "number" ? t.workdays : typeof t.workDays === "number" ? t.workDays : undefined,
      workdays: typeof t.workdays === "number" ? t.workdays : typeof t.workDays === "number" ? t.workDays : undefined,
      operatorId: t.operatorId || null,
      managerId: t.managerId || null,
      type: t.type || "Construction",
      subVendorIds: Array.isArray(t.subVendorIds) ? t.subVendorIds : [],
      raw: t,
    };
  });

  return {
    project: {
      projectId: toStr(row.projectId),
      title: toStr(row.project),
      operator: toStr(row.operator),
      county: toStr(row.county),
      projectColor: toStr(row.projectColor),
      currentPhase: toStr(row.currentPhase),
      phaseColor: toStr(row.phaseColor),
      phaseStatus: toStr(row.phaseStatus),
      phaseDurationDays: Number(row.phaseDays || 0),
      raw: row,
    },
    tasks: taskDocs,
  };
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

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function ProjectTimelineByPhase() {
  const [projectStatusRows, setProjectStatusRows] = useState<ProjectStatusRow[]>([]);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [taskColumns, setTaskColumns] = useState<string[]>(TASK_ORDER["Phase 1"]);
  const [loading, setLoading] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
  const [page, setPage] = useState(1);
  const [subvendors, setSubvendors] = useState<SubvendorOption[]>([]);
  const [subvendorSearch, setSubvendorSearch] = useState("");
  const [taskModal, setTaskModal] = useState<TaskModalState>({ open: false, row: null, taskName: "", task: null });
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    status: "Todo",
    startDate: "",
    completedDate: "",
    subVendorIds: [],
  });

  const [filters, setFilters] = useState<Filters>({
    phase: "Phase 1",
    operator: "",
    projectTitle: "",
    county: "",
    projectColor: "",
    currentPhase: "",
    phaseStatus: "",
    showConcluded: true,
    pageSize: 10,
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
    header: { display: "flex", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" },
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
    },
    label: { fontSize: 11, color: "rgba(17,24,39,0.75)", fontWeight: 800, marginBottom: 4, display: "block" },
    td: {
      padding: "10px 10px",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      fontSize: 12,
      color: "#111827",
      verticalAlign: "middle",
    },
  };

  async function fetchSubvendors() {
    try {
      const res = await fetch(SUBVENDORS_API_URL);
      const data = await res.json();
      if (res.ok && data?.ok && Array.isArray(data.items)) {
        setSubvendors(data.items);
      }
    } catch (e) {
      console.error("Erro ao carregar subvendors", e);
    }
  }

  async function fetchData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(TIMELINE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: normalizePhaseName(filters.phase),
          operator: filters.operator || undefined,
          project: filters.projectTitle || undefined,
          county: filters.county || undefined,
          projectColor: filters.projectColor || undefined,
          currentPhase: normalizePhaseName(filters.currentPhase),          phaseStatus: filters.phaseStatus || undefined,
          showConcluded: filters.showConcluded,
        }),
      });

      const data: TimelineApiResponse = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error((data as any)?.message || `Erro ao carregar timeline (${response.status})`);
      }

      const apiRows = parseApiArray(data);
      const normalizedProjects: ProjectStatusRow[] = [];
      const normalizedTasks: TaskDoc[] = [];

      for (const row of apiRows) {
        const normalized = normalizeTimelineApiRow(row, filters.phase);
        normalizedProjects.push(normalized.project);
        normalizedTasks.push(...normalized.tasks);
      }

      setTaskColumns(Array.isArray(data?.taskOrder) && data.taskOrder.length ? data.taskOrder : TASK_ORDER[filters.phase]);
      setProjectStatusRows(normalizedProjects);
      setTasks(normalizedTasks);
    } catch (e: any) {
      console.error("Erro ao carregar timeline por phase", e);
      setError(e?.message || "Erro ao carregar timeline por phase.");
      setProjectStatusRows([]);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [
    filters.phase,
    filters.operator,
    filters.projectTitle,
    filters.county,
    filters.projectColor,
    filters.currentPhase,
    filters.phaseStatus,
    filters.showConcluded,
  ]);

  useEffect(() => {
    fetchSubvendors();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const joinedRows = useMemo<JoinedRow[]>(() => {
    const taskMapByProject = new Map<string, Record<string, TaskDoc | null>>();

    for (const row of projectStatusRows) {
      const bucket: Record<string, TaskDoc | null> = {};
      for (const taskName of taskColumns) {
        bucket[normalizeTaskName(taskName)] = null;
      }
      taskMapByProject.set(row.projectId, bucket);
    }

    for (const task of tasks) {
      if (!taskMapByProject.has(task.projectId)) continue;
      const bucket = taskMapByProject.get(task.projectId)!;
      const key = normalizeTaskName(task.title);
      if (key in bucket) bucket[key] = task;
    }

    return projectStatusRows.map((row) => {
      const rawBucket = taskMapByProject.get(row.projectId) || {};
      const orderedTasks: Record<string, TaskDoc | null> = {};
      for (const taskName of taskColumns) {
        orderedTasks[taskName] = rawBucket[normalizeTaskName(taskName)] || null;
      }
      return {
        ...row,
        tasks: orderedTasks,
      };
    });
  }, [projectStatusRows, tasks, taskColumns]);

  const filteredRows = useMemo(() => {
    return joinedRows.filter((row) => {
      if (filters.operator && row.operator !== filters.operator) return false;
      if (filters.projectTitle && !row.title.toLowerCase().includes(filters.projectTitle.toLowerCase())) return false;
      if (filters.county && row.county !== filters.county) return false;
      if (filters.projectColor && row.projectColor !== filters.projectColor) return false;
      if (filters.currentPhase && row.currentPhase !== filters.currentPhase) return false;
      if (filters.phaseStatus && row.phaseStatus !== filters.phaseStatus) return false;
      if (!filters.showConcluded && row.currentPhase === "Concluded") return false;
      return true;
    });
  }, [joinedRows, filters]);

  const operatorOptions = useMemo(
    () => Array.from(new Set(projectStatusRows.map((r) => r.operator).filter(Boolean))).sort(),
    [projectStatusRows]
  );

  const countyOptions = useMemo(
    () => Array.from(new Set(projectStatusRows.map((r) => r.county).filter(Boolean))).sort(),
    [projectStatusRows]
  );

  const metrics = useMemo(() => {
    let done = 0;
    let progress = 0;
    let attention = 0;
    let totalDuration = 0;

    filteredRows.forEach((row) => {
      totalDuration += Number(row.phaseDurationDays || 0);

      for (const taskName of taskColumns) {
        const visual = taskVisual(row.tasks[taskName]);
        if (visual.className === "done") done += 1;
        else if (visual.className === "progress") progress += 1;
        else if (visual.className.includes("danger") || visual.className.includes("warning")) attention += 1;
      }
    });

    return {
      done,
      progress,
      attention,
      avgDuration: filteredRows.length ? (totalDuration / filteredRows.length).toFixed(1) : "0.0",
    };
  }, [filteredRows, taskColumns]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / filters.pageSize));

  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * filters.pageSize, page * filters.pageSize),
    [filteredRows, page, filters.pageSize]
  );

  function handleTaskStatusChange(newStatus: string) {
    setTaskForm((prev) => {
      const next = { ...prev, status: newStatus as TaskFormState["status"] };

      if ((newStatus === "InProgress" || newStatus === "Done") && !next.startDate) {
        next.startDate = todayInputValue();
      }

      if (newStatus === "Done") {
        if (!next.completedDate) next.completedDate = todayInputValue();
      } else {
        next.completedDate = "";
      }

      return next;
    });
  }

  function openTaskModal(row: JoinedRow, taskName: string, task: TaskDoc | null) {
    setEditError("");

    const effectiveTaskId = task?.taskId || toStr(task?.raw?._id || "");

    if (!task || !effectiveTaskId) {
      setEditError("Esta tarefa ainda não possui registro real na collection tasks para edição.");
      return;
    }

    const raw = toStr(task.status || "Todo").trim().toLowerCase();
    const normalizedStatus: TaskFormState["status"] =
      raw === "done" || raw === "completed"
        ? "Done"
        : raw === "in progress" || raw === "inprogress"
        ? "InProgress"
        : "Todo";

    const startDateValue =
      formatIsoDate(task.startDate || task.expectedStartDate || null) ||
      (normalizedStatus === "InProgress" || normalizedStatus === "Done" ? todayInputValue() : "");

    const completedDateValue =
      normalizedStatus === "Done"
        ? formatIsoDate(task.completedDate || task.endDate || null) || todayInputValue()
        : "";

    setTaskModal({ open: true, row, taskName, task });
    setTaskForm({
      status: normalizedStatus,
      startDate: startDateValue,
      completedDate: completedDateValue,
      subVendorIds: Array.isArray(task.subVendorIds) ? task.subVendorIds : [],
    });
  }

function closeTaskModal() {
  setTaskModal({ open: false, row: null, taskName: "", task: null });
  setEditError("");
  setSubvendorSearch("");
}

  async function saveTask() {
    if (!taskModal.row || !taskModal.task?.taskId) {
      setEditError("Task inválida para edição.");
      return;
    }

    if (taskForm.status === "Done" && !taskForm.completedDate) {
      setEditError("Completed Date é obrigatório quando o status for Done.");
      return;
    }

    try {
      setSavingTask(true);
      setEditError("");

      const userId = await getLoggedUserId();
      if (!userId) {
        throw new Error("Não foi possível identificar o usuário logado.");
      }

      const response = await fetch(TASKS_UPDATE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskModal.task.taskId || toStr(taskModal.task.raw?._id || ""),
          projectId: taskModal.row.projectId,
          userId,
          status: taskForm.status,
          startDate: taskForm.startDate || "",
          completedDate: taskForm.completedDate || "",
          subVendorIds: taskForm.subVendorIds,
        }),
      });

      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || `Erro ao salvar task (${response.status})`);
      }

      closeTaskModal();
      await fetchData();
    } catch (e: any) {
      console.error("Erro ao salvar task", e);
      setEditError(e?.message || "Erro ao salvar task.");
    } finally {
      setSavingTask(false);
    }
  }

  function exportCurrentViewCsv() {
    const headers = [
      "Projeto",
      "Operador",
      "County",
      "Farol Projeto",
      "Fase Atual",
      "Status da Phase",
      "Duração de Dias da Phase",
      "Farol da Phase",
      ...taskColumns.map((task) => `${task} (${filters.phase})`),
    ];

    const lines = filteredRows.map((row) => {
      const base = [
        row.title,
        row.operator,
        row.county,
        row.projectColor,
        row.currentPhase,
        row.phaseStatus,
        row.phaseDurationDays,
        row.phaseColor,
      ];

      const tasksPart = taskColumns.map((taskName) => {
        const task = row.tasks[taskName];
        const visual = taskVisual(task);
        return `${visual.label} | ${visual.date}`;
      });

      return [...base, ...tasksPart].map(csvEscape).join(",");
    });

    const csv = [headers.map(csvEscape).join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline_${filters.phase.replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

const fixedCols = [
  {
    key: "project",
    label: "Projeto",
    width: 220,
    render: (row: JoinedRow) => (
      <a
        href={`https://martins-development.com/projects/${row.projectId}`}
        target="_blank"
        rel="noreferrer"
        style={{ color: "#7A5A3A", fontWeight: 800, textDecoration: "none" }}
      >
        {row.title}
      </a>
    ),
  },
] as const;

const scrollCols = [
  { key: "operator", label: "Operador", width: 140, render: (row: JoinedRow) => row.operator || "-" },
  { key: "county", label: "County", width: 120, render: (row: JoinedRow) => row.county || "-" },
  {
    key: "projectColor",
    label: "Farol Projeto",
    width: 120,
    render: (row: JoinedRow) => (
      <span
        style={{
          color:
            row.projectColor === "Vermelho"
              ? "#dc2626"
              : row.projectColor === "Laranja"
              ? "#ea580c"
              : row.projectColor === "Amarelo"
              ? "#ca8a04"
              : "#16a34a",
          fontWeight: 800,
        }}
      >
        {row.projectColor || "-"}
      </span>
    ),
  },
  { key: "currentPhase", label: "Fase Atual", width: 130, render: (row: JoinedRow) => row.currentPhase || "-" },
  { key: "phaseStatus", label: "Status da Phase", width: 130, render: (row: JoinedRow) => row.phaseStatus || "-" },
  { key: "phaseDurationDays", label: "Duração de Dias da Phase", width: 150, render: (row: JoinedRow) => row.phaseDurationDays || 0 },
  {
    key: "phaseColor",
    label: "Farol da Phase",
    width: 120,
    render: (row: JoinedRow) => (
      <span
        style={{
          color:
            row.phaseColor === "Vermelho"
              ? "#dc2626"
              : row.phaseColor === "Laranja"
              ? "#ea580c"
              : row.phaseColor === "Amarelo"
              ? "#ca8a04"
              : "#16a34a",
          fontWeight: 800,
        }}
      >
        {row.phaseColor || "-"}
      </span>
    ),
  },
] as const;

  const fixedLeftOffsets = 0;
  const projectStickyLeft = 0;

  const filteredSubvendors = useMemo(() => {
  const term = subvendorSearch.trim().toLowerCase();
  if (!term) return subvendors;
  return subvendors.filter((sv) => sv.companyName.toLowerCase().includes(term));
}, [subvendors, subvendorSearch]);

  return (
    <div style={{ background: "#0b1220", minHeight: "100vh", padding: 16 }}>
      <div style={S.page}>
        <div style={S.header}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>Timeline por Phase dos Projetos</div>
            <div style={{ marginTop: 6, color: "rgba(17,24,39,0.60)", fontSize: 13 }}>
              
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0,1fr)) 180px", gap: 10, marginBottom: 16 }}>
          <div>
            <span style={S.label}>Phase</span>
            <select style={S.input} value={filters.phase} onChange={(e) => setFilters((p) => ({ ...p, phase: e.target.value as PhaseKey }))}>
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Operador</span>
            <select style={S.input} value={filters.operator} onChange={(e) => setFilters((p) => ({ ...p, operator: e.target.value }))}>
              <option value="">Todos</option>
              {operatorOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Projeto</span>
            <input
              style={S.input}
              placeholder="Buscar projeto"
              value={filters.projectTitle}
              onChange={(e) => setFilters((p) => ({ ...p, projectTitle: e.target.value }))}
            />
          </div>

          <div>
            <span style={S.label}>County</span>
            <select style={S.input} value={filters.county} onChange={(e) => setFilters((p) => ({ ...p, county: e.target.value }))}>
              <option value="">Todos</option>
              {countyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Farol Projeto</span>
            <select style={S.input} value={filters.projectColor} onChange={(e) => setFilters((p) => ({ ...p, projectColor: e.target.value }))}>
              <option value="">Todos</option>
              {COLOR_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Fase Atual</span>
            <select style={S.input} value={filters.currentPhase} onChange={(e) => setFilters((p) => ({ ...p, currentPhase: e.target.value }))}>
              <option value="">Todas</option>
              {CURRENT_PHASE_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span style={S.label}>Status da Phase</span>
            <select style={S.input} value={filters.phaseStatus} onChange={(e) => setFilters((p) => ({ ...p, phaseStatus: e.target.value }))}>
              <option value="">Todos</option>
              {PHASE_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <span style={S.label}>Itens por página</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <select
                style={S.input}
                value={filters.pageSize}
                onChange={(e) => setFilters((p) => ({ ...p, pageSize: Number(e.target.value) as PageSize }))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>

              <label style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", fontSize: 12, fontWeight: 800 }}>
                <input
                  type="checkbox"
                  checked={filters.showConcluded}
                  onChange={(e) => setFilters((p) => ({ ...p, showConcluded: e.target.checked }))}
                />
                Mostrar concluídos?
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0,1fr))", gap: 12, marginBottom: 18 }}>
          <SummaryCard title="Projetos filtrados" value={filteredRows.length} subtitle="Base da visão atual" />
          <SummaryCard title="Tasks concluídas" value={metrics.done} subtitle="Done com completedDate" />
          <SummaryCard title="Tasks em andamento" value={metrics.progress} subtitle="In Progress com startDate" />
          <SummaryCard title="Tasks com atenção" value={metrics.attention} subtitle="Pending com alerta por data" />
          <SummaryCard title="Duração média da phase" value={metrics.avgDuration} subtitle="Dias médios por phase selecionada" />
        </div>

        {error ? <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}
        {editError && !taskModal.open ? <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 800 }}>{editError}</div> : null}

        <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "72vh", position: "relative" }}>
            <table
              style={{
                borderCollapse: "separate",
                borderSpacing: 0,
                minWidth: fixedCols.reduce((sum, c) => sum + c.width, 0) + taskColumns.length * 120,
              }}
            >
              <thead>
                <tr>
                  {fixedCols.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        position: "sticky",
                        top: 0,
                        left: projectStickyLeft,
                        zIndex: 4,
                        background: "#FBFBFC",
                        minWidth: col.width,
                        width: col.width,
                        padding: "10px 10px",
                        textAlign: "left",
                        fontSize: 10,
                        color: "rgba(17,24,39,0.7)",
                        fontWeight: 900,
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                        boxShadow: "4px 0 0 rgba(0,0,0,0.03)",
                      }}
                    >
                      {col.label}
                    </th>
                  ))}

                  {scrollCols.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        background: "#FBFBFC",
                        minWidth: col.width,
                        width: col.width,
                        padding: "10px 10px",
                        textAlign: "left",
                        fontSize: 10,
                        color: "rgba(17,24,39,0.7)",
                        fontWeight: 900,
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      {col.label}
                    </th>
                  ))}

                  {taskColumns.map((taskName) => (
                    <th
                      key={taskName}
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        background: "#FBFBFC",
                        minWidth: 120,
                        width: 120,
                        padding: "10px 10px",
                        textAlign: "center",
                        fontSize: 10,
                        color: "rgba(17,24,39,0.7)",
                        fontWeight: 900,
                        borderBottom: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div>{taskName}</div>
                      <div style={{ marginTop: 2, color: "rgba(17,24,39,0.55)" }}>{filters.phase}</div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={fixedCols.length + scrollCols.length + taskColumns.length} style={{ padding: 24, textAlign: "center" }}>
                      Carregando...
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={fixedCols.length + scrollCols.length + taskColumns.length} style={{ padding: 24, textAlign: "center" }}>
                      Nenhum resultado encontrado.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.projectId}>
                      {fixedCols.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            ...S.td,
                            position: "sticky",
                            left: projectStickyLeft,
                            zIndex: 3,
                            background: "#fff",
                            minWidth: col.width,
                            width: col.width,
                            boxShadow: "4px 0 0 rgba(0,0,0,0.03)",
                          }}
                        >
                          {col.render(row)}
                        </td>
                      ))}

                      {scrollCols.map((col) => (
                        <td
                          key={col.key}
                          style={{
                            ...S.td,
                            minWidth: col.width,
                            width: col.width,
                          }}
                        >
                          {col.render(row)}
                        </td>
                      ))}

                      {taskColumns.map((taskName) => {
                        const task = row.tasks[taskName];
                        return (
                          <td key={`${row.projectId}-${taskName}`} style={{ ...S.td, minWidth: 120, width: 120, textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => openTaskModal(row, taskName, task)}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                cursor: task?.taskId ? "pointer" : "not-allowed",
                              }}
                              title={task?.taskId ? "Editar task" : "Task sem registro para edição"}
                            >
                              <StatusIcon task={task} />
                            </button>
                          </td>
                        );
                      })}
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
            <button style={S.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              ◀ Anterior
            </button>
            <div style={{ fontSize: 12, fontWeight: 800 }}>
              Página {page} de {totalPages}
            </div>
            <button style={S.btnGhost} disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Próxima ▶
            </button>
          </div>
        </div>
      </div>

      {taskModal.open && taskModal.row && taskModal.task ? (
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
                <div style={{ fontSize: 18, fontWeight: 900 }}>Edit task</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "rgba(17,24,39,0.60)" }}>
                  {taskModal.row.title} • {taskModal.taskName} • {filters.phase}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button style={S.btnGhost} onClick={closeTaskModal}>
                  Cancelar
                </button>
                <button style={S.btnPrimary} onClick={saveTask} disabled={savingTask}>
                  {savingTask ? "Salvando..." : "Save"}
                </button>
              </div>
            </div>

            <div style={{ padding: 18, display: "grid", gap: 18 }}>
              {editError ? <div style={{ color: "#b91c1c", fontWeight: 800 }}>{editError}</div> : null}

              <div>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>About the task</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
                  <div>
                    <span style={S.label}>Title</span>
                    <input style={S.input} value={taskModal.task.title} readOnly />
                  </div>

                  <div>
                    <span style={S.label}>Type</span>
                    <input style={S.input} value={taskModal.task.type || "Construction"} readOnly />
                  </div>

                  <div>
                    <span style={S.label}>Status</span>
                    <select style={S.input} value={taskForm.status} onChange={(e) => handleTaskStatusChange(e.target.value)}>
                      <option value="Todo">Todo</option>
                      <option value="InProgress">In Progress</option>
                      <option value="Done">Done</option>
                    </select>
                  </div>

                  <div>
                    <span style={S.label}>Completed Date</span>
                    <input
                      type="date"
                      style={S.input}
                      value={taskForm.completedDate}
                      disabled={taskForm.status !== "Done"}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, completedDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <span style={S.label}>Phase</span>
                    <input style={S.input} value={filters.phase} readOnly />
                  </div>

                  <div>
                    <span style={S.label}>Start Date</span>
                    <input
                      type="date"
                      style={S.input}
                      value={taskForm.startDate}
                      onChange={(e) => setTaskForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <span style={S.label}>Work days</span>
                    <input style={S.input} value={String(taskModal.task.workdays ?? taskModal.task.workDays ?? "")} readOnly />
                  </div>
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Group team</div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
                  <div>
                    <span style={S.label}>Operator</span>
                    <input style={S.input} value={taskModal.row.operator || taskModal.task.operatorId || ""} readOnly />
                  </div>

                  <div>
                    <span style={S.label}>Manager</span>
                    <input style={S.input} value={taskModal.task.managerId || ""} readOnly />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <span style={S.label}>Subvendors</span>

                  <input
                    style={{ ...S.input, marginBottom: 8 }}
                    placeholder="Pesquisar subvendor por nome..."
                    value={subvendorSearch}
                    onChange={(e) => setSubvendorSearch(e.target.value)}
                  />

                  <select
                    multiple
                    value={taskForm.subVendorIds}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                      setTaskForm((prev) => ({ ...prev, subVendorIds: values }));
                    }}
                    style={{
                      width: "100%",
                      minHeight: 140,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid rgba(0,0,0,0.14)",
                      outline: "none",
                      backgroundColor: "#fff",
                      fontSize: 13,
                      resize: "vertical",
                    }}
                  >
                    {filteredSubvendors.map((sv) => (
                      <option key={sv.id} value={sv.id}>
                        {sv.companyName}
                      </option>
                    ))}
                  </select>

                  <div style={{ marginTop: 8, fontSize: 11, color: "rgba(17,24,39,0.60)" }}>
                    Pesquise por nome e selecione por company name. O sistema salva somente IDs em subVendorIds.
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