// src/RewardsUser.tsx
import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./lib/amplifyClient";
import { fetchUserAttributes } from "aws-amplify/auth";

/**
 * Portal do usuário (grupo Cognito: Investor)
 * - Layout baseado no protótipo HTML
 * - Mesma lógica do Admin para saldo: mongoRewardsBalancesList e filtra por email
 * - Redeem: mongoRewardsBalanceSet usando o userId REAL do Mongo (evita criar “novo id”)
 */

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
  userEmail?: string | null;
  userName?: string | null;
  userType?: string | null;
  availablePoints: number;
  redeemedPoints: number;
  levelId?: string | null;
  updatedAt?: string | null;
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
        userEmail
        userType
        availablePoints
        redeemedPoints
        levelId
        updatedAt
      }
      nextToken
    }
  }
`;

const BALANCE_SET = /* GraphQL */ `
  mutation MongoRewardsBalanceSet($userId: ID!, $availablePoints: Int, $redeemedPoints: Int, $reason: String) {
    mongoRewardsBalanceSet(userId: $userId, availablePoints: $availablePoints, redeemedPoints: $redeemedPoints, reason: $reason) {
      ok
      message
      userId
      availablePoints
      redeemedPoints
      totalPoints
      updatedAt
    }
  }
`;

function i18n(lang: Lang) {
  const isPT = lang === "PT";
  const isEN = lang === "EN";
  const isES = lang === "ES";
  return {
    breadcrumbs: isEN ? "Referrals • Rewards" : isES ? "Referidos • Recompensas" : "Referrals • Rewards",
    search: isEN ? "Search rewards..." : isES ? "Buscar recompensas..." : "Buscar rewards...",
    rewardsTitle: isEN ? "Rewards" : isES ? "Recompensas" : "Rewards",
    rewardsSubtitle: isEN
      ? "Redeem rewards using your points. Corporate UI standard."
      : isES
        ? "Canjea recompensas usando tus puntos. Estándar corporativo."
        : "Resgate recompensas usando seus pontos. Visual no padrão corporativo do sistema.",
    reload: isEN ? "Reload" : isES ? "Recargar" : "Recarregar",

    // cards (4 itens)
    totalPoints: isEN ? "Total points" : isES ? "Puntos totales" : "Total pontos conquistados",
    availablePoints: isEN ? "Available points" : isES ? "Puntos disponibles" : "Pontos disponíveis",
    availableRewards: isEN ? "Available rewards" : isES ? "Recompensas disponíveis" : "Rewards disponíveis",
    redeemed: isEN ? "Redeemed" : isES ? "Canjeados" : "Resgatados",

    redeem: isEN ? "Redeem" : isES ? "Canjear" : "Resgatar",
    insufficient: isEN ? "Not enough points" : isES ? "Puntos insuficientes" : "Pontos insuficientes",
    confirmTitle: isEN ? "Confirm redeem?" : isES ? "¿Confirmar canje?" : "Confirmar resgate?",
    confirmBody: (title: string, pts: number) =>
      isEN
        ? `Redeem "${title}" for ${pts} points? It will go to approval (PENDING).`
        : isES
          ? `¿Canjear "${title}" por ${pts} puntos? Irá a aprobación (PENDING).`
          : `Resgatar "${title}" por ${pts} pontos? Vai para aprovação (PENDING).`,
    level: isEN ? "Level" : isES ? "Nivel" : "Nível",
  };
}

function pickI18nValue(v: MongoI18n | null | undefined, lang: Lang): string {
  if (!v) return "";
  if (lang === "PT") return (v.pt ?? v.en ?? v.es ?? "").toString();
  if (lang === "ES") return (v.es ?? v.en ?? v.pt ?? "").toString();
  return (v.en ?? v.pt ?? v.es ?? "").toString();
}

export default function RewardsUser({ lang }: { lang: Lang }) {
  const t = useMemo(() => i18n(lang), [lang]);

  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // balance
  const [balanceUserId, setBalanceUserId] = useState<string>("");
  const [levelId, setLevelId] = useState<string>("NONE");
  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  // rewards
  const [rewards, setRewards] = useState<MongoReward[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);

  // search (apenas search no header)
  const [q, setQ] = useState("");

  const totalPoints = useMemo(
    () => (availablePoints || 0) + (redeemedPoints || 0),
    [availablePoints, redeemedPoints]
  );

  async function loadUserAndBalance() {
    const attrs = await fetchUserAttributes();
    const mail = (attrs.email || "").toLowerCase().trim();

    // MESMA lógica do Admin: lista e filtra localmente
    const res: any = await gqlClient.graphql({
      query: LIST_BALANCES,
      variables: { limit: 2000, nextToken: null, name: null, userType: null },
    });

    const items: BalanceRow[] = res?.data?.mongoRewardsBalancesList?.items || [];
    const row = items.find((r) => (r.userEmail || "").toLowerCase().trim() === mail) || null;

    if (!row) {
      // Não cria nada automaticamente (evita userId “novo”)
      setBalanceUserId("");
      setLevelId("NONE");
      setAvailablePoints(0);
      setRedeemedPoints(0);
      return;
    }

    setBalanceUserId(row.userId);
    setLevelId((row.levelId || "NONE").toString());
    setAvailablePoints(Number(row.availablePoints || 0));
    setRedeemedPoints(Number(row.redeemedPoints || 0));
  }

  async function loadRewards(reset = false) {
    const tok = reset ? null : nextToken;
    const res: any = await gqlClient.graphql({
      query: LIST_REWARDS,
      variables: { limit: 200, nextToken: tok, activeOnly: true },
    });

    const items: MongoReward[] = res?.data?.mongoRewardsList?.items || [];
    const nt = res?.data?.mongoRewardsList?.nextToken || null;

    setNextToken(nt);
    setRewards((prev) => (reset ? items : [...prev, ...items]));
  }

  async function reloadAll() {
    setError(null);
    setLoading(true);
    try {
      await loadUserAndBalance();
      setRewards([]);
      setNextToken(null);
      await loadRewards(true);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar");
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
    if (!query) return rewards;

    return rewards.filter((r) => {
      const title = pickI18nValue(r.title, lang).toLowerCase();
      const desc = pickI18nValue(r.description || null, lang).toLowerCase();
      const code = (r.code || "").toLowerCase();
      const cat = (r.category || "").toLowerCase();
      const tags = (r.tags || []).map((x) => String(x).toLowerCase());

      return (
        title.includes(query) ||
        desc.includes(query) ||
        code.includes(query) ||
        cat.includes(query) ||
        tags.some((x) => x.includes(query))
      );
    });
  }, [rewards, q, lang]);

  async function redeemReward(r: MongoReward) {
    if (!balanceUserId) {
      setError("Saldo do usuário não encontrado (verifique se existe no rewards_points_balance).");
      return;
    }
    if (availablePoints < r.pointsCost) return;

    const title = pickI18nValue(r.title, lang) || r.code;
    const ok = window.confirm(`${t.confirmTitle}\n\n${t.confirmBody(title, r.pointsCost)}`);
    if (!ok) return;

    setSavingId(r.id);
    setError(null);

    try {
      // IMPORTANTÍSSIMO: usa o userId REAL do Mongo (do balance), não sub/email
      const newAvailable = Math.max(0, Number(availablePoints) - Number(r.pointsCost));
      const newRedeemed = Number(redeemedPoints) + Number(r.pointsCost);

      await gqlClient.graphql({
        query: BALANCE_SET,
        variables: {
          userId: balanceUserId,
          availablePoints: newAvailable,
          redeemedPoints: newRedeemed,
          // backend deve gerar redemption+ledger em PENDING (fluxo do admin)
          reason: `REDEEM:${r.code}:${r.pointsCost}`,
        },
      });

      // Atualiza UI
      setAvailablePoints(newAvailable);
      setRedeemedPoints(newRedeemed);
    } catch (e: any) {
      setError(e?.message || "Falha ao resgatar");
    } finally {
      setSavingId(null);
    }
  }

  // ===== Styles (mantém padrão do protótipo) =====
  const page: React.CSSProperties = { minHeight: "100vh", background: "#f6f7f9" };
  const header: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "#fff",
    borderBottom: "1px solid rgba(0,0,0,.06)",
  };
  const headerInner: React.CSSProperties = {
    maxWidth: 1300,
    margin: "0 auto",
    padding: "18px 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  };
  const brand: React.CSSProperties = { fontWeight: 900, fontSize: 18, color: "#111827" };
  const levelPill: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,.12)",
    borderRadius: 999,
    padding: "8px 14px",
    background: "#fff",
    fontWeight: 800,
    color: "#111827",
  };

  const main: React.CSSProperties = { maxWidth: 1300, margin: "0 auto", padding: "18px 18px 42px" };
  const breadcrumbs: React.CSSProperties = { color: "#6b7280", fontSize: 13, marginBottom: 8 };

  const topRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" };
  const searchWrap: React.CSSProperties = { flex: 1, minWidth: 280 };
  const search: React.CSSProperties = {
    width: "100%",
    height: 44,
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,.12)",
    padding: "0 14px",
    outline: "none",
    fontSize: 14,
    color: "#111827",
    background: "#fff",
  };

  const title: React.CSSProperties = { fontSize: 40, fontWeight: 900, margin: "14px 0 6px", color: "#111827" };
  const subtitle: React.CSSProperties = { color: "#64748b", fontSize: 16, marginBottom: 18 };

  const statsRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 };
  const statCard: React.CSSProperties = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,.08)",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 1px 2px rgba(0,0,0,.06)",
  };
  const statLabel: React.CSSProperties = { fontSize: 13, color: "#64748b", marginBottom: 6, fontWeight: 700 };
  const statValue: React.CSSProperties = { fontSize: 34, color: "#0f172a", fontWeight: 900 };

  const actionsRow: React.CSSProperties = { display: "flex", justifyContent: "flex-end", marginBottom: 8 };
  const reloadBtn: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,.12)",
    background: "#fff",
    borderRadius: 14,
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    color: "#111827",
  };

  const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginTop: 10 };

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,.08)",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 1px 2px rgba(0,0,0,.06)",
    display: "flex",
    flexDirection: "column",
    minHeight: 380,
  };

  const hero: React.CSSProperties = { height: 150, background: "#0b1220", position: "relative", overflow: "hidden" };
  const heroImg: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
  const ptsBadge: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: 12,
    background: "rgba(255,255,255,.95)",
    border: "1px solid rgba(0,0,0,.10)",
    borderRadius: 999,
    padding: "6px 10px",
    fontWeight: 900,
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const dot: React.CSSProperties = { width: 10, height: 10, borderRadius: 999, background: "#fbbf24" };

  const body: React.CSSProperties = { padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 };
  const cardTitle: React.CSSProperties = { fontWeight: 900, fontSize: 18, color: "#0f172a" };
  const cardDesc: React.CSSProperties = { color: "#64748b", fontSize: 14, lineHeight: 1.35, minHeight: 42 };

  const chips: React.CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap" };
  const chip: React.CSSProperties = {
    border: "1px solid rgba(0,0,0,.10)",
    background: "#f1f5f9",
    color: "#0f172a",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 13,
    fontWeight: 800,
  };

  const cardFooter: React.CSSProperties = { padding: 14, display: "flex", gap: 10, alignItems: "center" };
  const primaryBtn: React.CSSProperties = {
    flex: 1,
    border: 0,
    background: "#0b1220",
    color: "#fff",
    borderRadius: 14,
    padding: "12px 14px",
    fontWeight: 900,
    cursor: "pointer",
  };
  const disabledBtn: React.CSSProperties = { ...primaryBtn, background: "#cfc7b7", cursor: "not-allowed", color: "#fff" };

  const statusLine: React.CSSProperties = { marginTop: 10, color: "#ef4444", fontWeight: 800 };

  return (
    <div style={page}>
      {/* Header: mantém layout, pill apenas com o nível */}
      <div style={header}>
        <div style={headerInner}>
          <div style={brand}>Martins Development</div>

          <div style={levelPill}>
            {t.level}: <b>{(levelId || "NONE").toString().toUpperCase()}</b>
          </div>
        </div>
      </div>

      <div style={main}>
        <div style={topRow}>
          <div style={searchWrap}>
            <div style={breadcrumbs}>{t.breadcrumbs}</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              style={search}
              aria-label={t.search}
            />
          </div>

          {/* apenas para manter o “look” de idioma no topo (controle real fica no App.tsx) */}
          <div style={{ height: 36, padding: "0 10px", display: "flex", alignItems: "center", fontWeight: 900, color: "#64748b" }}>
            {lang}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={title}>{t.rewardsTitle}</div>
            <div style={subtitle}>{t.rewardsSubtitle}</div>
          </div>

          <div style={actionsRow}>
            <button onClick={reloadAll} style={reloadBtn} disabled={loading || !!savingId}>
              {t.reload}
            </button>
          </div>
        </div>

        {/* 4 cards conforme solicitado */}
        <div style={statsRow}>
          <div style={statCard}>
            <div style={statLabel}>{t.totalPoints}</div>
            <div style={statValue}>{Number.isFinite(totalPoints) ? totalPoints : 0}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>{t.availablePoints}</div>
            <div style={statValue}>{Number.isFinite(availablePoints) ? availablePoints : 0}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>{t.redeemed}</div>
            <div style={statValue}>{Number.isFinite(redeemedPoints) ? redeemedPoints : 0}</div>
          </div>

          <div style={statCard}>
            <div style={statLabel}>{t.availableRewards}</div>
            <div style={statValue}>{filtered.length}</div>
          </div>
        </div>

        {error && <div style={statusLine}>{error}</div>}

        {loading ? (
          <div style={{ color: "#64748b", fontWeight: 800, marginTop: 12 }}>Loading…</div>
        ) : (
          <div style={grid}>
            {filtered.map((r) => {
              const titleText = pickI18nValue(r.title, lang) || r.code;
              const descText = pickI18nValue(r.description || null, lang) || "";
              const canRedeem = availablePoints >= r.pointsCost && !!balanceUserId;
              const isBusy = savingId === r.id;

              return (
                <div key={r.id} style={card}>
                  <div style={hero}>
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={titleText} style={heroImg} />
                    ) : (
                      <div style={{ ...hero, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,.65)", fontWeight: 900 }}>
                        NO IMAGE
                      </div>
                    )}

                    <div style={ptsBadge}>
                      <span style={dot} />
                      <span>{r.pointsCost} pts</span>
                    </div>
                  </div>

                  <div style={body}>
                    <div style={cardTitle}>{titleText}</div>
                    <div style={cardDesc}>{descText}</div>

                    <div style={chips}>
                      {r.category ? <span style={chip}>{r.category}</span> : null}
                      {r.deliveryType ? <span style={chip}>{r.deliveryType}</span> : null}
                      {(r.tags || []).slice(0, 4).map((tg) => (
                        <span key={tg} style={chip}>
                          {tg}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={cardFooter}>
                    <button
                      style={canRedeem ? primaryBtn : disabledBtn}
                      onClick={() => redeemReward(r)}
                      disabled={!canRedeem || isBusy || loading}
                      aria-busy={isBusy}
                    >
                      {isBusy ? "…" : canRedeem ? t.redeem : t.insufficient}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* se quiser “load more” no futuro, já tem nextToken */}
        {!loading && nextToken ? (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button style={reloadBtn} onClick={() => loadRewards(false)} disabled={!!savingId}>
              Load more
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}