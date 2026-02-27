import React, { useState, useEffect } from 'react';
import { get, post } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
Amplify.configure({
  API: {
    REST: {
      "operatorApi": {
        endpoint: "https://d3g2ypezejhh8u.execute-api.us-east-2.amazonaws.com/staging", 
        region: "us-east-2"
      }
    }
  }
}, { libraryOptions: { API: { REST: { headers: async () => ({}) } } } });

export default function ProjectControl() {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newReason, setNewReason] = useState("");

  const [filters, setFilters] = useState({ 
    title: '', 
    operator: '', 
    color: '', 
    phase: '', 
    globalStatus: '' 
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
      // O nome 'operatorApi' aqui deve bater com o seu amplifyInit.ts
      const restOperation = get({ apiName: 'operatorApi', path: '/projects-control' });
      const response = await restOperation.response;
      const data: any = await response.body.json();
      
      const rawList = Array.isArray(data) ? data : (data?.body ? JSON.parse(data.body) : []);
      
      // Normalização dos campos numéricos vindo do MongoDB ($numberLong)
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
    if (filters.phase) res = res.filter(p => p.currentPhase === filters.phase);
    if (filters.globalStatus) res = res.filter(p => p.StatusProject === filters.globalStatus);
    
    setFilteredProjects(res);
  }, [filters, projects]);

  // --- EXPORTAÇÃO COMPLETA (21 colunas + Justificativas) ---
  const exportCsv = () => {
    const headers = [
      "ID", "Projeto", "County", "Operador", "Fase Atual", "P. Status", 
      "Global Status", "Hold Days", "Dias Fase", "Dias Totais", "Restante", "Cor",
      "Inicio P1", "Fim P1", "Status P1", "Inicio P2", "Fim P2", "Status P2", "Inicio P3", "Fim P3", "Status P3", "JUSTIFICATIVA"
    ];

    const rows = projects.map(p => [
      p.projectId, 
      `"${p.project?.title || ""}"`, 
      p.county || "",
      `"${p.majorityOperatorName || ""}"`, 
      p.currentPhase || "", 
      p.projectStatus || "", 
      p.StatusProject || "", 
      p.totalHoldDays || 0,
      p.daysInPhase, 
      p.daysInProject, 
      p.daysRemaining, 
      p.projectColor || "",
      p.StartDatePhase1 || "", p.EndDatePhase1 || "", p.StatusPhase1 || "",
      p.StartDatePhase2 || "", p.EndDatePhase2 || "", p.StatusPhase2 || "",
      p.StartDatePhase3 || "", p.EndDatePhase3 || "", p.StatusPhase3 || "",
      `"${p.reason || ""}"` // Justificativa técnica para auditoria
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Auditoria_Master_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getDotStyle = (color: string): React.CSSProperties => ({
    height: 12, width: 12, borderRadius: "50%", display: "inline-block",
    backgroundColor: color === 'Verde' ? '#22c55e' : color === 'Amarelo' ? '#eab308' : color === 'Laranja' ? '#f97316' : '#ef4444'
  });

  const S: Record<string, React.CSSProperties> = {
    page: { background: "#fff", borderRadius: 12, padding: 18, border: "1px solid rgba(0,0,0,0.06)", width: "100%", maxWidth: 1400, margin: "0 auto", color: "#111827" },
    header: { display: "flex", justifyContent: "space-between", marginBottom: 20 },
    btnPrimary: { background: "#7A5A3A", color: "white", border: "none", padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer", height: 42 },
    btnGhost: { background: "white", color: "#7A5A3A", border: "1px solid rgba(122,90,58,0.35)", padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer", height: 42 },
    input: { width: "100%", height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.14)", outline: "none", color: "#111827", backgroundColor: "#fff", fontSize: 13 },
    label: { fontSize: 11, color: "rgba(17,24,39,0.75)", fontWeight: 800, marginBottom: 4, display: "block" },
    th: { textAlign: "left", fontSize: 10, color: "rgba(17,24,39,0.7)", padding: "12px", background: "#FBFBFC", fontWeight: 900, borderBottom: "1px solid rgba(0,0,0,0.06)" },
    td: { padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#111827" } 
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>Controle de Projetos (Master)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV Completo</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>{loading ? "A carregar..." : "Aplicar"}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <div><span style={S.label}>Projeto</span><input style={S.input} placeholder="Nome" onChange={e => setFilters({...filters, title: e.target.value})}/></div>
        <div><span style={S.label}>Operador</span><input style={S.input} placeholder="Nome" onChange={e => setFilters({...filters, operator: e.target.value})}/></div>
        <div><span style={S.label}>Fase</span>
          <select style={S.input} onChange={e => setFilters({...filters, phase: e.target.value})}>
            <option value="">Todas</option>
            <option value="Phase 1">Phase 1</option><option value="Phase 2">Phase 2</option><option value="Phase 3">Phase 3</option>
          </select>
        </div>
        <div><span style={S.label}>Status Global</span>
          <select style={S.input} onChange={e => setFilters({...filters, globalStatus: e.target.value})}>
            <option value="">Todos</option>
            <option value="In Progress">In Progress</option><option value="Concluded">Concluded</option>
            <option value="Delayed">Delayed</option><option value="On Hold">On Hold</option>
          </select>
        </div>
        <div><span style={S.label}>Farol</span>
          <select style={S.input} onChange={e => setFilters({...filters, color: e.target.value})}>
            <option value="">Todos</option>
            <option value="Verde">Verde</option><option value="Amarelo">Amarelo</option>
            <option value="Laranja">Laranja</option><option value="Vermelho">Vermelho</option>
          </select>
        </div>
      </div>

      <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={S.th}>Farol</th><th style={S.th}>Projeto</th><th style={S.th}>P. Status</th><th style={S.th}>Global Status</th>
              <th style={S.th}>Hold</th><th style={S.th}>D. Fase</th><th style={S.th}>D. Totais</th><th style={S.th}>Restante</th><th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.projectId}>
                <td style={S.td}><span style={getDotStyle(p.projectColor)} /></td>
                <td style={{ ...S.td, fontWeight: 700 }}>{p.project?.title || p.projectId}</td>
                <td style={S.td}>{p.projectStatus || "-"}</td>
                <td style={S.td}>{p.StatusProject || "-"}</td>
                <td style={S.td}>{p.totalHoldDays || 0}</td>
                <td style={S.td}>{p.daysInPhase}</td>
                <td style={S.td}>{p.daysInProject}</td>
                <td style={{ ...S.td, color: p.daysRemaining < 0 ? 'red' : 'green', fontWeight: 800 }}>{p.daysRemaining}</td>
                <td style={S.td}><button style={{ ...S.btnGhost, padding: "5px 10px", height: "auto" }} onClick={() => { setSelectedProject(p); setNewReason(p.reason || ""); setIsModalOpen(true); }}>Justificar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: "100%", maxWidth: 500, color: "#111827" }}>
            <h3 style={{ marginTop: 0 }}>Justificativa Técnico</h3>
            <div style={{ marginBottom: 10, fontSize: 13, fontWeight: "bold" }}>Projeto: {selectedProject?.project?.title || selectedProject?.projectId}</div>
            <textarea style={{ ...S.input, height: 120, padding: 12, marginBottom: 16 }} value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Descreva o motivo técnico..."/>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={async () => {
                const restOperation = post({ 
                  apiName: 'operatorApi', 
                  path: '/projects-control', 
                  options: { body: { projectId: selectedProject?.projectId, reason: newReason } } 
                });
                await restOperation.response;
                setIsModalOpen(false); void fetchProjects();
              }}>Salvar Justificativa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}