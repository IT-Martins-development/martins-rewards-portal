export type Lang = "pt" | "en" | "es";

const STORAGE_KEY = "mr_lang";

export const LANG_LABEL: Record<Lang, string> = {
  pt: "PT",
  en: "EN",
  es: "ES",
};

type Dict = Record<string, Record<Lang, string>>;

export const dict: Dict = {
  // Topo / Geral
  "app.title": { pt: "Martins Rewards", en: "Martins Rewards", es: "Martins Rewards" },
  "app.loggedAs": { pt: "Logado como", en: "Logged in as", es: "Conectado como" },
  "app.profile": { pt: "Perfil", en: "Profile", es: "Perfil" },
  "app.logout": { pt: "Sair", en: "Sign out", es: "Salir" },

  // Tabs
  "tab.rewards": { pt: "Rewards", en: "Rewards", es: "Recompensas" },
  "tab.approvals": { pt: "Aprovações", en: "Approvals", es: "Aprobaciones" },
  "tab.report": { pt: "Relatório", en: "Report", es: "Informe" },

  // Botões comuns
  "btn.reload": { pt: "Recarregar", en: "Reload", es: "Recargar" },
  "btn.apply": { pt: "Aplicar", en: "Apply", es: "Aplicar" },

  // Status
  "status.REQUESTED": { pt: "SOLICITADO", en: "REQUESTED", es: "SOLICITADO" },
  "status.APPROVED": { pt: "APROVADO", en: "APPROVED", es: "APROBADO" },
  "status.REJECTED": { pt: "REJEITADO", en: "REJECTED", es: "RECHAZADO" },
  "status.FULFILLED": { pt: "ENTREGUE", en: "FULFILLED", es: "ENTREGADO" },
  "status.CANCELED": { pt: "CANCELADO", en: "CANCELED", es: "CANCELADO" },

  // Relatório (filtros)
  "report.title": { pt: "Relatório", en: "Report", es: "Informe" },
  "report.from": { pt: "De", en: "From", es: "Desde" },
  "report.to": { pt: "Até", en: "To", es: "Hasta" },
  "report.status": { pt: "Status", en: "Status", es: "Estado" },
  "report.none": { pt: "Nenhum registro no período/filtro.", en: "No records for the selected filters.", es: "No hay registros para los filtros seleccionados." },
};

export function getInitialLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
  if (saved === "pt" || saved === "en" || saved === "es") return saved;

  const nav = (navigator.language || "").toLowerCase();
  if (nav.startsWith("pt")) return "pt";
  if (nav.startsWith("es")) return "es";
  return "en";
}

export function saveLang(lang: Lang) {
  localStorage.setItem(STORAGE_KEY, lang);
}

export function t(key: string, lang: Lang): string {
  return dict[key]?.[lang] ?? key;
}