import React, { useCallback, useEffect, useMemo, useState } from "react";

type PermissionRow = {
  _id?: string;
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  pages: string[];
  updatedAt?: string | null;
  updatedBy?: string;
};

type UserPreview = {
  email: string;
  page: string;
  allowed: boolean | null;
  loading: boolean;
  message: string;
  pages: string[];
  isAdmin: boolean;
};

type FormState = {
  groupId: string;
  groupName: string;
  isAdmin: boolean;
  pages: string[];
  updatedBy: string;
};

const ACCESS_CONTROL_API =
  "https://2kg0lpfvda.execute-api.us-east-2.amazonaws.com/main/getAccessControl";

const AVAILABLE_PAGES = [
  { key: "home", label: "Home" },
  { key: "crud", label: "Rewards" },
  { key: "approvals", label: "Approvals" },
  { key: "report", label: "Report" },
  { key: "balances", label: "Balances" },
  { key: "projects", label: "Projects" },
  { key: "timeline", label: "Timeline" },
  { key: "invoices", label: "Invoices" },
  { key: "management-holds", label: "Management Hold" },
  { key: "project-expenses", label: "Project Expenses" },
  { key: "future-approvals", label: "Future Approvals" },
] as const;

function toStr(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeStrings(values: unknown) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return toStr(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

async function parseApiResponse(response: Response) {
  const rawText = await response.text();
  if (!rawText) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      message: rawText || "Invalid API response.",
      rawText,
    };
  }
}

function parsePermissionRows(payload: any): PermissionRow[] {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((row: any) => ({
    _id: row?._id ? toStr(row._id) : undefined,
    groupId: toStr(row?.groupId),
    groupName: toStr(row?.groupName),
    isAdmin: !!row?.isAdmin,
    pages: normalizeStrings(row?.pages),
    updatedAt: row?.updatedAt ? toStr(row.updatedAt) : null,
    updatedBy: toStr(row?.updatedBy),
  }));
}

function AccessBadge({ isAdmin }: { isAdmin: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 90,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 11,
        background: isAdmin ? "rgba(22,163,74,0.12)" : "rgba(59,130,246,0.12)",
        color: isAdmin ? "#15803d" : "#1d4ed8",
        border: isAdmin
          ? "1px solid rgba(22,163,74,0.18)"
          : "1px solid rgba(59,130,246,0.18)",
      }}
    >
      {isAdmin ? "Full Access" : "Restricted"}
    </span>
  );
}

function StatusBadge({ allowed }: { allowed: boolean | null }) {
  if (allowed === null) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 90,
          height: 28,
          padding: "0 10px",
          borderRadius: 999,
          fontWeight: 800,
          fontSize: 11,
          background: "rgba(107,114,128,0.12)",
          color: "#374151",
          border: "1px solid rgba(107,114,128,0.18)",
        }}
      >
        Not Checked
      </span>
    );
  }

  const success = allowed;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: 90,
        height: 28,
        padding: "0 10px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 11,
        background: success ? "rgba(22,163,74,0.12)" : "rgba(220,38,38,0.12)",
        color: success ? "#15803d" : "#b91c1c",
        border: success
          ? "1px solid rgba(22,163,74,0.18)"
          : "1px solid rgba(220,38,38,0.18)",
      }}
    >
      {success ? "Allowed" : "Denied"}
    </span>
  );
}

export default function ManagementAccess() {
  const [rows, setRows] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [form, setForm] = useState<FormState>({
    groupId: "",
    groupName: "",
    isAdmin: false,
    pages: [],
    updatedBy: "",
  });
  const [preview, setPreview] = useState<UserPreview>({
    email: "",
    page: "project-expenses",
    allowed: null,
    loading: false,
    message: "",
    pages: [],
    isAdmin: false,
  });

  const S: Record<string, React.CSSProperties> = {
    page: {
      background: "#fff",
      borderRadius: 12,
      padding: 18,
      border: "1px solid rgba(0,0,0,0.06)",
      width: "100%",
      maxWidth: 1800,
      margin: "0 auto",
      color: "#111827",
    },
    header: {
      display: "flex",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 12,
      flexWrap: "wrap",
    },
    titleWrap: {
      display: "grid",
      gap: 6,
    },
    title: {
      margin: 0,
      fontSize: 22,
      fontWeight: 900,
      color: "#111827",
    },
    subtitle: {
      margin: 0,
      color: "rgba(17,24,39,0.68)",
      fontSize: 13,
    },
    cardsGrid: {
      display: "grid",
      gridTemplateColumns: "420px 1fr",
      gap: 16,
      alignItems: "start",
    },
    card: {
      border: "1px solid rgba(17,24,39,0.08)",
      borderRadius: 16,
      padding: 16,
      background: "linear-gradient(180deg, #ffffff 0%, #fbfaf8 100%)",
    },
    field: {
      display: "grid",
      gap: 6,
      marginBottom: 12,
    },
    label: {
      fontSize: 12,
      fontWeight: 800,
      color: "rgba(17,24,39,0.72)",
    },
    input: {
      height: 40,
      borderRadius: 10,
      border: "1px solid rgba(17,24,39,0.12)",
      padding: "0 12px",
      background: "#fff",
      color: "#111827",
      outline: "none",
      fontWeight: 600,
    },
    textarea: {
      minHeight: 76,
      borderRadius: 10,
      border: "1px solid rgba(17,24,39,0.12)",
      padding: 12,
      background: "#fff",
      color: "#111827",
      outline: "none",
      fontWeight: 600,
      resize: "vertical",
    },
    btnPrimary: {
      background: "#7A5A3A",
      color: "white",
      border: "none",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "pointer",
      height: 42,
      whiteSpace: "nowrap",
    },
    btnSecondary: {
      background: "#fff",
      color: "#374151",
      border: "1px solid rgba(17,24,39,0.12)",
      padding: "10px 14px",
      borderRadius: 12,
      fontWeight: 800,
      cursor: "pointer",
      height: 42,
      whiteSpace: "nowrap",
    },
    actionRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      marginTop: 10,
    },
    tableWrap: {
      overflow: "auto",
      border: "1px solid rgba(17,24,39,0.08)",
      borderRadius: 16,
      background: "#fff",
      marginTop: 16,
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      minWidth: 1100,
    },
    th: {
      position: "sticky",
      top: 0,
      background: "#faf8f5",
      color: "#374151",
      textAlign: "left",
      fontSize: 12,
      fontWeight: 900,
      padding: "12px 14px",
      borderBottom: "1px solid rgba(17,24,39,0.08)",
      zIndex: 1,
    },
    td: {
      padding: "12px 14px",
      borderBottom: "1px solid rgba(17,24,39,0.06)",
      fontSize: 13,
      color: "#111827",
      verticalAlign: "top",
    },
    empty: {
      textAlign: "center",
      padding: 28,
      color: "rgba(17,24,39,0.60)",
      fontWeight: 700,
    },
    error: {
      background: "rgba(220,38,38,0.08)",
      color: "#991b1b",
      border: "1px solid rgba(220,38,38,0.16)",
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 14,
      fontWeight: 700,
    },
    success: {
      background: "rgba(22,163,74,0.08)",
      color: "#166534",
      border: "1px solid rgba(22,163,74,0.16)",
      padding: "12px 14px",
      borderRadius: 12,
      marginBottom: 14,
      fontWeight: 700,
    },
    checkboxGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
      gap: 10,
      marginTop: 4,
    },
    checkboxItem: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      border: "1px solid rgba(17,24,39,0.08)",
      borderRadius: 12,
      padding: "10px 12px",
      background: "#fff",
      fontWeight: 700,
      color: "#374151",
    },
    chipRow: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
    },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 28,
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(122,90,58,0.12)",
      color: "#7A5A3A",
      border: "1px solid rgba(122,90,58,0.18)",
      fontWeight: 800,
      fontSize: 11,
    },
  };

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(ACCESS_CONTROL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "listGroupPermissions" }),
      });

      const result = await parseApiResponse(response);
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "Failed to load group permissions.");
      }

      setRows(parsePermissionRows(result));
    } catch (e: any) {
      console.error(e);
      setRows([]);
      setError(e?.message || "Failed to load group permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => {
      return (
        row.groupId.toLowerCase().includes(query) ||
        row.groupName.toLowerCase().includes(query) ||
        row.pages.some((page) => page.toLowerCase().includes(query))
      );
    });
  }, [rows, search]);

  function resetForm() {
    setSelectedGroupId("");
    setForm({
      groupId: "",
      groupName: "",
      isAdmin: false,
      pages: [],
      updatedBy: form.updatedBy,
    });
  }

  function selectRow(row: PermissionRow) {
    setSelectedGroupId(row.groupId);
    setForm({
      groupId: row.groupId,
      groupName: row.groupName,
      isAdmin: row.isAdmin,
      pages: row.pages,
      updatedBy: form.updatedBy,
    });
    setSuccess("");
    setError("");
  }

  function togglePage(pageKey: string) {
    setForm((prev) => {
      const exists = prev.pages.includes(pageKey);
      return {
        ...prev,
        pages: exists ? prev.pages.filter((page) => page !== pageKey) : [...prev.pages, pageKey],
      };
    });
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!form.groupId.trim()) {
        throw new Error("Group Id is required.");
      }

      if (!form.groupName.trim()) {
        throw new Error("Group Name is required.");
      }

      const response = await fetch(ACCESS_CONTROL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveGroupPermission",
          groupId: form.groupId.trim(),
          groupName: form.groupName.trim(),
          isAdmin: form.isAdmin,
          pages: form.isAdmin ? [] : form.pages,
          updatedBy: form.updatedBy.trim(),
        }),
      });

      const result = await parseApiResponse(response);
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "Failed to save group permission.");
      }

      setSuccess("Group permission saved successfully.");
      await loadRows();
      setSelectedGroupId(form.groupId.trim());
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "Failed to save group permission.");
    } finally {
      setSaving(false);
    }
  }, [form, loadRows]);

  const handlePreview = useCallback(async () => {
    setPreview((prev) => ({
      ...prev,
      loading: true,
      message: "",
      allowed: null,
      pages: [],
      isAdmin: false,
    }));

    try {
      if (!preview.email.trim()) {
        throw new Error("Email is required to test access.");
      }

      const response = await fetch(ACCESS_CONTROL_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "checkPageAccess",
          email: preview.email.trim(),
          page: preview.page,
        }),
      });

      const result = await parseApiResponse(response);
      if (!response.ok || result?.ok === false) {
        throw new Error(result?.message || "Failed to check page access.");
      }

      const data = result?.data || {};
      setPreview((prev) => ({
        ...prev,
        loading: false,
        allowed: !!data.allowed,
        message: toStr(data.reason),
        pages: Array.isArray(data.pages) ? data.pages.map((page: any) => toStr(page)) : [],
        isAdmin: !!data.isAdmin,
      }));
    } catch (e: any) {
      console.error(e);
      setPreview((prev) => ({
        ...prev,
        loading: false,
        allowed: false,
        message: e?.message || "Failed to check page access.",
        pages: [],
        isAdmin: false,
      }));
    }
  }, [preview.email, preview.page]);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={S.titleWrap}>
          <h2 style={S.title}>Management Access</h2>
          <p style={S.subtitle}>
            Configure which groups can access each module. Admin groups receive full access automatically.
          </p>
        </div>
      </div>

      {error ? <div style={S.error}>{error}</div> : null}
      {success ? <div style={S.success}>{success}</div> : null}

      <div style={S.cardsGrid}>
        <div style={S.card}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Group Permission</div>

          <div style={S.field}>
            <label style={S.label}>Group Id</label>
            <input
              style={S.input}
              value={form.groupId}
              onChange={(e) => setForm((prev) => ({ ...prev, groupId: e.target.value }))}
              placeholder="Ex.: 284f8c46-57bc-4bbc-8fd8-f38c9c33723a"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Group Name</label>
            <input
              style={S.input}
              value={form.groupName}
              onChange={(e) => setForm((prev) => ({ ...prev, groupName: e.target.value }))}
              placeholder="Ex.: Admin"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Updated By</label>
            <input
              style={S.input}
              value={form.updatedBy}
              onChange={(e) => setForm((prev) => ({ ...prev, updatedBy: e.target.value }))}
              placeholder="claus@martinsdevelopmentllc.com"
            />
          </div>

          <div style={{ ...S.field, marginBottom: 16 }}>
            <label style={S.label}>Access Mode</label>
            <label style={S.checkboxItem}>
              <input
                type="checkbox"
                checked={form.isAdmin}
                onChange={(e) => setForm((prev) => ({ ...prev, isAdmin: e.target.checked }))}
              />
              Admin group with full access
            </label>
          </div>

          <div style={S.field}>
            <label style={S.label}>Allowed Pages</label>
            <div style={S.checkboxGrid}>
              {AVAILABLE_PAGES.map((page) => (
                <label
                  key={page.key}
                  style={{
                    ...S.checkboxItem,
                    opacity: form.isAdmin ? 0.55 : 1,
                    cursor: form.isAdmin ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.isAdmin ? false : form.pages.includes(page.key)}
                    disabled={form.isAdmin}
                    onChange={() => togglePage(page.key)}
                  />
                  {page.label}
                </label>
              ))}
            </div>
          </div>

          <div style={S.actionRow}>
            <button type="button" style={S.btnPrimary} onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" style={S.btnSecondary} onClick={resetForm}>
              New
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={S.card}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>Access Preview</div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr auto", gap: 12, alignItems: "end" }}>
              <div style={S.field}>
                <label style={S.label}>User Email</label>
                <input
                  style={S.input}
                  value={preview.email}
                  onChange={(e) => setPreview((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="User email"
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>Page</label>
                <select
                  style={S.input}
                  value={preview.page}
                  onChange={(e) => setPreview((prev) => ({ ...prev, page: e.target.value }))}
                >
                  {AVAILABLE_PAGES.map((page) => (
                    <option key={page.key} value={page.key}>
                      {page.label}
                    </option>
                  ))}
                </select>
              </div>

              <button type="button" style={S.btnPrimary} onClick={() => void handlePreview()} disabled={preview.loading}>
                {preview.loading ? "Checking..." : "Check Access"}
              </button>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div style={S.chipRow}>
                <StatusBadge allowed={preview.allowed} />
                <AccessBadge isAdmin={preview.isAdmin} />
              </div>

              {preview.message ? (
                <div style={{ color: "rgba(17,24,39,0.72)", fontWeight: 700, fontSize: 13 }}>
                  Result: {preview.message}
                </div>
              ) : null}

              <div>
                <div style={{ ...S.label, marginBottom: 8 }}>Resolved Pages</div>
                <div style={S.chipRow}>
                  {preview.isAdmin ? (
                    <span style={S.chip}>*</span>
                  ) : preview.pages.length ? (
                    preview.pages.map((page) => (
                      <span key={page} style={S.chip}>
                        {page}
                      </span>
                    ))
                  ) : (
                    <span style={{ color: "rgba(17,24,39,0.60)", fontWeight: 700 }}>No pages resolved.</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 12 }}>How it works</div>
            <div style={{ color: "rgba(17,24,39,0.72)", fontSize: 14, lineHeight: 1.6 }}>
              This screen saves one document per group in <strong>groups-permission-md</strong>.
              <br />
              If <strong>Admin group with full access</strong> is enabled, the group can access every page.
              <br />
              Otherwise, access is restricted to the selected pages only.
            </div>
          </div>
        </div>
      </div>

      <div style={S.tableWrap}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Group Name</th>
              <th style={S.th}>Group Id</th>
              <th style={S.th}>Access</th>
              <th style={S.th}>Allowed Pages</th>
              <th style={S.th}>Updated At</th>
              <th style={S.th}>Updated By</th>
              <th style={S.th}>Edit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td} colSpan={7}>
                <input
                  style={{ ...S.input, width: "100%" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by group name, group id or page"
                />
              </td>
            </tr>

            {loading ? (
              <tr>
                <td style={S.empty} colSpan={7}>
                  Loading permissions...
                </td>
              </tr>
            ) : filteredRows.length === 0 ? (
              <tr>
                <td style={S.empty} colSpan={7}>
                  No group permissions found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.groupId} style={selectedGroupId === row.groupId ? { background: "#fcfbf8" } : undefined}>
                  <td style={S.td}>
                    <div style={{ fontWeight: 900 }}>{row.groupName || "-"}</div>
                  </td>
                  <td style={S.td}>{row.groupId}</td>
                  <td style={S.td}>
                    <AccessBadge isAdmin={row.isAdmin} />
                  </td>
                  <td style={S.td}>
                    <div style={S.chipRow}>
                      {row.isAdmin ? (
                        <span style={S.chip}>*</span>
                      ) : row.pages.length ? (
                        row.pages.map((page) => (
                          <span key={page} style={S.chip}>
                            {page}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: "rgba(17,24,39,0.60)", fontWeight: 700 }}>No pages assigned</span>
                      )}
                    </div>
                  </td>
                  <td style={S.td}>{formatDateTime(row.updatedAt)}</td>
                  <td style={S.td}>{row.updatedBy || "-"}</td>
                  <td style={S.td}>
                    <button type="button" style={S.btnSecondary} onClick={() => selectRow(row)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
