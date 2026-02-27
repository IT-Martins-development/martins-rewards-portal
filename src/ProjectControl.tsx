import React, { useState, useEffect, useMemo } from 'react';
import { get, post } from 'aws-amplify/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- INTERFACES ---
interface Justification {
  reason: string;
  createdAt?: string;
}

interface ProjectData {
  projectId: string;
  project?: { title: string };
  county: string;
  majorityOperatorName: string;
  currentPhase: string;
  daysInProject: number;
  projectColor: string;
  StatusProject: string;
  justifications?: Justification[];
}

// --- UTILITÁRIOS ---
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

export default function ProjectControl() {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [newReason, setNewReason] = useState("");

  const [filters, setFilters] = useState({ title: '', operator: '', county: '', color: '' });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const restOperation = get({ apiName: 'operatorApi', path: '/projects-control' });
      const response = await restOperation.response;
      let data: any = await response.body.json();
      if (typeof data === 'string') data = JSON.parse(data);
      if (data && data.body) data = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
      setProjects(data as ProjectData[]);
    } catch (error) {
      console.error("Erro ao carregar projetos:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchProjects(); }, []);

  useEffect(() => {
    let res = projects;
    if (filters.title) res = res.filter(p => p.project?.title?.toLowerCase().includes(filters.title.toLowerCase()));
    if (filters.operator) res = res.filter(p => p.majorityOperatorName?.toLowerCase().includes(filters.operator.toLowerCase()));
    if (filters.county) res = res.filter(p => p.county?.toLowerCase().includes(filters.county.toLowerCase()));
    if (filters.color) res = res.filter(p => p.projectColor === filters.color);
    setFilteredProjects(res);
  }, [filters, projects]);

  const exportCsv = () => {
    const headers = ["Farol", "Projeto", "County", "Operador", "Dias Corridos", "Status"];
    const rows = filteredProjects.map(p => [
      p.projectColor,
      p.project?.title || p.projectId,
      p.county,
      p.majorityOperatorName,
      p.daysInProject,
      p.StatusProject
    ]);
    const csv = [headers, ...rows].map(row => row.map(csvEscape).join(",")).join("\n");
    downloadTextFile(`projetos_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  const chartData = useMemo(() => {
    const ranges = { "0-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "120+": 0 };
    filteredProjects.forEach(p => {
      const d = p.daysInProject || 0;
      if (d <= 30) ranges["0-30"]++;
      else if (d <= 60) ranges["31-60"]++;
      else if (d <= 90) ranges["61-90"]++;
      else if (d <= 120) ranges["91-120"]++;
      else ranges["120+"]++;
    });
    return Object.entries(ranges).map(([range, quantidade]) => ({ range, quantidade }));
  }, [filteredProjects]);

  // --- ESTILOS PADRÃO REWARDS ---
  const S: Record<string, React.CSSProperties> = {
    page: { background: "#F6F7F9", borderRadius: 12, padding: 18, border: "1px solid rgba(0,0,0,0.06)", width: "100%", maxWidth: 1200, margin: "0 auto" },
    header: { display: "flex", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 },
    title: { margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" },
    btnPrimary: { background: "#7A5A3A", color: "white", border: "none", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800, height: 42 },
    btnGhost: { background: "white", color: "#7A5A3A", border: "1px solid rgba(122,90,58,0.35)", padding: "10px 14px", borderRadius: 12, cursor: "pointer", fontWeight: 800, height: 42 },
    filterGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 20 },
    label: { fontSize: 12, color: "rgba(17,24,39,0.75)", fontWeight: 800, marginBottom: 6, display: "block" },
    input: { width: "100%", height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.14)", outline: "none", backgroundColor: "white", fontSize: 14 },
    tableWrap: { background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflowX: "auto" },
    table: { width: "100%", borderCollapse: "collapse" },
    th: { textAlign: "left", fontSize: 12, color: "rgba(17,24,39,0.7)", padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#FBFBFC", fontWeight: 900 },
    td: { padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 13, color: "#111827" },
  };

  // Função de estilo para o Farol (fora do objeto S para evitar erro de TS)
  const getDotStyle = (color: string): React.CSSProperties => ({
    height: 12, width: 12, borderRadius: "50%", display: "inline-block",
    backgroundColor: color === 'Verde' ? '#22c55e' : color === 'Amarelo' ? '#eab308' : color === 'Laranja' ? '#f97316' : '#ef4444'
  });

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div><h2 style={S.title}>Controle de Projetos (Master)</h2><div style={{color: "rgba(17,24,39,0.65)", fontSize: 13}}>Total: <b>{filteredProjects.length}</b></div></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV</button>
          <button style={S.btnPrimary} onClick={() => void fetchProjects()}>{loading ? "..." : "Aplicar"}</button>
        </div>
      </div>

      <div style={S.filterGrid}>
        <label><div><span style={S.label}>Projeto</span><input style={S.input} onChange={e => setFilters({...filters, title: e.target.value})} placeholder="Nome do projeto"/></div></label>
        <label><div><span style={S.label}>Operador</span><input style={S.input} onChange={e => setFilters({...filters, operator: e.target.value})} placeholder="Buscar operador"/></div></label>
        <label><div><span style={S.label}>Cor do Farol</span>
          <select style={S.input} onChange={e => setFilters({...filters, color: e.target.value})}>
            <option value="">Todos</option><option value="Verde">Verde</option><option value="Amarelo">Amarelo</option><option value="Laranja">Laranja</option><option value="Vermelho">Vermelho</option>
          </select>
        </div></label>
      </div>

      <div style={{ background: "white", padding: 15, borderRadius: 12, marginBottom: 20, border: "1px solid rgba(0,0,0,0.08)" }}>
        <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 900 }}>Volume por Duração</h4>
        <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="range" fontSize={12}/><YAxis fontSize={12}/><Tooltip/><Bar dataKey="quantidade" fill="#7A5A3A" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div>
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Farol</th>
              <th style={S.th}>Projeto</th>
              <th style={S.th}>County</th>
              <th style={S.th}>Operador</th>
              <th style={S.th}>Dias Corridos</th>
              <th style={S.th}>Status</th>
              <th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.projectId}>
                <td style={S.td}><span style={getDotStyle(p.projectColor)} /></td>
                <td style={{ ...S.td, fontWeight: 700 }}>{p.project?.title || p.projectId}</td>
                <td style={S.td}>{p.county}</td>
                <td style={S.td}>{p.majorityOperatorName}</td>
                <td style={{ ...S.td, fontWeight: 800 }}>{p.daysInProject}</td>
                <td style={S.td}>{p.StatusProject}</td>
                <td style={S.td}><button style={S.btnGhost} onClick={() => { setSelectedProject(p); setIsModalOpen(true); }}>Justificar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: "100%", maxWidth: 500 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Nova Justificativa</h3>
            <textarea style={{ ...S.input, height: 100, padding: 10, marginBottom: 16 }} value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Descreva o motivo..."/>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={async () => {
                await post({ apiName: 'operatorApi', path: '/projects-control', options: { body: JSON.stringify({ projectId: selectedProject?.projectId, reason: newReason }) } });
                setIsModalOpen(false); void fetchProjects();
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}