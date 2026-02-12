import React, { useEffect, useMemo, useState } from "react";
import { gqlClient } from "./amplifyClient"; // ajuste o caminho
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";

type Lang = "PT" | "EN" | "ES";

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
  tags?: string[] | null;
};

type Props = {
  lang: Lang;
};

// ✅ ajuste aqui se o seu schema tiver outro nome
const LIST_REWARDS = /* GraphQL */ `
  query ListRewards {
    listRewards {
      items {
        id
        code
        title
        description
        imageUrl
        pointsCost
        active
        deliveryType
        category
        tags
      }
    }
  }
`;

// ====== UI helpers ======
const page: React.CSSProperties = {
  background: "#F6F7F9",
  minHeight: "100vh",
};

const container: React.CSSProperties = {
  maxWidth: 1200,
  margin: "0 auto",
  padding: 14,
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 14,
};

const row: React.CSSProperties = { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" };

const input: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.14)",
  padding: "0 10px",
  outline: "none",
  background: "#fff",
  minWidth: 120,
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 999,
  background: "rgba(0,0,0,0.05)",
  fontSize: 12,
  fontWeight: 800,
  color: "#111827",
};

const okPill: React.CSSProperties = {
  ...pill,
  background: "rgba(34,197,94,0.16)",
  color: "#0F5132",
};

const redeemBtn: React.CSSProperties = {
  height: 40,
  borderRadius: 999,
  border: 0,
  padding: "0 14px",
  cursor: "pointer",
  fontWeight: 900,
  background: "#6b5a2b",
  color: "#fff",
  width: "100%",
};

const redeemBtnDisabled: React.CSSProperties = {
  ...redeemBtn,
  background: "rgba(107,90,43,0.35)",
  cursor: "not-allowed",
};

function splitTags(v?: string[] | null): string[] {
  return (v || [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
}

function parseTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function fmtDelivery(x?: Reward["deliveryType"]) {
  if (!x) return "—";
  if (x === "EMAIL") return "Email";
  if (x === "LOCAL") return "Local";
  return "Entrega";
}

export default function RewardsUser({ lang }: Props) {
  const [fullName, setFullName] = useState<string>("");

  // ✅ depois você liga isso no saldo real do cliente (DB)
  const [pointsBalance, setPointsBalance] = useState<number>(0);

  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);

  // filtros
  const [q, setQ] = useState("");
  const [minPts, setMinPts] = useState<string>("");
  const [maxPts, setMaxPts] = useState<string>("");
  const [tagsText, setTagsText] = useState<string>("");

  useEffect(() => {
    async function loadUser() {
      try {
        const u = await getCurrentUser();
        const attrs = await fetchUserAttributes();

        const name =
          (attrs.name || attrs.given_name || attrs.family_name || attrs.email || u.username || "")
            .toString()
            .trim();

        setFullName(name);

        // ✅ opcional: se você guardar pontos no atributo custom (ex: custom:points)
        // const pts = Number(attrs["custom:points"] || 0);
        // setPointsBalance(Number.isFinite(pts) ? pts : 0);
      } catch {
        // ok
      }
    }

    loadUser();
  }, []);

  async function loadRewards() {
    setLoading(true);
    setError(null);
    try {
      const res: any = await gqlClient.graphql({ query: LIST_REWARDS });
      const items: Reward[] = res?.data?.listRewards?.items || [];
      // portal do user: mostra só ativos
      setRewards(items.filter((r) => r?.active));
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar rewards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const tags = parseTags(tagsText).map((t) => t.toLowerCase());

    const min = minPts.trim() === "" ? null : Number(minPts);
    const max = maxPts.trim() === "" ? null : Number(maxPts);

    return rewards.filter((r) => {
      const title = (r.title || "").toLowerCase();
      const desc = (r.description || "").toLowerCase();
      const code = (r.code || "").toLowerCase();

      if (query) {
        const hit = title.includes(query) || desc.includes(query) || code.includes(query);
        if (!hit) return false;
      }

      if (min !== null && Number.isFinite(min) && r.pointsCost < min) return false;
      if (max !== null && Number.isFinite(max) && r.pointsCost > max) return false;

      if (tags.length) {
        const rtags = splitTags(r.tags).map((t) => t.toLowerCase());
        const hasAll = tags.every((t) => rtags.includes(t));
        if (!hasAll) return false;
      }

      return true;
    });
  }, [rewards, q, minPts, maxPts, tagsText]);

  async function handleRedeem(reward: Reward) {
    // ✅ placeholder: aqui vamos ligar no backend (mutation / lambda / API)
    // ideia: createRedemption({ rewardId, userSub/email, pointsCost, status: "PENDING" })
    alert(`Resgate solicitado: ${reward.title || reward.code || reward.id} (${reward.pointsCost} pts)`);
  }

  return (
    <div style={page}>
      <div style={container}>
        {/* Header Martins claro */}
        <div
          style={{
            ...card,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
              Bem-vindo{fullName ? `, ${fullName}` : ""} 👋
            </div>
            <div style={{ opacity: 0.75, color: "#111827", marginTop: 2 }}>
              Escolha um reward para resgatar
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={pill}>
              Pontos disponíveis: <b>{pointsBalance}</b>
            </span>
            <button
              onClick={loadRewards}
              style={{
                height: 38,
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.14)",
                background: "#fff",
                padding: "0 14px",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Recarregar
            </button>
          </div>
        </div>

        {/* filtros */}
        <div style={{ ...card, marginTop: 12 }}>
          <div style={{ ...row, justifyContent: "space-between" }}>
            <div style={{ fontWeight: 900, color: "#111827" }}>Filtros</div>
            <div style={{ opacity: 0.7, fontWeight: 800, color: "#111827" }}>
              Total: {filtered.length}
            </div>
          </div>

          <div style={{ ...row, marginTop: 10 }}>
            <input
              style={{ ...input, flex: 1, minWidth: 220 }}
              placeholder="Buscar (título, descrição ou código)"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <input
              style={input}
              inputMode="numeric"
              placeholder="Min pts"
              value={minPts}
              onChange={(e) => setMinPts(e.target.value)}
            />

            <input
              style={input}
              inputMode="numeric"
              placeholder="Max pts"
              value={maxPts}
              onChange={(e) => setMaxPts(e.target.value)}
            />

            <input
              style={{ ...input, flex: 1, minWidth: 180 }}
              placeholder="Tags (separadas por vírgula)"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
            />

            <button
              onClick={() => {
                setQ("");
                setMinPts("");
                setMaxPts("");
                setTagsText("");
              }}
              style={{
                height: 38,
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.14)",
                background: "#fff",
                padding: "0 14px",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              Limpar
            </button>
          </div>
        </div>

        {/* listagem */}
        <div style={{ marginTop: 12 }}>
          {error && (
            <div style={{ ...card, borderColor: "rgba(220,38,38,0.35)", color: "#991B1B" }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ ...card, color: "#111827", fontWeight: 800 }}>Carregando…</div>
          ) : (
            <div style={grid}>
              {filtered.map((r) => {
                const canRedeem = pointsBalance >= (r.pointsCost || 0);
                return (
                  <div key={r.id} style={card}>
                    <div style={{ display: "flex", gap: 10 }}>
                      <div
                        style={{
                          width: 64,
                          height: 64,
                          borderRadius: 12,
                          border: "1px solid rgba(0,0,0,0.08)",
                          background: "rgba(0,0,0,0.03)",
                          overflow: "hidden",
                          flex: "0 0 auto",
                        }}
                      >
                        {r.imageUrl ? (
                          <img
                            src={r.imageUrl}
                            alt={r.title || "reward"}
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "grid",
                              placeItems: "center",
                              fontWeight: 900,
                              opacity: 0.55,
                            }}
                          >
                            —
                          </div>
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 900, color: "#111827", fontSize: 16 }}>
                          {r.title || r.code || "Reward"}
                        </div>
                        <div style={{ opacity: 0.72, marginTop: 2, color: "#111827", fontSize: 13 }}>
                          {r.description || ""}
                        </div>

                        <div style={{ ...row, marginTop: 8 }}>
                          <span style={pill}>Pontos: {r.pointsCost}</span>
                          <span style={pill}>Entrega: {fmtDelivery(r.deliveryType)}</span>
                          <span style={okPill}>Ativo</span>
                        </div>

                        {!!r.category && (
                          <div style={{ opacity: 0.7, marginTop: 8, color: "#111827", fontSize: 12 }}>
                            Categoria: <b>{r.category}</b>
                          </div>
                        )}

                        {!!splitTags(r.tags).length && (
                          <div style={{ opacity: 0.7, marginTop: 4, color: "#111827", fontSize: 12 }}>
                            Tags: {splitTags(r.tags).join(", ")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <button
                        style={canRedeem ? redeemBtn : redeemBtnDisabled}
                        disabled={!canRedeem}
                        onClick={() => handleRedeem(r)}
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
      </div>
    </div>
  );
}