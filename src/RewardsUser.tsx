import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./amplifyClient";
import { fetchUserAttributes } from "aws-amplify/auth";

type Lang = "PT" | "EN" | "ES";

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
  deliveryType?: string | null;
  active: boolean;
};

type BalanceRow = {
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  userType?: string | null;
  availablePoints: number;
  redeemedPoints: number;
  updatedAt?: string | null;
};

const MONGO_REWARDS_LIST = /* GraphQL */ `
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

const MONGO_BALANCES_LIST = /* GraphQL */ `
  query MongoRewardsBalancesList($limit: Int, $nextToken: String, $name: String, $userType: String) {
    mongoRewardsBalancesList(limit: $limit, nextToken: $nextToken, name: $name, userType: $userType) {
      items {
        userId
        userName
        userEmail
        userType
        availablePoints
        redeemedPoints
        updatedAt
      }
      nextToken
    }
  }
`;

function pickI18nText(v?: MongoI18n | null, lang?: Lang) {
  if (!v) return "";
  if (lang === "EN") return v.en ?? v.pt ?? v.es ?? "";
  if (lang === "ES") return v.es ?? v.pt ?? v.en ?? "";
  return v.pt ?? v.en ?? v.es ?? "";
}

function computeTier(points: number) {
  // ajuste como você quiser
  if (points >= 10000) return "PLATINUM";
  if (points >= 5000) return "BLACK";
  if (points >= 1000) return "GOLD";
  if (points > 0) return "SILVER";
  return "NONE";
}

function safeImg(url?: string | null) {
  if (!url) return "";
  // remove lixo tipo "}" que estava gerando %7D e 404
  return url.trim().replace(/[}\s]+$/g, "");
}

export default function RewardsUser({ lang }: { lang: Lang }) {
  const [fullName, setFullName] = useState<string>(""); // header "Bem-vindo"
  const [email, setEmail] = useState<string>("");

  const [points, setPoints] = useState<number>(0);
  const tier = useMemo(() => computeTier(points), [points]);

  const [rewards, setRewards] = useState<MongoReward[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [q, setQ] = useState("");
  const [minPts, setMinPts] = useState("");
  const [maxPts, setMaxPts] = useState("");
  const [tagsText, setTagsText] = useState("");

  const tagsFilter = useMemo(() => {
    return tagsText
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
  }, [tagsText]);

  async function loadUser() {
    const attrs = await fetchUserAttributes();
    const name =
      attrs.name ||
      attrs.given_name ||
      attrs.family_name ||
      attrs.preferred_username ||
      "";
    const mail = attrs.email || "";
    setFullName(name || "Cliente");
    setEmail(mail);
    return { name, mail };
  }

  async function loadRewards() {
    // pega tudo (se quiser paginar depois, ok)
    const res: any = await gqlClient.graphql({
      query: MONGO_REWARDS_LIST,
      variables: { limit: 200, nextToken: null, activeOnly: true },
    });

    const items: MongoReward[] = res?.data?.mongoRewardsList?.items || [];
    setRewards(items.filter((r) => r.active));
  }

  async function loadBalanceByEmail(userEmail: string) {
    // percorre páginas até achar o email
    let nextToken: string | null = null;

    for (let i = 0; i < 20; i++) {
      const res: any = await gqlClient.graphql({
        query: MONGO_BALANCES_LIST,
        variables: { limit: 200, nextToken, name: null, userType: null },
      });

      const items: BalanceRow[] = res?.data?.mongoRewardsBalancesList?.items || [];
      const found = items.find(
        (x) => (x.userEmail || "").toLowerCase() === userEmail.toLowerCase()
      );

      if (found) {
        setPoints(found.availablePoints || 0);
        return;
      }

      nextToken = res?.data?.mongoRewardsBalancesList?.nextToken || null;
      if (!nextToken) break;
    }

    // se não achar, fica 0
    setPoints(0);
  }

  async function reloadAll() {
    setLoading(true);
    setError(null);
    try {
      const u = await loadUser();
      await Promise.all([loadRewards(), u.mail ? loadBalanceByEmail(u.mail) : Promise.resolve()]);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    const min = minPts.trim() === "" ? null : Number(minPts);
    const max = maxPts.trim() === "" ? null : Number(maxPts);

    return rewards.filter((r) => {
      const title = pickI18nText(r.title, lang).toLowerCase();
      const desc = pickI18nText(r.description, lang).toLowerCase();
      const code = (r.code || "").toLowerCase();

      const okQ =
        !query || title.includes(query) || desc.includes(query) || code.includes(query);

      const okMin = min === null || r.pointsCost >= min;
      const okMax = max === null || r.pointsCost <= max;

      const rewardTags = (r.tags || []).map((t) => t.toLowerCase());
      const okTags =
        tagsFilter.length === 0 || tagsFilter.every((t) => rewardTags.includes(t));

      return okQ && okMin && okMax && okTags;
    });
  }, [rewards, q, minPts, maxPts, tagsFilter, lang]);

  // (por enquanto) o schema não tem mutation de "criar resgate" no mongo
  function onRedeemClick(r: MongoReward) {
    alert(
      `Resgate solicitado (UI).\n\nPróximo passo: criar mutation no backend para gravar em rewards_redemptions.\nReward: ${r.code}`
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 14 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
          padding: 16,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>
            Bem-vindo, {fullName} 👋
          </div>
          <div style={{ opacity: 0.75 }}>Escolha um reward para resgatar</div>
          {email ? <div style={{ fontSize: 12, opacity: 0.55 }}>{email}</div> : null}
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "#F3F4F6",
              fontWeight: 900,
            }}
          >
            Pontos disponíveis: {points}
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "#F3F4F6",
              fontWeight: 900,
            }}
          >
            Nível: {tier}
          </div>

          <button
            onClick={reloadAll}
            style={{
              borderRadius: 999,
              padding: "8px 14px",
              border: "1px solid rgba(0,0,0,0.14)",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Recarregar
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Filtros</div>
          <div style={{ fontWeight: 900, opacity: 0.7 }}>Total: {filtered.length}</div>
        </div>

        <div
          style={{
            marginTop: 10,
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 2fr auto",
            gap: 10,
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar (título, descrição ou código)"
            style={{ height: 40, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", padding: "0 12px" }}
          />
          <input
            value={minPts}
            onChange={(e) => setMinPts(e.target.value)}
            placeholder="Min pts"
            style={{ height: 40, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", padding: "0 12px" }}
          />
          <input
            value={maxPts}
            onChange={(e) => setMaxPts(e.target.value)}
            placeholder="Max pts"
            style={{ height: 40, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", padding: "0 12px" }}
          />
          <input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="Tags (separadas por vírgula)"
            style={{ height: 40, borderRadius: 12, border: "1px solid rgba(0,0,0,0.12)", padding: "0 12px" }}
          />
          <button
            onClick={() => {
              setQ("");
              setMinPts("");
              setMaxPts("");
              setTagsText("");
            }}
            style={{
              height: 40,
              borderRadius: 12,
              padding: "0 14px",
              border: "1px solid rgba(0,0,0,0.14)",
              background: "#fff",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Limpar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ marginTop: 14, padding: 16, color: "#111827", fontWeight: 900 }}>Carregando…</div>
      ) : error ? (
        <div
          style={{
            marginTop: 14,
            background: "#fff",
            border: "1px solid rgba(220,38,38,0.25)",
            borderRadius: 14,
            padding: 14,
            color: "#b91c1c",
            fontWeight: 900,
          }}
        >
          {error}
        </div>
      ) : (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 14,
          }}
        >
          {filtered.map((r) => {
            const title = pickI18nText(r.title, lang) || r.code;
            const desc = pickI18nText(r.description, lang);
            const canRedeem = points >= r.pointsCost;
            const img = safeImg(r.imageUrl);

            return (
              <div
                key={r.id}
                style={{
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 14,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "70px 1fr",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 12,
                    background: "#F3F4F6",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(0,0,0,0.06)",
                  }}
                >
                  {img ? (
                    <img src={img} alt={title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ opacity: 0.6, fontWeight: 900 }}>—</span>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 950, fontSize: 16, color: "#111827" }}>{title}</div>
                  {desc ? <div style={{ opacity: 0.75, marginTop: 2 }}>{desc}</div> : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ background: "#F3F4F6", borderRadius: 999, padding: "6px 10px", fontWeight: 900 }}>
                      Pontos: {r.pointsCost}
                    </span>
                    <span style={{ background: "#F3F4F6", borderRadius: 999, padding: "6px 10px", fontWeight: 900 }}>
                      Entrega: {r.deliveryType || "—"}
                    </span>
                  </div>

                  <button
                    disabled={!canRedeem}
                    onClick={() => onRedeemClick(r)}
                    style={{
                      marginTop: 12,
                      width: "100%",
                      height: 40,
                      borderRadius: 999,
                      border: "0",
                      fontWeight: 950,
                      cursor: canRedeem ? "pointer" : "not-allowed",
                      background: canRedeem ? "#7A5A3A" : "#D1D5DB",
                      color: "#fff",
                    }}
                  >
                    {canRedeem ? "Resgatar" : "Pontos insuficientes"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* responsivo */}
      <style>{`
        @media (max-width: 980px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </div>
  );
}