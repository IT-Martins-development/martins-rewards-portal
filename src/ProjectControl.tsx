import React, { useState, useEffect } from 'react';
import { get, post } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';

// Registro forçado da API compatível com o build tsc da AWS
const apiConfig = {
  API: {
    REST: {
      "operatorApi": {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
};
Amplify.configure(apiConfig);

export default function ProjectControl() {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newReason, setNewReason] = useState("");

  const [filters, setFilters] = useState({ title: '', operator: '', color: '', phase: '', globalStatus: '' });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // Chamada exata esperada pelo backend homologado
      const restOperation = get({ apiName: 'operatorApi', path: '/projects-control' });
      const response = await restOperation.response;
      const data: any = await response.body.json();
      const rawList = Array.isArray(data) ? data : (data?.body ? JSON.parse(data.body) : []);
      
      const normalized = rawList.map((p: any) => ({
        ...p,
        daysInPhase: p.daysInPhase?.$numberLong ? parseInt(p.daysInPhase.$numberLong) : (Number(p.daysInPhase) || 0),
        daysInProject: p.daysInProject?.$numberLong ? parseInt(p.daysInProject.$numberLong) : (Number(p.daysInProject) || 0),
        daysRemaining: p.daysRemaining?.$numberLong ? parseInt(p.daysRemaining.$numberLong) : (Number(p.daysRemaining) || 0),
        totalHoldDays: p.totalHoldDays?.$numberLong ? parseInt(p.totalHoldDays.$numberLong) : (Number(p.totalHoldDays) || 0),
      }));
      setProjects(normalized);
    } catch (error) { console.error("Erro ao carregar dados:", error); }
    finally { setLoading(false); }
  };

  useEffect(() => { void fetchProjects(); }, []);

  useEffect(() => {
    let res = projects;
    if (filters.title) res = res.filter(p => p.project?.title?.toLowerCase().includes(filters.title.toLowerCase()));
    if (filters.operator) res = res.filter(p => p.majorityOperatorName?.toLowerCase().includes(filters.operator.toLowerCase()));
    if (filters.color) res = res.filter(p => p.projectColor === filters.color);
    if (filters.globalStatus) res = res.filter(p => p.StatusProject === filters.globalStatus);
    setFilteredProjects(res);
  }, [filters, projects]);

  // --- EXPORTAÇÃO MASTER (21 colunas + Justificativas) ---
  const exportCsv = () => {
    const headers = [
      "ID", "Projeto", "County", "Operador", "Fase Atual", "P. Status", 
      "Global Status", "Hold Days", "Dias Fase", "Dias Totais", "Restante", "Cor",
      "Inicio P1", "Fim P1", "Status P1", "Inicio P2", "Fim P2", "Status P2", "Inicio P3", "Fim P3", "Status P3", "JUSTIFICATIVA"
    ];
    const rows = projects.map(p => [
      p.projectId, `"${p.project?.title || ""}"`, p.county || "", `"${p.majorityOperatorName || ""}"`, 
      p.currentPhase || "", p.projectStatus || "", p.StatusProject || "", p.totalHoldDays || 0,
      p.daysInPhase, p.daysInProject, p.daysRemaining, p.projectColor || "",
      p.StartDatePhase1 || "", p.EndDatePhase1 || "", p.StatusPhase1 || "",
      p.StartDatePhase2 || "", p.EndDatePhase2 || "", p.StatusPhase2 || "",
      p.StartDatePhase3 || "", p.EndDatePhase3 || "", p.StatusPhase3 || "", `"${p.reason || ""}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Auditoria_Master_Martins.csv`;
    link.click();
  };

  const S: Record<string, React.CSSProperties> = {
    page: { background: "#fff", padding: 20, color: "#111827", minHeight: "100vh" },
    input: { height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid #ccc", color: "#111827", background: "#fff" },
    td: { padding: "12px", borderBottom: "1px solid #eee", fontSize: 12, color: "#111827" },
    btnPrimary: { background: "#7A5A3A", color: "white", padding: "10px 16px", borderRadius: 12, border: "none", fontWeight: "bold", cursor: "pointer" }
  };

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900, color: "#111827" }}>Controle de Projetos (Master)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btnPrimary, background: "#fff", color: "#7A5A3A", border: "1px solid #7A5A3A" }} onClick={exportCsv}>Exportar Auditoria</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>{loading ? "..." : "Aplicar"}</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <input style={S.input} placeholder="Projeto" onChange={e => setFilters({...filters, title: e.target.value})}/>
        <input style={S.input} placeholder="Operador" onChange={e => setFilters({...filters, operator: e.target.value})}/>
        <select style={S.input} onChange={e => setFilters({...filters, color: e.target.value})}>
          <option value="">Farol (Todos)</option>
          <option value="Verde">Verde</option><option value="Amarelo">Amarelo</option><option value="Vermelho">Vermelho</option>
        </select>
        <select style={S.input} onChange={e => setFilters({...filters, globalStatus: e.target.value})}>
          <option value="">Status Global</option>
          <option value="In Progress">In Progress</option><option value="Delayed">Delayed</option>
        </select>
      </div>
      <div style={{ background: "white", borderRadius: 12, border: "1px solid #eee", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={S.td}>Farol</th><th style={S.td}>Projeto</th><th style={S.td}>Status</th><th style={S.td}>Restante</th><th style={S.td}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.projectId}>
                <td style={S.td}>{p.projectColor}</td>
                <td style={{ ...S.td, fontWeight: "bold" }}>{p.project?.title || p.projectId}</td>
                <td style={S.td}>{p.StatusProject}</td>
                <td style={{ ...S.td, color: p.daysRemaining < 0 ? 'red' : 'green', fontWeight: "bold" }}>{p.daysRemaining}</td>
                <td style={S.td}>
                  <button style={{ ...S.btnPrimary, padding: "5px 10px" }} onClick={() => { setSelectedProject(p); setNewReason(p.reason || ""); setIsModalOpen(true); }}>Justificar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}