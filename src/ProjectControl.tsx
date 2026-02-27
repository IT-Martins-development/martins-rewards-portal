import React, { useState, useEffect, useMemo } from 'react';
import { get, post } from 'aws-amplify/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- TIPAGENS (TypeScript) ---
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

interface Filters {
  currentPhase: string;
  majorityOperatorName: string;
  county: string;
  title: string;
  StatusProject: string;
  projectColor: string;
}

export default function ProjectControl() {
  // --- ESTADOS ---
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<ProjectData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);
  const [newReason, setNewReason] = useState("");
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    currentPhase: '',
    majorityOperatorName: '',
    county: '',
    title: '',
    StatusProject: '',
    projectColor: ''
  });

  // --- BUSCAR DADOS (Amplify API) ---
  useEffect(() => {
    fetchProjects();
  }, []);

const fetchProjects = async () => {
    setLoading(true);
    try {
      const restOperation = get({
        apiName: 'operatorApi',
        path: '/projects-control'
      });
      
const response = await restOperation.response;
      let data: any = await response.body.json(); // <-- Só adicionar ": any" aqui
      
      // 1. LOG PARA VERMOS O QUE CHEGOU
      console.log("Resposta da API (Tipo):", typeof data);
      console.log("Resposta da API (Conteúdo):", data);

      // 2. TRAVA DE SEGURANÇA
      if (typeof data === 'string') {
        data = JSON.parse(data);
      }

      if (data && data.body) {
         data = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
      }

      console.log("Array de projetos final:", data);
      setProjects(data as ProjectData[]);
    } catch (error) {
      console.error("Erro ao buscar projetos:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE FILTROS ---
  useEffect(() => {
    let result = projects;
    
    if (filters.currentPhase) result = result.filter(p => p.currentPhase === filters.currentPhase);
    if (filters.county) result = result.filter(p => p.county?.toLowerCase().includes(filters.county.toLowerCase()));
    if (filters.StatusProject) result = result.filter(p => p.StatusProject === filters.StatusProject);
    if (filters.projectColor) result = result.filter(p => p.projectColor === filters.projectColor);
    if (filters.majorityOperatorName) {
      result = result.filter(p => p.majorityOperatorName?.toLowerCase().includes(filters.majorityOperatorName.toLowerCase()));
    }
    if (filters.title) {
      result = result.filter(p => p.project?.title?.toLowerCase().includes(filters.title.toLowerCase()));
    }
    
    setFilteredProjects(result);
  }, [filters, projects]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // --- DADOS DO GRÁFICO ---
  const chartData = useMemo(() => {
    const ranges = { "0-30": 0, "31-60": 0, "61-90": 0, "91-120": 0, "120+": 0 };
    filteredProjects.forEach(p => {
      const days = p.daysInProject || 0;
      if (days <= 30) ranges["0-30"]++;
      else if (days <= 60) ranges["31-60"]++;
      else if (days <= 90) ranges["61-90"]++;
      else if (days <= 120) ranges["91-120"]++;
      else ranges["120+"]++;
    });
    return Object.keys(ranges).map(key => ({ range: key, quantidade: ranges[key as keyof typeof ranges] }));
  }, [filteredProjects]);

  // --- MODAL & JUSTIFICATIVAS ---
  const openModal = (project: ProjectData) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

const saveJustification = async () => {
    if (!newReason.trim() || !selectedProject) return;
    
    try {
      // Nova sintaxe do Amplify v6 para POST
      const restOperation = post({
        apiName: 'operatorApi',
        path: '/projects-control',
        options: {
          body: {
            projectId: selectedProject.projectId,
            reason: newReason
          }
        }
      });
      
      await restOperation.response;
      
      setNewReason("");
      setIsModalOpen(false);
      fetchProjects(); // Recarrega os dados atualizados
    } catch (error) {
      console.error("Erro ao salvar justificativa:", error);
      alert("Erro ao salvar a justificativa.");
    }
  };

  // --- RENDERIZAÇÃO DA TELA ---
  return (
    <div className="p-6 bg-white rounded-lg shadow-sm w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Controle de Projetos</h1>
        <button onClick={fetchProjects} className="bg-gray-200 px-4 py-2 rounded hover:bg-gray-300">
          {loading ? "Carregando..." : "Recarregar Dados"}
        </button>
      </div>

      {/* ÁREA DE FILTROS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 p-4 bg-gray-50 rounded border">
        <input name="title" placeholder="Buscar por Título do Projeto..." onChange={handleFilterChange} className="border p-2 rounded w-full" />
        <input name="majorityOperatorName" placeholder="Buscar por Operador..." onChange={handleFilterChange} className="border p-2 rounded w-full" />
        <input name="county" placeholder="County (Ex: Marion)..." onChange={handleFilterChange} className="border p-2 rounded w-full" />
        
        <select name="currentPhase" onChange={handleFilterChange} className="border p-2 rounded w-full">
          <option value="">Todas as Fases</option>
          <option value="Phase 1">Phase 1</option>
          <option value="Phase 2">Phase 2</option>
          <option value="Phase 3">Phase 3</option>
          <option value="Preconstruction">Preconstruction</option>
        </select>

        <select name="StatusProject" onChange={handleFilterChange} className="border p-2 rounded w-full">
          <option value="">Status do Projeto (Todos)</option>
          <option value="Concluded">Concluded</option>
          <option value="In Progress">In Progress</option>
        </select>

        <select name="projectColor" onChange={handleFilterChange} className="border p-2 rounded w-full">
          <option value="">Cores (Todas)</option>
          <option value="Verde">Verde</option>
          <option value="Amarelo">Amarelo</option>
          <option value="Laranja">Laranja</option>
          <option value="Vermelho">Vermelho</option>
        </select>
      </div>

      {/* GRÁFICO */}
      <div className="mb-8 bg-white p-4 border rounded" style={{ height: 350 }}>
        <h2 className="text-lg font-semibold mb-4 text-center">Volume de Projetos por Dias de Duração</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="range" />
            <YAxis allowDecimals={false} />
            <Tooltip cursor={{ fill: '#f5f5f5' }} />
            <Legend />
            <Bar dataKey="quantidade" fill="#4A90E2" name="Quantidade de Projetos" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* TABELA DE PROJETOS */}
      <div className="overflow-x-auto border rounded">
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-100 border-b">
              <th className="p-3">Projeto</th>
              <th className="p-3">County</th>
              <th className="p-3">Operador</th>
              <th className="p-3 text-center">Dias Corridos</th>
              <th className="p-3 text-center">Cor</th>
              <th className="p-3">Status Global</th>
              <th className="p-3">Justificativas</th>
              <th className="p-3 text-center">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.length === 0 ? (
              <tr><td colSpan={8} className="p-4 text-center text-gray-500">Nenhum projeto encontrado.</td></tr>
            ) : (
              filteredProjects.map(p => (
                <tr key={p.projectId} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.project?.title || p.projectId}</td>
                  <td className="p-3 text-gray-600">{p.county}</td>
                  <td className="p-3 text-gray-600">{p.majorityOperatorName}</td>
                  <td className="p-3 text-center font-bold text-gray-700">{p.daysInProject}</td>
                  <td className="p-3 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm ${
                      p.projectColor === 'Verde' ? 'bg-green-500' : 
                      p.projectColor === 'Vermelho' ? 'bg-red-500' : 
                      p.projectColor === 'Laranja' ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}>
                      {p.projectColor}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{p.StatusProject}</td>
                  <td className="p-3 text-sm text-gray-500 max-w-xs truncate">
                    {p.justifications && p.justifications.length > 0 
                      ? p.justifications.map(j => j.reason).join(' | ') 
                      : "Nenhuma"}
                  </td>
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => openModal(p)} 
                      className="bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 text-sm transition-colors"
                    >
                      Justificar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL DE JUSTIFICATIVA */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-full max-w-lg shadow-xl">
            <h3 className="text-xl font-bold mb-4 text-gray-800">
              Justificativas do Projeto
            </h3>
            <p className="text-sm text-gray-500 mb-4">Projeto: <span className="font-semibold">{selectedProject?.project?.title}</span></p>
            
            <div className="mb-4 max-h-48 overflow-y-auto bg-gray-50 p-3 rounded border">
              <h4 className="font-semibold text-sm text-gray-700 mb-2">Histórico de Justificativas:</h4>
              {selectedProject?.justifications && selectedProject.justifications.length > 0 ? (
                selectedProject.justifications.map((j, idx) => (
                  <div key={idx} className="border-b last:border-0 py-2 text-sm text-gray-700">
                    • {j.reason}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic">Nenhum registro encontrado.</p>
              )}
            </div>

            <textarea 
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Descreva o motivo do atraso ou adicione uma nova observação..."
              className="w-full border p-3 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              rows={4}
            />

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button onClick={saveJustification} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium">
                Salvar Justificativa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}