import React, { useMemo } from "react";
import type { Lang } from "./App";

// Adicionei um onClick opcional na prop para você ligar com a sua navegação
type Props = { lang: Lang; onNavigateToProjects?: () => void };

export default function RewardsAdmin({ lang, onNavigateToProjects }: Props) {
  const t = useMemo(() => {
    const dict = {
      pt: {
        title: "Bem-vindo ao Programa de Rewards da Martins",
        subtitle:
          "Aqui você pode cadastrar e gerenciar recompensas, aprovar resgates e acompanhar relatórios.",
        hint: "Use o menu à esquerda para navegar.",
        btnProject: "Acessar Controle de Projetos",
      },
      en: {
        title: "Welcome to Martins Rewards Program",
        subtitle:
          "Here you can manage rewards, approvals, and reports.",
        hint: "Use the left menu to navigate.",
        btnProject: "Access Project Control",
      },
      es: {
        title: "Bienvenido al Programa de Rewards de Martins",
        subtitle:
          "Aquí puedes administrar recompensas, aprobaciones y reportes.",
        hint: "Usa el menú de la izquierda para navegar.",
        btnProject: "Acceder al Control de Proyectos",
      },
    } as const;
    return dict[lang] ?? dict.pt;
  }, [lang]);

  const Wrap: React.CSSProperties = {
    borderRadius: 18,
    overflow: "hidden",
    background:
      "linear-gradient(135deg, rgba(201,176,137,0.28) 0%, rgba(0,0,0,0) 55%), linear-gradient(180deg, #ffffff 0%, #f4f4f4 100%)",
    border: "1px solid rgba(0,0,0,0.06)",
  };

  const Hero: React.CSSProperties = {
    padding: 22,
    display: "flex",
    alignItems: "stretch",
    gap: 18,
  };

  const Left: React.CSSProperties = { flex: 1, minWidth: 240 };

  const Title: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 900,
    margin: 0,
    color: "#1f1f1f",
  };

  const Sub: React.CSSProperties = { marginTop: 10, color: "#3a3a3a", lineHeight: 1.4 };

  const Hint: React.CSSProperties = {
    marginTop: 12,
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(107,86,50,0.10)",
    border: "1px solid rgba(107,86,50,0.18)",
    color: "#4b3c23",
    fontWeight: 700,
    fontSize: 13,
  };

  // --- NOVO ESTILO PARA O BOTÃO ---
  const BtnAction: React.CSSProperties = {
    marginTop: 20,
    display: "block",
    padding: "10px 16px",
    borderRadius: 8,
    background: "#4b3c23",
    color: "#fff",
    border: "none",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    width: "fit-content",
  };

  const Right: React.CSSProperties = {
    width: 340,
    borderRadius: 16,
    background:
      "radial-gradient(1200px 500px at 20% 0%, rgba(201,176,137,0.45) 0%, rgba(201,176,137,0.0) 60%), linear-gradient(135deg, rgba(43,43,43,0.98) 0%, rgba(43,43,43,0.70) 55%, rgba(43,43,43,0.98) 100%)",
    color: "#fff",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  };

  const Badge: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontWeight: 800,
    width: "fit-content",
  };

  const Dot: React.CSSProperties = {
    width: 10,
    height: 10,
    borderRadius: 999,
    background: "#c9b089",
    display: "inline-block",
  };

  const Steps: React.CSSProperties = { marginTop: 14, fontSize: 13, opacity: 0.95, lineHeight: 1.5 };

  return (
    <div style={Wrap}>
      <div style={Hero}>
        <div style={Left}>
          <h2 style={Title}>{t.title}</h2>
          <div style={Sub}>{t.subtitle}</div>
          <div style={Hint}>{t.hint}</div>
          
          {/* --- NOVO BOTÃO DE ACESSO RÁPIDO --- */}
          <button style={BtnAction} onClick={onNavigateToProjects}>
            {t.btnProject} →
          </button>
        </div>

        <div style={Right}>
          <div>
            <div style={Badge}>
              <span style={Dot} />
              Martins Rewards Portal
            </div>
            <div style={Steps}>
              <div>• Rewards (CRUD): criar/editar recompensas</div>
              <div>• Aprovações: aprovar/rejeitar resgates</div>
              <div>• Relatório: visualizar e exportar resultados</div>
              {/* --- NOVA LINHA NA LISTA DA DIREITA --- */}
              <div>• Controle de Projetos: gestão de prazos e fases</div>
            </div>
          </div>

          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Dica: se você estiver sem sessão, clique em <b>Sair</b> e faça login novamente.
          </div>
        </div>
      </div>
    </div>
  );
}