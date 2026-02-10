import React, { useEffect, useMemo, useState } from "react";
import type { Lang } from "./types/lang";
import { gqlClient } from "./lib/amplifyClient";
import {
  MONGO_REWARDS_LIST,
  MONGO_REWARD_CREATE,
  MONGO_REWARD_UPDATE,
  MONGO_REWARD_DELETE,
} from "./lib/rewards.gql";

type Props = { lang: Lang };

type MongoI18n = { pt: string; en?: string | null; es?: string | null };

type Reward = {
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
  offerStartAt?: string | null;
  offerEndAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  createdBy?: string | null;
};

type ListResp = {
  mongoRewardsList?: {
    items?: any[];
    nextToken?: string | null;
  };
};

type CreateResp = { mongoRewardCreate?: any | null };
type UpdateResp = { mongoRewardUpdate?: any | null };

function toISOFromDateInput(value: string) {
  if (!value) return null;
  const d = new Date(value + "T00:00:00");
  return d.toISOString();
}

function fromISOToDateInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function normalizeImageUrl(raw?: string | null) {
  const v = (raw ?? "").trim();
  if (!v) return null;

  if (v.startsWith("//")) return `https:${v}`;
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("www.")) return `https://${v}`;
  if (v.includes("vtexassets.com")) return `https://${v.replace(/^\/+/, "")}`;

  return v;
}

function getRewardId(r: any): string | null {
  return (r?.id ?? r?._id ?? null) as string | null;
}

function normalizeReward(r: any): Reward {
  const id = getRewardId(r) ?? "";
  const title = r?.title ?? {};
  const description = r?.description ?? null;
  return {
    ...r,
    id,
    title: {
      pt: title?.pt ?? "",
      en: title?.en ?? null,
      es: title?.es ?? null,
    },
    description: description
      ? {
          pt: description?.pt ?? "",
          en: description?.en ?? null,
          es: description?.es ?? null,
        }
      : null,
    imageUrl: normalizeImageUrl(r?.imageUrl),
  };
}

export default function RewardsCRUD({ lang }: Props) {
  const t = useMemo(() => {
    const dict: Record<Lang, any> = {
      pt: {
        title: "Rewards (CRUD)",
        subtitle: "Crie, edite e gerencie os rewards cadastrados no MongoDB.",
        reload: "Recarregar",
        apply: "Aplicar",
        total: "Total",
        search: "Buscar (título ou código)",
        activeOnly: "Somente ativos",
        create: "Criar",
        saving: "Salvando...",
        save: "Salvar",
        cancel: "Cancelar",
        edit: "Editar",
        delete: "Excluir",
        confirmDelete: "Excluir este reward?",
        noItems: "Nenhum item encontrado.",
        code: "Código *",
        points: "Pontos (custo) *",
        delivery: "Tipo de entrega",
        active: "Ativo",
        category: "Categoria",
        tags: "Tags (vírgula)",
        offerStart: "Oferta começa",
        offerEnd: "Oferta termina",
        image: "Imagem",
        imageHint:
          "Cole a URL da imagem acima. (Upload para S3 será reativado quando Identity Pool estiver configurado.)",
        titlePT: "Título (PT)",
        titleEN: "Título (EN)",
        titleES: "Título (ES)",
        descPT: "Descrição (PT)",
        descEN: "Descrição (EN)",
        descES: "Descrição (ES)",
      },
      en: {
        title: "Rewards (CRUD)",
        subtitle: "Create, edit, and manage rewards stored in MongoDB.",
        reload: "Reload",
        apply: "Apply",
        total: "Total",
        search: "Search (title or code)",
        activeOnly: "Active only",
        create: "Create",
        saving: "Saving...",
        save: "Save",
        cancel: "Cancel",
        edit: "Edit",
        delete: "Delete",
        confirmDelete: "Delete this reward?",
        noItems: "No items found.",
        code: "Code *",
        points: "Points (cost) *",
        delivery: "Delivery type",
        active: "Active",
        category: "Category",
        tags: "Tags (comma)",
        offerStart: "Offer starts",
        offerEnd: "Offer ends",
        image: "Image",
        imageHint:
          "Paste an image URL above. (S3 upload will be re-enabled when Identity Pool is configured.)",
        titlePT: "Title (PT)",
        titleEN: "Title (EN)",
        titleES: "Title (ES)",
        descPT: "Description (PT)",
        descEN: "Description (EN)",
        descES: "Description (ES)",
      },
      es: {
        title: "Rewards (CRUD)",
        subtitle: "Cree, edite y administre rewards almacenados en MongoDB.",
        reload: "Recargar",
        apply: "Aplicar",
        total: "Total",
        search: "Buscar (título o código)",
        activeOnly: "Solo activos",
        create: "Crear",
        saving: "Guardando...",
        save: "Guardar",
        cancel: "Cancelar",
        edit: "Editar",
        delete: "Eliminar",
        confirmDelete: "¿Eliminar este reward?",
        noItems: "No se encontraron elementos.",
        code: "Código *",
        points: "Puntos (costo) *",
        delivery: "Tipo de entrega",
        active: "Activo",
        category: "Categoría",
        tags: "Tags (coma)",
        offerStart: "Oferta inicia",
        offerEnd: "Oferta termina",
        image: "Imagen",
        imageHint:
          "Pegue la URL de la imagen arriba. (La subida a S3 se reactivará cuando Identity Pool esté configurado.)",
        titlePT: "Título (PT)",
        titleEN: "Título (EN)",
        titleES: "Título (ES)",
        descPT: "Descripción (PT)",
        descEN: "Descripción (EN)",
        descES: "Descripción (ES)",
      },
    };
    return dict[lang];
  }, [lang]);

  const [items, setItems] = useState<Reward[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const emptyForm = () => ({
    id: "",
    code: "",
    pointsCost: 0,
    deliveryType: "EMAIL",
    active: true,
    category: "",
    tags: "",
    offerStartAt: "",
    offerEndAt: "",
    imageUrl: "",
    titlePT: "",
    titleEN: "",
    titleES: "",
    descPT: "",
    descEN: "",
    descES: "",
  });

  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  function buildPayload() {
    const tagsArr = form.tags
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return {
      code: form.code.trim(),
      pointsCost: Number(form.pointsCost) || 0,
      deliveryType: form.deliveryType,
      active: !!form.active,
      category: (form.category || "").trim() || null,
      tags: tagsArr.length ? tagsArr : null,
      offerStartAt: form.offerStartAt ? toISOFromDateInput(form.offerStartAt) : null,
      offerEndAt: form.offerEndAt ? toISOFromDateInput(form.offerEndAt) : null,
      imageUrl: normalizeImageUrl(form.imageUrl),
      title: {
        pt: form.titlePT.trim(),
        en: form.titleEN.trim() || null,
        es: form.titleES.trim() || null,
      },
      description: {
        pt: form.descPT.trim(),
        en: form.descEN.trim() || null,
        es: form.descES.trim() || null,
      },
    };
  }

  async function load() {
    setBusy(true);
    setErr(null);
    try {
      const resp = (await gqlClient.graphql({
        query: MONGO_REWARDS_LIST,
        variables: { search: search || null, activeOnly },
      } as any)) as { data?: ListResp };

      const raw = resp?.data?.mongoRewardsList?.items ?? [];
      setItems(raw.map(normalizeReward));
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      const payload = buildPayload();

      const resp = (await gqlClient.graphql({
        query: MONGO_REWARD_CREATE,
        variables: { input: payload },
      } as any)) as { data?: CreateResp };

      const created = resp?.data?.mongoRewardCreate;
      if (created) {
        setItems((prev) => [normalizeReward(created), ...prev]);
      }
      setForm(emptyForm());
      setEditingId(null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (!editingId) throw new Error("Missing id to update");

      const payload = buildPayload();

      const resp = (await gqlClient.graphql({
        query: MONGO_REWARD_UPDATE,
        variables: { id: editingId, input: payload },
      } as any)) as { data?: UpdateResp };

      const updated = resp?.data?.mongoRewardUpdate;
      if (updated) {
        const n = normalizeReward(updated);
        setItems((prev) => prev.map((x) => (x.id === n.id ? n : x)));
      }
      setForm(emptyForm());
      setEditingId(null);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t.confirmDelete)) return;
    setBusy(true);
    setErr(null);
    try {
      await gqlClient.graphql({
        query: MONGO_REWARD_DELETE,
        variables: { id },
      } as any);

      setItems((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm());
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function startEdit(r: Reward) {
    setEditingId(r.id);
    setForm({
      id: r.id,
      code: r.code ?? "",
      pointsCost: r.pointsCost ?? 0,
      deliveryType: r.deliveryType ?? "EMAIL",
      active: !!r.active,
      category: r.category ?? "",
      tags: (r.tags ?? []).join(", "),
      offerStartAt: fromISOToDateInput(r.offerStartAt),
      offerEndAt: fromISOToDateInput(r.offerEndAt),
      imageUrl: r.imageUrl ?? "",
      titlePT: r.title?.pt ?? "",
      titleEN: r.title?.en ?? "",
      titleES: r.title?.es ?? "",
      descPT: r.description?.pt ?? "",
      descEN: r.description?.en ?? "",
      descES: r.description?.es ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
  }

  // ---------------- styles ----------------
  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 18,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
    color: "#111",
  };

  const section: React.CSSProperties = {
    background: "#f5f5f5",
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    border: "1px solid rgba(0,0,0,0.05)",
  };

  const row2: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  };

  const label: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 6,
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.15)",
    outline: "none",
    fontSize: 14,
    background: "#fff",
  };

  const textarea: React.CSSProperties = {
    ...input,
    height: 86,
    resize: "vertical",
  };

  const btnPrimary: React.CSSProperties = {
    border: 0,
    borderRadius: 999,
    padding: "10px 16px",
    background: "#6b5a2b",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  };

  const btnGhost: React.CSSProperties = {
    borderRadius: 999,
    padding: "10px 16px",
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.15)",
    cursor: "pointer",
    fontWeight: 800,
  };

  const imgBox: React.CSSProperties = {
    pointerEvents: "none",
    width: "100%",
    height: 120,
    borderRadius: 14,
    background: "#eee",
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(0,0,0,0.08)",
  };

  function renderImagePreview(urlRaw?: string | null, title?: string) {
    const url = normalizeImageUrl(urlRaw);
    const showImg = !!url && /^https?:\/\//i.test(url);

    return (
      <div style={imgBox}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontWeight: 800,
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          Sem imagem
        </div>

        {showImg ? (
          <img
            src={url!}
            alt={title || "reward"}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              position: "relative",
              zIndex: 2,
              pointerEvents: "none",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : null}
      </div>
    );
  }

  const filtered = items.filter((it) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const titleAny =
      (it.title?.pt ?? "") + " " + (it.title?.en ?? "") + " " + (it.title?.es ?? "");
    return it.code?.toLowerCase().includes(q) || titleAny.toLowerCase().includes(q);
  });

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{t.title}</div>
          <div style={{ marginTop: 4, color: "#6b7280" }}>{t.subtitle}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {t.total}: {items.length}
          </div>
          <button style={btnGhost} onClick={load} disabled={busy}>
            {t.reload}
          </button>
        </div>
      </div>

      {err ? (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            color: "#7f1d1d",
            borderRadius: 12,
            fontWeight: 800,
            whiteSpace: "pre-wrap",
          }}
        >
          {err}
        </div>
      ) : null}

      <div style={section}>
        <div style={row2}>
          <div>
            <div style={label}>{t.search}</div>
            <input
              style={input}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
            />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "end" }}>
            <div style={{ flex: 1 }}>
              <div style={label}>{t.activeOnly}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                />
                <span style={{ fontWeight: 800 }}>{activeOnly ? "ON" : "OFF"}</span>
              </label>
            </div>
            <button style={btnPrimary} onClick={load} disabled={busy} type="button">
              {t.apply}
            </button>
          </div>
        </div>
      </div>

      <div style={section}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>{editingId ? "Editar" : "Criar"}</div>
          <div style={{ display: "flex", gap: 10 }}>
            {editingId ? (
              <>
                <button style={btnGhost} onClick={cancelEdit} disabled={busy}>
                  {t.cancel}
                </button>
                <button style={btnPrimary} onClick={save} disabled={busy}>
                  {busy ? t.saving : t.save}
                </button>
              </>
            ) : (
              <button style={btnPrimary} onClick={create} disabled={busy}>
                {busy ? t.saving : t.create}
              </button>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={row2}>
            <div>
              <div style={label}>{t.code}</div>
              <input style={input} value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
            </div>
            <div>
              <div style={label}>{t.points}</div>
              <input
                style={input}
                type="number"
                value={form.pointsCost}
                onChange={(e) => setForm((p) => ({ ...p, pointsCost: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.delivery}</div>
              <select style={input} value={form.deliveryType} onChange={(e) => setForm((p) => ({ ...p, deliveryType: e.target.value }))}>
                <option value="EMAIL">EMAIL</option>
                <option value="LOCAL">LOCAL</option>
                <option value="SHIPPING">SHIPPING</option>
              </select>
            </div>
            <div>
              <div style={label}>{t.active}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                <span style={{ fontWeight: 900 }}>{form.active ? t.active : "OFF"}</span>
              </label>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.category}</div>
              <input style={input} value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} />
            </div>
            <div>
              <div style={label}>{t.tags}</div>
              <input style={input} value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.offerStart}</div>
              <input style={input} type="date" value={form.offerStartAt} onChange={(e) => setForm((p) => ({ ...p, offerStartAt: e.target.value }))} />
            </div>
            <div>
              <div style={label}>{t.offerEnd}</div>
              <input style={input} type="date" value={form.offerEndAt} onChange={(e) => setForm((p) => ({ ...p, offerEndAt: e.target.value }))} />
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.image}</div>
              <input
                style={input}
                value={form.imageUrl}
                onChange={(e) => setForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="https://... (opcional)"
              />
              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>{t.imageHint}</div>
            </div>
            <div>
              <div style={label}>Preview</div>
              {renderImagePreview(form.imageUrl, form.titlePT || form.code)}
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.titlePT}</div>
              <input style={input} value={form.titlePT} onChange={(e) => setForm((p) => ({ ...p, titlePT: e.target.value }))} />
            </div>
            <div>
              <div style={label}>{t.descPT}</div>
              <textarea style={textarea} value={form.descPT} onChange={(e) => setForm((p) => ({ ...p, descPT: e.target.value }))} />
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.titleEN}</div>
              <input style={input} value={form.titleEN} onChange={(e) => setForm((p) => ({ ...p, titleEN: e.target.value }))} />
            </div>
            <div>
              <div style={label}>{t.descEN}</div>
              <textarea style={textarea} value={form.descEN} onChange={(e) => setForm((p) => ({ ...p, descEN: e.target.value }))} />
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={row2}>
            <div>
              <div style={label}>{t.titleES}</div>
              <input style={input} value={form.titleES} onChange={(e) => setForm((p) => ({ ...p, titleES: e.target.value }))} />
            </div>
            <div>
              <div style={label}>{t.descES}</div>
              <textarea style={textarea} value={form.descES} onChange={(e) => setForm((p) => ({ ...p, descES: e.target.value }))} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontWeight: 900 }}>
        {t.total}: {filtered.length}
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 14 }}>
        {filtered.length === 0 ? (
          <div style={{ opacity: 0.7 }}>{t.noItems}</div>
        ) : (
          filtered.map((it) => {
            const title =
              (lang === "pt" ? it.title?.pt : lang === "en" ? it.title?.en : it.title?.es) ||
              it.title?.pt ||
              it.title?.en ||
              it.title?.es ||
              "(sem título)";
            const imgSrc = normalizeImageUrl(it.imageUrl);

            return (
              <div
                key={it.id}
                style={{
                  background: "#fff",
                  borderRadius: 16,
                  padding: 12,
                  border: "1px solid rgba(0,0,0,0.06)",
                  boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
                }}
              >
                {renderImagePreview(imgSrc, title)}

                <div style={{ marginTop: 10, fontWeight: 900 }}>{title}</div>

                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", fontWeight: 800 }}>
                    {it.pointsCost} pts
                  </span>
                  <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", fontWeight: 800 }}>
                    {it.deliveryType}
                  </span>
                  <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", fontWeight: 800 }}>
                    {it.active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                  <button style={{ ...btnGhost, padding: "8px 12px", borderRadius: 10 }} onClick={() => startEdit(it)} disabled={busy}>
                    {t.edit}
                  </button>
                  <button
                    style={{ padding: "8px 12px", borderRadius: 10, border: "0", background: "#b42318", color: "#fff", fontWeight: 900, cursor: "pointer" }}
                    onClick={() => remove(it.id)}
                    disabled={busy}
                  >
                    {t.delete}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
