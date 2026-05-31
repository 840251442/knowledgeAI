"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Select } from "antd";

import type { ArticleImportTaskItem, ArticleImportTaskStatus } from "@/types/article";
import { apiRequest } from "./adminApi";

type ImportTaskListResponse = {
  page: number;
  pageSize: number;
  total: number;
  status: ArticleImportTaskStatus | null;
  items: ArticleImportTaskItem[];
};

const STATUS_OPTIONS: Array<{ value: "ALL" | ArticleImportTaskStatus; label: string }> = [
  { value: "ALL", label: "全部状态" },
  { value: "QUEUED", label: "排队中" },
  { value: "PROCESSING", label: "处理中" },
  { value: "RETRYING", label: "重试中" },
  { value: "SUCCEEDED", label: "成功" },
  { value: "FAILED", label: "失败" },
];

function statusLabel(status: ArticleImportTaskStatus) {
  if (status === "QUEUED") return "排队中";
  if (status === "PROCESSING") return "处理中";
  if (status === "RETRYING") return "重试中";
  if (status === "SUCCEEDED") return "成功";
  if (status === "FAILED") return "失败";
  return status;
}

function statusDotClass(status: ArticleImportTaskStatus) {
  if (status === "SUCCEEDED") return "dot dotGreen";
  if (status === "FAILED") return "dot dotWarn";
  if (status === "PROCESSING" || status === "RETRYING") return "dot dotCyan";
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

  return (
    <div className="panel adminImportsPanel" data-testid="admin-import-panel">
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>导入任务</strong>
          <span>查看解析进度、失败原因并支持重试</span>
        </div>
        <div className="actions">
          <span className="badge">共 {data?.total ?? 0} 个任务</span>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

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
              disabled={busy}
              data-testid="import-task-filter-status"
            >
            </Select>
          </div>
        </div>
      </div>

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
                  disabled={busy || !canRetry}
                  onClick={() => void retryTask(task.id)}
                  data-testid="import-task-retry"
                >
                  重试
                </Button>
              </div>
            </div>
          );
        })}

        {!busy && data && data.items.length === 0 ? <div className="emptyLine">暂无导入任务</div> : null}
      </div>

      <div className="pager">
        <div className="pagerLeft">
          <Button className="btn" disabled={busy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button
            className="btn"
            disabled={busy || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </Button>
          <span className="subMuted">
            第 {page} / {totalPages} 页
          </span>
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
            disabled={busy}
            options={[
              { value: "10", label: "10" },
              { value: "20", label: "20" },
              { value: "50", label: "50" },
            ]}
          >
          </Select>
        </div>
      </div>
    </div>
  );
}
