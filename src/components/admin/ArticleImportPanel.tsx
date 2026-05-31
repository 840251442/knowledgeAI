"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Select } from "antd";

import type { ArticleImportTaskItem, ArticleImportTaskStatus } from "@/types/article";
import { apiRequest, authFetch } from "./adminApi";

type ImportTaskListResponse = {
  page: number;
  pageSize: number;
  total: number;
  status: ArticleImportTaskStatus | null;
  items: ArticleImportTaskItem[];
};

type UploadResult = {
  queued: number;
  taskIds: string[];
};

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const STATUS_OPTIONS: Array<{ value: "ALL" | ArticleImportTaskStatus; label: string }> = [
  { value: "ALL", label: "全部状态" },
  { value: "QUEUED", label: "排队中" },
  { value: "PROCESSING", label: "处理中" },
  { value: "RETRYING", label: "重试中" },
  { value: "SUCCEEDED", label: "成功" },
  { value: "FAILED", label: "失败" },
];

function statusLabel(s: ArticleImportTaskStatus) {
  if (s === "QUEUED") return "排队中";
  if (s === "PROCESSING") return "处理中";
  if (s === "RETRYING") return "重试中";
  if (s === "SUCCEEDED") return "成功";
  if (s === "FAILED") return "失败";
  return s;
}

function statusDotClass(s: ArticleImportTaskStatus) {
  if (s === "SUCCEEDED") return "dot dotGreen";
  if (s === "FAILED") return "dot dotWarn";
  if (s === "PROCESSING" || s === "RETRYING") return "dot dotCyan";
  return "dot dotBrand";
}

function formatTime(value: string) {
  return value.slice(0, 19).replace("T", " ");
}

export default function ArticleImportPanel(props: {
  initialData: ImportTaskListResponse | null;
  initialError?: string | null;
}) {
  const [data, setData] = useState<ImportTaskListResponse | null>(props.initialData);
  const [status, setStatus] = useState<"ALL" | ArticleImportTaskStatus>(props.initialData?.status ?? "ALL");
  const [page, setPage] = useState(props.initialData?.page ?? 1);
  const [pageSize, setPageSize] = useState(props.initialData?.pageSize ?? 20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(props.initialError ?? null);

  // upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mounted = useRef(false);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  const load = useCallback(
    async (
      next: { page: number; pageSize: number; status: "ALL" | ArticleImportTaskStatus },
      options?: { keepBusy?: boolean },
    ) => {
      if (!options?.keepBusy) setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(next.page));
        params.set("pageSize", String(next.pageSize));
        if (next.status !== "ALL") params.set("status", next.status);
        const res = await apiRequest<ImportTaskListResponse>(`/api/admin/articles/imports?${params.toString()}`);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
        setData(null);
      } finally {
        if (!options?.keepBusy) setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!mounted.current) {
        mounted.current = true;
        if (!props.initialData) {
          void load({ page, pageSize, status });
        }
        return;
      }
      void load({ page, pageSize, status });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, page, pageSize, props.initialData, status]);

  async function retryTask(taskId: string) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest<{ id: string }>(`/api/admin/articles/imports/${taskId}/retry`, { method: "POST" });
      await load({ page, pageSize, status }, { keepBusy: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "重试失败");
    } finally {
      setBusy(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setUploadFiles(files);
    setUploadMsg(null);
  }

  function clearFileSelection() {
    setUploadFiles([]);
    setUploadMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (uploadFiles.length === 0) return;
    if (uploadFiles.length > 5) {
      setUploadMsg({ type: "err", text: "单次最多上传 5 个文件" });
      return;
    }

    setUploading(true);
    setUploadMsg(null);

    try {
      // Step 1: 上传文件入队
      const form = new FormData();
      for (const f of uploadFiles) form.append("files", f);

      const uploadRes = await authFetch("/api/admin/articles/import", { method: "POST", body: form });
      if (!uploadRes.ok) {
        const json = await uploadRes.json().catch(() => null) as { error?: { message?: string } } | null;
        const msg = json?.error?.message ?? `上传失败 (${uploadRes.status})`;
        setUploadMsg({ type: "err", text: msg });
        return;
      }
      const uploadJson = await uploadRes.json() as { success: boolean; data: UploadResult };
      const queued = uploadJson.success ? uploadJson.data.queued : 0;

      // Step 2: 触发批量解析
      const processRes = await authFetch("/api/admin/articles/imports/process", { method: "POST" });
      const processJson = await processRes.json().catch(() => null) as { data?: { processed?: number } } | null;
      const processed = processJson?.data?.processed ?? 0;

      setUploadMsg({
        type: "ok",
        text: `已入队 ${queued} 个任务，本次处理 ${processed} 个，稍后刷新可查看结果`,
      });
      clearFileSelection();
      // 刷新任务列表
      await load({ page: 1, pageSize, status }, { keepBusy: true });
      setPage(1);
    } catch (e) {
      setUploadMsg({ type: "err", text: e instanceof Error ? e.message : "上传失败" });
    } finally {
      setUploading(false);
    }
  }

  const isUploading = uploading;
  const isBusy = busy || isUploading;

  return (
    <div className="panel adminImportsPanel" data-testid="admin-import-panel">
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>导入任务</strong>
          <span>上传文件自动解析为草稿，支持 PDF / 图片 / Word / TXT</span>
        </div>
        <div className="actions">
          <span className="badge">共 {data?.total ?? 0} 个任务</span>
        </div>
      </div>

      {/* ── 上传区 ── */}
      <div className="subPanel">
        <div className="subPanelHeader">
          <strong>上传文件</strong>
          <span className="subMuted">单次最多 5 个，支持 pdf / png / jpg / webp / txt / md / doc / docx</span>
        </div>
        <div className="gridForm">
          <div className="field" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            {/* 隐藏的 file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              style={{ display: "none" }}
              onChange={handleFileChange}
              data-testid="import-file-input"
            />
            <Button
              className="btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              data-testid="import-choose-files"
            >
              选择文件
            </Button>
            {uploadFiles.length > 0 && (
              <span className="subMuted" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                已选 {uploadFiles.length} 个：{uploadFiles.map((f) => f.name).join("、")}
              </span>
            )}
            {uploadFiles.length > 0 && (
              <Button className="btn" onClick={clearFileSelection} disabled={isUploading}>
                清除
              </Button>
            )}
            <Button
              className="btn btnGreen"
              type="primary"
              disabled={uploadFiles.length === 0 || isUploading}
              onClick={() => void handleUpload()}
              data-testid="import-upload-submit"
            >
              {isUploading ? "上传中…" : "上传并解析"}
            </Button>
          </div>
        </div>
        {uploadMsg && (
          <div className={uploadMsg.type === "ok" ? "successBox" : "errorBox"} style={{ margin: "0 0 4px" }}>
            {uploadMsg.text}
          </div>
        )}
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      {/* ── 筛选区 ── */}
      <div className="subPanel">
        <div className="subPanelHeader">
          <strong>筛选</strong>
          <span className="subMuted">按状态过滤导入任务</span>
        </div>
        <div className="gridForm">
          <div className="field">
            <div className="label">状态</div>
            <Select
              className="input"
              value={status}
              options={STATUS_OPTIONS}
              onChange={(value) => {
                const nextStatus = String(value) as "ALL" | ArticleImportTaskStatus;
                setStatus(nextStatus);
                setPage(1);
              }}
              disabled={isBusy}
              data-testid="import-task-filter-status"
            />
          </div>
        </div>
      </div>

      {/* ── 任务列表 ── */}
      <div className="tableWrap">
        <div className="tableHeader adminImportTableHeader">
          <div>任务</div>
          <div>状态</div>
          <div>更新时间</div>
          <div>错误信息</div>
          <div />
        </div>

        {(data?.items ?? []).map((task) => {
          const canRetry = task.status === "FAILED";
          return (
            <div className="tableRow adminImportTableRow" key={task.id}>
              <div className="cell">
                <div className="commentArticle">
                  <strong className="commentArticleTitle">{task.fileName}</strong>
                  <span className="subMuted">{task.fileType} · {Math.ceil(task.fileSize / 1024)} KB</span>
                </div>
              </div>
              <div className="cell">
                <span className="badge" data-testid="import-task-status">
                  <span className={statusDotClass(task.status)} />
                  {statusLabel(task.status)}
                </span>
              </div>
              <div className="cell">
                <span className="subMuted">{formatTime(task.updatedAt)}</span>
              </div>
              <div className="cell">
                <span className="subMuted adminImportErrorText">{task.errorMessage ?? "-"}</span>
              </div>
              <div className="cell cellActions">
                <Button
                  className="btn"
                  disabled={isBusy || !canRetry}
                  onClick={() => void retryTask(task.id)}
                  data-testid="import-task-retry"
                >
                  重试
                </Button>
              </div>
            </div>
          );
        })}

        {!isBusy && data && data.items.length === 0 ? <div className="emptyLine">暂无导入任务</div> : null}
      </div>

      <div className="pager">
        <div className="pagerLeft">
          <Button className="btn" disabled={isBusy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button
            className="btn"
            disabled={isBusy || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
          <span className="subMuted">第 {page} / {totalPages} 页</span>
        </div>
        <div className="pagerRight">
          <span className="subMuted">每页</span>
          <Select
            className="input inputSm"
            value={String(pageSize)}
            onChange={(value) => {
              const next = Number.parseInt(String(value), 10);
              setPageSize(Number.isFinite(next) ? next : 20);
              setPage(1);
            }}
            disabled={isBusy}
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
