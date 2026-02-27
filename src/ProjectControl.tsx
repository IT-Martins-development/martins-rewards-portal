import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

const MONGO_PROJECTS_LIST = /* GraphQL */ `
  query MongoProjectsControlList($limit: Int) {
    mongoProjectsControlList(limit: $limit) {
      items {
        projectId county majorityOperatorName currentPhase phaseStatus 
        projectStatus StatusProject daysInPhase daysInProject daysRemaining 
        totalHoldDays projectColor phaseExpectedDays permitIssuedDate
        StartDatePhase1 EndDatePhase1 StatusPhase1
        StartDatePhase2 EndDatePhase2 StatusPhase2
        StartDatePhase3 EndDatePhase3 StatusPhase3
        reason project { title }
      }
    }
  }
`;

const SAVE_JUSTIFICATION = /* GraphQL */ `
  mutation MongoProjectSaveJustification($projectId: ID!, $reason: String!) {
    mongoProjectSaveJustification(projectId: $projectId, reason: $reason) {
      projectId reason
    }
  }
`;

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
      const res: any = await client.graphql({ query: MONGO_PROJECTS_LIST, variables: { limit: 500 } });
      setProjects(res?.data?.mongoProjectsControlList?.items || []);
    } catch (error) { console.error("Erro ao carregar:", error); }
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

  const exportCsv = () => {
    const headers = [
      "ID", "Projeto", "County", "Operador", "Fase Atual", "Status Fase", "Expectativa", "Dias na Fase",
      "Status Projeto", "Status Global", "Hold Days", "Dias Totais", "Restante", "Cor", "Permit Date",
      "S. Phase 1", "E. Phase 1", "Status P1", "S. Phase 2", "E. Phase 2", "Status P2", "JUSTIFICATIVA"
    ];
    const rows = projects.map(p => [
      p.projectId, `"${p.project?.title || ""}"`, p.county, `"${p.majorityOperatorName || ""}"`,
      p.currentPhase, p.phaseStatus, p.phaseExpectedDays, p.daysInPhase, p.projectStatus, p.StatusProject,
      p.totalHoldDays, p.daysInProject, p.daysRemaining, p.projectColor, p.permitIssuedDate,
      p.StartDatePhase1, p.EndDatePhase1, p.StatusPhase1, p.StartDatePhase2, p.EndDatePhase2, p.StatusPhase2,
      `"${p.reason || ""}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Auditoria_Projetos.csv`;
    link.click();
  };

  const S: Record<string, React.CSSProperties> = {
    page: { background: "#fff", padding: 20, color: "#111827", minHeight: "100vh" },
    input: { height: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #ccc", color: "#111827" },
    td: { padding: "10px", borderBottom: "1px solid #eee", fontSize: 12, color: "#111827" },
    btnPrimary: { background: "#7A5A3A", color: "white", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: "bold", cursor: "pointer" }
  };

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontWeight: 900 }}>Controle de Projetos (Master)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.btnPrimary, background: "#fff", color: "#7A5A3A", border: "1px solid #7A5A3A" }} onClick={exportCsv}>Exportar Auditoria</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>Aplicar</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 25 }}>
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

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FBFBFC" }}>
              <th style={S.td}>Farol</th><th style={S.td}>Projeto</th><th style={S.td}>Fase</th><th style={S.td}>Status</th><th style={S.td}>Restante</th><th style={S.td}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.projectId}>
                <td style={S.td}>{p.projectColor}</td>
                <td style={{ ...S.td, fontWeight: "bold" }}>{p.project?.title || p.projectId}</td>
                <td style={S.td}>{p.currentPhase}</td>
                <td style={S.td}>{p.StatusProject}</td>
                <td style={{ ...S.td, color: p.daysRemaining < 0 ? 'red' : 'green', fontWeight: "bold" }}>{p.daysRemaining}</td>
                <td style={S.td}>
                  <button style={{ ...S.btnPrimary, padding: "5px 10px", fontSize: 10 }} onClick={() => { setSelectedProject(p); setIsModalOpen(true); }}>Justificar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "white", padding: 25, borderRadius: 12, width: 400, color: "#111827" }}>
            <h3 style={{ marginTop: 0 }}>Justificar Projeto</h3>
            <textarea style={{ width: "100%", height: 100, marginBottom: 15, padding: 10, color: "#111827" }} value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Motivo técnico..." />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setIsModalOpen(false)}>Sair</button>
              <button style={S.btnPrimary} onClick={async () => {
                await client.graphql({ query: SAVE_JUSTIFICATION, variables: { projectId: selectedProject.projectId, reason: newReason } });
                setIsModalOpen(false); setNewReason(""); void fetchProjects();
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}