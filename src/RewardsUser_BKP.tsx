// src/RewardsUser.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { fetchUserAttributes, getCurrentUser } from "aws-amplify/auth";
import { gqlClient } from "./amplifyClient";

type Lang = "pt" | "en" | "es";
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
  userType?: string | null;
  userEmail?: string | null;
  userPhone?: string | null;
  availablePoints: number;
  redeemedPoints: number;
  updatedAt?: string | null;
};

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
  // Mesmo “entry-point” usado no admin (RewardsBalancesReport).
  // Pressuposto: resolver registra ledger + redemption (PENDING) e atualiza saldo.
  MONGO_BALANCE_SET: /* GraphQL */ `
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
  `,
};

function pickLang(x?: "PT" | "EN" | "ES" | string): Lang {
  const v = String(x || "").toLowerCase();
  if (v === "en") return "en";
  if (v === "es") return "es";
  return "pt";
}

function pickI18n(i18n: MongoI18n | null | undefined, lang: Lang) {
  if (!i18n) return "";
  return (i18n[lang] ?? i18n.pt ?? i18n.en ?? i18n.es ?? "") || "";
}

function normalizeText(s: string) {
  return (s || "").trim().toLowerCase();
}

function parseTags(txt: string) {
  return txt
    .split(",")
    .map((t) => normalizeText(t))
    .filter(Boolean);
}

function fmtPts(n: any) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return String(Math.trunc(v));
}

// Como o schema NÃO expõe levelId no balance, derivamos pelo saldo.
// (Se quiser o levelId real, precisa adicionar ao schema/resolver.)
function tierFromPoints(points: number): "SILVER" | "GOLD" | "BLACK" | "PLATINUM" | "NONE" {
  const p = Math.max(0, Number(points) || 0);
  if (p >= 1000) return "PLATINUM";
  if (p >= 500) return "BLACK";
  if (p >= 200) return "GOLD";
  if (p >= 1) return "SILVER";
  return "NONE";
}

export default function RewardsUser({ lang: langIn }: { lang?: "PT" | "EN" | "ES" }) {
  const lang = pickLang(langIn);

  const L = useMemo(() => {
    const dict = {
      pt: {
        crumbs: "Referrals • Rewards",
        search: "Buscar rewards…",
        title: "Rewards",
        subtitle: "Resgate recompensas usando seus pontos. Visual no padrão corporativo do sistema.",
        totalPoints: "Total points",
        availableRewards: "Available rewards",
        redeemed: "Redeemed",
        level: "Nível",
        points: "Pontos",
        buy: "Redeem",
        buyConfirmTitle: "Confirmar resgate",
        buyConfirmBody: "Deseja resgatar este reward?",
        cancel: "Cancelar",
        confirm: "Confirmar",
        insufficient: "Pontos insuficientes",
        loading: "Carregando…",
        empty: "Nenhum reward disponível.",
        error: "Erro ao carregar.",
        minPts: "Min pts",
        maxPts: "Max pts",
        tags: "Tags (separadas por vírgula)",
        clear: "Limpar",
        reload: "Recarregar",
      },
      en: {
        crumbs: "Referrals • Rewards",
        search: "Search rewards…",
        title: "Rewards",
        subtitle: "Redeem rewards with your points. Corporate look & feel.",
        totalPoints: "Total points",
        availableRewards: "Available rewards",
        redeemed: "Redeemed",
        level: "Level",
        points: "Points",
        buy: "Redeem",
        buyConfirmTitle: "Confirm redemption",
        buyConfirmBody: "Do you want to redeem this reward?",
        cancel: "Cancel",
        confirm: "Confirm",
        insufficient: "Not enough points",
        loading: "Loading…",
        empty: "No rewards available.",
        error: "Failed to load.",
        minPts: "Min pts",
        maxPts: "Max pts",
        tags: "Tags (comma-separated)",
        clear: "Clear",
        reload: "Reload",
      },
      es: {
        crumbs: "Referrals • Rewards",
        search: "Buscar rewards…",
        title: "Rewards",
        subtitle: "Canjea recompensas usando tus puntos. Visual corporativo.",
        totalPoints: "Total points",
        availableRewards: "Available rewards",
        redeemed: "Redeemed",
        level: "Nivel",
        points: "Puntos",
        buy: "Canjear",
        buyConfirmTitle: "Confirmar canje",
        buyConfirmBody: "¿Deseas canjear este reward?",
        cancel: "Cancelar",
        confirm: "Confirmar",
        insufficient: "Puntos insuficientes",
        loading: "Cargando…",
        empty: "No hay rewards disponibles.",
        error: "Error al cargar.",
        minPts: "Min pts",
        maxPts: "Max pts",
        tags: "Tags (separadas por coma)",
        clear: "Limpiar",
        reload: "Recargar",
      },
    } as const;
    return dict[lang];
  }, [lang]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userSub, setUserSub] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");

  const [availablePoints, setAvailablePoints] = useState<number>(0);
  const [redeemedPoints, setRedeemedPoints] = useState<number>(0);

  const [rewards, setRewards] = useState<MongoReward[]>([]);

  // header search + filters
  const [q, setQ] = useState("");
  const [minPts, setMinPts] = useState("");
  const [maxPts, setMaxPts] = useState("");
  const [tagsText, setTagsText] = useState("");

  // redeem modal
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemTarget, setRedeemTarget] = useState<MongoReward | null>(null);
  const redeemBusyRef = useRef(false);

  const tier = useMemo(() => tierFromPoints(availablePoints), [availablePoints]);
  const tagsFilter = useMemo(() => new Set(parseTags(tagsText)), [tagsText]);

  const filtered = useMemo(() => {
    const nq = normalizeText(q);
    const min = minPts.trim() === "" ? null : Number(minPts);
    const max = maxPts.trim() === "" ? null : Number(maxPts);

    return rewards.filter((r) => {
      const title = normalizeText(pickI18n(r.title, lang));
      const desc = normalizeText(pickI18n(r.description || undefined, lang));
      const code = normalizeText(r.code || "");
      const hay = `${title} ${desc} ${code}`;

      if (nq && !hay.includes(nq)) return false;

      const pts = Number(r.pointsCost) || 0;
      if (min != null && Number.isFinite(min) && pts < min) return false;
      if (max != null && Number.isFinite(max) && pts > max) return false;

      if (tagsFilter.size) {
        const rt = new Set((r.tags || []).map((t) => normalizeText(t)));
        for (const t of tagsFilter) if (!rt.has(t)) return false;
      }
      return true;
    });
  }, [rewards, q, minPts, maxPts, tagsFilter, lang]);

  async function loadAllRewards() {
    let nextToken: string | null | undefined = null;
    const all: MongoReward[] = [];

    do {
      const res: any = await gqlClient.graphql({
        query: GQL.MONGO_REWARDS_LIST,
        variables: { limit: 200, nextToken, activeOnly: true },
      });
      const chunk: MongoReward[] = res?.data?.mongoRewardsList?.items || [];
      const token: string | null | undefined = res?.data?.mongoRewardsList?.nextToken;
      all.push(...chunk.filter((r) => !!r && r.active !== false));
      nextToken = token;
    } while (nextToken);

    all.sort((a, b) => (a.pointsCost || 0) - (b.pointsCost || 0));
    setRewards(all);
  }

  async function loadBalanceForUser(sub: string, email: string | null, name: string | null) {
    // API não filtra por userId -> paginar e achar
    let nextToken: string | null | undefined = null;

    const wantSub = normalizeText(sub);
    const wantEmail = normalizeText(email || "");
    const wantName = normalizeText(name || "");

    do {
      const res: any = await gqlClient.graphql({
        query: GQL.MONGO_BALANCES_LIST,
        variables: { limit: 200, nextToken, name: null, userType: null },
      });

      const items: BalanceRow[] = res?.data?.mongoRewardsBalancesList?.items || [];
      for (const row of items) {
        const rowSub = normalizeText(row.userId || "");
        const rowEmail = normalizeText(row.userEmail || "");
        const rowName = normalizeText(row.userName || "");

        if (wantSub && rowSub === wantSub) return row;
        if (wantEmail && rowEmail === wantEmail) return row;
        if (wantName && rowName && rowName === wantName) return row;
      }

      nextToken = res?.data?.mongoRewardsBalancesList?.nextToken;
    } while (nextToken);

    return null;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentUser();
      const attrs = await fetchUserAttributes();

      const sub = (current.userId || "") as string;     // Cognito sub
      const email = (attrs.email || "") as string;
      const name = (attrs.name || attrs.given_name || attrs.family_name || "") as string;

      setUserSub(sub);
      setFullName(name);

      const [, bal] = await Promise.all([
        loadAllRewards(),
        loadBalanceForUser(sub, email || null, name || null),
      ]);

      if (bal) {
        setAvailablePoints(Number(bal.availablePoints) || 0);
        setRedeemedPoints(Number(bal.redeemedPoints) || 0);
        if (bal.userName) setFullName(bal.userName);
      } else {
        setAvailablePoints(0);
        setRedeemedPoints(0);
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || L.error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function openRedeem(r: MongoReward) {
    setRedeemTarget(r);
    setRedeemOpen(true);
  }

  async function confirmRedeem() {
    if (!redeemTarget) return;
    if (redeemBusyRef.current) return;

    const cost = Number(redeemTarget.pointsCost) || 0;
    if (availablePoints < cost) return;

    redeemBusyRef.current = true;
    try {
      const newAvail = Math.max(0, (Number(availablePoints) || 0) - cost);
      const newRedeemed = Math.max(0, (Number(redeemedPoints) || 0) + cost);

      await gqlClient.graphql({
        query: GQL.MONGO_BALANCE_SET,
        variables: {
          userId: userSub,
          availablePoints: newAvail,
          redeemedPoints: newRedeemed,
          reason: `REDEEM:${redeemTarget.code}`,
        },
      });

      setRedeemOpen(false);
      setRedeemTarget(null);

      // refresh balance
      const attrs = await fetchUserAttributes();
      const name = (attrs.name || attrs.given_name || attrs.family_name || "") as string;
      const email = (attrs.email || "") as string;

      const bal = await loadBalanceForUser(userSub, email || null, name || null);
      if (bal) {
        setAvailablePoints(Number(bal.availablePoints) || 0);
        setRedeemedPoints(Number(bal.redeemedPoints) || 0);
      } else {
        setAvailablePoints(newAvail);
        setRedeemedPoints(newRedeemed);
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message || e?.message || L.error);
    } finally {
      redeemBusyRef.current = false;
    }
  }

  const stats = useMemo(() => {
    return {
      total: availablePoints + redeemedPoints,
      availableRewards: rewards.length,
      redeemed: redeemedPoints,
    };
  }, [availablePoints, redeemedPoints, rewards.length]);

  return (
    <div className="rw-root">
      <style>{css}</style>

      {/* Topbar (protótipo) */}
      <div className="rw-topbar">
        <div className="rw-left">
          <div className="rw-crumb">{L.crumbs}</div>
          <div className="rw-search">
            <span className="rw-ico">🔎</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.search} />
          </div>
        </div>

        <div className="rw-right">
          <div className="rw-pill">
            {L.level}: <b>{tier}</b> • {L.points}: <b>{fmtPts(availablePoints)}</b>
          </div>
          <div className="rw-avatar" title={fullName || "User"} />
        </div>
      </div>

      <div className="rw-page">
        <div className="rw-header">
          <div>
            <div className="rw-h1">{L.title}</div>
            <div className="rw-sub">{L.subtitle}</div>
          </div>

          <div className="rw-actions">
            <button className="rw-btn rw-btn-ghost" onClick={loadAll} disabled={loading}>
              {L.reload}
            </button>
          </div>
        </div>

        <div className="rw-stats">
          <div className="rw-stat">
            <div className="rw-stat-label">{L.totalPoints}</div>
            <div className="rw-stat-value">{fmtPts(stats.total)}</div>
          </div>
          <div className="rw-stat">
            <div className="rw-stat-label">{L.availableRewards}</div>
            <div className="rw-stat-value">{fmtPts(stats.availableRewards)}</div>
          </div>
          <div className="rw-stat">
            <div className="rw-stat-label">{L.redeemed}</div>
            <div className="rw-stat-value">{fmtPts(stats.redeemed)}</div>
          </div>
        </div>

        <div className="rw-filters">
          <div className="rw-filters-row">
            <div className="rw-field">
              <label>{L.minPts}</label>
              <input value={minPts} onChange={(e) => setMinPts(e.target.value)} inputMode="numeric" />
            </div>
            <div className="rw-field">
              <label>{L.maxPts}</label>
              <input value={maxPts} onChange={(e) => setMaxPts(e.target.value)} inputMode="numeric" />
            </div>
            <div className="rw-field rw-field-wide">
              <label>{L.tags}</label>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
            </div>
            <button
              className="rw-btn rw-btn-ghost"
              onClick={() => {
                setMinPts("");
                setMaxPts("");
                setTagsText("");
              }}
            >
              {L.clear}
            </button>
          </div>
        </div>

        {error && <div className="rw-alert">{String(error)}</div>}
        {loading && <div className="rw-muted">{L.loading}</div>}
        {!loading && !filtered.length && !error && <div className="rw-muted">{L.empty}</div>}

        <div className="rw-grid">
          {filtered.map((r) => {
            const canRedeem = (Number(availablePoints) || 0) >= (Number(r.pointsCost) || 0);
            const title = pickI18n(r.title, lang) || r.code;
            const desc = pickI18n(r.description || undefined, lang);

            return (
              <div key={r.id} className="rw-card">
                <div className="rw-imgwrap">
                  <img
                    className="rw-img"
                    src={r.imageUrl || ""}
                    alt={title}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <div className="rw-badge">
                    <span className="rw-coin" /> {fmtPts(r.pointsCost)} pts
                  </div>
                </div>

                <div className="rw-card-body">
                  <div className="rw-card-title">{title}</div>
                  {desc ? <div className="rw-card-desc">{desc}</div> : null}

                  <div className="rw-chips">
                    {r.category ? <span className="rw-chip">{r.category}</span> : null}
                    {r.deliveryType ? <span className="rw-chip">{r.deliveryType}</span> : null}
                    {(r.tags || []).slice(0, 3).map((t) => (
                      <span key={t} className="rw-chip">
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="rw-card-footer">
                    <button
                      className={`rw-btn rw-btn-primary ${!canRedeem ? "rw-btn-disabled" : ""}`}
                      disabled={!canRedeem}
                      onClick={() => openRedeem(r)}
                    >
                      {canRedeem ? L.buy : L.insufficient}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm modal */}
      {redeemOpen && redeemTarget ? (
        <div className="rw-modal-backdrop" role="dialog" aria-modal="true">
          <div className="rw-modal">
            <div className="rw-modal-title">{L.buyConfirmTitle}</div>
            <div className="rw-modal-body">
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                {pickI18n(redeemTarget.title, lang) || redeemTarget.code}
              </div>
              <div style={{ opacity: 0.85, marginBottom: 10 }}>{L.buyConfirmBody}</div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="rw-btn rw-btn-ghost" onClick={() => setRedeemOpen(false)}>
                  {L.cancel}
                </button>
                <button className="rw-btn rw-btn-primary" onClick={confirmRedeem}>
                  {L.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const css = `
  :root{
    --bg:#f6f7f9;
    --panel:#ffffff;
    --text:#0f172a;
    --muted:#64748b;
    --border:#e2e8f0;
    --shadow:0 1px 2px rgba(15,23,42,.06);
    --brand:#0f172a;
    --brandHover:#111c33;
    --chip:#f1f5f9;
    --radius:12px;
  }

  .rw-root{background:var(--bg); color:var(--text); min-height: calc(100vh - 58px);}
  .rw-topbar{
    height:58px;
    background:var(--panel);
    border-bottom:1px solid var(--border);
    display:flex;
    align-items:center;
    justify-content:space-between;
    padding:0 18px;
    position: sticky;
    top: 0;
    z-index: 9;
  }
  .rw-left{display:flex; align-items:center; gap:12px; min-width:0;}
  .rw-crumb{font-size:13px; color:var(--muted); white-space:nowrap;}
  .rw-search{
    display:flex; align-items:center; gap:10px;
    background:var(--panel);
    border:1px solid var(--border);
    border-radius:12px;
    padding:8px 10px;
    width:min(520px,55vw);
  }
  .rw-ico{font-size:14px; opacity:.8}
  .rw-search input{
    border:none; outline:none; width:100%;
    font-size:13px; background:transparent; color:var(--text);
  }
  .rw-right{display:flex; align-items:center; gap:12px;}
  .rw-pill{
    border:1px solid var(--border);
    background:#fff;
    padding:8px 12px;
    border-radius:999px;
    font-size:13px;
    color:var(--text);
    white-space:nowrap;
  }
  .rw-avatar{width:34px; height:34px; border-radius:999px; background:linear-gradient(135deg,#cbd5e1,#94a3b8);}
  .rw-page{max-width:1200px; margin:0 auto; padding:18px;}
  .rw-header{display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-top:6px; flex-wrap:wrap;}
  .rw-h1{font-size:28px; font-weight:800; letter-spacing:-.02em;}
  .rw-sub{margin-top:4px; color:var(--muted);}
  .rw-actions{display:flex; gap:10px; align-items:center;}
  .rw-stats{display:grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap:12px; margin:14px 0 16px;}
  .rw-stat{background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:12px; box-shadow:var(--shadow);}
  .rw-stat-label{font-size:12px; color:var(--muted); margin-bottom:6px;}
  .rw-stat-value{font-size:24px; font-weight:900; color:var(--text);}
  .rw-filters{background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); padding:12px; box-shadow:var(--shadow); margin-bottom:14px;}
  .rw-filters-row{display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap;}
  .rw-field{display:flex; flex-direction:column; gap:6px;}
  .rw-field-wide{min-width:260px; flex:1;}
  .rw-field label{font-size:12px; color:var(--muted); font-weight:700;}
  .rw-field input{
    height:38px; border-radius:12px; border:1px solid var(--border);
    padding:0 12px; font-size:13px; outline:none; background:#fff; color:var(--text);
  }
  .rw-btn{
    height:40px; border-radius:12px; padding:0 14px; font-weight:800;
    border:1px solid transparent; cursor:pointer; white-space:nowrap;
  }
  .rw-btn-primary{background:var(--brand); color:#fff;}
  .rw-btn-primary:hover{background:var(--brandHover);}
  .rw-btn-ghost{background:#fff; border:1px solid var(--border); color:var(--text);}
  .rw-btn-disabled{opacity:.55; cursor:not-allowed;}
  .rw-alert{
    background:#fff; border:1px solid rgba(239,68,68,.35); color:#991b1b;
    padding:10px 12px; border-radius:12px; margin-bottom:12px;
  }
  .rw-muted{color:var(--muted); padding:10px 2px;}
  .rw-grid{display:grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap:14px; padding-bottom:26px;}
  @media (max-width: 1050px){ .rw-grid{grid-template-columns: repeat(3, minmax(0,1fr));} }
  @media (max-width: 780px){
    .rw-grid{grid-template-columns: repeat(2, minmax(0,1fr));}
    .rw-stats{grid-template-columns:1fr;}
    .rw-search{width: min(420px, 55vw);}
  }
  @media (max-width: 520px){
    .rw-grid{grid-template-columns: 1fr;}
    .rw-search{display:none;}
  }

  .rw-card{background:var(--panel); border:1px solid var(--border); border-radius:var(--radius); box-shadow:var(--shadow); overflow:hidden; display:flex; flex-direction:column;}
  .rw-imgwrap{position:relative; height:140px; background:#0b1220;}
  .rw-img{width:100%; height:100%; object-fit:cover; display:block;}
  .rw-badge{
    position:absolute; top:10px; right:10px;
    background:rgba(255,255,255,.9);
    border:1px solid rgba(15,23,42,.12);
    border-radius:999px;
    padding:6px 10px;
    font-size:12px;
    font-weight:900;
    color:var(--text);
    display:inline-flex;
    align-items:center;
    gap:8px;
  }
  .rw-coin{width:10px;height:10px;border-radius:999px;background:#facc15; box-shadow:0 0 0 2px rgba(250,204,21,.25);}
  .rw-card-body{padding:12px; display:flex; flex-direction:column; gap:8px; flex:1;}
  .rw-card-title{font-size:16px; font-weight:900; color:var(--text);}
  .rw-card-desc{font-size:13px; color:var(--muted); line-height:1.35; min-height: 34px;}
  .rw-chips{display:flex; gap:8px; flex-wrap:wrap; margin-top:2px;}
  .rw-chip{
    background:var(--chip);
    border:1px solid rgba(15,23,42,.08);
    padding:6px 10px;
    border-radius:999px;
    font-size:12px;
    color:var(--text);
  }
  .rw-card-footer{margin-top:auto;}

  .rw-modal-backdrop{
    position:fixed; inset:0; background:rgba(15,23,42,.45);
    display:flex; align-items:center; justify-content:center; padding:16px;
    z-index: 99;
  }
  .rw-modal{
    width:min(520px, 95vw);
    background:#fff;
    border:1px solid rgba(15,23,42,.10);
    border-radius:16px;
    box-shadow:0 8px 30px rgba(0,0,0,.18);
    padding:14px;
  }
  .rw-modal-title{font-weight:900; font-size:16px; margin-bottom:8px; color:var(--text);}
  .rw-modal-body{color:var(--text); font-size:13px;}
`;