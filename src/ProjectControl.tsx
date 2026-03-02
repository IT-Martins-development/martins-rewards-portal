// src/ProjectControl.tsx
import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "aws-amplify/api";

type AnyObj = Record<string, any>;

type DynamicField =
  | ""
  | "projectTitle"
  | "operator"
  | "county"
  | "farol"
  | "faseAtual"
  | "statusGlobal"
  | "pStatus";

const ENUM_OPTIONS: Record<Exclude<DynamicField, "" | "projectTitle" | "operator" | "county">, string[]> = {
  farol: ["Verde", "Amarelo", "Laranja", "Vermelho"],
  faseAtual: ["Phase 1", "Phase 2", "Phase 3"],
  statusGlobal: ["In Progress", "Concluded", "Delayed", "On Hold"],
  pStatus: ["In Progress", "Concluded", "Delayed", "On Hold"],
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
  const h = toStr(hay).toLowerCase();
  const n = needle.toLowerCase();
  return h.includes(n);
}

export default function ProjectControl() {
  const [projects, setProjects] = useState<AnyObj[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal (Justificativa)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<AnyObj | null>(null);
  const [newReason, setNewReason] = useState("");
  const [savingReason, setSavingReason] = useState(false);
  const [saveError, setSaveError] = useState<string>("");

  // Paginação
  const [pageSize, setPageSize] = useState<10 | 50 | 100>(10);
  const [page, setPage] = useState(1);

  // Filtro operador (fixo, pedido por você)
  const [operatorFilter, setOperatorFilter] = useState("");

  // Filtro dinâmico (campo + valor)
  const [dynField, setDynField] = useState<DynamicField>("");
  const [dynValue, setDynValue] = useState("");

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

  // ✅ Reset automático de página quando muda filtro/pageSize
  useEffect(() => {
    setPage(1);
  }, [operatorFilter, dynField, dynValue, pageSize]);

  // Se trocar o campo dinâmico, limpa o valor (para evitar “valor inválido”)
  useEffect(() => {
    setDynValue("");
  }, [dynField]);

  const filteredProjects = useMemo(() => {
    let res = projects;

    // Operador (campo fixo)
    if (operatorFilter.trim()) {
      res = res.filter((p) => includesI(p.majorityOperatorName, operatorFilter.trim()));
    }

    // Dinâmico
    const v = dynValue.trim();
    if (dynField && v) {
      switch (dynField) {
        case "projectTitle":
          res = res.filter((p) => includesI(p.project?.title, v));
          break;
        case "operator":
          res = res.filter((p) => includesI(p.majorityOperatorName, v));
          break;
        case "county":
          res = res.filter((p) => includesI(p.county, v));
          break;
        case "farol":
          res = res.filter((p) => toStr(p.projectColor) === v);
          break;
        case "faseAtual":
          res = res.filter((p) => toStr(p.currentPhase) === v);
          break;
        case "statusGlobal":
          res = res.filter((p) => toStr(p.StatusProject) === v);
          break;
        case "pStatus":
          // ✅ P.Status agora pega phaseStatus
          res = res.filter((p) => toStr(p.phaseStatus) === v);
          break;
        default:
          break;
      }
    }

    return res;
  }, [projects, operatorFilter, dynField, dynValue]);

  // Paginação aplicada ao resultado filtrado
  const total = filteredProjects.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);
  const pagedProjects = filteredProjects.slice(startIdx, endIdx);

  // --- EXPORTAÇÃO MASTER ---
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
      "Cor",
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
      p.currentPhase || "",
      // ✅ P.Status = phaseStatus
      p.phaseStatus || "",
      p.StatusProject || "",
      p.county || "",
      p.totalHoldDays || 0,
      p.daysInPhase,
      p.daysInProject,
      p.daysRemaining,
      p.projectColor || "",
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

  const getDotStyle = (color: string): React.CSSProperties => ({
    height: 12,
    width: 12,
    borderRadius: "50%",
    display: "inline-block",
    backgroundColor:
      color === "Verde"
        ? "#22c55e"
        : color === "Amarelo"
          ? "#eab308"
          : color === "Laranja"
            ? "#f97316"
            : "#ef4444",
  });

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#fff",
      borderRadius: 12,
      padding: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: 1600,
      margin: "0 auto",
      color: "#111827",
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

  const dynIsEnum = dynField in ENUM_OPTIONS;
  const dynEnumOptions = dynIsEnum ? (ENUM_OPTIONS as any)[dynField] : [];

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
        options: {
          body: { projectId: selectedProject.projectId, reason: newReason },
        },
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

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>Controle de Projetos (Master)</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={S.btnGhost} onClick={exportCsv}>
            Exportar CSV Completo
          </button>
          <button style={S.btnPrimary} onClick={fetchProjects}>
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* ✅ Barra de filtros + paginação */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr 1fr 0.8fr 0.8fr",
          gap: 12,
          marginBottom: 14,
          alignItems: "end",
        }}
      >
        {/* Operador fixo */}
        <div>
          <span style={S.label}>Operador</span>
          <input
            style={S.input}
            placeholder="Digite o nome do operador"
            value={operatorFilter}
            onChange={(e) => setOperatorFilter(e.target.value)}
          />
        </div>

        {/* Filtro dinâmico */}
        <div>
          <span style={S.label}>Filtro (Campo)</span>
          <select style={S.input} value={dynField} onChange={(e) => setDynField(e.target.value as DynamicField)}>
            <option value="">Selecione</option>
            <option value="projectTitle">Projeto</option>
            <option value="operator">Operador (dinâmico)</option>
            <option value="county">County</option>
            <option value="farol">Farol</option>
            <option value="faseAtual">Fase Atual</option>
            <option value="statusGlobal">Status Global</option>
            <option value="pStatus">P. Status</option>
          </select>
        </div>

        <div>
          <span style={S.label}>Valor</span>

          {/* ✅ Dropdown quando enumerado; senão input livre */}
          {dynField && dynIsEnum ? (
            <select style={S.input} value={dynValue} onChange={(e) => setDynValue(e.target.value)}>
              <option value="">Selecione um valor</option>
              {dynEnumOptions.map((opt: string) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={S.input}
              placeholder={dynField ? "Digite o valor..." : "Selecione um campo acima"}
              disabled={!dynField}
              value={dynValue}
              onChange={(e) => setDynValue(e.target.value)}
            />
          )}
        </div>

        {/* Page size */}
        <div>
          <span style={S.label}>Itens por página</span>
          <select style={S.input} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as any)}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Clear */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            style={S.btnGhost}
            onClick={() => {
              setOperatorFilter("");
              setDynField("");
              setDynValue("");
            }}
          >
            Limpar Filtro
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: "white", borderRadius: 12, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1500 }}>
            <thead>
              <tr>
                <th style={S.th}>Farol</th>
                <th style={S.th}>Projeto</th>
                <th style={S.th}>Operador</th>
                <th style={S.th}>Fase Atual</th>
                <th style={S.th}>P. Status</th>
                <th style={S.th}>Global Status</th>
                <th style={S.th}>Hold</th>
                <th style={S.th}>D. Fase</th>
                <th style={S.th}>D. Totais</th>
                <th style={S.th}>Restante</th>

                {/* ✅ Campos novos ao final */}
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
                  <td style={S.td}>
                    <span style={getDotStyle(p.projectColor)} />
                  </td>

                  <td style={{ ...S.td, fontWeight: 700 }}>{p.project?.title || p.projectId}</td>

                  <td style={S.td}>{p.majorityOperatorName || "-"}</td>

                  <td style={S.td}>{p.currentPhase || "-"}</td>

                  {/* ✅ P.Status = phaseStatus */}
                  <td style={S.td}>{p.phaseStatus || "-"}</td>

                  <td style={S.td}>{p.StatusProject || "-"}</td>

                  <td style={S.td}>{p.totalHoldDays || 0}</td>
                  <td style={S.td}>{p.daysInPhase}</td>
                  <td style={S.td}>{p.daysInProject}</td>

                  <td style={{ ...S.td, color: p.daysRemaining < 0 ? "red" : "green", fontWeight: 800 }}>
                    {p.daysRemaining}
                  </td>

                  {/* ✅ Campos novos ao final */}
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
                    <button
                      style={{ ...S.btnGhost, padding: "6px 10px", height: "auto" }}
                      onClick={() => openJustify(p)}
                    >
                      Justificar
                    </button>
                  </td>
                </tr>
              ))}

              {pagedProjects.length === 0 && (
                <tr>
                  <td style={S.td} colSpan={20}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé de paginação */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: 12,
            borderTop: "1px solid rgba(0,0,0,0.06)",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 12, color: "rgba(17,24,39,0.8)", fontWeight: 700 }}>
            Mostrando {total === 0 ? 0 : startIdx + 1}–{endIdx} de {total}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              style={safePage <= 1 ? S.btnPrimaryDisabled : S.btnGhost}
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ◀ Anterior
            </button>

            <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>
              Página {safePage} de {totalPages}
            </div>

            <button
              style={safePage >= totalPages ? S.btnPrimaryDisabled : S.btnGhost}
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Próxima ▶
            </button>
          </div>
        </div>
      </div>

      {/* ✅ Modal com zIndex alto + pointerEvents (corrige “botão não clica”) */}
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
            pointerEvents: "auto",
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

            <div style={{ marginBottom: 10, fontSize: 13, fontWeight: "bold" }}>
              Projeto: {selectedProject?.project?.title || selectedProject?.projectId}
            </div>

            <textarea
              style={{ ...S.input, height: 140, padding: 12, marginBottom: 12 }}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Descreva o motivo técnico do atraso ou hold..."
            />

            {saveError && (
              <div style={{ marginBottom: 12, fontSize: 12, color: "#b91c1c", fontWeight: 800 }}>{saveError}</div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={closeJustify}>
                Cancelar
              </button>

              <button
                style={savingReason ? S.btnPrimaryDisabled : S.btnPrimary}
                disabled={savingReason}
                onClick={saveJustification}
              >
                {savingReason ? "Salvando..." : "Salvar Justificativa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}