import { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./lib/amplifyClient";
import { MONGO_REWARDS_LIST } from "./lib/rewards.gql";

type Lang = "pt" | "en" | "es";

type Props = {
  lang: Lang;
};

type MongoI18n = {
  pt?: string | null;
  en?: string | null;
  es?: string | null;
};

type DeliveryType = "EMAIL" | "PICKUP" | "SHIPPING";

type MongoReward = {
  id: string;
  code: string;
  title: MongoI18n;
  description?: MongoI18n | null;
  category?: string | null;
  tags?: string[] | null;
  pointsCost: number;
  imageUrl?: string | null;
  deliveryType: DeliveryType;
  active: boolean;
  offerStartAt?: string | null;
  offerEndAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
};

type MongoRewardsListResponse = {
  mongoRewardsList?: {
    items: MongoReward[];
    nextToken?: string | null;
  } | null;
};

function pickErr(e: any) {
  return (
    e?.errors?.[0]?.message ||
    e?.message ||
    (typeof e === "string" ? e : JSON.stringify(e, null, 2))
  );
}

function t(lang: Lang) {
  const dict = {
    pt: {
      title: "Rewards",
      subtitle: "Escolha um reward para resgatar",
      onlyActive: "Somente ativos",
      perPage: "Itens por página",
      loadMore: "Carregar mais",
      loading: "Carregando...",
      empty: "Nenhum reward encontrado.",
      points: "Pontos",
      delivery: "Entrega",
      category: "Categoria",
      tags: "Tags",
      statusActive: "Ativo",
      statusInactive: "Inativo",
      period: "Período",
      from: "De",
      to: "Até",
      all: "Todos",
      email: "Email",
      pickup: "Retirada",
      shipping: "Entrega",
    },
    en: {
      title: "Rewards",
      subtitle: "Choose a reward to redeem",
      onlyActive: "Active only",
      perPage: "Items per page",
      loadMore: "Load more",
      loading: "Loading...",
      empty: "No rewards found.",
      points: "Points",
      delivery: "Delivery",
      category: "Category",
      tags: "Tags",
      statusActive: "Active",
      statusInactive: "Inactive",
      period: "Period",
      from: "From",
      to: "To",
      all: "All",
      email: "Email",
      pickup: "Pickup",
      shipping: "Shipping",
    },
    es: {
      title: "Recompensas",
      subtitle: "Elige una recompensa para canjear",
      onlyActive: "Solo activas",
      perPage: "Ítems por página",
      loadMore: "Cargar más",
      loading: "Cargando...",
      empty: "No se encontraron recompensas.",
      points: "Puntos",
      delivery: "Entrega",
      category: "Categoría",
      tags: "Etiquetas",
      statusActive: "Activa",
      statusInactive: "Inactiva",
      period: "Período",
      from: "Desde",
      to: "Hasta",
      all: "Todas",
      email: "Email",
      pickup: "Retiro",
      shipping: "Envío",
    },
  } as const;

  return dict[lang];
}

function getI18nText(v: MongoI18n | null | undefined, lang: Lang) {
  if (!v) return "";
  const fallback = v.en || v.pt || v.es || "";
  const byLang = v[lang] || "";
  return byLang || fallback;
}

function fmtDelivery(dt: DeliveryType, lang: Lang) {
  const L = t(lang);
  if (dt === "EMAIL") return L.email;
  if (dt === "PICKUP") return L.pickup;
  return L.shipping;
}

function fmtDate(s?: string | null) {
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s);
  return d.toLocaleDateString();
}

function isoDateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function RewardsUser({ lang }: Props) {
  const L = useMemo(() => t(lang), [lang]);

  const [items, setItems] = useState<MongoReward[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filtros
  const [activeOnly, setActiveOnly] = useState(true);
  const [limit, setLimit] = useState<number>(10);

  // filtro de período (cliente-side; não filtra no Mongo agora)
  const defaultFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return isoDateOnly(d);
  }, []);
  const defaultTo = useMemo(() => isoDateOnly(new Date()), []);
  const [fromDate, setFromDate] = useState(defaultFrom);
  const [toDate, setToDate] = useState(defaultTo);

  // paginação cursor (Mongo)
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  async function load(reset = false) {
    setLoading(true);
    setError("");
    try {
      const res: any = await gqlClient.graphql({
        query: MONGO_REWARDS_LIST,
        variables: {
          limit,
          nextToken: reset ? null : nextToken,
          activeOnly,
        },
      });

      const data: MongoRewardsListResponse = res?.data || {};
      const page = data?.mongoRewardsList;
      const newItems = (page?.items || []).filter(Boolean);
      const nt = page?.nextToken ?? null;

      setNextToken(nt);
      setHasMore(!!nt);

      setItems((prev) => (reset ? newItems : [...prev, ...newItems]));
    } catch (e: any) {
      setError(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  function applyFilters() {
    // reset list/cursor
    setItems([]);
    setNextToken(null);
    setHasMore(false);
    load(true);
  }

  // aplica filtros de período localmente (como createdAt vem ISO)
  const filteredByDate = useMemo(() => {
    const fromIso = `${fromDate}T00:00:00.000Z`;
    const toIso = `${toDate}T23:59:59.999Z`;
    return items.filter((r) => {
      const c = r.createdAt || "";
      if (!c) return true;
      return c >= fromIso && c <= toIso;
    });
  }, [items, fromDate, toDate]);

  useEffect(() => {
    // load inicial
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const styles: Record<string, React.CSSProperties> = {
    page: {
      background: "#F6F7F9",
      borderRadius: 14,
      padding: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: "100%",
      boxSizing: "border-box",
    },
    headerRow: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 12,
    },
    titleWrap: { display: "flex", flexDirection: "column", gap: 4 },
    title: { margin: 0, fontSize: 20, fontWeight: 800, color: "#111827" },
    subtle: { color: "rgba(17,24,39,0.65)", fontSize: 13, margin: 0 },

    filterRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 10,
      alignItems: "end",
      width: "100%",
      marginBottom: 12,
    },
    label: { fontSize: 12, color: "rgba(17,24,39,0.7)", marginBottom: 6 },
    input: {
      width: "100%",
      padding: 10,
      borderRadius: 10,
      border: "1px solid rgba(0,0,0,0.14)",
      outline: "none",
      background: "white",
      boxSizing: "border-box",
    },
    checkboxRow: { display: "flex", gap: 10, alignItems: "center", paddingBottom: 2 },

    btn: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 999,
      cursor: "pointer",
      fontWeight: 800,
      width: "100%",
      boxSizing: "border-box",
    },
    btnGhost: {
      background: "white",
      color: "#111827",
      border: "1px solid rgba(0,0,0,0.14)",
      padding: "10px 14px",
      borderRadius: 999,
      cursor: "pointer",
      fontWeight: 800,
      width: "100%",
      boxSizing: "border-box",
    },

    error: {
      background: "#FFECEC",
      color: "#7F1D1D",
      border: "1px solid rgba(127,29,29,0.25)",
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
      whiteSpace: "pre-wrap",
    },

    cards: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
      gap: 12,
      width: "100%",
    },
    card: {
      background: "white",
      borderRadius: 14,
      border: "1px solid rgba(0,0,0,0.08)",
      padding: 12,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minHeight: 180,
    },
    cardTop: { display: "flex", gap: 10, alignItems: "flex-start" },
    img: {
      width: 64,
      height: 64,
      borderRadius: 12,
      objectFit: "cover",
      background: "#F3F4F6",
      border: "1px solid rgba(0,0,0,0.06)",
      flex: "0 0 auto",
    },
    h3: { margin: 0, fontSize: 16, fontWeight: 900, color: "#111827", lineHeight: 1.1 },
    desc: { margin: 0, color: "rgba(17,24,39,0.75)", fontSize: 13, lineHeight: 1.35 },
    meta: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "4px 10px",
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 800,
      background: "#F3F4F6",
      color: "#374151",
    },
    badgeActive: { background: "#DCFCE7", color: "#166534" },
    badgeInactive: { background: "#FEE2E2", color: "#7F1D1D" },

    footerRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      marginTop: 12,
      flexWrap: "wrap",
    },
    small: { fontSize: 12, color: "rgba(17,24,39,0.65)" },
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <div style={styles.titleWrap}>
          <h2 style={styles.title}>{L.title}</h2>
          <p style={styles.subtle}>{L.subtitle}</p>
        </div>
      </div>

      <div style={styles.filterRow}>
        <label>
          <div style={styles.label}>{L.from}</div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={styles.input}
          />
        </label>

        <label>
          <div style={styles.label}>{L.to}</div>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={styles.input}
          />
        </label>

        <label>
          <div style={styles.label}>{L.perPage}</div>
          <select
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={styles.input}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </select>
        </label>

        <label>
          <div style={styles.label}>{L.onlyActive}</div>
          <div style={{ ...styles.input, ...styles.checkboxRow }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            <span style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>
              {activeOnly ? L.statusActive : L.all}
            </span>
          </div>
        </label>

        <button onClick={applyFilters} style={styles.btn} disabled={loading}>
          {loading ? L.loading : "Apply"}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {filteredByDate.length === 0 ? (
        <div style={{ padding: 12 }}>
          {loading ? L.loading : L.empty}
        </div>
      ) : (
        <div style={styles.cards}>
          {filteredByDate.map((r) => {
            const title = getI18nText(r.title, lang) || r.code;
            const desc = getI18nText(r.description || null, lang);

            return (
              <div key={r.id} style={styles.card}>
                <div style={styles.cardTop}>
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt={title} style={styles.img} />
                  ) : (
                    <div style={styles.img} />
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.h3}>{title}</div>
                    {desc ? <p style={styles.desc}>{desc}</p> : null}
                    <div style={{ ...styles.small, marginTop: 6 }}>
                      {r.category ? `${L.category}: ${r.category} • ` : ""}
                      {r.createdAt ? `${fmtDate(r.createdAt)}` : ""}
                    </div>
                  </div>
                </div>

                <div style={styles.meta}>
                  <span style={styles.badge}>
                    {L.points}: {r.pointsCost}
                  </span>
                  <span style={styles.badge}>
                    {L.delivery}: {fmtDelivery(r.deliveryType, lang)}
                  </span>

                  <span
                    style={{
                      ...styles.badge,
                      ...(r.active ? styles.badgeActive : styles.badgeInactive),
                    }}
                  >
                    {r.active ? L.statusActive : L.statusInactive}
                  </span>
                </div>

                {Array.isArray(r.tags) && r.tags.length > 0 ? (
                  <div style={{ ...styles.small }}>
                    {L.tags}: {r.tags.join(", ")}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div style={styles.footerRow}>
        <div style={styles.small}>
          Showing: <b>{filteredByDate.length}</b>
        </div>

        {hasMore ? (
          <button
            onClick={() => load(false)}
            style={{ ...styles.btnGhost, width: 220 }}
            disabled={loading}
          >
            {loading ? L.loading : L.loadMore}
          </button>
        ) : (
          <div style={styles.small} />
        )}
      </div>
    </div>
  );
}