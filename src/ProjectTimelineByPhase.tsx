import React, { useEffect, useMemo, useState } from "react";

type AnyObj = Record<string, any>;
type PhaseKey = "Pre Construction" | "Phase 1" | "Phase 2" | "Phase 3" | "Utilities" | "Supplies";
type TaskStatus = "Todo" | "Pending" | "In Progress" | "Done" | "Null";
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
  _id?: string;
  taskId?: string;
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
  operatorId?: string;
  managerId?: string;
  type?: string;
  subVendorIds?: string[];
  raw: AnyObj;
};

type SubvendorOption = {
  id: string;
  companyName: string;
};

type TaskModalState = {
  open: boolean;
  row: JoinedRow | null;
  taskName: string;
  task: TaskDoc | null;
};

type JoinedRow = ProjectStatusRow & {
  tasks: Record<string, TaskDoc | null>;
};

const PHASES: PhaseKey[] = ["Pre Construction", "Phase 1", "Phase 2", "Phase 3", "Utilities", "Supplies"];
const COLOR_OPTIONS = ["Verde", "Amarelo", "Laranja", "Vermelho"];
const CURRENT_PHASE_OPTIONS = ["Phase 1", "Phase 2", "Phase 3", "Concluded"];
const PHASE_STATUS_OPTIONS = ["Todo", "Pending", "In Progress", "Done", "Concluded", "Delayed", "On Hold"];
const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50, 100];

const FIXED_COLUMN_WIDTHS = [220, 140, 120, 110, 120, 140, 170, 130] as const;
const FIXED_COLUMN_LEFTS = FIXED_COLUMN_WIDTHS.map((_, index) =>
  FIXED_COLUMN_WIDTHS.slice(0, index).reduce((sum, width) => sum + width, 0)
);

function getStickyCellStyle(index: number, isHeader = false): React.CSSProperties {
  return {
    position: "sticky",
    left: FIXED_COLUMN_LEFTS[index],
    zIndex: isHeader ? 5 : 3,
    background: "#fff",
    minWidth: FIXED_COLUMN_WIDTHS[index],
    width: FIXED_COLUMN_WIDTHS[index],
    maxWidth: FIXED_COLUMN_WIDTHS[index],
    boxShadow: index === FIXED_COLUMN_WIDTHS.length - 1 ? "2px 0 0 rgba(0,0,0,0.06)" : undefined,
  };
}


const TIMELINE_API_URL = "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/projects-timeline-by-phase";
const SUBVENDORS_API_URL = "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/subvendors-options";
const TASKS_UPDATE_API_URL = "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/tasks-update";
const PROJECT_DETAILS_BASE_URL = "https://martins-development.com/projects";

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
};

const COLOR_MAP: Record<string, string> = {
  Verde: "#22c55e",
  Amarelo: "#eab308",
  Laranja: "#f97316",
  Vermelho: "#ef4444",
  Cinza: "#9ca3af",
};

function toStr(v: any): string {
  return (v ?? "").toString();
}

function normNumber(v: any, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v?.$numberLong) return parseInt(v.$numberLong, 10) || fallback;
  if (v?.$numberInt) return parseInt(v.$numberInt, 10) || fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function parseApiArray(payload: any): AnyObj[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function normalizePhase(input: any): PhaseKey | "" {
  const raw = toStr(input).trim().toLowerCase();
  if (!raw) return "";
  if (["pre construction", "pre-construction", "preconstruction", "construction permit"].includes(raw)) return "Pre Construction";
  if (raw === "phase 1" || raw === "phase1") return "Phase 1";
  if (raw === "phase 2" || raw === "phase2") return "Phase 2";
  if (raw === "phase 3" || raw === "phase3") return "Phase 3";
  if (raw === "utilities" || raw === "utilities manager") return "Utilities";
  if (raw === "supplies" || raw === "supplies manager") return "Supplies";
  return "";
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toStr(value);
  return d.toLocaleDateString("en-US");
}

function formatIsoDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toStr(value);
  return d.toISOString().slice(0, 10);
}

function toIsoStartOfDay(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveCurrentUserId(): string {
  try {
    const candidates = [
      window.localStorage.getItem("userId"),
      window.localStorage.getItem("currentUserId"),
      window.localStorage.getItem("operatorId"),
      window.sessionStorage.getItem("userId"),
      window.sessionStorage.getItem("currentUserId"),
    ].filter(Boolean);
    return toStr(candidates[0] || "");
  } catch {
    return "";
  }
}

function daysUntil(dateLike?: string | null): number | null {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.ceil((a - b) / 86400000);
}

function getProjectColorDot(color: string): React.CSSProperties {
  const c = COLOR_MAP[color] || "#cbd5e1";
  return {
    width: 12,
    height: 12,
    borderRadius: "50%",
    display: "inline-block",
    background: c,
    boxShadow: `0 0 0 3px ${c}22`,
  };
}

function csvEscape(value: any) {
  return `"${toStr(value).replace(/"/g, '""')}"`;
}

function resolvePhaseStatus(view: AnyObj, phase: PhaseKey): string {
  const map: Record<PhaseKey, string[]> = {
    "Pre Construction": ["StatusPreConstruction", "statusPreConstruction", "StatusConstruction", "statusConstruction"],
    "Phase 1": ["StatusPhase1", "statusPhase1"],
    "Phase 2": ["StatusPhase2", "statusPhase2"],
    "Phase 3": ["StatusPhase3", "statusPhase3"],
    Utilities: ["StatusUtilities", "statusUtilities"],
    Supplies: ["StatusSupplies", "statusSupplies"],
  };
  for (const key of map[phase]) {
    const value = toStr(view[key]).trim();
    if (value) return value;
  }
  return phase === view.currentPhase ? toStr(view.phaseStatus || view.pStatus || "") : "";
}

function resolvePhaseStart(view: AnyObj, phase: PhaseKey): string {
  const map: Record<PhaseKey, string[]> = {
    "Pre Construction": ["StartDatePreConstruction", "startDatePreConstruction", "permitIssuedDate", "phaseStartDate"],
    "Phase 1": ["StartDatePhase1", "startDatePhase1"],
    "Phase 2": ["StartDatePhase2", "startDatePhase2"],
    "Phase 3": ["StartDatePhase3", "startDatePhase3"],
    Utilities: ["StartDateUtilities", "startDateUtilities"],
    Supplies: ["StartDateSupplies", "startDateSupplies"],
  };
  for (const key of map[phase]) {
    const value = toStr(view[key]).trim();
    if (value) return value;
  }
  return "";
}

function resolvePhaseEnd(view: AnyObj, phase: PhaseKey): string {
  const map: Record<PhaseKey, string[]> = {
    "Pre Construction": ["EndDatePreConstruction", "endDatePreConstruction"],
    "Phase 1": ["EndDatePhase1", "endDatePhase1"],
    "Phase 2": ["EndDatePhase2", "endDatePhase2"],
    "Phase 3": ["EndDatePhase3", "endDatePhase3"],
    Utilities: ["EndDateUtilities", "endDateUtilities"],
    Supplies: ["EndDateSupplies", "endDateSupplies"],
  };
  for (const key of map[phase]) {
    const value = toStr(view[key]).trim();
    if (value) return value;
  }
  return "";
}

function inferPhaseDurationDays(view: AnyObj, phase: PhaseKey): number {
  const currentPhase = toStr(view.currentPhase);
  if (currentPhase === phase) {
    return normNumber(view.daysInPhase, 0);
  }
  const start = resolvePhaseStart(view, phase);
  const end = resolvePhaseEnd(view, phase);
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function normalizeProjectStatusDoc(view: AnyObj, phase: PhaseKey): ProjectStatusRow {
  return {
    projectId: toStr(view.projectId || view.project?._id || view.project?.id || view._id),
    title: toStr(view.project?.title || view.title || view.projectTitle || "Sem projeto"),
    operator: toStr(view.majorityOperatorName || view.operatorName || view.operator || "-"),
    county: toStr(view.county || view.project?.county || "-"),
    projectColor: toStr(view.projectColor || view.color || "Sem cor"),
    currentPhase: toStr(view.currentPhase || "-"),
    phaseColor: toStr(
      phase === toStr(view.currentPhase)
        ? view.phaseColor
        : phase === "Phase 1"
          ? view.phaseColorPhase1 || view.phaseColor1 || view.phaseColor
          : phase === "Phase 2"
            ? view.phaseColorPhase2 || view.phaseColor2 || view.phaseColor
            : phase === "Phase 3"
              ? view.phaseColorPhase3 || view.phaseColor3 || view.phaseColor
              : view.phaseColor || "Cinza"
    ) || "Cinza",
    phaseStatus: resolvePhaseStatus(view, phase) || "Null",
    phaseDurationDays: inferPhaseDurationDays(view, phase),
    raw: view,
  };
}

function normalizeTaskDoc(doc: AnyObj): TaskDoc | null {
  const phase = normalizePhase(doc.phase || doc.type || doc.phaseLabel || doc.groupName);
  const title = toStr(doc.title || doc.name).trim();
  const projectId = toStr(doc.projectId || doc.project?._id || doc.project?.id).trim();
  if (!phase || !title || !projectId) return null;
  return {
    _id: toStr(doc._id),
    taskId: toStr(doc.taskId || doc._id),
    projectId,
    phase,
    title,
    status: toStr(doc.status || "Todo") || "Todo",
    startDate: toStr(doc.startDate || doc.expectedStartDate || "") || null,
    endDate: toStr(doc.endDate || "") || null,
    completedDate: toStr(doc.completedDate || doc.endDate || "") || null,
    expectedStartDate: toStr(doc.expectedStartDate || "") || null,
    workDays: normNumber(doc.workDays, 0),
    workdays: normNumber(doc.workdays, 0),
    operatorId: toStr(doc.operatorId || ""),
    managerId: toStr(doc.managerId || ""),
    type: toStr(doc.type || ""),
    subVendorIds: Array.isArray(doc.subVendorIds) ? doc.subVendorIds.map((id: any) => toStr(id)) : [],
    raw: doc,
  };
}

function normalizeTimelineApiRow(row: AnyObj, phase: PhaseKey): { project: ProjectStatusRow; tasks: TaskDoc[] } {
  const projectId = toStr(row.projectId || row.project?._id || row.project?.id || row._id);
  const project: ProjectStatusRow = {
    projectId,
    title: toStr(row.project || row.title || row.projectTitle || "Sem projeto"),
    operator: toStr(row.operator || row.majorityOperatorName || "-"),
    county: toStr(row.county || "-"),
    projectColor: toStr(row.projectColor || "Sem cor"),
    currentPhase: toStr(row.currentPhase || "-"),
    phaseColor: toStr(row.phaseColor || "Cinza") || "Cinza",
    phaseStatus: toStr(row.phaseStatus || "Null") || "Null",
    phaseDurationDays: normNumber(row.phaseDays, 0),
    raw: row,
  };

  const tasks: TaskDoc[] = Object.entries((row.tasks || {}) as Record<string, AnyObj>)
    .map(([taskTitle, taskValue]) => {
      if (!taskValue) return null;
      return normalizeTaskDoc({
        ...taskValue,
        title: taskTitle,
        projectId,
        phase,
      });
    })
    .filter(Boolean) as TaskDoc[];

  return { project, tasks };
}

function taskVisual(task: TaskDoc | null) {
  if (!task) {
    return { className: "null", date: "-", label: "Nulo", csvStatus: "Null" as TaskStatus };
  }

  const raw = toStr(task.status).trim();
  const normalized = raw.toLowerCase();

  if (normalized === "done") {
    return { className: "done", date: formatDate(task.completedDate || task.endDate), label: "Concluída", csvStatus: "Done" as TaskStatus };
  }

  if (normalized === "in progress" || normalized === "inprogress") {
    return { className: "progress", date: formatDate(task.startDate), label: "Em andamento", csvStatus: "In Progress" as TaskStatus };
  }

  const startRef = task.startDate || task.expectedStartDate || null;
  const delta = daysUntil(startRef);

  if (normalized === "pending") {
    if (delta !== null && delta < 0) {
      return { className: "pending danger", date: formatDate(startRef), label: "Pendente atrasada", csvStatus: "Pending" as TaskStatus };
    }
    if (delta !== null && delta <= 3) {
      return { className: "pending warning", date: formatDate(startRef), label: "Pendente até 3 dias", csvStatus: "Pending" as TaskStatus };
    }
    return { className: "pending", date: formatDate(startRef), label: "Pendente", csvStatus: "Pending" as TaskStatus };
  }

  return { className: "todo", date: formatDate(startRef), label: "Não iniciada", csvStatus: "Todo" as TaskStatus };
}

function StatusIcon({ task, onClick }: { task: TaskDoc | null; onClick?: () => void }) {
  const visual = taskVisual(task);
  const styleBase: React.CSSProperties = {
    width: 46,
    height: 46,
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    position: "relative",
    background: "#fff",
    fontWeight: 900,
    margin: "0 auto",
  };

  let style: React.CSSProperties = { ...styleBase, border: "4px solid #cbd5e1", color: "#9aa3af", fontSize: 26 };
  let symbol = "•";
  let attention: React.ReactNode = null;

  if (visual.className === "done") {
    style = { ...styleBase, border: "6px solid #22c55e", color: "#22c55e", fontSize: 24 };
    symbol = "✓";
  } else if (visual.className === "progress") {
    style = { ...styleBase, border: "4px solid #2563eb", color: "#2563eb", fontSize: 22 };
    symbol = "◔";
    attention = <span style={{ position: "absolute", top: -6, right: -3, fontSize: 18, color: "#2563eb" }}>↻</span>;
  } else if (visual.className.includes("danger")) {
    style = { ...styleBase, border: "4px solid #9ca3af", color: "#9ca3af", fontSize: 30, boxShadow: "0 0 0 3px rgba(239,68,68,0.15)" };
    symbol = "•";
    attention = <span style={{ position: "absolute", top: -7, right: -4, fontSize: 18, color: "#ef4444" }}>⚠</span>;
  } else if (visual.className.includes("warning")) {
    style = { ...styleBase, border: "4px solid #eab308", color: "#9ca3af", fontSize: 30, boxShadow: "0 0 0 3px rgba(234,179,8,0.15)" };
    symbol = "•";
    attention = <span style={{ position: "absolute", top: -7, right: -4, fontSize: 18, color: "#eab308" }}>⚠</span>;
  } else if (visual.className === "todo") {
    style = { ...styleBase, border: "4px solid #cbd5e1", color: "#9aa3af", fontSize: 30 };
    symbol = "•";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 104, background: "transparent", border: "none", padding: 0, cursor: onClick ? "pointer" : "default" }}
      title={task ? "Editar task" : "Sem task"}
    >
      <div style={style}>
        {symbol}
        {attention}
      </div>
      <div style={{ fontSize: 11, fontWeight: 800, color: "#111827", whiteSpace: "nowrap" }}>{visual.date}</div>
      <div style={{ fontSize: 10, color: "rgba(17,24,39,0.65)", textAlign: "center", lineHeight: 1.2 }}>{visual.label}</div>
    </button>
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

export default function ProjectTimelineByPhase() {
  const [projectStatusRows, setProjectStatusRows] = useState<ProjectStatusRow[]>([]);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [subvendorOptions, setSubvendorOptions] = useState<SubvendorOption[]>([]);
  const [taskModal, setTaskModal] = useState<TaskModalState>({ open: false, row: null, taskName: "", task: null });
  const [taskForm, setTaskForm] = useState({ status: "Todo", startDate: "", completedDate: todayInputValue(), subVendorIds: [] as string[] });
  const [savingTask, setSavingTask] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
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
    th: {
      textAlign: "left",
      fontSize: 10,
      color: "rgba(17,24,39,0.7)",
      padding: "10px 10px",
      background: "#FBFBFC",
      fontWeight: 900,
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      whiteSpace: "nowrap",
      position: "sticky" as const,
      top: 0,
      zIndex: 1,
    },
    td: { padding: "10px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#111827", verticalAlign: "middle" },
  };

  const taskColumns = useMemo(() => TASK_ORDER[filters.phase] || [], [filters.phase]);

  useEffect(() => {
    setCurrentUserId(resolveCurrentUserId());
  }, []);

  async function fetchSubvendors() {
    try {
      const response = await fetch(SUBVENDORS_API_URL);
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || "Erro ao carregar subvendors");
      setSubvendorOptions(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error("Erro ao carregar subvendors", e);
    }
  }

  function openTaskModal(row: JoinedRow, taskName: string, task: TaskDoc | null) {
    const normalizedStatus = (() => {
      const raw = toStr(task?.status || "Todo").trim().toLowerCase();
      if (raw === "done" || raw === "completed") return "Done";
      if (raw === "in progress" || raw === "inprogress") return "InProgress";
      return "Todo";
    })();

    setTaskModal({ open: true, row, taskName, task });
    setTaskForm({
      status: normalizedStatus,
      startDate: formatIsoDate(task?.startDate || task?.expectedStartDate || null),
      completedDate: formatIsoDate(task?.completedDate || task?.endDate || null) || todayInputValue(),
      subVendorIds: Array.isArray(task?.subVendorIds) ? task!.subVendorIds! : [],
    });
    fetchSubvendors();
  }

  function closeTaskModal() {
    if (savingTask) return;
    setTaskModal({ open: false, row: null, taskName: "", task: null });
  }

  function handleTaskStatusChange(newStatus: string) {
    setTaskForm((prev) => {
      const next = { ...prev, status: newStatus };

      if ((newStatus === "InProgress" || newStatus === "Done") && !next.startDate) {
        next.startDate = todayInputValue();
      }

      if (newStatus === "Done") {
        if (!next.completedDate) {
          next.completedDate = todayInputValue();
        }
      } else {
        next.completedDate = "";
      }

      return next;
    });
  }

  async function saveTaskUpdate() {
    if (!taskModal.row || !taskModal.task?.taskId) {
      setError("Task inválida para edição.");
      return;
    }

    if (!taskForm.startDate) {
      setError("Start Date é obrigatório.");
      return;
    }

    if (taskForm.status === "Done" && !taskForm.completedDate) {
      setError("Completed Date é obrigatório quando a task estiver Done.");
      return;
    }

    setSavingTask(true);
    setError("");
    try {
      const response = await fetch(TASKS_UPDATE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: taskModal.task.taskId,
          projectId: taskModal.row.projectId,
          userId: currentUserId || taskModal.task.operatorId || taskModal.row.raw?.operatorId || "unknown-user",
          status: taskForm.status,
          startDate: toIsoStartOfDay(taskForm.startDate),
          completedDate: taskForm.status === "Done" ? toIsoStartOfDay(taskForm.completedDate || todayInputValue()) : null,
          subVendorIds: taskForm.subVendorIds,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) throw new Error(data?.message || `Erro ao atualizar task (${response.status})`);
      closeTaskModal();
      await fetchData();
    } catch (e: any) {
      console.error("Erro ao atualizar task", e);
      setError(e?.message || "Erro ao atualizar task.");
    } finally {
      setSavingTask(false);
    }
  }

  async function fetchData() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(TIMELINE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phase: filters.phase,
          showConcluded: filters.showConcluded,
        }),
      });

      const data = await response.json();

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.message || `Erro ao carregar timeline (${response.status})`);
      }

      const apiRows = parseApiArray(data);
      const normalizedProjects: ProjectStatusRow[] = [];
      const normalizedTasks: TaskDoc[] = [];

      for (const row of apiRows) {
        const normalized = normalizeTimelineApiRow(row, filters.phase);
        normalizedProjects.push(normalized.project);
        normalizedTasks.push(...normalized.tasks);
      }

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
  }, [filters.phase]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const operatorOptions = useMemo(
    () => Array.from(new Set(projectStatusRows.map((r) => r.operator).filter(Boolean))).sort(),
    [projectStatusRows]
  );

  const countyOptions = useMemo(
    () => Array.from(new Set(projectStatusRows.map((r) => r.county).filter(Boolean))).sort(),
    [projectStatusRows]
  );

  const taskMapByProjectAndPhase = useMemo(() => {
    const map = new Map<string, Record<string, TaskDoc>>();
    for (const task of tasks) {
      const key = `${task.projectId}__${task.phase}`;
      const current = map.get(key) || {};
      current[task.title] = task;
      map.set(key, current);
    }
    return map;
  }, [tasks]);

  const joinedRows = useMemo<JoinedRow[]>(() => {
    return projectStatusRows.map((row) => {
      const taskMap = taskMapByProjectAndPhase.get(`${row.projectId}__${filters.phase}`) || {};
      const orderedTasks: Record<string, TaskDoc | null> = {};
      for (const taskName of taskColumns) orderedTasks[taskName] = taskMap[taskName] || null;
      return { ...row, tasks: orderedTasks };
    });
  }, [projectStatusRows, taskMapByProjectAndPhase, filters.phase, taskColumns]);

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

  const pagedRows = useMemo(() => {
    const start = (page - 1) * filters.pageSize;
    return filteredRows.slice(start, start + filters.pageSize);
  }, [filteredRows, page, filters.pageSize]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filteredRows.length / filters.pageSize)), [filteredRows.length, filters.pageSize]);

  const metrics = useMemo(() => {
    const allVisibleTasks = filteredRows.flatMap((row) => Object.values(row.tasks)).filter(Boolean) as TaskDoc[];
    const done = allVisibleTasks.filter((t) => taskVisual(t).csvStatus === "Done").length;
    const progress = allVisibleTasks.filter((t) => taskVisual(t).csvStatus === "In Progress").length;
    const attention = allVisibleTasks.filter((t) => {
      const cls = taskVisual(t).className;
      return cls.includes("warning") || cls.includes("danger");
    }).length;
    const avgDuration = filteredRows.length
      ? (filteredRows.reduce((sum, row) => sum + row.phaseDurationDays, 0) / filteredRows.length).toFixed(1)
      : "0.0";
    return { done, progress, attention, avgDuration };
  }, [filteredRows]);

  const exportCsv = () => {
    const header = [
      "Projeto",
      "Operador",
      "County",
      "Farol Projeto",
      "Fase Atual",
      "Status da Phase",
      "Duracao de Dias da Phase",
      "Farol da Phase",
      ...taskColumns.flatMap((taskName) => [`${taskName} - Status`, `${taskName} - Data`]),
    ];

    const rows = filteredRows.map((row) => [
      row.title,
      row.operator,
      row.county,
      row.projectColor,
      row.currentPhase,
      row.phaseStatus,
      row.phaseDurationDays,
      row.phaseColor,
      ...taskColumns.flatMap((taskName) => {
        const task = row.tasks[taskName];
        const visual = taskVisual(task);
        const date = !task ? "" : visual.csvStatus === "Done" ? formatDate(task.endDate) : formatDate(task.startDate || task.expectedStartDate);
        return [visual.csvStatus, date];
      }),
    ]);

    const csv = [header, ...rows].map((line) => line.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline_${filters.phase.toLowerCase().replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>Timeline por Phase dos Projetos</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(17,24,39,0.70)" }}>
            Dados cruzados entre <strong>tasks</strong> e <strong>view_project_status</strong>, com ordenação fixa das tasks por phase.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={S.btnGhost} onClick={exportCsv}>Exportar Excel</button>
          <button style={S.btnPrimary} onClick={fetchData}>{loading ? "Carregando..." : "Atualizar"}</button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 18,
          alignItems: "end",
        }}
      >
        <div>
          <span style={S.label}>Phase</span>
          <select style={S.input} value={filters.phase} onChange={(e) => setFilters((p) => ({ ...p, phase: e.target.value as PhaseKey }))}>
            {PHASES.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
          </select>
        </div>

        <div>
          <span style={S.label}>Operador</span>
          <select style={S.input} value={filters.operator} onChange={(e) => setFilters((p) => ({ ...p, operator: e.target.value }))}>
            <option value="">Todos</option>
            {operatorOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <span style={S.label}>Projeto</span>
          <input style={S.input} value={filters.projectTitle} placeholder="Buscar projeto" onChange={(e) => setFilters((p) => ({ ...p, projectTitle: e.target.value }))} />
        </div>

        <div>
          <span style={S.label}>County</span>
          <select style={S.input} value={filters.county} onChange={(e) => setFilters((p) => ({ ...p, county: e.target.value }))}>
            <option value="">Todos</option>
            {countyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span style={S.label}>Farol Projeto</span>
          <select style={S.input} value={filters.projectColor} onChange={(e) => setFilters((p) => ({ ...p, projectColor: e.target.value }))}>
            <option value="">Todos</option>
            {COLOR_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span style={S.label}>Fase Atual</span>
          <select style={S.input} value={filters.currentPhase} onChange={(e) => setFilters((p) => ({ ...p, currentPhase: e.target.value }))}>
            <option value="">Todas</option>
            {CURRENT_PHASE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <span style={S.label}>Status da Phase</span>
          <select style={S.input} value={filters.phaseStatus} onChange={(e) => setFilters((p) => ({ ...p, phaseStatus: e.target.value }))}>
            <option value="">Todos</option>
            {PHASE_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <span style={S.label}>Itens por página</span>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <select style={S.input} value={filters.pageSize} onChange={(e) => setFilters((p) => ({ ...p, pageSize: Number(e.target.value) as PageSize }))}>
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
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
        <SummaryCard title="Tasks concluídas" value={metrics.done} subtitle="Done com endDate" />
        <SummaryCard title="Tasks em andamento" value={metrics.progress} subtitle="In Progress com startDate" />
        <SummaryCard title="Tasks com atenção" value={metrics.attention} subtitle="Pending com alerta por data" />
        <SummaryCard title="Duração média da phase" value={metrics.avgDuration} subtitle="Dias médios por phase selecionada" />
      </div>

      {error ? <div style={{ marginBottom: 12, color: "#b91c1c", fontWeight: 800 }}>{error}</div> : null}

      <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fffdfb" }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 4 }}>Linha de acompanhamento por task da phase</div>
          <div style={{ fontSize: 12, color: "rgba(17,24,39,0.70)" }}>
            Phase selecionada: <strong>{filters.phase}</strong>. Projetos sem tasks nessa phase exibem células nulas. A ordem das tasks segue exatamente o template informado.
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 2200 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, ...getStickyCellStyle(0, true) }}>Projeto</th>
                <th style={{ ...S.th, ...getStickyCellStyle(1, true) }}>Operador</th>
                <th style={{ ...S.th, ...getStickyCellStyle(2, true) }}>County</th>
                <th style={{ ...S.th, ...getStickyCellStyle(3, true) }}>Farol Projeto</th>
                <th style={{ ...S.th, ...getStickyCellStyle(4, true) }}>Fase Atual</th>
                <th style={{ ...S.th, ...getStickyCellStyle(5, true) }}>Status da Phase</th>
                <th style={{ ...S.th, ...getStickyCellStyle(6, true) }}>Duração de Dias da Phase</th>
                <th style={{ ...S.th, ...getStickyCellStyle(7, true) }}>Farol da Phase</th>
                {taskColumns.map((taskName) => (
                  <th key={taskName} style={S.th}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 130 }}>
                      <span>{taskName}</span>
                      <span style={{ fontSize: 10, color: "rgba(17,24,39,0.58)", fontWeight: 700 }}>{filters.phase}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={`${row.projectId}-${filters.phase}`}>
                  <td style={{ ...S.td, ...getStickyCellStyle(0), fontWeight: 800 }}><a href={`${PROJECT_DETAILS_BASE_URL}/${row.projectId}`} target="_blank" rel="noreferrer" style={{ color: "#7A5A3A", textDecoration: "none", fontWeight: 800 }}>{row.title}</a></td>
                  <td style={{ ...S.td, ...getStickyCellStyle(1) }}>{row.operator}</td>
                  <td style={{ ...S.td, ...getStickyCellStyle(2) }}>{row.county}</td>
                  <td style={{ ...S.td, ...getStickyCellStyle(3) }}><span style={getProjectColorDot(row.projectColor)} /></td>
                  <td style={{ ...S.td, ...getStickyCellStyle(4) }}>{row.currentPhase || "-"}</td>
                  <td style={{ ...S.td, ...getStickyCellStyle(5) }}>{row.phaseStatus || "Null"}</td>
                  <td style={{ ...S.td, ...getStickyCellStyle(6) }}>{row.phaseDurationDays}</td>
                  <td style={{ ...S.td, ...getStickyCellStyle(7) }}><span style={getProjectColorDot(row.phaseColor)} /></td>
                  {taskColumns.map((taskName) => (
                    <td key={taskName} style={S.td}><StatusIcon task={row.tasks[taskName]} onClick={() => openTaskModal(row, taskName, row.tasks[taskName])} /></td>
                  ))}
                </tr>
              ))}
              {!pagedRows.length ? (
                <tr>
                  <td style={{ ...S.td, textAlign: "center", padding: 20 }} colSpan={8 + taskColumns.length}>
                    Nenhum projeto encontrado com os filtros atuais.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "rgba(17,24,39,0.70)", fontWeight: 700 }}>
          Mostrando {(filteredRows.length ? (page - 1) * filters.pageSize + 1 : 0)}–{Math.min(page * filters.pageSize, filteredRows.length)} de {filteredRows.length}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btnGhost} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>◀ Anterior</button>
          <div style={{ ...S.btnGhost, cursor: "default", display: "flex", alignItems: "center" }}>Página {page} de {pageCount}</div>
          <button style={S.btnGhost} disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>Próxima ▶</button>
        </div>
      </div>

      {taskModal.open ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.42)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
          <div style={{ width: "min(860px, 96vw)", maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 24px 70px rgba(15,23,42,0.22)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900 }}>Edit task</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "rgba(17,24,39,0.70)" }}>
                  {taskModal.row?.title} • {taskModal.taskName} • {filters.phase}
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={S.btnGhost} onClick={closeTaskModal} disabled={savingTask}>Cancelar</button>
                <button style={S.btnPrimary} onClick={saveTaskUpdate} disabled={savingTask}>{savingTask ? "Salvando..." : "Save"}</button>
              </div>
            </div>

            <div style={{ padding: 20, display: "grid", gap: 18 }}>
              <div style={{ fontWeight: 900, fontSize: 18 }}>About the task</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <span style={S.label}>Title</span>
                  <input style={S.input} value={taskModal.taskName} disabled />
                </div>
                <div>
                  <span style={S.label}>Type</span>
                  <input style={S.input} value={taskModal.task?.type || "Construction"} disabled />
                </div>

                <div>
                  <span style={S.label}>Status</span>
                  <select style={S.input} value={taskForm.status} onChange={(e) => handleTaskStatusChange(e.target.value)}>
                    <option value="Todo">Todo</option>
                    <option value="InProgress">InProgress</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
                <div>
                  <span style={S.label}>Completed Date</span>
                  <input type="date" style={{ ...S.input, backgroundColor: taskForm.status === "Done" ? "#fff" : "#f3f4f6" }} value={taskForm.status === "Done" ? taskForm.completedDate : ""} disabled={taskForm.status !== "Done"} onChange={(e) => setTaskForm((p) => ({ ...p, completedDate: e.target.value }))} />
                </div>

                <div>
                  <span style={S.label}>Phase</span>
                  <input style={S.input} value={filters.phase} disabled />
                </div>
                <div>
                  <span style={S.label}>Start Date</span>
                  <input type="date" style={S.input} value={taskForm.startDate} onChange={(e) => setTaskForm((p) => ({ ...p, startDate: e.target.value }))} />
                </div>

                <div>
                  <span style={S.label}>Work days</span>
                  <input style={S.input} value={toStr(taskModal.task?.workDays || taskModal.task?.workdays || "")} disabled />
                </div>
              </div>

              <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>Group team</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <span style={S.label}>Operator</span>
                  <input style={S.input} value={taskModal.row?.operator || ""} disabled />
                </div>
                <div>
                  <span style={S.label}>Manager</span>
                  <input style={S.input} value={toStr(taskModal.task?.managerId || taskModal.task?.raw?.managerId || "")} disabled />
                </div>
              </div>

              <div>
                <span style={S.label}>Subvendors</span>
                <select
                  multiple
                  value={taskForm.subVendorIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
                    setTaskForm((p) => ({ ...p, subVendorIds: selected }));
                  }}
                  style={{ width: "100%", minHeight: 160, padding: 12, borderRadius: 12, border: "1px solid rgba(0,0,0,0.14)", background: "#fff", fontSize: 13, color: "#111827" }}
                >
                  {subvendorOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.companyName}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 8, fontSize: 12, color: "rgba(17,24,39,0.65)" }}>Seleção por company name, salvando somente IDs em <strong>subVendorIds</strong>.</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
