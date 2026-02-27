import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

// Query baseada no novo schema que você subiu
const LIST_PROJECTS = /* GraphQL */ `
  query MongoProjectsControlList {
    mongoProjectsControlList(limit: 500) {
      items {
        projectId
        county
        majorityOperatorName
        currentPhase
        phaseStatus
        projectStatus
        StatusProject
        daysInPhase
        daysInProject
        daysRemaining
        totalHoldDays
        projectColor
        phaseExpectedDays
        permitIssuedDate
        StartDatePhase1
        EndDatePhase1
        StatusPhase1
        reason
        project {
          title
        }
      }
    }
  }
`;

const SAVE_JUSTIFICATION = /* GraphQL */ `
  mutation MongoProjectSaveJustification($projectId: ID!, $reason: String!) {
    mongoProjectSaveJustification(projectId: $projectId, reason: $reason) {
      projectId
      reason
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
      const res: any = await client.graphql({ query: LIST_PROJECTS });
      const list = res?.data?.mongoProjectsControlList?.items || [];
      
      // Normalização para garantir que números do MongoDB apareçam corretamente
      const normalized = list.map((p: any) => ({
        ...p,
        daysInPhase: p.daysInPhase || 0,
        daysInProject: p.daysInProject || 0,
        daysRemaining: p.daysRemaining || 0,
        totalHoldDays: p.totalHoldDays || 0
      }));

      setProjects(normalized);
    } catch (error) {
      console.error("Erro via GraphQL:", error);
    } finally {
      setLoading(false);
    }
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

  const exportCsv = () => {
    const headers = ["ID", "Projeto", "Operador", "Fase", "D. Restante", "Cor", "JUSTIFICATIVA"];
    const rows = projects.map(p => [
      p.projectId, `"${p.project?.title || ""}"`, `"${p.majorityOperatorName || ""}"`,
      p.currentPhase, p.daysRemaining, p.projectColor, `"${p.reason || ""}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Master.csv`;
    link.click();
  };

  const S: Record<string, React.CSSProperties> = {
    page: { background: "#F6F7F9", padding: 18, color: "#111827" },
    btnPrimary: { background: "#7A5A3A", color: "white", border: "none", padding: "10px 14px", borderRadius: 12, cursor: "pointer" },
    btnGhost: { background: "white", color: "#7A5A3A", border: "1px solid #7A5A3A", padding: "8px 12px", borderRadius: 12, cursor: "pointer" },
    input: { height: 42, padding: "0 12px", borderRadius: 12, border: "1px solid #ddd", color: "#111827" },
    td: { padding: "12px", borderBottom: "1px solid #eee", fontSize: 12, color: "#111827" }
  };

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontWeight: 900 }}>Controle de Projetos (GraphQL)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnGhost} onClick={exportCsv}>Exportar CSV</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>Atualizar</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <input style={S.input} placeholder="Projeto" onChange={e => setFilters({...filters, title: e.target.value})}/>
        <select style={S.input} onChange={e => setFilters({...filters, color: e.target.value})}>
          <option value="">Todos Faróis</option>
          <option value="Verde">Verde</option><option value="Amarelo">Amarelo</option><option value="Vermelho">Vermelho</option>
        </select>
      </div>

      <div style={{ background: "white", borderRadius: 12, overflow: "hidden", border: "1px solid #eee" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#FBFBFC" }}>
              <th style={S.td}>Farol</th><th style={S.td}>Projeto</th><th style={S.td}>Status</th><th style={S.td}>Restante</th><th style={S.td}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.projectId}>
                <td style={S.td}>{p.projectColor}</td>
                <td style={{ ...S.td, fontWeight: 700 }}>{p.project?.title || p.projectId}</td>
                <td style={S.td}>{p.StatusProject}</td>
                <td style={{ ...S.td, color: p.daysRemaining < 0 ? 'red' : 'green' }}>{p.daysRemaining}</td>
                <td style={S.td}>
                  <button style={S.btnGhost} onClick={() => { setSelectedProject(p); setIsModalOpen(true); }}>Justificar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: 400 }}>
            <h3>Justificar Projeto</h3>
            <textarea style={{ width: "100%", height: 100, marginBottom: 16 }} value={newReason} onChange={e => setNewReason(e.target.value)} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setIsModalOpen(false)}>Sair</button>
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