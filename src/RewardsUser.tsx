import React, { useEffect, useMemo, useState } from "react";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import { gqlClient } from "./amplifyClient";

type Tier = "SILVER" | "GOLD" | "BLACK" | "PLATINUM" | "NONE";

type Reward = {
  id: string;
  code?: string | null;
  title?: { pt?: string | null; en?: string | null; es?: string | null } | null;
  description?: { pt?: string | null; en?: string | null; es?: string | null } | null;
  category?: string | null;
  tags?: string[] | null;
  pointsCost: number;
  imageUrl?: string | null;
  deliveryType?: string | null;
  active?: boolean | null;
};

type BalanceRow = {
  userId: string;
  userName?: string | null;
  userType?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  availablePoints: number;
  redeemedPoints: number;
  updatedAt?: string | null;
};

type Props = {
  lang?: "PT" | "EN" | "ES";
};

const LIST_REWARDS = /* GraphQL */ `
  query MongoRewardsList($limit: Int, $nextToken: String, $activeOnly: Boolean) {
    mongoRewardsList(limit: $limit, nextToken: $nextToken, activeOnly: $activeOnly) {
      items {
        id
        code
        title { pt en es }
        description { pt en es }
        category
        tags
        pointsCost
        imageUrl
        deliveryType
        active
      }
      nextToken
    }
  }
`;

const LIST_BALANCES = /* GraphQL */ `
  query MongoRewardsBalancesList($limit: Int, $nextToken: String, $name: String, $userType: String) {
    mongoRewardsBalancesList(limit: $limit, nextToken: $nextToken, name: $name, userType: $userType) {
      items {
        userId
        userName
        userType
        userEmail
        userPhone
        availablePoints
        redeemedPoints
        updatedAt
      }
      nextToken
    }
  }
`;

function pickErr(e: any) {
  return (
    e?.errors?.[0]?.message ||
    e?.message ||
    (typeof e === "string" ? e : JSON.stringify(e, null, 2))
  );
}

function fmtPts(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return String(Math.trunc(v));
}

function computeTier(points: number): Tier {
  const p = Math.max(0, Number(points) || 0);
  if (p >= 5000) return "PLATINUM";
  if (p >= 2000) return "BLACK";
  if (p >= 1000) return "GOLD";
  if (p >= 1) return "SILVER";
  return "NONE";
}

function tierStyle(tier: Tier): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 12px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    color: "#111827",
    whiteSpace: "nowrap",
  };

  switch (tier) {
    case "PLATINUM":
      return {
        ...base,
        background: "#EEF2FF",
        border: "1px solid rgba(79,70,229,0.25)",
        color: "#312E81",
      };
    case "BLACK":
      return { ...base, background: "#111827", border: "1px solid rgba(0,0,0,0.5)", color: "#fff" };
    case "GOLD":
      return {
        ...base,
        background: "#FEF9C3",
        border: "1px solid rgba(161,98,7,0.25)",
        color: "#7C2D12",
      };
    case "SILVER":
      return { ...base, background: "#F3F4F6", border: "1px solid rgba(0,0,0,0.10)", color: "#111827" };
    default:
      return { ...base, background: "#fff", color: "rgba(17,24,39,0.75)" };
  }
}

function t(lang: "PT" | "EN" | "ES") {
  const dict = {
    PT: {
      welcome: "Bem-vindo",
      points: "Pontos",
      tier: "Nível",
      loading: "Carregando...",
      empty: "Nenhum reward disponível no momento.",
      filters: "Filtros",
      minPts: "Pontos (mín)",
      maxPts: "Pontos (máx)",
      tags: "Tags",
      tagsHint: "Ex: giftcard, viagem",
      clear: "Limpar",
      apply: "Aplicar",
      redeem: "Resgatar",
      needPoints: "Pontos insuficientes",
      yourBalance: "Seu saldo",
      refresh: "Atualizar",
    },
    EN: {
      welcome: "Welcome",
      points: "Points",
      tier: "Tier",
      loading: "Loading...",
      empty: "No rewards available right now.",
      filters: "Filters",
      minPts: "Min points",
      maxPts: "Max points",
      tags: "Tags",
      tagsHint: "e.g. giftcard, travel",
      clear: "Clear",
      apply: "Apply",
      redeem: "Redeem",
      needPoints: "Not enough points",
      yourBalance: "Your balance",
      refresh: "Refresh",
    },
    ES: {
      welcome: "Bienvenido",
      points: "Puntos",
      tier: "Nivel",
      loading: "Cargando...",
      empty: "No hay rewards disponibles ahora.",
      filters: "Filtros",
      minPts: "Puntos (mín)",
      maxPts: "Puntos (máx)",
      tags: "Etiquetas",
      tagsHint: "Ej: giftcard, viaje",
      clear: "Limpiar",
      apply: "Aplicar",
      redeem: "Canjear",
      needPoints: "Puntos insuficientes",
      yourBalance: "Tu saldo",
      refresh: "Actualizar",
    },
  } as const;

  return dict[lang];
}

function pickI18n(i18n: any, lang: "PT" | "EN" | "ES") {
  if (!i18n) return "";
  if (lang === "PT") return i18n.pt || i18n.en || i18n.es || "";
  if (lang === "ES") return i18n.es || i18n.en || i18n.pt || "";
  return i18n.en || i18n.pt || i18n.es || "";
}

export default function RewardsUser({ lang }: Props) {
  const safeLang: "PT" | "EN" | "ES" = lang === "PT" || lang === "EN" || lang === "ES" ? lang : "EN";
  const L = useMemo(() => t(safeLang), [safeLang]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [userSub, setUserSub] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [balance, setBalance] = useState<BalanceRow | null>(null);

  const [rewards, setRewards] = useState<Reward[]>([]);

  // filters
  const [minPts, setMinPts] = useState<string>("");
  const [maxPts, setMaxPts] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      // current user
      const u = await getCurrentUser();
      const sub = String((u as any)?.userId || (u as any)?.username || "").trim();
      setUserSub(sub);

      // name (prefer Cognito attributes, fallback to balance userName)
      try {
        const attrs = await fetchUserAttributes();
        const name =
          (attrs as any)?.name ||
          (attrs as any)?.["custom:fullName"] ||
          [String((attrs as any)?.given_name || "").trim(), String((attrs as any)?.family_name || "").trim()]
            .filter(Boolean)
            .join(" ");
        if (name) setFullName(String(name));
      } catch {
        // ignore
      }

      // rewards list (Mongo)
      {
        let nextToken: string | null | undefined = null;
        const all: Reward[] = [];
        const PAGE_SIZE = 200;
        const MAX_ITEMS = 2000;

        do {
          const res: any = await gqlClient.graphql({
            query: LIST_REWARDS,
            variables: { limit: PAGE_SIZE, nextToken, activeOnly: true },
          });

          const block = res?.data?.mongoRewardsList;
          const list: Reward[] = block?.items ?? [];
          all.push(...list.filter(Boolean));
          nextToken = block?.nextToken ?? null;
        } while (nextToken && all.length < MAX_ITEMS);

        // sort by pointsCost asc
        all.sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));
        setRewards(all);
      }

      // balance (Mongo) — same paging strategy as admin balances report
      {
        let nextToken: string | null | undefined = null;
        let found: BalanceRow | null = null;

        const PAGE_SIZE = 200;
        const MAX_PAGES = 40; // safety

        let pages = 0;
        do {
          const res: any = await gqlClient.graphql({
            query: LIST_BALANCES,
            variables: { limit: PAGE_SIZE, nextToken, name: null, userType: null },
          });

          const block = res?.data?.mongoRewardsBalancesList;
          const list: BalanceRow[] = block?.items ?? [];

          found = list.find((r) => String(r?.userId || "").trim() === sub) || null;

          nextToken = block?.nextToken ?? null;
          pages += 1;
        } while (!found && nextToken && pages < MAX_PAGES);

        setBalance(found);

        // fallback name if still empty
        if (!fullName && found?.userName) setFullName(String(found.userName));
      }
    } catch (e: any) {
      setError(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availablePoints = useMemo(() => {
    const v = Number(balance?.availablePoints);
    return Number.isFinite(v) ? v : 0;
  }, [balance]);

  const tier = useMemo(() => computeTier(availablePoints), [availablePoints]);

  const tagsFilter = useMemo(() => {
    return tagsText
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }, [tagsText]);

  const filteredRewards = useMemo(() => {
    const min = minPts.trim() ? Number(minPts) : null;
    const max = maxPts.trim() ? Number(maxPts) : null;

    return rewards.filter((r) => {
      const cost = Number(r.pointsCost || 0);

      const okMin = min == null || (Number.isFinite(min) && cost >= min);
      const okMax = max == null || (Number.isFinite(max) && cost <= max);

      const rt = (r.tags || []).map((x) => String(x).trim().toLowerCase()).filter(Boolean);
      const okTags = tagsFilter.length === 0 || tagsFilter.some((t) => rt.includes(t));

      return okMin && okMax && okTags;
    });
  }, [rewards, minPts, maxPts, tagsFilter]);

  function clearFilters() {
    setMinPts("");
    setMaxPts("");
    setTagsText("");
  }

  // NOTE: Redeem flow needs backend mutation to create a redemption request in Mongo.
  function handleRedeem(_r: Reward) {
    alert("Resgate ainda não habilitado no backend (pendente criar mutation no Mongo).");
  }

  const isNarrow = useMemo(() => window.innerWidth < 900, []);

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#F6F7F9",
      padding: 16,
      minHeight: "calc(100vh - 56px)",
    },
    container: {
      maxWidth: 1200,
      margin: "0 auto",
    },
    headerCard: {
      background: "white",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 14,
    },
    hLeft: { display: "flex", flexDirection: "column", gap: 6 },
    hTitle: { margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" },
    hSub: { fontSize: 13, color: "rgba(17,24,39,0.75)", fontWeight: 700 },
    hRight: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
    pointsCard: {
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: "10px 12px",
      minWidth: 180,
    },
    ptsLabel: { fontSize: 12, color: "rgba(17,24,39,0.65)", fontWeight: 900, letterSpacing: 0.4 },
    ptsValue: { fontSize: 22, color: "#111827", fontWeight: 1000, lineHeight: 1.15, marginTop: 2 },
    btn: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 900,
      height: 42,
    },
    btnGhost: {
      background: "white",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.35)",
      padding: "10px 14px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 900,
      height: 42,
    },
    grid: {
      display: "grid",
      gridTemplateColumns: isNarrow ? "1fr" : "320px 1fr",
      gap: 14,
      alignItems: "start",
    },
    card: {
      background: "white",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      padding: 14,
    },
    cardTitle: { margin: 0, fontSize: 14, fontWeight: 1000, color: "#111827", marginBottom: 10 },
    label: { fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.75)", marginBottom: 6 },
    input: {
      width: "100%",
      height: 42,
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.14)",
      outline: "none",
      backgroundColor: "white",
      color: "#111827",
      fontSize: 14,
    },
    error: {
      background: "#FFECEC",
      color: "#7F1D1D",
      border: "1px solid rgba(127,29,29,0.25)",
      padding: 12,
      borderRadius: 10,
      marginBottom: 12,
      whiteSpace: "pre-wrap",
      fontWeight: 700,
    },
    rewardsGrid: {
      display: "grid",
      gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, minmax(0, 1fr))",
      gap: 12,
    },
    rewardCard: {
      background: "white",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 14,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      minHeight: 320,
    },
    rewardImg: { width: "100%", height: 160, objectFit: "cover", background: "#F3F4F6" },
    rewardBody: { padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 },
    rewardTitle: { fontSize: 14, fontWeight: 1000, color: "#111827" },
    rewardDesc: { fontSize: 13, color: "rgba(17,24,39,0.75)", lineHeight: 1.35, minHeight: 36 },
    rewardMeta: { display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 4 },
    costPill: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "6px 10px",
      borderRadius: 999,
      background: "#F3F4F6",
      color: "#111827",
      fontWeight: 1000,
      fontSize: 12,
      border: "1px solid rgba(0,0,0,0.06)",
      whiteSpace: "nowrap",
    },
    tagRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 },
    tag: {
      fontSize: 11,
      fontWeight: 900,
      padding: "4px 8px",
      borderRadius: 999,
      background: "#FBFBFC",
      border: "1px solid rgba(0,0,0,0.08)",
      color: "rgba(17,24,39,0.75)",
    },
    redeemBtn: {
      marginTop: 10,
      width: "100%",
      borderRadius: 12,
      padding: "10px 12px",
      fontWeight: 1000,
      border: "none",
      cursor: "pointer",
      background: "#7A5A3A",
      color: "white",
    },
    redeemBtnDisabled: { opacity: 0.5, cursor: "not-allowed" as const },
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {error && <div style={S.error}>{error}</div>}

        <div style={S.headerCard}>
          <div style={S.hLeft}>
            <h2 style={S.hTitle}>{L.welcome}{fullName ? `, ${fullName}` : ""}!</h2>
            <div style={S.hSub}>
              {L.yourBalance}: <b style={{ color: "#111827" }}>{fmtPts(availablePoints)}</b> • {L.tier}: {" "}
              <span style={tierStyle(tier)}>{tier}</span>
              {userSub ? (
                <span
                  style={{
                    marginLeft: 10,
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    color: "rgba(17,24,39,0.55)",
                  }}
                >
                  ({userSub})
                </span>
              ) : null}
            </div>
          </div>

          <div style={S.hRight}>
            <div style={S.pointsCard}>
              <div style={S.ptsLabel}>{L.points}</div>
              <div style={S.ptsValue}>{fmtPts(availablePoints)}</div>
            </div>

            <button style={S.btnGhost} onClick={load} disabled={loading}>
              {loading ? L.loading : L.refresh}
            </button>
          </div>
        </div>

        <div style={S.grid}>
          <div style={S.card}>
            <h3 style={S.cardTitle}>{L.filters}</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={S.label}>{L.minPts}</div>
                <input
                  type="number"
                  value={minPts}
                  onChange={(e) => setMinPts(e.target.value)}
                  style={S.input}
                  placeholder="0"
                  min={0}
                />
              </div>

              <div>
                <div style={S.label}>{L.maxPts}</div>
                <input
                  type="number"
                  value={maxPts}
                  onChange={(e) => setMaxPts(e.target.value)}
                  style={S.input}
                  placeholder="2000"
                  min={0}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <div style={S.label}>{L.tags}</div>
              <input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                style={S.input}
                placeholder={L.tagsHint}
              />
              <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button style={S.btnGhost} onClick={clearFilters} disabled={loading}>
                  {L.clear}
                </button>
                <button style={S.btn} onClick={() => {}} disabled={loading}>
                  {L.apply}
                </button>
              </div>
            </div>
          </div>

          <div>
            {loading && rewards.length === 0 ? (
              <div style={{ ...S.card, color: "#111827", fontWeight: 900 }}>{L.loading}</div>
            ) : filteredRewards.length === 0 ? (
              <div style={{ ...S.card, color: "#111827", fontWeight: 900 }}>{L.empty}</div>
            ) : (
              <div style={S.rewardsGrid}>
                {filteredRewards.map((r) => {
                  const title = pickI18n(r.title, safeLang) || r.code || r.id;
                  const desc = pickI18n(r.description, safeLang);
                  const cost = Number(r.pointsCost || 0);
                  const canRedeem = availablePoints >= cost && cost > 0;

                  return (
                    <div key={r.id} style={S.rewardCard}>
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={title} style={S.rewardImg} />
                      ) : (
                        <div style={S.rewardImg} />
                      )}
                      <div style={S.rewardBody}>
                        <div style={S.rewardTitle}>{title}</div>
                        <div style={S.rewardDesc}>{desc || ""}</div>

                        <div style={S.tagRow}>
                          {(r.tags || []).slice(0, 6).map((tg) => (
                            <span key={tg} style={S.tag}>
                              {tg}
                            </span>
                          ))}
                        </div>

                        <div style={S.rewardMeta}>
                          <span style={S.costPill}>
                            {fmtPts(cost)} {L.points}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.7)" }}>
                            {r.category || ""}
                          </span>
                        </div>

                        <button
                          style={{ ...S.redeemBtn, ...(canRedeem ? {} : S.redeemBtnDisabled) }}
                          disabled={!canRedeem}
                          onClick={() => handleRedeem(r)}
                          title={canRedeem ? "" : L.needPoints}
                        >
                          {L.redeem}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
