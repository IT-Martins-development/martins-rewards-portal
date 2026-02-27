import React, { useState, useEffect } from 'react';
import { get } from 'aws-amplify/api';

export default function DivergenceReport() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    projectId: '',
    status: '',
    pendingPhase: '',
    inProgressPhase: '',
    lastDonePhase: '',
    startDate: '',
    endDate: ''
  });

  // --- Estados de Paginação ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Pode alterar a quantidade de itens por página aqui

  // Função para formatar a data para o padrão Brasileiro (DD/MM/AAAA)
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      // Caso a data já venha no formato DD/MM/AAAA, retorna como está
      if (dateString.includes('/')) return dateString; 
      
      const date = new Date(dateString);
      // Verifica se a data é válida
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    } catch (error) {
      return dateString;
    }
  };

  const fetchReport = async (currentFilters) => {
    setLoading(true);
    try {
      // TODO: Substituir pelo ID do operador vindo do contexto
      const operatorId = "915b85f0-8061-70b8-2e92-29914e90abcf"; 

      const queryParams = Object.fromEntries(
        Object.entries({ ...currentFilters, operatorId })
          .filter(([_, v]) => v !== '')
      );

      const restOperation = get({
        apiName: 'operatorApi', 
        path: '/divergence-report',
        options: { queryParams }
      });
      
      const { body } = await restOperation.response;
      const resultData = await body.json();
      
      setData(resultData);
      setCurrentPage(1); // Volta para a primeira página sempre que fizer uma nova busca
    } catch (error) {
      console.error('Erro ao buscar relatório:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSearch = () => {
    fetchReport(filters);
  };

  const handleClearFilters = () => {
    const emptyFilters = {
      projectId: '',
      status: '',
      pendingPhase: '',
      inProgressPhase: '',
      lastDonePhase: '',
      startDate: '',
      endDate: ''
    };
    setFilters(emptyFilters);
    fetchReport(emptyFilters);
  };

  // --- Lógica Matemática da Paginação ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = data.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const nextPage = () => setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  const prevPage = () => setCurrentPage((prev) => Math.max(prev - 1, 1));

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          Relatório de Divergências para Operadores
        </h2>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-white rounded-lg shadow">
          <input 
            type="text" 
            name="projectId" 
            placeholder="ID do Projeto" 
            value={filters.projectId} 
            onChange={handleFilterChange} 
            className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <select 
            name="status" 
            value={filters.status} 
            onChange={handleFilterChange}
            className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Status (Todos)</option>
            <option value="Todo">To Do</option>
            <option value="InProgress">In Progress</option>
          </select>
          
          <input 
            type="date" 
            name="startDate" 
            value={filters.startDate} 
            onChange={handleFilterChange} 
            className="p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="flex gap-2 ml-auto">
            <button 
              onClick={handleSearch} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition-colors"
            >
              Buscar
            </button>
            <button 
              onClick={handleClearFilters} 
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* Tabela e Paginação */}
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <p className="text-gray-500 text-lg">A carregar relatório...</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left border-collapse">
                <thead>
                  <tr className="bg-blue-600 text-white">
                    <th className="p-4 font-semibold">Projeto</th>
                    <th className="p-4 font-semibold">Tarefa</th>
                    <th className="p-4 font-semibold">Fase Atual</th>
                    <th className="p-4 font-semibold">Última Concluída</th>
                    <th className="p-4 font-semibold">Início</th>
                    <th className="p-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentItems.length > 0 ? (
                    currentItems.map((item) => (
                      <tr key={item._id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-gray-800">{item.project?.title || item.projectId}</td>
                        <td className="p-4 text-gray-600">{item.title}</td>
                        <td className="p-4 text-gray-600">{item.currentTaskPhase}</td>
                        <td className="p-4 text-gray-600">{item.lastTaskDonePhase}</td>
                        {/* Utilizando a nova função de formatação de data */}
                        <td className="p-4 text-gray-600">{formatDate(item.startDate)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-xs font-semibold ${item.status === 'Todo' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-6 text-center text-gray-500">
                        Nenhuma divergência encontrada com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Controles de Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center p-4 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <span className="text-gray-600 font-medium">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}