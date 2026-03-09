import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "aws-amplify/api";

type AnyObj = Record<string, any>;
type ViewMode = "table" | "dashboard";
type PageSize = 10 | 50 | 100;

type Filters = {
  operator: string;
  projectTitle: string;
  county: string;
  farol: string;
  phaseColor: string;
  currentPhase: string;
  globalStatus: string;
  phaseStatus: string;
};

const COLOR_LABELS = ["Verde", "Amarelo", "Laranja", "Vermelho"] as const;
const STATUS_OPTIONS = ["In Progress", "Concluded", "Delayed", "On Hold"] as const;
const PHASE_OPTIONS = ["Phase 1", "Phase 2", "Phase 3"] as const;
const COLOR_MAP: Record<string, string> = {
  Verde: "#22c55e",
  Amarelo: "#eab308",
  Laranja: "#f97316",
  Vermelho: "#ef4444",
};

function normLong(v: any, fallback = 0) {
  if (v?.$numberLong) return parseInt(v.$numberLong, 10);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v: any) {
  return (v ?? "").toString();
}

function includesI(hay: any, needle: string) {
  return toStr(hay).toLowerCase().includes(needle.toLowerCase());
}

function avg(arr: number[]) {
  if (!arr.length) return 0;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function statusColor(status: string) {
  switch (status) {
    case "Concluded":
      return "#22c55e";
    case "Delayed":
      return "#ef4444";
    case "On Hold":
      return "#f97316";
    default:
      return "#3b82f6";
  }
}

function getPhaseValue(p: AnyObj) {
  return toStr(p.currentPhase || p.faseAtual || "Sem fase") || "Sem fase";
}

function getProjectColorValue(p: AnyObj) {
  return toStr(p.projectColor || p.color || p.farol || "Sem cor") || "Sem cor";
}

function getPhaseColorValue(p: AnyObj) {
  return toStr(p.phaseColor || "Sem cor") || "Sem cor";
}

function getGlobalStatusValue(p: AnyObj) {
  return toStr(p.StatusProject || p.statusGlobal || "Sem status") || "Sem status";
}

function getPhaseStatusValue(p: AnyObj) {
  return toStr(p.phaseStatus || p.pStatus || "Sem status") || "Sem status";
}

function isConcludedProject(p: AnyObj) {
  return getGlobalStatusValue(p) === "Concluded" || getPhaseValue(p) === "Concluded";
}

function dotStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block",
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: COLOR_MAP[color] || "#cbd5e1",
    boxShadow: `0 0 0 3px ${COLOR_MAP[color] || "#cbd5e1"}22`,
  };
}

function Card({ title, value, subtitle }: { title: string; value: string | number; subtitle?: string }) {
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
      {subtitle ? <div style={{ marginTop: 8, fontSize: 12, color: "rgba(17,24,39,0.70)" }}>{subtitle}</div> : null}
    </div>
  );
}

function ProgressBar({ value, max, color, label }: { value: number; max: number; color: string; label?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div>
      <div
        style={{
          height: 10,
          width: "100%",
          background: "#eef2f7",
          borderRadius: 999,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999 }} />
      </div>
      {label ? <div style={{ marginTop: 6, fontSize: 11, color: "rgba(17,24,39,0.72)" }}>{label}</div> : null}
    </div>
  );
}

function PhaseColorChart({ rows }: { rows: Array<{ phase: string; total: number; colors: Record<string, number> }> }) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <div style={{ display: "grid", gap: 16 }}>
      {rows.map((row) => (
        <div key={row.phase}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 12 }}>
            <div style={{ fontWeight: 800, color: "#111827" }}>{row.phase}</div>
            <div style={{ fontSize: 12, color: "rgba(17,24,39,0.72)", fontWeight: 700 }}>{row.total} projetos</div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {COLOR_LABELS.map((colorName) => (
              <div
                key={colorName}
                style={{
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 14,
                  padding: 10,
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={dotStyle(colorName)} />
                  <span style={{ fontSize: 12, fontWeight: 800 }}>{colorName}</span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{row.colors[colorName] || 0}</div>
              </div>
            ))}
          </div>
          <ProgressBar value={row.total} max={max} color="#7A5A3A" />
        </div>
      ))}
    </div>
  );
}

function OperatorPhaseTable({ rows }: { rows: Array<any> }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 950 }}>
        <thead>
          <tr>
            {[
              "Operador",
              "Projetos",
              "Fase Atual",
              "Status Phase",
              "Status Projeto",
              "Média Dias Phase",
              "Média Dias Projeto",
            ].map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "12px 10px",
                  fontSize: 11,
                  color: "rgba(17,24,39,0.70)",
                  fontWeight: 900,
                  borderBottom: "1px solid rgba(0,0,0,0.08)",
                  background: "#fbfbfc",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.operator}>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 800 }}>{row.operator}</td>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{row.total}</td>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{row.topPhase}</td>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{row.topPhaseStatus}</td>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>{row.topProjectStatus}</td>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 800 }}>{row.avgDaysInPhase}</td>
              <td style={{ padding: "12px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontWeight: 800 }}>{row.avgDaysInProject}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBars({ title, rows, colorFn }: { title: string; rows: Array<{ label: string; value: number }>; colorFn: (label: string) => string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.06)",
        borderRadius: 18,
        padding: 18,
        boxShadow: "0 8px 30px rgba(15,23,42,0.04)",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 14 }}>{title}</div>
      <div style={{ display: "grid", gap: 14 }}>
        {rows.map((row) => (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, gap: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{row.label}</div>
              <div style={{ fontSize: 12, color: "rgba(17,24,39,0.72)", fontWeight: 800 }}>{row.value}</div>
            </div>
            <ProgressBar value={row.value} max={max} color={colorFn(row.label)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectControl() {
  const [projects, setProjects] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<AnyObj | null>(null);
  const [newReason, setNewReason] = useState("");
  const [savingReason, setSavingReason] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);
  const [showConcluded, setShowConcluded] = useState(true);

  const [filters, setFilters] = useState<Filters>({
    operator: "",
    projectTitle: "",
    county: "",
    farol: "",
    phaseColor: "",
    currentPhase: "",
    globalStatus: "",
    phaseStatus: "",
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const restOperation = get({ apiName: "operatorApi", path: "/projects-control" });
      const response = await restOperation.response;
      const data: any = await response.body.json();
      const rawList = Array.isArray(data) ? data : data?.body ? JSON.parse(data.body) : [];

      const normalized = (rawList as AnyObj[]).map((p) => ({
        ...p,
        daysInPhase: normLong(p.daysInPhase),
        daysInProject: normLong(p.daysInProject),
        daysRemaining: normLong(p.daysRemaining),
        totalHoldDays: normLong(p.totalHoldDays),
      }));

      setProjects(normalized);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProjects();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, showConcluded]);

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (!showConcluded && isConcludedProject(p)) return false;
      if (filters.operator && !includesI(p.majorityOperatorName, filters.operator)) return false;
      if (filters.projectTitle && !includesI(p.project?.title, filters.projectTitle)) return false;
      if (filters.county && !includesI(p.county, filters.county)) return false;
      if (filters.farol && getProjectColorValue(p) !== filters.farol) return false;
      if (filters.phaseColor && getPhaseColorValue(p) !== filters.phaseColor) return false;
      if (filters.currentPhase && getPhaseValue(p) !== filters.currentPhase) return false;
      if (filters.globalStatus && getGlobalStatusValue(p) !== filters.globalStatus) return false;
      if (filters.phaseStatus && getPhaseStatusValue(p) !== filters.phaseStatus) return false;
      return true;
    });
  }, [projects, filters, showConcluded]);

  const operatorOptions = useMemo(() => {
    return Array.from(new Set(projects.map((p) => toStr(p.majorityOperatorName)).filter(Boolean))).sort();
  }, [projects]);

  const countyOptions = useMemo(() => {
    return Array.from(new Set(projects.map((p) => toStr(p.county)).filter(Boolean))).sort();
  }, [projects]);

  const total = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pagedProjects = filteredProjects.slice(startIdx, endIdx);

  const dashboard = useMemo(() => {
    const phaseMap = new Map<string, { phase: string; total: number; colors: Record<string, number> }>();
    const operatorMap = new Map<string, any>();
    const phaseStatusCount = new Map<string, number>();
    const projectStatusCount = new Map<string, number>();

    let totalDaysInPhase = 0;
    let totalDaysInProject = 0;
    let totalHoldDays = 0;
    let delayedProjects = 0;

    filteredProjects.forEach((p) => {
      const phase = getPhaseValue(p);
      const phaseColor = getPhaseColorValue(p);
      const operator = toStr(p.majorityOperatorName || "Sem operador") || "Sem operador";
      const phaseStatus = getPhaseStatusValue(p);
      const projectStatus = getGlobalStatusValue(p);

      totalDaysInPhase += normLong(p.daysInPhase);
      totalDaysInProject += normLong(p.daysInProject);
      totalHoldDays += normLong(p.totalHoldDays);
      if (projectStatus === "Delayed" || phaseStatus === "Delayed") delayedProjects += 1;

      if (!phaseMap.has(phase)) {
        phaseMap.set(phase, {
          phase,
          total: 0,
          colors: { Verde: 0, Amarelo: 0, Laranja: 0, Vermelho: 0 },
        });
      }
      const phaseEntry = phaseMap.get(phase)!;
      phaseEntry.total += 1;
      if (phaseEntry.colors[phaseColor] !== undefined) phaseEntry.colors[phaseColor] += 1;

      phaseStatusCount.set(phaseStatus, (phaseStatusCount.get(phaseStatus) || 0) + 1);
      projectStatusCount.set(projectStatus, (projectStatusCount.get(projectStatus) || 0) + 1);

      if (!operatorMap.has(operator)) {
        operatorMap.set(operator, {
          operator,
          total: 0,
          daysInPhase: [] as number[],
          daysInProject: [] as number[],
          phases: new Map<string, number>(),
          phaseStatuses: new Map<string, number>(),
          projectStatuses: new Map<string, number>(),
        });
      }
      const op = operatorMap.get(operator)!;
      op.total += 1;
      op.daysInPhase.push(normLong(p.daysInPhase));
      op.daysInProject.push(normLong(p.daysInProject));
      op.phases.set(phase, (op.phases.get(phase) || 0) + 1);
      op.phaseStatuses.set(phaseStatus, (op.phaseStatuses.get(phaseStatus) || 0) + 1);
      op.projectStatuses.set(projectStatus, (op.projectStatuses.get(projectStatus) || 0) + 1);
    });

    const phaseRows = Array.from(phaseMap.values()).sort((a, b) => b.total - a.total);

    const operatorRows = Array.from(operatorMap.values())
      .map((op) => {
        const pickTop = (m: Map<string, number>) =>
          Array.from(m.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "-";
        return {
          operator: op.operator,
          total: op.total,
          topPhase: pickTop(op.phases),
          topPhaseStatus: pickTop(op.phaseStatuses),
          topProjectStatus: pickTop(op.projectStatuses),
          avgDaysInPhase: avg(op.daysInPhase).toFixed(1),
          avgDaysInProject: avg(op.daysInProject).toFixed(1),
        };
      })
      .sort((a, b) => b.total - a.total);

    const phaseStatusRows = Array.from(phaseStatusCount.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const projectStatusRows = Array.from(projectStatusCount.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    return {
      totalProjects: filteredProjects.length,
      avgDaysInPhase: avg(filteredProjects.map((p) => normLong(p.daysInPhase))).toFixed(1),
      avgDaysInProject: avg(filteredProjects.map((p) => normLong(p.daysInProject))).toFixed(1),
      avgHoldDays: avg(filteredProjects.map((p) => normLong(p.totalHoldDays))).toFixed(1),
      delayedProjects,
      phaseRows,
      operatorRows,
      phaseStatusRows,
      projectStatusRows,
      totalDaysInPhase,
      totalDaysInProject,
      totalHoldDays,
    };
  }, [filteredProjects]);

  const exportCsv = () => {
    const headers = [
      "ID",
      "Projeto",
      "Operador",
      "Fase Atual",
      "P. Status",
      "Global Status",
      "County",
      "Hold Days",
      "Dias Fase",
      "Dias Totais",
      "Restante",
      "Farol",
      "Farol Phase",
      "Inicio P1",
      "Fim P1",
      "Status P1",
      "Inicio P2",
      "Fim P2",
      "Status P2",
      "Inicio P3",
      "Fim P3",
      "Status P3",
      "JUSTIFICATIVA",
    ];

    const rows = filteredProjects.map((p) => [
      p.projectId,
      `"${p.project?.title || ""}"`,
      `"${p.majorityOperatorName || ""}"`,
      getPhaseValue(p),
      getPhaseStatusValue(p),
      getGlobalStatusValue(p),
      p.county || "",
      p.totalHoldDays || 0,
      p.daysInPhase || 0,
      p.daysInProject || 0,
      p.daysRemaining || 0,
      getProjectColorValue(p),
      getPhaseColorValue(p),
      p.StartDatePhase1 || "",
      p.EndDatePhase1 || "",
      p.StatusPhase1 || "",
      p.StartDatePhase2 || "",
      p.EndDatePhase2 || "",
      p.StatusPhase2 || "",
      p.StartDatePhase3 || "",
      p.EndDatePhase3 || "",
      p.StatusPhase3 || "",
      `"${p.reason || ""}"`,
    ]);

    const csvContent = [headers, ...rows].map((e) => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Auditoria_Master_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const openJustify = (p: AnyObj) => {
    setSaveError("");
    setSelectedProject(p);
    setNewReason(p.reason || "");
    setIsModalOpen(true);
  };

  const closeJustify = () => {
    setIsModalOpen(false);
    setSelectedProject(null);
    setNewReason("");
    setSaveError("");
    setSavingReason(false);
  };

  const saveJustification = async () => {
    if (!selectedProject?.projectId) return;
    setSavingReason(true);
    setSaveError("");
    try {
      const restOperation = post({
        apiName: "operatorApi",
        path: "/projects-control",
        options: { body: { projectId: selectedProject.projectId, reason: newReason } },
      });
      await restOperation.response;
      closeJustify();
      await fetchProjects();
    } catch (e: any) {
      console.error("Erro ao salvar justificativa:", e);
      setSaveError(e?.message || "Erro ao salvar justificativa.");
    } finally {
      setSavingReason(false);
    }
  };

  const resetFilters = () => {
    setFilters({
      operator: "",
      projectTitle: "",
      county: "",
      farol: "",
      phaseColor: "",
      currentPhase: "",
      globalStatus: "",
      phaseStatus: "",
    });
    setShowConcluded(true);
  };

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#fff",
      borderRadius: 16,
      padding: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: 1700,
      margin: "0 auto",
      color: "#111827",
      boxSizing: "border-box",
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
    btnPrimaryDisabled: {
      background: "rgba(122,90,58,0.55)",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "not-allowed",
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
    },
    td: { padding: "10px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#111827" },
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#111827" }}>Controle de Projetos (Master)</h2>
          <div style={{ marginTop: 6, fontSize: 13, color: "rgba(17,24,39,0.72)", fontWeight: 600 }}>
            Tabela operacional + dashboard moderno de KPI dos projetos filtrados.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={S.btnGhost} onClick={() => setViewMode(viewMode === "table" ? "dashboard" : "table")}> 
            {viewMode === "table" ? "Abrir Dashboard KPI" : "Voltar para Tabela"}
          </button>
          <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV Completo</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>{loading ? "Carregando..." : "Atualizar"}</button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          gap: 12,
          marginBottom: 16,
          alignItems: "end",
        }}
      >
        <div>
          <span style={S.label}>Operador</span>
          <select style={S.input} value={filters.operator} onChange={(e) => setFilters((f) => ({ ...f, operator: e.target.value }))}>
            <option value="">Todos</option>
            {operatorOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>Projeto</span>
          <input style={S.input} value={filters.projectTitle} placeholder="Buscar projeto" onChange={(e) => setFilters((f) => ({ ...f, projectTitle: e.target.value }))} />
        </div>

        <div>
          <span style={S.label}>County</span>
          <select style={S.input} value={filters.county} onChange={(e) => setFilters((f) => ({ ...f, county: e.target.value }))}>
            <option value="">Todos</option>
            {countyOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>Farol Projeto</span>
          <select style={S.input} value={filters.farol} onChange={(e) => setFilters((f) => ({ ...f, farol: e.target.value }))}>
            <option value="">Todos</option>
            {COLOR_LABELS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>Farol Phase</span>
          <select style={S.input} value={filters.phaseColor} onChange={(e) => setFilters((f) => ({ ...f, phaseColor: e.target.value }))}>
            <option value="">Todos</option>
            {COLOR_LABELS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>Fase Atual</span>
          <select style={S.input} value={filters.currentPhase} onChange={(e) => setFilters((f) => ({ ...f, currentPhase: e.target.value }))}>
            <option value="">Todas</option>
            {PHASE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>Global Status</span>
          <select style={S.input} value={filters.globalStatus} onChange={(e) => setFilters((f) => ({ ...f, globalStatus: e.target.value }))}>
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>P. Status</span>
          <select style={S.input} value={filters.phaseStatus} onChange={(e) => setFilters((f) => ({ ...f, phaseStatus: e.target.value }))}>
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <div>
          <span style={S.label}>Itens por página</span>
          <select style={S.input} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#111827" }}>
            <input type="checkbox" checked={showConcluded} onChange={(e) => setShowConcluded(e.target.checked)} />
            Mostrar concluídos?
          </label>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gridColumn: "span 2" }}>
          <button style={S.btnGhost} onClick={resetFilters}>Limpar Filtros</button>
        </div>
      </div>

      {viewMode === "dashboard" ? (
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 14 }}>
            <Card title="Projetos filtrados" value={dashboard.totalProjects} subtitle="Base de cálculo do dashboard" />
            <Card title="Média dias por phase" value={dashboard.avgDaysInPhase} subtitle="Considerando os filtros ativos" />
            <Card title="Média dias por projeto" value={dashboard.avgDaysInProject} subtitle="Tempo médio total" />
            <Card title="Média hold days" value={dashboard.avgHoldDays} subtitle="Dias médios em hold" />
            <Card title="Projetos em atraso" value={dashboard.delayedProjects} subtitle="Phase ou projeto em Delayed" />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr 1fr", gap: 16 }}>
            <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 20, padding: 18, boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 14 }}>
                1. Quantidade de projetos por phase e farol da phase
              </div>
              <PhaseColorChart rows={dashboard.phaseRows} />
            </div>

            <StatusBars title="Status por Phase" rows={dashboard.phaseStatusRows} colorFn={statusColor} />
            <StatusBars title="Status por Projeto" rows={dashboard.projectStatusRows} colorFn={statusColor} />
          </div>

          <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 20, padding: 18, boxShadow: "0 8px 30px rgba(15,23,42,0.04)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>2. Projetos por operador + fase/status + médias</div>
                <div style={{ fontSize: 12, color: "rgba(17,24,39,0.70)", marginTop: 4 }}>
                  Exibe o operador, a fase predominante, o status predominante da phase, o status predominante do projeto e as médias de dias.
                </div>
              </div>
            </div>
            <OperatorPhaseTable rows={dashboard.operatorRows} />
          </div>
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1750 }}>
              <thead>
                <tr>
                  <th style={S.th}>Farol</th>
                  <th style={S.th}>Farol Phase</th>
                  <th style={S.th}>Projeto</th>
                  <th style={S.th}>Operador</th>
                  <th style={S.th}>Fase Atual</th>
                  <th style={S.th}>P. Status</th>
                  <th style={S.th}>Global Status</th>
                  <th style={S.th}>County</th>
                  <th style={S.th}>Hold</th>
                  <th style={S.th}>D. Fase</th>
                  <th style={S.th}>D. Totais</th>
                  <th style={S.th}>Restante</th>
                  <th style={S.th}>Start P1</th>
                  <th style={S.th}>End P1</th>
                  <th style={S.th}>Status P1</th>
                  <th style={S.th}>Start P2</th>
                  <th style={S.th}>End P2</th>
                  <th style={S.th}>Status P2</th>
                  <th style={S.th}>Start P3</th>
                  <th style={S.th}>End P3</th>
                  <th style={S.th}>Status P3</th>
                  <th style={S.th}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pagedProjects.map((p) => (
                  <tr key={p.projectId}>
                    <td style={S.td}><span style={dotStyle(getProjectColorValue(p))} /></td>
                    <td style={S.td}><span style={dotStyle(getPhaseColorValue(p))} /></td>
                    <td style={{ ...S.td, fontWeight: 700 }}>{p.project?.title || p.projectId}</td>
                    <td style={S.td}>{p.majorityOperatorName || "-"}</td>
                    <td style={S.td}>{getPhaseValue(p) || "-"}</td>
                    <td style={S.td}>{getPhaseStatusValue(p) || "-"}</td>
                    <td style={S.td}>{getGlobalStatusValue(p) || "-"}</td>
                    <td style={S.td}>{p.county || "-"}</td>
                    <td style={S.td}>{p.totalHoldDays || 0}</td>
                    <td style={S.td}>{p.daysInPhase || 0}</td>
                    <td style={S.td}>{p.daysInProject || 0}</td>
                    <td style={{ ...S.td, color: normLong(p.daysRemaining) < 0 ? "#b91c1c" : "#15803d", fontWeight: 900 }}>
                      {p.daysRemaining || 0}
                    </td>
                    <td style={S.td}>{p.StartDatePhase1 || ""}</td>
                    <td style={S.td}>{p.EndDatePhase1 || ""}</td>
                    <td style={S.td}>{p.StatusPhase1 || ""}</td>
                    <td style={S.td}>{p.StartDatePhase2 || ""}</td>
                    <td style={S.td}>{p.EndDatePhase2 || ""}</td>
                    <td style={S.td}>{p.StatusPhase2 || ""}</td>
                    <td style={S.td}>{p.StartDatePhase3 || ""}</td>
                    <td style={S.td}>{p.EndDatePhase3 || ""}</td>
                    <td style={S.td}>{p.StatusPhase3 || ""}</td>
                    <td style={S.td}>
                      <button style={{ ...S.btnGhost, padding: "6px 10px", height: "auto" }} onClick={() => openJustify(p)}>
                        Justificar
                      </button>
                    </td>
                  </tr>
                ))}
                {pagedProjects.length === 0 && (
                  <tr>
                    <td style={S.td} colSpan={22}>Nenhum registro encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, borderTop: "1px solid rgba(0,0,0,0.06)", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, color: "rgba(17,24,39,0.8)", fontWeight: 700 }}>
              Mostrando {total === 0 ? 0 : startIdx + 1}–{endIdx} de {total}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button style={safePage <= 1 ? S.btnPrimaryDisabled : S.btnGhost} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>◀ Anterior</button>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>Página {safePage} de {totalPages}</div>
              <button style={safePage >= totalPages ? S.btnPrimaryDisabled : S.btnGhost} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Próxima ▶</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div
          onClick={closeJustify}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              padding: 24,
              borderRadius: 16,
              width: "100%",
              maxWidth: 560,
              color: "#111827",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Justificativa Técnico</h3>
            <div style={{ marginBottom: 10, fontSize: 13, fontWeight: "bold" }}>Projeto: {selectedProject?.project?.title || selectedProject?.projectId}</div>
            <textarea
              style={{ ...S.input, height: 140, padding: 12, marginBottom: 12 }}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Descreva o motivo técnico do atraso ou hold..."
            />
            {saveError ? <div style={{ marginBottom: 12, fontSize: 12, color: "#b91c1c", fontWeight: 800 }}>{saveError}</div> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={closeJustify}>Cancelar</button>
              <button style={savingReason ? S.btnPrimaryDisabled : S.btnPrimary} disabled={savingReason} onClick={saveJustification}>
                {savingReason ? "Salvando..." : "Salvar Justificativa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
