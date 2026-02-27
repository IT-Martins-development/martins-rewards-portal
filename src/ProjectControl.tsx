import React, { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import * as queries from './graphql/queries';
import * as mutations from './graphql/mutations';

const client = generateClient();

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
      const res: any = await client.graphql({ query: queries.mongoProjectsControlList });
      const list = res?.data?.mongoProjectsControlList?.items || [];
      
      // Normalização robusta baseada nos campos reais do MongoDB (ex: daysInPhase, daysInProject)
      const normalized = list.map((p: any) => ({
        ...p,
        daysInPhase: p.daysInPhase || 0,
        daysInProject: p.daysInProject || 0,
        daysRemaining: p.daysRemaining || 0,
        totalHoldDays: p.totalHoldDays || 0
      }));
      setProjects(normalized);
    } catch (error) { console.error("Erro GraphQL:", error); }
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

  // Estilos garantindo letras pretas (#111827) para visibilidade total
  const S: Record<string, React.CSSProperties> = {
    page: { background: "#fff", padding: 20, color: "#111827", minHeight: "100vh" },
    input: { height: 40, padding: "0 10px", borderRadius: 8, border: "1px solid #ccc", color: "#111827" },
    th: { textAlign: "left", fontSize: 11, color: "#7A5A3A", padding: "10px", borderBottom: "2px solid #eee", fontWeight: "bold" },
    td: { padding: "10px", borderBottom: "1px solid #eee", fontSize: 12, color: "#111827" }, // Letras pretas aqui
    btnPrimary: { background: "#7A5A3A", color: "white", padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: "bold", cursor: "pointer" },
    btnGhost: { background: "#fff", color: "#7A5A3A", padding: "6px 12px", borderRadius: 8, border: "1px solid #7A5A3A", cursor: "pointer" }
  };

  const getDotStyle = (color: string): React.CSSProperties => ({
    height: 10, width: 10, borderRadius: "50%", display: "inline-block", marginRight: 8,
    backgroundColor: color === 'Verde' ? '#22c55e' : color === 'Amarelo' ? '#eab308' : '#ef4444'
  });

  return (
    <div style={S.page}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontWeight: 900 }}>Controle de Projetos (Master)</h2>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={S.btnGhost} onClick={() => {}}>Exportar CSV</button>
          <button style={S.btnPrimary} onClick={fetchProjects}>Aplicar</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 25 }}>
        <input style={S.input} placeholder="Projeto" onChange={e => setFilters({...filters, title: e.target.value})}/>
        <input style={S.input} placeholder="Operador" onChange={e => setFilters({...filters, operator: e.target.value})}/>
        <select style={S.input} onChange={e => setFilters({...filters, phase: e.target.value})}>
          <option value="">Fase (Todas)</option>
          <option value="Phase 1">Phase 1</option><option value="Phase 3">Phase 3</option>
        </select>
        <select style={S.input} onChange={e => setFilters({...filters, color: e.target.value})}>
          <option value="">Farol (Todos)</option>
          <option value="Verde">Verde</option><option value="Vermelho">Vermelho</option>
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={S.th}>Farol</th><th style={S.th}>Projeto</th><th style={S.th}>Operador</th>
              <th style={S.th}>Fase</th><th style={S.th}>Dias Fase</th><th style={S.th}>Dias Totais</th>
              <th style={S.th}>Restante</th><th style={S.th}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map(p => (
              <tr key={p.projectId}>
                <td style={S.td}><span style={getDotStyle(p.projectColor)} /></td>
                <td style={{ ...S.td, fontWeight: "bold" }}>{p.project?.title || p.projectId}</td>
                <td style={S.td}>{p.majorityOperatorName}</td>
                <td style={S.td}>{p.currentPhase}</td>
                <td style={S.td}>{p.daysInPhase}</td>
                <td style={S.td}>{p.daysInProject}</td>
                <td style={{ ...S.td, color: p.daysRemaining < 0 ? 'red' : 'green', fontWeight: "bold" }}>{p.daysRemaining}</td>
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
          <div style={{ background: "white", padding: 25, borderRadius: 12, width: 400, color: "#111827" }}>
            <h3 style={{ marginTop: 0 }}>Justificar Projeto</h3>
            <textarea style={{ width: "100%", height: 100, marginBottom: 15, padding: 10, border: "1px solid #ccc" }} 
              value={newReason} onChange={e => setNewReason(e.target.value)} placeholder="Motivo técnico..." />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setIsModalOpen(false)}>Sair</button>
              <button style={S.btnPrimary} onClick={async () => {
                await client.graphql({ query: mutations.mongoProjectSaveJustification, variables: { projectId: selectedProject.projectId, reason: newReason } });
                setIsModalOpen(false); setNewReason(""); void fetchProjects();
              }}>Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}