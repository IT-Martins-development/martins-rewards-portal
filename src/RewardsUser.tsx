// src/RewardsUser.tsx
import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./lib/amplifyClient";
import { getCurrentUser, fetchUserAttributes, fetchAuthSession } from "aws-amplify/auth";

type Lang = "PT" | "EN" | "ES";
type Tier = "SILVER" | "GOLD" | "BLACK" | "PLATINUM" | "NONE";

type MongoI18n = { pt?: string | null; en?: string | null; es?: string | null };

type MongoReward = {
  id: string;
  code?: string | null;
  title?: MongoI18n | null;
  description?: MongoI18n | null;
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

type Props = { lang?: Lang };

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
  return e?.errors?.[0]?.message || e?.message || String(e);
}

function t(i18n?: MongoI18n | null, lang: Lang = "EN") {
  if (!i18n) return "";
  if (lang === "PT") return i18n.pt || i18n.en || i18n.es || "";
  if (lang === "ES") return i18n.es || i18n.en || i18n.pt || "";
  return i18n.en || i18n.pt || i18n.es || "";
}

function tierFromPoints(points: number): Tier {
  if (points >= 5000) return "PLATINUM";
  if (points >= 2000) return "BLACK";
  if (points >= 1000) return "GOLD";
  if (points >= 200) return "SILVER";
  return "NONE";
}

export default function RewardsUser({ lang }: Props) {
  const safeLang: Lang = lang === "PT" || lang === "EN" || lang === "ES" ? lang : "EN";

  const [sub, setSub] = useState("");
  const [fullName, setFullName] = useState("");

  const [balance, setBalance] = useState<BalanceRow | null>(null);
  const [rewards, setRewards] = useState<MongoReward[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filtros
  const [minPts, setMinPts] = useState("");
  const [maxPts, setMaxPts] = useState("");
  const [tag, setTag] = useState("");

  const pointsAvailable = Math.max(0, Number(balance?.availablePoints || 0));
  const tier = tierFromPoints(pointsAvailable);

  // ✅ Investor only
  useEffect(() => {
    async function checkInvestor() {
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.idToken?.payload?.["cognito:groups"] as string[] | undefined) || [];
        const norm = groups.map((g) => String(g).trim().toLowerCase());
        if (!norm.includes("investor")) window.location.href = "/";
      } catch {
        window.location.href = "/";
      }
    }
    checkInvestor();
  }, []);

  // user identity
  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      const u = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      const name =
        attrs?.name ||
        attrs?.["custom:fullName"] ||
        attrs?.["given_name"] ||
        u?.username ||
        "";
      if (!cancelled) {
        setSub(u?.userId || "");
        setFullName(String(name || "").trim());
      }
    }
    loadUser().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      // rewards (mongo)
      {
        let nextToken: string | null | undefined = null;
        const all: MongoReward[] = [];
        do {
          const res: any = await gqlClient.graphql({
            query: LIST_REWARDS,
            variables: { limit: 200, nextToken, activeOnly: true },
          });
          const block = res?.data?.mongoRewardsList;
          all.push(...(block?.items || []));
          nextToken = block?.nextToken ?? null;
        } while (nextToken);
        setRewards(all.sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0)));
      }

      // balance (MESMA query do admin)
      if (sub) {
        const res: any = await gqlClient.graphql({
          query: LIST_BALANCES,
          variables: { limit: 200, nextToken: null, name: null, userType: null },
        });

        const items: BalanceRow[] = res?.data?.mongoRewardsBalancesList?.items || [];
        const mine = items.find((x) => String(x?.userId || "") === String(sub)) || null;

        setBalance(mine);
      }
    } catch (e: any) {
      setError(pickErr(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sub) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    rewards.forEach((r) => (r.tags || []).forEach((x) => x && s.add(String(x))));
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [rewards]);

  const filtered = useMemo(() => {
    const min = minPts.trim() ? Number(minPts) : null;
    const max = maxPts.trim() ? Number(maxPts) : null;
    const tsel = tag.trim();
    return rewards.filter((r) => {
      const okMin = min == null || (r.pointsCost || 0) >= min;
      const okMax = max == null || (r.pointsCost || 0) <= max;
      const okTag = !tsel || (r.tags || []).includes(tsel);
      return okMin && okMax && okTag;
    });
  }, [rewards, minPts, maxPts, tag]);

  // Martins light UI
  const S: Record<string, React.CSSProperties> = {
    page: { background: "#F6F7F9", minHeight: "100vh", padding: 18 },
    wrap: { maxWidth: 1200, margin: "0 auto" },
    card: { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16 },
    h1: { margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" },
    subtitle: { marginTop: 6, color: "rgba(17,24,39,0.75)", fontWeight: 700 },
    pill: {
      display: "inline-flex",
      gap: 8,
      alignItems: "center",
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(0,0,0,0.10)",
      background: "#fff",
      color: "#111827",
      fontWeight: 900,
    },
    btn: {
      border: 0,
      borderRadius: 12,
      padding: "10px 14px",
      background: "#7A5A3A",
      color: "#fff",
      fontWeight: 900,
      cursor: "pointer",
      height: 42,
    },
    btnGhost: {
      borderRadius: 12,
      padding: "10px 14px",
      background: "#fff",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.35)",
      fontWeight: 900,
      cursor: "pointer",
      height: 42,
    },
    input: {
      width: "100%",
      height: 42,
      padding: "0 12px",
      borderRadius: 12,
      border: "1px solid rgba(0,0,0,0.14)",
      background: "#fff",
      color: "#111827",
      outline: "none",
    },
    grid: { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14, marginTop: 14 },
    reward: { background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" },
    img: { width: "100%", height: 160, objectFit: "cover", background: "#F3F4F6" },
    body: { padding: 12, display: "flex", flexDirection: "column", gap: 8, flex: 1 },
    title: { margin: 0, fontWeight: 900, color: "#111827", fontSize: 15 },
    desc: { margin: 0, color: "rgba(17,24,39,0.75)", fontWeight: 600, fontSize: 13 },
    foot: { marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 },
    tag: { display: "inline-flex", padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.10)", color: "rgba(17,24,39,0.75)", fontSize: 12, fontWeight: 800 },
  };

  // responsivo simples
  const isNarrow = typeof window !== "undefined" ? window.innerWidth < 900 : false;
  if (isNarrow) S.grid.gridTemplateColumns = "repeat(1,minmax(0,1fr))";

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h1 style={S.h1}>Bem-vindo, {fullName || "👋"}</h1>
              <div style={S.subtitle}>Escolha um reward para resgatar</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={S.pill}>Pontos disponíveis: {pointsAvailable}</div>
              <div style={S.pill}>Nível: {tier}</div>
              <button style={S.btnGhost} onClick={load} disabled={loading}>
                Recarregar
              </button>
            </div>
          </div>

          {error ? (
            <div style={{ marginTop: 12, background: "#FFECEC", border: "1px solid rgba(127,29,29,0.25)", color: "#7F1D1D", padding: 12, borderRadius: 10, whiteSpace: "pre-wrap" }}>
              {error}
            </div>
          ) : null}

          <div style={{ marginTop: 14, fontWeight: 900, color: "#111827" }}>Filtros</div>
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 10, marginTop: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.75)", marginBottom: 6 }}>Pontos (mín)</div>
              <input style={S.input} inputMode="numeric" value={minPts} onChange={(e) => setMinPts(e.target.value)} />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.75)", marginBottom: 6 }}>Pontos (máx)</div>
              <input style={S.input} inputMode="numeric" value={maxPts} onChange={(e) => setMaxPts(e.target.value)} />
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: "rgba(17,24,39,0.75)", marginBottom: 6 }}>Tag</div>
              <select style={S.input} value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Todas</option>
                {allTags.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button style={S.btnGhost} onClick={() => { setMinPts(""); setMaxPts(""); setTag(""); }}>
                Limpar
              </button>
            </div>
          </div>
        </div>

        <div style={S.grid}>
          {filtered.map((r) => {
            const title = t(r.title, safeLang) || r.code || "Reward";
            const desc = t(r.description, safeLang);
            const canRedeem = pointsAvailable >= (r.pointsCost || 0);

            return (
              <div key={r.id} style={S.reward}>
                {r.imageUrl ? <img src={r.imageUrl} alt={title} style={S.img} /> : <div style={S.img} />}
                <div style={S.body}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {r.category ? <span style={S.tag}>{r.category}</span> : null}
                    {(r.tags || []).slice(0, 3).map((x) => (
                      <span key={x} style={S.tag}>{x}</span>
                    ))}
                  </div>

                  <p style={S.title}>{title}</p>
                  {desc ? <p style={S.desc}>{desc}</p> : null}

                  <div style={S.foot}>
                    <div style={{ fontWeight: 900, color: "#111827" }}>{r.pointsCost} pts</div>
                    <button
                      style={{ ...S.btn, opacity: canRedeem ? 1 : 0.5, cursor: canRedeem ? "pointer" : "not-allowed" }}
                      disabled={!canRedeem}
                      onClick={() => alert("Resgate: próxima etapa (vamos implementar o fluxo de redemption)")}
                    >
                      Resgatar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {loading ? <div style={{ marginTop: 10, color: "#111827", fontWeight: 900 }}>Carregando…</div> : null}
      </div>
    </div>
  );
}