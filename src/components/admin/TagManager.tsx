"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "antd";

import { apiRequest } from "./adminApi";

type TagRow = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

type EditDraft = {
  name: string;
  slug: string;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toDraft(t: TagRow): EditDraft {
  return { name: t.name, slug: t.slug };
}

export default function TagManager(props: { initial: TagRow[] }) {
  const [items, setItems] = useState<TagRow[]>(props.initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [create, setCreate] = useState<EditDraft>({ name: "", slug: "" });

  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = useMemo(() => {
    if (!editingId) return null;
    const t = items.find((x) => x.id === editingId);
    return t ? toDraft(t) : null;
  }, [editingId, items]);
  const [draft, setDraft] = useState<EditDraft | null>(null);

  async function refresh() {
    const next = await apiRequest<TagRow[]>("/api/admin/tags");
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
      await apiRequest<{ id: string }>("/api/admin/tags", {
        method: "POST",
        body: JSON.stringify({ name: create.name.trim(), slug: create.slug.trim() }),
      });
      setCreate({ name: "", slug: "" });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(id: string) {
    const t = items.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setDraft(toDraft(t));
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
      await apiRequest<{ id: string }>(`/api/admin/tags/${editingId}`, {
        method: "PUT",
        body: JSON.stringify({ name: draft.name.trim(), slug: draft.slug.trim() }),
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
    const t = items.find((x) => x.id === id);
    if (!t) return;
    const ok = window.confirm(`确认删除标签：${t.name}？`);
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest<{ id: string }>(`/api/admin/tags/${id}`, { method: "DELETE" });
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
          <strong>标签管理</strong>
          <span>用于搜索与相关推荐</span>
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
          <strong>新建标签</strong>
          <span className="subMuted">name/slug 必填</span>
        </div>
        <div className="gridForm">
          <div className="field">
            <div className="label">Name</div>
            <Input
              className="input"
              value={create.name}
              onChange={(e) => setCreate((p) => ({ ...p, name: e.target.value }))}
              placeholder="Prisma"
            />
          </div>
          <div className="field">
            <div className="label">Slug</div>
            <Input
              className="input"
              value={create.slug}
              onChange={(e) => setCreate((p) => ({ ...p, slug: e.target.value }))}
              placeholder="prisma"
            />
          </div>
        </div>
        <div className="subActions">
          <Button className="btn btnGreen" onClick={() => void submitCreate()} disabled={busy} type="primary">
            {busy ? "提交中…" : "创建"}
          </Button>
        </div>
      </div>

      <div className="tableWrap">
        <div className="tableHeader">
          <div>标签</div>
          <div>Slug</div>
          <div>更新时间</div>
          <div />
        </div>

        {items.map((t) => {
          const isEditing = editingId === t.id;
          const view = isEditing && draft ? draft : null;
          return (
            <div key={t.id} className={cx("tableRow", isEditing && "tableRowActive")}>
              <div className="cell">
                {view ? (
                  <Input className="input inputSm" value={view.name} onChange={(e) => setDraft((p) => (p ? { ...p, name: e.target.value } : p))} />
                ) : (
                  <strong style={{ fontSize: 13 }}>{t.name}</strong>
                )}
              </div>
              <div className="cell">
                {view ? (
                  <Input className="input inputSm" value={view.slug} onChange={(e) => setDraft((p) => (p ? { ...p, slug: e.target.value } : p))} />
                ) : (
                  <span className="mono">{t.slug}</span>
                )}
              </div>
              <div className="cell">
                <span className="subMuted">{t.updatedAt.slice(0, 10)}</span>
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
                    <Button className="btn" onClick={() => beginEdit(t.id)} disabled={busy}>
                      编辑
                    </Button>
                    <Button className="btn" onClick={() => void remove(t.id)} disabled={busy}>
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
