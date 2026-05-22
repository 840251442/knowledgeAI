"use client";

import { useMemo, useState } from "react";
import { Button, Input, Select } from "antd";

import { apiRequest } from "./adminApi";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
};

type EditDraft = {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isVisible: boolean;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toDraft(c: CategoryRow): EditDraft {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? "",
    sortOrder: String(c.sortOrder ?? 0),
    isVisible: Boolean(c.isVisible),
  };
}

export default function CategoryManager(props: { initial: CategoryRow[] }) {
  const [items, setItems] = useState<CategoryRow[]>(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [create, setCreate] = useState<EditDraft>({
    name: "",
    slug: "",
    description: "",
    sortOrder: "0",
    isVisible: true,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => {
    if (!editingId) return null;
    const c = items.find((x) => x.id === editingId);
    return c ? toDraft(c) : null;
  }, [editingId, items]);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  async function refresh() {
    const next = await apiRequest<CategoryRow[]>("/api/admin/categories");
    setItems(next);
  }

  async function submitCreate() {
    setError(null);
    if (!create.name.trim() || !create.slug.trim()) {
      setError("请填写 name 与 slug");
      return;
    }
    setBusy(true);
    try {
      await apiRequest<{ id: string }>("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: create.name.trim(),
          slug: create.slug.trim(),
          description: create.description.trim() ? create.description.trim() : null,
          sortOrder: Number.parseInt(create.sortOrder, 10) || 0,
          isVisible: create.isVisible,
        }),
      });
      setCreate({ name: "", slug: "", description: "", sortOrder: "0", isVisible: true });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(id: string) {
    const c = items.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setDraft(toDraft(c));
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveEdit() {
    if (!editingId || !draft) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest<{ id: string }>(`/api/admin/categories/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: draft.name.trim(),
          slug: draft.slug.trim(),
          description: draft.description.trim() ? draft.description.trim() : null,
          sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
          isVisible: draft.isVisible,
        }),
      });
      await refresh();
      cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const c = items.find((x) => x.id === id);
    if (!c) return;
    const ok = window.confirm(`确认删除分类：${c.name}？`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest<{ id: string }>(`/api/admin/categories/${id}`, { method: "DELETE" });
      await refresh();
      if (editingId === id) cancelEdit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>分类管理</strong>
          <span>用于公开站内容组织与筛选</span>
        </div>
        <div className="actions">
          <span className="badge">
            <span className={cx("dot", "dotCyan")} />
            共 {items.length} 个
          </span>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="subPanel">
        <div className="subPanelHeader">
          <strong>新建分类</strong>
          <span className="subMuted">name/slug 必填</span>
        </div>
        <div className="gridForm">
          <div className="field">
            <div className="label">Name</div>
            <Input
              className="input"
              value={create.name}
              onChange={(e) => setCreate((p) => ({ ...p, name: e.target.value }))}
              placeholder="数据库"
            />
          </div>
          <div className="field">
            <div className="label">Slug</div>
            <Input
              className="input"
              value={create.slug}
              onChange={(e) => setCreate((p) => ({ ...p, slug: e.target.value }))}
              placeholder="database"
            />
          </div>
          <div className="field">
            <div className="label">Sort</div>
            <Input
              className="input"
              value={create.sortOrder}
              onChange={(e) => setCreate((p) => ({ ...p, sortOrder: e.target.value }))}
              placeholder="0"
            />
          </div>
          <div className="field">
            <div className="label">可见</div>
            <Select
              className="input"
              value={create.isVisible ? "1" : "0"}
              onChange={(value) => setCreate((p) => ({ ...p, isVisible: value === "1" }))}
              options={[
                { value: "1", label: "是" },
                { value: "0", label: "否" },
              ]}
            >
            </Select>
          </div>
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <div className="label" style={{ marginBottom: 8 }}>
            Description
          </div>
          <Input
            className="input"
            value={create.description}
            onChange={(e) => setCreate((p) => ({ ...p, description: e.target.value }))}
            placeholder="可选，用于页面展示"
          />
        </div>
        <div className="subActions">
          <Button className="btn btnGreen" onClick={() => void submitCreate()} disabled={busy} type="primary">
            {busy ? "提交中…" : "创建"}
          </Button>
        </div>
      </div>

      <div className="tableWrap">
        <div className="tableHeader">
          <div>分类</div>
          <div>Slug</div>
          <div>Sort</div>
          <div>可见</div>
          <div>更新时间</div>
          <div />
        </div>

        {items.map((c) => {
          const isEditing = editingId === c.id;
          const view = isEditing && draft ? draft : null;
          return (
            <div key={c.id} className={cx("tableRow", isEditing && "tableRowActive")}>
              <div className="cell">
                {view ? (
                  <Input className="input inputSm" value={view.name} onChange={(e) => setDraft((p) => (p ? { ...p, name: e.target.value } : p))} />
                ) : (
                  <div>
                    <strong style={{ fontSize: 13 }}>{c.name}</strong>
                    <div className="subMuted">{c.description ?? "—"}</div>
                  </div>
                )}
              </div>
              <div className="cell">
                {view ? (
                  <Input className="input inputSm" value={view.slug} onChange={(e) => setDraft((p) => (p ? { ...p, slug: e.target.value } : p))} />
                ) : (
                  <span className="mono">{c.slug}</span>
                )}
              </div>
              <div className="cell">
                {view ? (
                  <Input className="input inputSm" value={view.sortOrder} onChange={(e) => setDraft((p) => (p ? { ...p, sortOrder: e.target.value } : p))} />
                ) : (
                  <span className="mono">{c.sortOrder}</span>
                )}
              </div>
              <div className="cell">
                {view ? (
                  <Select
                    className="input inputSm"
                    value={view.isVisible ? "1" : "0"}
                    onChange={(value) => setDraft((p) => (p ? { ...p, isVisible: value === "1" } : p))}
                    options={[
                      { value: "1", label: "是" },
                      { value: "0", label: "否" },
                    ]}
                  >
                  </Select>
                ) : (
                  <span className="badge">
                    <span className={cx("dot", c.isVisible ? "dotGreen" : "dotWarn")} />
                    {c.isVisible ? "可见" : "隐藏"}
                  </span>
                )}
              </div>
              <div className="cell">
                <span className="subMuted">{c.updatedAt.slice(0, 10)}</span>
              </div>
              <div className="cell cellActions">
                {isEditing ? (
                  <>
                    <Button className="btn btnPrimary" onClick={() => void saveEdit()} disabled={busy} type="primary">
                      保存
                    </Button>
                    <Button className="btn" onClick={cancelEdit} disabled={busy}>
                      取消
                    </Button>
                  </>
                ) : (
                  <>
                    <Button className="btn" onClick={() => beginEdit(c.id)} disabled={busy}>
                      编辑
                    </Button>
                    <Button className="btn" onClick={() => void remove(c.id)} disabled={busy}>
                      删除
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

