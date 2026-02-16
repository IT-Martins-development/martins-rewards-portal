// src/RewardsUser.tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchUserAttributes } from "aws-amplify/auth";
import { gqlClient } from "./lib/amplifyClient";
import type { Lang } from "./types/lang";

type Props = { lang: Uppercase<Lang> };

type MongoI18n = { pt?: string | null; en?: string | null; es?: string | null };
type MongoReward = {
  id: string;
  code: string;
  title: MongoI18n;
  description?: MongoI18n | null;
  category?: string | null;
  tags?: string[] | null;
  pointsCost: number;
  imageUrl?: string | null;
  deliveryType: string;
  active: boolean;
};

type BalanceRow = {
  userId: string;
  userName?: string | null;
  availablePoints: number;
  redeemedPoints: number;
  levelId?: string | null; // se estiver exposto no schema
};

const Q_MONGO_REWARDS_LIST = /* GraphQL */ `
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

// OBS: se "levelId" não existir no schema, REMOVA "levelId" daqui e do BalanceRow
const Q_MONGO_BALANCES_LIST = /* GraphQL */ `
  query MongoRewardsBalancesList($limit: Int, $nextToken: String) {
    mongoRewardsBalancesList(limit: $limit, nextToken: $nextToken) {
      items {
        userId
        userName
        availablePoints
        redeemedPoints
        levelId
      }
      nextToken
    }
  }
`;

/**
 * ✅ MUTATION CORRETO (VOCÊ VAI CRIAR NO APPSYNC / MONGO):
 * - cria redemption PENDING
 * - cria ledger
 * - debita availablePoints
 * - incrementa redeemedPoints
 */
const M_MONGO_REDEEM = /* GraphQL */ `
  mutation MongoRewardsRedeem($input: MongoRewardsRedeemInput!) {
    mongoRewardsRedeem(input: $input) {
      ok
      message
      redemptionId
      availablePoints
      redeemedPoints
      levelId
    }
  }
`;

function t(lang: Uppercase<Lang>) {
  const L = lang as Uppercase<Lang>;
  const dict: Record<string, Record<Uppercase<Lang>, string>> = {
    breadcrumbs: { PT: "Referrals • Rewards", EN: "Referrals • Rewards", ES: "Referencias • Rewards" },
    search: { PT: "Buscar rewards…", EN: "Search rewards…", ES: "Buscar rewards…" },
    title: { PT: "Rewards", EN: "Rewards", ES: "Rewards" },
    subtitle: {
      PT: "Resgate recompensas usando seus pontos. Visual no padrão corporativo do sistema.",
      EN: "Redeem rewards using your points. Corporate layout standard.",
      ES: "Canjea recompensas usando tus puntos. Estándar corporativo.",
    },
    reload: { PT: "Recarregar", EN: "Reload", ES: "Recargar" },
    level: { PT: "Nível:", EN: "Level:", ES: "Nivel:" },

    totalPoints: { PT: "Total pontos conquistados", EN: "Total points earned", ES: "Total puntos ganados" },
    availablePoints: { PT: "Pontos disponíveis", EN: "Available points", ES: "Puntos disponibles" },
    redeemedPoints: { PT: "Resgatados", EN: "Redeemed", ES: "Canjeados" },
    rewardsAvailable: { PT: "Rewards disponíveis", EN: "Available rewards", ES: "Rewards disponibles" },

    redeem: { PT: "Resgatar", EN: "Redeem", ES: "Canjear" },
    insufficient: { PT: "Pontos insuficientes", EN: "Insufficient points", ES: "Puntos insuficientes" },
    confirmTitle: { PT: "Confirmar resgate", EN: "Confirm redemption", ES: "Confirmar canje" },
    confirmMsg: {
      PT: "Deseja resgatar este reward? A solicitação ficará pendente para aprovação.",
      EN: "Redeem this reward? The request will be pending approval.",
      ES: "¿Canjear esta recompensa? La solicitud quedará pendiente de aprobación.",
    },
    loadError: { PT: "Erro ao carregar", EN: "Failed to load", ES: "Error al cargar" },
  };

  const get = (key: string) => dict[key]?.[L] ?? dict[key]?.PT ?? key;
  return { get };
}

function pickI18n(v: MongoI18n | null | undefined, lang: Uppercase<Lang>): string {
  if (!v) return "";
  const L = lang.toLowerCase() as "pt" | "en" | "es";
  return (v[L] ?? v.pt ?? v.en ?? v.es ?? "").trim();
}

function safeNum(n: any, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/** ======= Styles (mantém o layout do protótipo) ======= */
const pageWrap: React.CSSProperties = { background: "#F6F7F9", minHeight: "calc(100vh - 68px)", paddingBottom: 28 };
const container: React.CSSProperties = { maxWidth: 1220, margin: "0 auto", padding: "0 18px" };

const topRow: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, padding: "16px 0 10px" };
const crumb: React.CSSProperties = { color: "#6B7280", fontWeight: 700 };
const searchWrap: React.CSSProperties = { flex: 1, display: "flex", alignItems: "center", gap: 10 };
const searchInput: React.CSSProperties = {
  width: "100%", height: 44, borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "white",
  padding: "0 18px 0 44px", outline: "none", fontSize: 15
};
const searchIcon: React.CSSProperties = { position: "absolute", marginLeft: 16, color: "#6B7280", fontSize: 16 };

const levelPill: React.CSSProperties = {
  borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", background: "white",
  padding: "10px 14px", fontWeight: 900, color: "#111827", whiteSpace: "nowrap"
};

const headRow: React.CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "10px 0 14px" };
const title: React.CSSProperties = { fontSize: 44, fontWeight: 950, letterSpacing: -1, color: "#111827" };
const subtitle: React.CSSProperties = { color: "#6B7280", fontSize: 20, fontWeight: 600, marginTop: 6 };

const reloadBtn: React.CSSProperties = {
  borderRadius: 14, border: "1px solid rgba(0,0,0,0.14)", background: "white",
  padding: "12px 18px", fontWeight: 900, cursor: "pointer", height: 48
};

const statsRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 };
const card: React.CSSProperties = { background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 18, padding: 18, boxShadow: "0 6px 18px rgba(17,24,39,0.06)" };
const cardK: React.CSSProperties = { color: "#6B7280", fontWeight: 800, fontSize: 16, marginBottom: 8 };
const cardV: React.CSSProperties = { color: "#111827", fontWeight: 950, fontSize: 44 };

const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18, marginTop: 18 };

const rewardCard: React.CSSProperties = { background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden", boxShadow: "0 6px 18px rgba(17,24,39,0.06)" };
const imageBox: React.CSSProperties = { height: 150, background: "#0B1220", position: "relative" };
const ptsPill: React.CSSProperties = {
  position: "absolute", top: 12, right: 12, borderRadius: 999, background: "rgba(255,255,255,0.92)",
  padding: "6px 10px", fontWeight: 950, color: "#111827", display: "flex", alignItems: "center", gap: 8
};
const coin: React.CSSProperties = { width: 10, height: 10, borderRadius: 999, background: "#F6C343", display: "inline-block" };

const body: React.CSSProperties = { padding: 16 };
const rTitle: React.CSSProperties = { fontSize: 18, fontWeight: 950, color: "#111827", marginBottom: 6 };
const rDesc: React.CSSProperties = { color: "#6B7280", fontWeight: 650, lineHeight: 1.35, minHeight: 56 };
const tagRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, minHeight: 36 };
const tag: React.CSSProperties = { borderRadius: 999, border: "1px solid rgba(0,0,0,0.10)", background: "#F3F4F6", padding: "6px 10px", fontWeight: 800, color: "#111827", fontSize: 13 };

const btn: React.CSSProperties = { marginTop: 14, width: "100%", borderRadius: 12, border: "1px solid rgba(0,0,0,0.10)", background: "#0F172A", color: "white", fontWeight: 950, padding: "12px 14px", cursor: "pointer", fontSize: 16 };
const btnDisabled: React.CSSProperties = { ...btn, background: "#D1D5DB", color: "#374151", cursor: "not-allowed" };

export default function RewardsUser({ lang }: Props) {
  const { get } = t(lang);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState<string>("");
  const [levelId, setLevelId] = useState<string>("NONE");
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  const [rewards, setRewards] = useState<MongoReward[]>([]);

  const totalPoints = useMemo(() => safeNum(availablePoints, 0) + safeNum(redeemedPoints, 0), [availablePoints, redeemedPoints]);
  const rewardsAvailable = useMemo(() => rewards.filter((r) => r.active).length, [rewards]);

  const filteredRewards = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = rewards.filter((r) => r.active);
    if (!qq) return base;
    return base.filter((r) => {
      const title = pickI18n(r.title, lang).toLowerCase();
      const desc = pickI18n(r.description ?? undefined, lang).toLowerCase();
      const code = (r.code || "").toLowerCase();
      const tags = (r.tags || []).join(" ").toLowerCase();
      return [title, desc, code, tags].some((x) => x.includes(qq));
    });
  }, [q, rewards, lang]);

  async function loadAll() {
    setLoading(true);
    setError(null);

    try {
      const attrs = await fetchUserAttributes();
      const sub = (attrs.sub || "").trim();
      setUserId(sub);

      const rRes: any = await gqlClient.graphql({
        query: Q_MONGO_REWARDS_LIST,
        variables: { limit: 500, nextToken: null, activeOnly: true },
      });
      setRewards(rRes?.data?.mongoRewardsList?.items || []);

      const bRes: any = await gqlClient.graphql({
        query: Q_MONGO_BALANCES_LIST,
        variables: { limit: 5000, nextToken: null },
      });

      const rows: BalanceRow[] = bRes?.data?.mongoRewardsBalancesList?.items || [];
      const me = rows.find((x) => String(x.userId || "").trim() === sub);

      if (me) {
        setAvailablePoints(safeNum(me.availablePoints, 0));
        setRedeemedPoints(safeNum(me.redeemedPoints, 0));
        setLevelId((me.levelId || "NONE").toUpperCase());
      } else {
        // NÃO criar saldo no portal do usuário. Se não existe, é problema de carga/seed/integração.
        setAvailablePoints(0);
        setRedeemedPoints(0);
        setLevelId("NONE");
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.errors?.[0]?.message || e?.message || get("loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redeem(reward: MongoReward) {
    if (!userId) return;
    if (availablePoints < reward.pointsCost) return;

    const ok = window.confirm(`${get("confirmTitle")}\n\n${get("confirmMsg")}`);
    if (!ok) return;

    setRedeemingId(reward.id);
    setError(null);

    try {
      // ✅ CHAMAR MUTATION ÚNICO QUE FAZ: redemption(PENDING)+ledger+update balance
      const res: any = await gqlClient.graphql({
        query: M_MONGO_REDEEM,
        variables: {
          input: {
            userId,              // Cognito sub
            rewardId: reward.id, // id do reward (MongoReward.id)
            rewardCode: reward.code,
            pointsCost: reward.pointsCost,
            lang: lang.toLowerCase(),
          },
        },
      });

      const out = res?.data?.mongoRewardsRedeem;
      if (!out?.ok) throw new Error(out?.message || "Redeem failed");

      // atualiza UI conforme retorno do backend (fonte da verdade)
      setAvailablePoints(safeNum(out.availablePoints, 0));
      setRedeemedPoints(safeNum(out.redeemedPoints, 0));
      if (out.levelId) setLevelId(String(out.levelId).toUpperCase());
    } catch (e: any) {
      console.error(e);
      setError(e?.errors?.[0]?.message || e?.message || "Erro ao resgatar");
    } finally {
      setRedeemingId(null);
    }
  }

  return (
    <div style={pageWrap}>
      <div style={container}>
        <div style={topRow}>
          <div style={crumb}>{get("breadcrumbs")}</div>

          <div style={searchWrap}>
            <div style={{ position: "relative", width: "100%" }}>
              <div style={searchIcon}>🔎</div>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={get("search")} style={searchInput} />
            </div>
          </div>

          {/* ✅ apenas Level, sem points */}
          <div style={levelPill}>
            {get("level")} <span style={{ marginLeft: 6 }}>{levelId || "NONE"}</span>
          </div>
        </div>

        <div style={headRow}>
          <div>
            <div style={title}>{get("title")}</div>
            <div style={subtitle}>{get("subtitle")}</div>
          </div>

          <button style={reloadBtn} onClick={loadAll} disabled={loading}>
            {get("reload")}
          </button>
        </div>

        {/* ✅ 4 cards (sem alterar layout padrão) */}
        <div style={statsRow}>
          <div style={card}>
            <div style={cardK}>{get("totalPoints")}</div>
            <div style={cardV}>{loading ? "…" : totalPoints}</div>
          </div>

          <div style={card}>
            <div style={cardK}>{get("availablePoints")}</div>
            <div style={cardV}>{loading ? "…" : availablePoints}</div>
          </div>

          <div style={card}>
            <div style={cardK}>{get("redeemedPoints")}</div>
            <div style={cardV}>{loading ? "…" : redeemedPoints}</div>
          </div>

          <div style={card}>
            <div style={cardK}>{get("rewardsAvailable")}</div>
            <div style={cardV}>{loading ? "…" : rewardsAvailable}</div>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 14, color: "#DC2626", fontWeight: 900 }}>
            {get("loadError")}: {error}
          </div>
        )}

        <div style={grid}>
          {filteredRewards.map((r) => {
            const canRedeem = availablePoints >= r.pointsCost;
            const img = r.imageUrl || "";
            const titleTxt = pickI18n(r.title, lang) || r.code;
            const descTxt = pickI18n(r.description ?? undefined, lang);

            return (
              <div key={r.id} style={rewardCard}>
                <div style={imageBox}>
                  {img ? (
                    <img
                      src={img}
                      alt={titleTxt}
                      style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.96 }}
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                    />
                  ) : null}

                  <div style={ptsPill}>
                    <span style={coin} />
                    {r.pointsCost} pts
                  </div>
                </div>

                <div style={body}>
                  <div style={rTitle}>{titleTxt}</div>
                  <div style={rDesc}>{descTxt}</div>

                  <div style={tagRow}>
                    {(r.tags || []).slice(0, 3).map((tg) => (
                      <span key={tg} style={tag}>
                        {tg}
                      </span>
                    ))}
                  </div>

                  <button
                    style={canRedeem ? btn : btnDisabled}
                    onClick={() => redeem(r)}
                    disabled={!canRedeem || !!redeemingId || loading}
                  >
                    {redeemingId === r.id ? "…" : canRedeem ? get("redeem") : get("insufficient")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}