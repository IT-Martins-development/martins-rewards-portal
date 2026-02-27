import React, { useState, useEffect } from 'react';
import { get, post } from 'aws-amplify/api';
import { Amplify } from 'aws-amplify';
Amplify.configure({
  API: {
    REST: {
      "operatorApi": {
        endpoint: "https://d2ti6bqx2tfgyt.execute-api.us-east-2.amazonaws.com/staging",
        region: "us-east-2"
      }
    }
  }
});


export default function ProjectControl() {
  const [projects, setProjects] = useState<any[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newReason, setNewReason] = useState("");

  const [filters, setFilters] = useState({ 
    title: '', operator: '', color: '', phase: '', globalStatus: '' 
  });

  const fetchProjects = async () => {
    setLoading(true);
    try {
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
        phaseExpectedDays: p.phaseExpectedDays?.$numberLong ? parseInt(p.phaseExpectedDays.$numberLong) : (Number(p.phaseExpectedDays) || 0),
        }));

      setProjects(normalized);
    } catch (error) { console.error("Erro:", error); }
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

  // --- EXPORTAÇÃO COMPLETA COM JUSTIFICATIVAS ---
const exportCsv = () => {
  // Cabeçalhos técnicos completos para auditoria
  const headers = [
    "ID Projeto", "Nome do Projeto", "County", "Operador Responsável", 
    "Fase Atual", "Status da Fase", "Expectativa Fase (Dias)", "Dias na Fase",
    "Status Projeto", "Status Global", "Hold Days (Total)", "Dias Totais Projeto", "Dias Restantes", 
    "Cor Farol", "Data Emissão Permit",
    "Inicio Phase 1", "Fim Phase 1", "Status Phase 1",
    "Inicio Phase 2", "Fim Phase 2", "Status Phase 2",
    "Inicio Phase 3", "Fim Phase 3", "Status Phase 3",
    "JUSTIFICATIVA TÉCNICA"
  ];

  // Mapeamento direto de TODA a base vinda do MongoDB
  const rows = projects.map(p => [
    p.projectId,
    `"${p.project?.title || ""}"`,
    `"${p.county || ""}"`,
    `"${p.majorityOperatorName || ""}"`,
    p.currentPhase || "",
    p.phaseStatus || "",
    p.phaseExpectedDays || 0,
    p.daysInPhase || 0,
    p.projectStatus || "",
    p.StatusProject || "",
    p.totalHoldDays || 0,
    p.daysInProject || 0,
    p.daysRemaining || 0,
    p.projectColor || "",
    p.permitIssuedDate || "",
    p.StartDatePhase1 || "", p.EndDatePhase1 || "", p.StatusPhase1 || "",
    p.StartDatePhase2 || "", p.EndDatePhase2 || "", p.StatusPhase2 || "",
    p.StartDatePhase3 || "", p.EndDatePhase3 || "", p.StatusPhase3 || "",
    `"${p.reason || p.justification || ""}"`
  ]);

  const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' }); // \ufeff ajuda o Excel com acentos
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Relatorio_Master_Completo_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};

  const getDotStyle = (color: string): React.CSSProperties => ({
    height: 12, width: 12, borderRadius: "50%", display: "inline-block",
    backgroundColor: color === 'Verde' ? '#22c55e' : color === 'Amarelo' ? '#eab308' : color === 'Laranja' ? '#f97316' : '#ef4444'
  });

  const S: Record<string, React.CSSProperties> = {
    page: { background: "#F6F7F9", borderRadius: 12, padding: 18, border: "1px solid rgba(0,0,0,0.06)", width: "100%", maxWidth: 1400, margin: "0 auto", color: "#111827" },
    btnPrimary: { background: "#7A5A3A", color: "white", border: "none", padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer", height: 42 },
    btnGhost: { background: "white", color: "#7A5A3A", border: "1px solid rgba(122,90,58,0.35)", padding: "10px 14px", borderRadius: 12, fontWeight: 800, cursor: "pointer", height: 42 },
    input: { width: "100%", height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.14)", outline: "none", color: "#111827", backgroundColor: "#fff" },
    th: { textAlign: "left", fontSize: 10, color: "rgba(17,24,39,0.7)", padding: "12px", background: "#FBFBFC", fontWeight: 900, borderBottom: "1px solid rgba(0,0,0,0.06)" },
    td: { padding: "12px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 12, color: "#111827" } 
  };

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>Controle de Projetos (Master)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV Completo</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>{loading ? "..." : "Aplicar"}</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <input style={S.input} placeholder="Projeto" onChange={e => setFilters({...filters, title: e.target.value})}/>
        <input style={S.input} placeholder="Operador" onChange={e => setFilters({...filters, operator: e.target.value})}/>
        <select style={S.input} onChange={e => setFilters({...filters, phase: e.target.value})}>
          <option value="">Todas as Fases</option>
          <option value="Phase 1">Phase 1</option><option value="Phase 2">Phase 2</option><option value="Phase 3">Phase 3</option>
        </select>
        <select style={S.input} onChange={e => setFilters({...filters, globalStatus: e.target.value})}>
          <option value="">Todos Status</option>
          <option value="In Progress">In Progress</option><option value="Concluded">Concluded</option><option value="Delayed">Delayed</option><option value="On Hold">On Hold</option>
        </select>
        <select style={S.input} onChange={e => setFilters({...filters, color: e.target.value})}>
          <option value="">Todos Faróis</option>
          <option value="Verde">Verde</option><option value="Amarelo">Amarelo</option><option value="Laranja">Laranja</option><option value="Vermelho">Vermelho</option>
        </select>
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
                <td style={S.td}><button style={S.btnGhost} onClick={() => { setSelectedProject(p); setIsModalOpen(true); }}>Justificar</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: "100%", maxWidth: 500, color: "#111827" }}>
            <h3 style={{ marginTop: 0 }}>Salvar em stausProjects</h3>
            <textarea style={{ ...S.input, height: 100, padding: 10, marginBottom: 16 }} value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Escreva o motivo técnico..."/>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button style={S.btnPrimary} onClick={async () => {
                await post({ apiName: 'operatorApi', path: '/projects-control', options: { body: { projectId: selectedProject?.projectId, reason: newReason } } });
                setIsModalOpen(false); setNewReason(""); void fetchProjects();
              }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}