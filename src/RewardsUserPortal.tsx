import React, { useEffect, useMemo, useState } from "react";
import { generateClient } from "aws-amplify/api";
import { getCurrentUser, fetchUserAttributes, fetchAuthSession } from "aws-amplify/auth";



type Tier = "SILVER" | "GOLD" | "BLACK" | "PLATINUM" | "NONE";

type Reward = {
  id: string;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  pointsCost: number;
  active: boolean;
  deliveryType?: "EMAIL" | "LOCAL" | "OTHER" | null;
  category?: string | null;
};

type MyProfile = {
  userId: string;
  name: string;
  email?: string;
  points: number;
  tier: Tier;
};

const client = generateClient();

/**
 * ✅ TROQUE os nomes dessas operations para os do teu schema
 * - query GetMyProfile
 * - query ListRewards
 * - mutation CreateRedemption
 */
const gql = {
  getMyProfile: /* GraphQL */ `
    query GetMyProfile {
      getMyProfile {
        userId
        name
        email
        points
        tier
      }
    }
  `,
  listRewards: /* GraphQL */ `
    query ListRewards($active: Boolean) {
      listRewards(active: $active) {
        id
        code
        title
        description
        imageUrl
        pointsCost
        active
        deliveryType
        category
      }
    }
  `,
  createRedemption: /* GraphQL */ `
    mutation CreateRedemption($rewardId: ID!) {
      createRedemption(rewardId: $rewardId) {
        id
        status
        pointsCost
        createdAt
      }
    }
  `,
};


function tierLabel(t: Tier) {
  switch (t) {
    case "SILVER":
      return "Silver";
    case "GOLD":
      return "Gold";
    case "BLACK":
      return "Black";
    case "PLATINUM":
      return "Platinum";
    default:
      return "Member";
  }
}

function tierStyle(t: Tier): React.CSSProperties {
  // Mantive “Martins style”: neutro/chique, sem cores gritantes
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e7e3da",
    background: "#faf9f6",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.3,
  };

  if (t === "BLACK") return { ...base, background: "#111", color: "#fff", border: "1px solid #111" };
  if (t === "GOLD") return { ...base, background: "#f7f0dc", border: "1px solid #eadfbf" };
  if (t === "SILVER") return { ...base, background: "#f3f3f3", border: "1px solid #e5e5e5" };
  if (t === "PLATINUM") return { ...base, background: "#f3f1ff", border: "1px solid #e6e1ff" };
  return base;
}

export default function RewardsUserPortal() {
  useEffect(() => {
    async function checkAccess() {
      const session = await fetchAuthSession();
      const groups =
        session.tokens?.idToken?.payload["cognito:groups"] as string[] | undefined;

      if (!groups?.includes("investor")) {
        window.location.href = "/"; // ou "/403"
      }
    }
    checkAccess();
  }, []);

  const [loading, setLoading] = useState(true);
  const [busyRedeem, setBusyRedeem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Reward | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rewards.filter((r) => r.active);
    return rewards
      .filter((r) => r.active)
      .filter((r) => {
        const hay = `${r.title ?? ""} ${r.description ?? ""} ${r.category ?? ""} ${r.code ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
  }, [rewards, query]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // 1) Cognito user basic info (pra mostrar "Bem-vindo")
      const user = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      const fallbackName =
        attrs.name || attrs.given_name || attrs.family_name || user.username;

      // 2) Profile (pontos + tier) via AppSync
      //    ✅ Ajuste o shape conforme teu schema
      const profRes: any = await client.graphql({ query: gql.getMyProfile });
      const p = profRes?.data?.getMyProfile;

      const myProfile: MyProfile = {
        userId: p?.userId ?? user.userId,
        name: p?.name ?? fallbackName ?? "Cliente",
        email: p?.email ?? attrs.email,
        points: Number(p?.points ?? 0),
        tier: (p?.tier ?? "NONE") as Tier,
      };
      setProfile(myProfile);

      // 3) Rewards catalog
      const rewardsRes: any = await client.graphql({
        query: gql.listRewards,
        variables: { active: true },
      });

      const list: Reward[] = rewardsRes?.data?.listRewards ?? [];
      setRewards(list);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar dados do portal.");
    } finally {
      setLoading(false);
    }
  }

  async function redeem(reward: Reward) {
    if (!profile) return;
    if (profile.points < reward.pointsCost) {
      setError("Você não tem pontos suficientes para resgatar este reward.");
      return;
    }

    setBusyRedeem(true);
    setError(null);

    try {
      // ✅ Ajuste mutation conforme teu schema
      await client.graphql({
        query: gql.createRedemption,
        variables: { rewardId: reward.id },
      });

      // Atualiza UI (otimista)
      setProfile({ ...profile, points: profile.points - reward.pointsCost });
      setSelected(null);
    } catch (e: any) {
      setError(e?.message || "Erro ao resgatar reward.");
    } finally {
      setBusyRedeem(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const points = profile?.points ?? 0;

  return (
    <div style={S.page}>
      {/* Top bar (padrão claro Martins) */}
      <div style={S.topbar}>
        <div style={S.brandRow}>
          <div style={S.brandMark}>MARTINS</div>
          <div style={S.brandSub}>Rewards</div>
        </div>

        <div style={S.topRight}>
          {profile ? (
            <>
              <div style={S.welcome}>
                Bem-vindo, <b>{profile.name}</b>
              </div>
              <div style={tierStyle(profile.tier)}>{tierLabel(profile.tier)}</div>
            </>
          ) : null}
        </div>
      </div>

      <div style={S.container}>
        {/* Summary cards */}
        <div style={S.summaryGrid}>
          <div style={S.summaryCard}>
            <div style={S.summaryTitle}>Pontos disponíveis</div>
            <div style={S.summaryValue}>{loading ? "—" : points.toLocaleString()}</div>
            <div style={S.summaryHint}>Use seus pontos para resgatar rewards.</div>
          </div>

          <div style={S.summaryCard}>
            <div style={S.summaryTitle}>Seu nível</div>
            <div style={S.summaryValueSm}>{loading ? "—" : tierLabel(profile?.tier ?? "NONE")}</div>
            <div style={S.summaryHint}>Quanto mais pontos, maior o nível.</div>
          </div>

          <div style={S.summaryCard}>
            <div style={S.summaryTitle}>Catálogo</div>
            <div style={S.summaryValueSm}>{loading ? "—" : filtered.length}</div>
            <div style={S.summaryHint}>Rewards ativos disponíveis.</div>
          </div>
        </div>

        {/* Search */}
        <div style={S.searchRow}>
          <input
            style={S.input}
            placeholder="Buscar reward (ex: gift card, viagem, cinema...)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <button style={S.btnGhost} onClick={() => load()} disabled={loading}>
            {loading ? "Carregando..." : "Atualizar"}
          </button>
        </div>

        {error ? <div style={S.error}>{error}</div> : null}

        {/* Rewards grid */}
        {loading ? (
          <div style={S.loadingBox}>Carregando catálogo...</div>
        ) : filtered.length === 0 ? (
          <div style={S.loadingBox}>Nenhum reward encontrado.</div>
        ) : (
          <div style={S.grid}>
            {filtered.map((r) => {
              const canRedeem = points >= r.pointsCost;

              return (
                <div key={r.id} style={S.card}>
                  <div style={S.cardImgWrap}>
                    {r.imageUrl ? (
                      <img src={r.imageUrl} alt={r.title ?? r.code ?? "Reward"} style={S.cardImg} />
                    ) : (
                      <div style={S.noImg}>Sem imagem</div>
                    )}
                  </div>

                  <div style={S.cardBody}>
                    <div style={S.cardTitle}>{r.title ?? r.code ?? "Reward"}</div>
                    {r.description ? <div style={S.cardDesc}>{r.description}</div> : null}

                    <div style={S.badges}>
                      <span style={S.badge}>{r.pointsCost} pts</span>
                      {r.deliveryType ? <span style={S.badge}>{r.deliveryType}</span> : null}
                      {r.category ? <span style={S.badge}>{r.category}</span> : null}
                    </div>

                    <button
                      style={{
                        ...S.btnPrimary,
                        ...(canRedeem ? null : S.btnDisabled),
                      }}
                      disabled={!canRedeem}
                      onClick={() => setSelected(r)}
                    >
                      {canRedeem ? "Resgatar" : "Pontos insuficientes"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmação */}
      {selected ? (
        <div style={S.modalOverlay} onClick={() => setSelected(null)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>Confirmar resgate</div>
            <div style={S.modalText}>
              Você deseja resgatar <b>{selected.title ?? selected.code ?? "este reward"}</b> por{" "}
              <b>{selected.pointsCost} pontos</b>?
            </div>

            <div style={S.modalRow}>
              <button style={S.btnGhost} onClick={() => setSelected(null)} disabled={busyRedeem}>
                Cancelar
              </button>
              <button style={S.btnPrimary} onClick={() => redeem(selected)} disabled={busyRedeem}>
                {busyRedeem ? "Resgatando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#fbfaf7", color: "#1f1f1f" },

  topbar: {
    height: 64,
    background: "#ffffff",
    borderBottom: "1px solid #eee9df",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    position: "sticky",
    top: 0,
    zIndex: 5,
  },

  brandRow: { display: "flex", alignItems: "baseline", gap: 10 },
  brandMark: { fontWeight: 900, letterSpacing: 2, fontSize: 18 },
  brandSub: { fontSize: 12, color: "#6b6b6b", fontWeight: 600 },

  topRight: { display: "flex", alignItems: "center", gap: 12 },
  welcome: { fontSize: 13, color: "#2d2d2d" },

  container: { maxWidth: 1120, margin: "0 auto", padding: "18px 16px 40px" },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  summaryCard: {
    background: "#fff",
    border: "1px solid #eee9df",
    borderRadius: 16,
    padding: 14,
    boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
  },
  summaryTitle: { fontSize: 12, color: "#6b6b6b", fontWeight: 700 },
  summaryValue: { fontSize: 28, fontWeight: 900, marginTop: 6 },
  summaryValueSm: { fontSize: 18, fontWeight: 900, marginTop: 6 },
  summaryHint: { marginTop: 6, fontSize: 12, color: "#7a7a7a" },

  searchRow: { display: "flex", gap: 10, alignItems: "center", marginBottom: 12 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    border: "1px solid #e9e2d6",
    background: "#fff",
    padding: "0 14px",
    outline: "none",
    fontSize: 14,
  },

  error: {
    background: "#fff2f2",
    border: "1px solid #ffd1d1",
    color: "#8a1f1f",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 13,
  },

  loadingBox: {
    background: "#fff",
    border: "1px solid #eee9df",
    borderRadius: 16,
    padding: 18,
    color: "#6b6b6b",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },

  card: {
    background: "#fff",
    border: "1px solid #eee9df",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 10px 22px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    minHeight: 330,
  },

  cardImgWrap: { height: 140, background: "#f2efe8", display: "flex", alignItems: "center", justifyContent: "center" },
  cardImg: { width: "100%", height: "100%", objectFit: "cover" },
  noImg: { color: "#8c8c8c", fontWeight: 700 },

  cardBody: { padding: 14, display: "flex", flexDirection: "column", gap: 10, flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: 900, lineHeight: 1.2 },
  cardDesc: { fontSize: 13, color: "#5e5e5e", lineHeight: 1.35 },

  badges: { display: "flex", flexWrap: "wrap", gap: 8 },
  badge: {
    fontSize: 12,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #eee9df",
    background: "#faf9f6",
    fontWeight: 700,
    color: "#2e2e2e",
  },

  btnPrimary: {
    height: 42,
    borderRadius: 12,
    border: "1px solid #7d6a4b",
    background: "#7d6a4b",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  btnGhost: {
    height: 44,
    borderRadius: 12,
    border: "1px solid #e9e2d6",
    background: "#fff",
    color: "#2e2e2e",
    fontWeight: 800,
    padding: "0 14px",
    cursor: "pointer",
  },

  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    zIndex: 50,
  },
  modal: {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    borderRadius: 18,
    border: "1px solid #eee9df",
    padding: 16,
    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
  },
  modalTitle: { fontSize: 16, fontWeight: 900, marginBottom: 8 },
  modalText: { fontSize: 13, color: "#4e4e4e", lineHeight: 1.4 },
  modalRow: { display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 },
};

/**
 * Responsivo (sem depender de CSS global):
 * - Se quiser, eu adapto pro seu layout existente (sidebar/menu) do Admin
 * - Aqui já fica bom em smartphone (2 colunas / 1 coluna) se você colocar CSS global,
 *   mas se preferir 100% inline, eu te mando a versão com media queries via CSS file.
 */