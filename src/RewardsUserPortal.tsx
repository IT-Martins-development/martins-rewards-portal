// src/RewardsUserPortal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchUserAttributes, fetchAuthSession } from "aws-amplify/auth";
import { gqlClient } from "./amplifyClient";

type Tier = "SILVER" | "GOLD" | "BLACK" | "PLATINUM" | "NONE";

type MongoReward = {
  id: string;
  code: string;
  title: { pt?: string | null; en?: string | null; es?: string | null };
  description?: { pt?: string | null; en?: string | null; es?: string | null } | null;
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
  userType?: string | null;
  userEmail?: string | null;
  availablePoints: number;
  redeemedPoints: number;
  updatedAt?: string | null;
};

// ===== GraphQL (EXATOS do seu schema) =====
const GQL = {
  MONGO_REWARDS_LIST: /* GraphQL */ `
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
          offerStartAt
          offerEndAt
          createdAt
          updatedAt
          createdBy
        }
        nextToken
      }
    }
  `,
  MONGO_BALANCES_LIST: /* GraphQL */ `
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
  `,
  CREATE_REDEMPTION: /* GraphQL */ `
    mutation CreateRewardRedemption($input: CreateRewardRedemptionInput!) {
      createRewardRedemption(input: $input) {
        id
        userId
        rewardId
        pointsSpent
        status
        createdAt
        updatedAt
      }
    }
  `,
};

function normalizeTierFromPoints(points: number): Tier {
  // ✅ ajuste livremente depois (hoje você tem levelId no Mongo, mas não está exposto por query)
  if (points >= 2000) return "BLACK";
  if (points >= 1000) return "PLATINUM";
  if (points >= 500) return "GOLD";
  if (points >= 1) return "SILVER";
  return "NONE";
}

function parseTags(txt: string): string[] {
  return txt
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function pickI18n(i18n: any, lang: "pt" | "en" | "es") {
  if (!i18n) return "";
  return i18n?.[lang] || i18n?.pt || i18n?.en || i18n?.es || "";
}

export default function RewardsUserPortal({ lang = "pt" as "pt" | "en" | "es" }) {
  const [fullName, setFullName] = useState<string>("Cliente");
  const [userId, setUserId] = useState<string>("");

  const [points, setPoints] = useState<number>(0);
  const [tier, setTier] = useState<Tier>("NONE");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [rewards, setRewards] = useState<MongoReward[]>([]);

  // filtros
  const [q, setQ] = useState("");
  const [minPts, setMinPts] = useState("");
  const [maxPts, setMaxPts] = useState("");
  const [tagsText, setTagsText] = useState("");

  async function loadUser() {
    const attrs = await fetchUserAttributes();
    const name =
      attrs.name ||
      [attrs.given_name, attrs.family_name].filter(Boolean).join(" ") ||
      attrs.email ||
      "Cliente";
    setFullName(name);

    const session = await fetchAuthSession();
    const sub = session.tokens?.idToken?.payload?.sub as string | undefined;
    if (!sub) throw new Error("Não consegui obter o userId (sub) do token.");
    setUserId(sub);

    return { name, sub };
  }

  async function loadRewards() {
    const res: any = await gqlClient.graphql({
      query: GQL.MONGO_REWARDS_LIST,
      variables: { limit: 200, activeOnly: true },
    });

    const items: MongoReward[] = res?.data?.mongoRewardsList?.items || [];
    // activeOnly já filtra, mas deixo safe:
    setRewards(items.filter((r) => r.active !== false));
  }

  async function loadPointsByUserId(sub: string) {
    // ✅ Como não existe query by userId, vamos listar e filtrar localmente.
    // Se você tiver muitos usuários, depois eu te dou a melhoria no backend (query específica).
    const res: any = await gqlClient.graphql({
      query: GQL.MONGO_BALANCES_LIST,
      variables: { limit: 1000 },
    });

    const items: BalanceRow[] = res?.data?.mongoRewardsBalancesList?.items || [];
    const row = items.find((x) => String(x.userId) === String(sub));

    const available = Number(row?.availablePoints || 0);
    setPoints(available);

    // ⚠️ Seu Mongo tem levelId, mas essa query NÃO retorna levelId.
    // Então por enquanto calculo por faixa (ajustável).
    setTier(normalizeTierFromPoints(available));
  }

  async function reloadAll() {
    setLoading(true);
    setError(null);
    try {
      const { sub } = await loadUser();
      await Promise.all([loadRewards(), loadPointsByUserId(sub)]);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar portal.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const tags = parseTags(tagsText).map((t) => t.toLowerCase());
    const min = minPts.trim() === "" ? null : Number(minPts);
    const max = maxPts.trim() === "" ? null : Number(maxPts);

    return rewards.filter((r) => {
      const title = pickI18n(r.title, lang).toLowerCase();
      const desc = pickI18n(r.description, lang).toLowerCase();
      const code = (r.code || "").toLowerCase();

      if (query) {
        const blob = `${title} ${desc} ${code}`.toLowerCase();
        if (!blob.includes(query)) return false;
      }

      if (min !== null && r.pointsCost < min) return false;
      if (max !== null && r.pointsCost > max) return false;

      if (tags.length) {
        const rt = (r.tags || []).map((t) => (t || "").toLowerCase());
        for (const t of tags) if (!rt.includes(t)) return false;
      }

      return true;
    });
  }, [rewards, q, minPts, maxPts, tagsText, lang]);

  function clearFilters() {
    setQ("");
    setMinPts("");
    setMaxPts("");
    setTagsText("");
  }

  async function redeem(r: MongoReward) {
    try {
      if (!userId) throw new Error("Usuário não carregado.");
      if (points < r.pointsCost) return;

      const input = {
        userId,
        rewardId: r.id,
        pointsSpent: r.pointsCost,
        status: "REQUESTED",
        createdAt: new Date().toISOString(),
      };

      await gqlClient.graphql({
        query: GQL.CREATE_REDEMPTION,
        variables: { input },
      });

      alert("Resgate solicitado! Status: REQUESTED");
      await loadPointsByUserId(userId); // atualiza UI (mesmo sem debitar ainda)
    } catch (e: any) {
      alert(e?.message || "Erro ao solicitar resgate.");
    }
  }

  return (
    <div style={{ background: "#f6f7f9", minHeight: "100vh" }}>
      <header style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 16px" }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Martins Rewards</div>

        <div style={{ marginTop: 10, background: "#fff", borderRadius: 14, padding: 16, border: "1px solid #e8e8e8" }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Bem-vindo, {fullName} 👋</div>
          <div style={{ color: "#666", marginTop: 6 }}>Escolha um reward para resgatar</div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14, alignItems: "center" }}>
            <span style={{ background: "#eef1f6", padding: "6px 10px", borderRadius: 999, fontWeight: 700 }}>
              Pontos disponíveis: {points}
            </span>
            <span style={{ background: "#eef1f6", padding: "6px 10px", borderRadius: 999, fontWeight: 700 }}>
              Nível: {tier}
            </span>
            <button
              onClick={reloadAll}
              disabled={loading}
              style={{
                marginLeft: "auto",
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 999,
                padding: "8px 14px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Recarregar
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, background: "#fff", borderRadius: 14, padding: 14, border: "1px solid #e8e8e8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontWeight: 800 }}>Filtros</div>
            <div style={{ fontWeight: 800, color: "#666" }}>Total: {filtered.length}</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr auto", gap: 10 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar (título, descrição ou código)"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={minPts}
              onChange={(e) => setMinPts(e.target.value)}
              placeholder="Min pts"
              inputMode="numeric"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={maxPts}
              onChange={(e) => setMaxPts(e.target.value)}
              placeholder="Max pts"
              inputMode="numeric"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <input
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="Tags (separadas por vírgula)"
              style={{ padding: 10, borderRadius: 10, border: "1px solid #ddd" }}
            />
            <button
              onClick={clearFilters}
              style={{
                background: "#fff",
                border: "1px solid #ddd",
                borderRadius: 999,
                padding: "8px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Limpar
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginTop: 12, background: "#fff1f1", border: "1px solid #ffbaba", color: "#b40000", borderRadius: 12, padding: 12 }}>
            {error}
          </div>
        )}
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0 16px 30px" }}>
        {loading ? (
          <div style={{ padding: 18 }}>Carregando...</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
            {filtered.map((r) => {
              const title = pickI18n(r.title, lang);
              const desc = pickI18n(r.description, lang);
              const canRedeem = points >= r.pointsCost;

              return (
                <div key={r.id} style={{ background: "#fff", border: "1px solid #e8e8e8", borderRadius: 16, padding: 14 }}>
                  <div style={{ display: "flex", gap: 12 }}>
                    <div style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", border: "1px solid #eee", background: "#f3f3f3", flex: "0 0 auto" }}>
                      {r.imageUrl ? <img src={r.imageUrl} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{title}</div>
                      <div style={{ color: "#666", marginTop: 4, fontSize: 13 }}>{desc}</div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <span style={{ background: "#eef1f6", padding: "5px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                          Pontos: {r.pointsCost}
                        </span>
                        <span style={{ background: "#eef1f6", padding: "5px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                          Entrega: {r.deliveryType}
                        </span>
                        {r.category ? (
                          <span style={{ background: "#eef1f6", padding: "5px 10px", borderRadius: 999, fontWeight: 800, fontSize: 12 }}>
                            {r.category}
                          </span>
                        ) : null}
                      </div>

                      <button
                        onClick={() => redeem(r)}
                        disabled={!canRedeem}
                        style={{
                          marginTop: 12,
                          width: "100%",
                          borderRadius: 999,
                          border: "none",
                          padding: "10px 12px",
                          fontWeight: 900,
                          cursor: canRedeem ? "pointer" : "not-allowed",
                          background: canRedeem ? "#6b5632" : "#cfc7bb",
                          color: "#fff",
                        }}
                      >
                        {canRedeem ? "Resgatar" : "Pontos insuficientes"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}