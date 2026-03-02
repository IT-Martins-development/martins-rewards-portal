import React, { useEffect, useMemo, useState } from "react";
import { get, post } from "aws-amplify/api";

type PageSize = 10 | 50 | 100;

type DynamicField =
  | ""
  | "project.title"
  | "majorityOperatorName"
  | "county"
  | "projectColor"
  | "currentPhase"
  | "StatusProject"
  | "projectStatus"
  | "projectId";

const ENUM_FIELDS: DynamicField[] = ["projectColor", "currentPhase", "StatusProject", "projectStatus"];

export default function ProjectControl() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // modal justificativa
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [newReason, setNewReason] = useState("");

  // filtro dinâmico
  const [dynField, setDynField] = useState<DynamicField>("");
  const [dynValue, setDynValue] = useState("");

  // paginação
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const toNum = (v: any) => {
    if (v?.$numberLong) return parseInt(v.$numberLong, 10);
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getNestedValue = (obj: any, path: string) => {
    if (!obj) return "";
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      cur = cur?.[p];
      if (cur === undefined || cur === null) return "";
    }
    return cur;
  };

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const restOperation = get({ apiName: "operatorApi", path: "/projects-control" });
      const response = await restOperation.response;
      const data: any = await response.body.json();

      const rawList = Array.isArray(data) ? data : data?.body ? JSON.parse(data.body) : [];

      const normalized = rawList.map((p: any) => ({
        ...p,
        daysInPhase: toNum(p.daysInPhase),
        daysInProject: toNum(p.daysInProject),
        daysRemaining: toNum(p.daysRemaining),
        totalHoldDays: toNum(p.totalHoldDays),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset automático ao mudar filtros / page size
  useEffect(() => {
    setPage(1);
  }, [dynField, dynValue, pageSize]);

  const enumOptions = useMemo(() => {
    if (!dynField || !ENUM_FIELDS.includes(dynField)) return [];
    const set = new Set<string>();
    for (const p of projects) {
      const v = String(getNestedValue(p, dynField) ?? "").trim();
      if (v) set.add(v);
    }

    // fallback se vier vazio (ou quiser lista padrão)
    if (dynField === "projectColor") {
      ["Verde", "Amarelo", "Laranja", "Vermelho"].forEach((v) => set.add(v));
    }
    if (dynField === "currentPhase") {
      ["Phase 1", "Phase 2", "Phase 3"].forEach((v) => set.add(v));
    }
    if (dynField === "StatusProject") {
      ["In Progress", "Concluded", "Delayed", "On Hold"].forEach((v) => set.add(v));
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dynField, projects]);

  const filteredProjects = useMemo(() => {
    let res = projects;

    // filtro dinâmico
    if (dynField && dynValue) {
      const needle = dynValue.toLowerCase().trim();

      if (ENUM_FIELDS.includes(dynField)) {
        // enumerados = match exato (mais previsível)
        res = res.filter((p) => String(getNestedValue(p, dynField) ?? "") === dynValue);
      } else if (dynField === "projectId") {
        res = res.filter((p) => String(p.projectId ?? "").toLowerCase().includes(needle));
      } else {
        res = res.filter((p) => String(getNestedValue(p, dynField) ?? "").toLowerCase().includes(needle));
      }
    }

    return res;
  }, [projects, dynField, dynValue]);

  const totalPages = useMemo(() => {
    const n = Math.ceil(filteredProjects.length / pageSize);
    return Math.max(1, n);
  }, [filteredProjects.length, pageSize]);

  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedProjects = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, safePage, pageSize]);

  const exportCsv = () => {
    const headers = [
      "ID",
      "Projeto",
      "County",
      "Operador",
      "Fase Atual",
      "P. Status",
      "Global Status",
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

    const rows = projects.map((p) => [
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
      maxWidth: 1400,
      margin: "0 auto",
      color: "#111827",
    },
    header: { display: "flex", justifyContent: "space-between", marginBottom: 20 },
    btnPrimary: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "pointer",
      height: 42,
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
    label: {
      fontSize: 11,
      color: "rgba(17,24,39,0.75)",
      fontWeight: 800,
      marginBottom: 4,
      display: "block",
    },
    th: {
      textAlign: "left",
      fontSize: 10,
      color: "rgba(17,24,39,0.7)",
      padding: "12px",
      background: "#FBFBFC",
      fontWeight: 900,
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      whiteSpace: "nowrap",
    },
    td: {
      padding: "12px",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
      fontSize: 12,
      color: "#111827",
      verticalAlign: "top",
      whiteSpace: "nowrap",
    },
    pagerWrap: {
      marginTop: 14,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
    },
    small: { fontSize: 12, color: "rgba(17,24,39,0.75)", fontWeight: 700 },
  };

  const fieldLabel = (f: DynamicField) => {
    switch (f) {
      case "project.title":
        return "Projeto";
      case "majorityOperatorName":
        return "Operador";
      case "county":
        return "County";
      case "projectColor":
        return "Farol";
      case "currentPhase":
        return "Fase Atual";
      case "StatusProject":
        return "Status Global";
      case "projectStatus":
        return "P. Status";
      case "projectId":
        return "Project ID";
      default:
        return "Selecione";
    }
  };

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>
          Controle de Projetos (Master)
        </h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button style={S.btnGhost} onClick={exportCsv}>
            Exportar CSV Completo
          </button>
          <button style={S.btnPrimary} onClick={fetchProjects}>
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Filtro dinâmico */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.1fr 1.4fr 0.7fr 0.8fr",
          gap: 12,
          marginBottom: 14,
          alignItems: "end",
        }}
      >
        <div>
          <span style={S.label}>Filtro (Campo)</span>
          <select
            style={S.input}
            value={dynField}
            onChange={(e) => {
              const next = e.target.value as DynamicField;
              setDynField(next);
              setDynValue("");
            }}
          >
            <option value="">{fieldLabel("")}</option>
            <option value="project.title">{fieldLabel("project.title")}</option>
            <option value="majorityOperatorName">{fieldLabel("majorityOperatorName")}</option>
            <option value="county">{fieldLabel("county")}</option>
            <option value="projectColor">{fieldLabel("projectColor")}</option>
            <option value="currentPhase">{fieldLabel("currentPhase")}</option>
            <option value="StatusProject">{fieldLabel("StatusProject")}</option>
            <option value="projectStatus">{fieldLabel("projectStatus")}</option>
            <option value="projectId">{fieldLabel("projectId")}</option>
          </select>
        </div>

        <div>
          <span style={S.label}>Valor</span>
          {dynField && ENUM_FIELDS.includes(dynField) ? (
            <select style={S.input} value={dynValue} onChange={(e) => setDynValue(e.target.value)}>
              <option value="">Selecione...</option>
              {enumOptions.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input
              style={S.input}
              placeholder={dynField ? `Digite o valor para ${fieldLabel(dynField)}` : "Selecione um campo acima"}
              value={dynValue}
              onChange={(e) => setDynValue(e.target.value)}
              disabled={!dynField}
            />
          )}
        </div>

        <div>
          <span style={S.label}>Itens por página</span>
          <select style={S.input} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}>
            <option value={10}>10</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div>
          <button
            style={S.btnGhost}
            onClick={() => {
              setDynField("");
              setDynValue("");
            }}
          >
            Limpar Filtro
          </button>
        </div>
      </div>

      <div
        style={{
          background: "white",
          borderRadius: 12,
          border: "1px solid rgba(0,0,0,0.08)",
          overflowX: "auto",
          overflowY: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 2100 }}>
          <thead>
            <tr>
              <th style={S.th}>Farol</th>
              <th style={S.th}>Projeto</th>
              <th style={S.th}>Operador</th>
              <th style={S.th}>Fase Atual</th>
              <th style={S.th}>P. Status</th>
              <th style={S.th}>Status Global</th>
              <th style={S.th}>Hold</th>
              <th style={S.th}>D. Fase</th>
              <th style={S.th}>D. Totais</th>
              <th style={S.th}>Restante</th>

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
            {paginatedProjects.map((p) => (
              <tr key={p.projectId}>
                <td style={S.td}>
                  <span style={getDotStyle(p.projectColor)} />
                </td>

                <td style={{ ...S.td, fontWeight: 700 }}>{p.project?.title || p.projectId}</td>

                <td style={S.td}>{p.majorityOperatorName || "-"}</td>

                <td style={S.td}>{p.currentPhase || "-"}</td>

                <td style={S.td}>{p.projectStatus || "-"}</td>

                <td style={S.td}>{p.StatusProject || "-"}</td>

                <td style={S.td}>{p.totalHoldDays || 0}</td>

                <td style={S.td}>{p.daysInPhase}</td>

                <td style={S.td}>{p.daysInProject}</td>

                <td style={{ ...S.td, color: p.daysRemaining < 0 ? "red" : "green", fontWeight: 800 }}>
                  {p.daysRemaining}
                </td>

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
                    style={{ ...S.btnGhost, padding: "5px 10px", height: "auto" }}
                    onClick={() => {
                      setSelectedProject(p);
                      setNewReason(p.reason || "");
                      setIsModalOpen(true);
                    }}
                  >
                    Justificar
                  </button>
                </td>
              </tr>
            ))}

            {!loading && paginatedProjects.length === 0 && (
              <tr>
                <td style={{ ...S.td, padding: 16 }} colSpan={20}>
                  Nenhum registro encontrado com o filtro atual.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginação */}
      <div style={S.pagerWrap}>
        <div style={S.small}>
          Mostrando{" "}
          <strong>
            {filteredProjects.length === 0 ? 0 : (safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, filteredProjects.length)}
          </strong>{" "}
          de <strong>{filteredProjects.length}</strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            style={{ ...S.btnGhost, padding: "8px 12px", height: "auto" }}
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ◀ Anterior
          </button>

          <span style={S.small}>
            Página <strong>{safePage}</strong> de <strong>{totalPages}</strong>
          </span>

          <button
            style={{ ...S.btnGhost, padding: "8px 12px", height: "auto" }}
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima ▶
          </button>
        </div>
      </div>

      {/* Modal justificativa */}
      {isModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ background: "white", padding: 24, borderRadius: 16, width: "100%", maxWidth: 500, color: "#111827" }}>
            <h3 style={{ marginTop: 0 }}>Justificativa Técnico</h3>

            <div style={{ marginBottom: 10, fontSize: 13, fontWeight: "bold" }}>
              Projeto: {selectedProject?.project?.title || selectedProject?.projectId}
            </div>

            <textarea
              style={{ ...S.input, height: 120, padding: 12, marginBottom: 16 }}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Descreva o motivo técnico do atraso ou hold..."
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={S.btnGhost} onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>

              <button
                style={S.btnPrimary}
                onClick={async () => {
                  try {
                    const restOperation = post({
                      apiName: "operatorApi",
                      path: "/projects-control",
                      options: { body: { projectId: selectedProject?.projectId, reason: newReason } },
                    });
                    await restOperation.response;
                    setIsModalOpen(false);
                    void fetchProjects();
                  } catch (err) {
                    console.error("Erro ao salvar justificativa:", err);
                  }
                }}
              >
                Salvar Justificativa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}