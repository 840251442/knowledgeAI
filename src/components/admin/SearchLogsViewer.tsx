"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Select } from "antd";

import { apiRequest } from "./adminApi";

type SearchLogRow = {
  id: string;
  query: string;
  queryType: string;
  resultCount: number;
  latencyMs: number;
  createdAt: string;
};

type SearchLogAggregates = {
  avgLatencyMs: number;
  topQueries: Array<{ query: string; count: number }>;
  noResultQueries: Array<{ query: string; count: number }>;
};

type SearchLogResponse = {
  page: number;
  pageSize: number;
  total: number;
  items: SearchLogRow[];
  aggregates: SearchLogAggregates;
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function SearchLogsViewer() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [data, setData] = useState<SearchLogResponse | null>(null);

  const totalPages = useMemo(() => {
    const total = data?.total ?? 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [data?.total, pageSize]);

  async function load(next: { page: number; pageSize: number }) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest<SearchLogResponse>(`/api/admin/search-logs?page=${next.page}&pageSize=${next.pageSize}`);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    Promise.resolve().then(() => void load({ page, pageSize }));
  }, [page, pageSize]);

  const aggregates = data?.aggregates ?? {
    avgLatencyMs: 0,
    topQueries: [],
    noResultQueries: [],
  };

  return (
    <div className="panel" data-testid="search-logs-panel">
      <div className="panelHeader">
        <div className="panelTitle">
          <strong>搜索日志</strong>
          <span>用于观察搜索效果与耗时（只读）</span>
        </div>
        <div className="actions">
          <span className="badge">
            <span className={cx("dot", "dotBrand")} />
            平均 {aggregates.avgLatencyMs}ms
          </span>
          <span className="badge">
            <span className={cx("dot", "dotCyan")} />
            共 {data?.total ?? 0} 条
          </span>
        </div>
      </div>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="subGrid">
        <div className="subPanel">
          <div className="subPanelHeader">
            <strong>Top Queries</strong>
            <span className="subMuted">出现次数最多</span>
          </div>
          <div className="kvList" data-testid="search-logs-top-queries">
            {aggregates.topQueries.length ? (
              aggregates.topQueries.map((x) => (
                <div key={x.query} className="kvRow">
                  <div className="kvKey">{x.query}</div>
                  <div className="kvVal">{x.count}</div>
                </div>
              ))
            ) : (
              <div className="emptyLine">暂无数据</div>
            )}
          </div>
        </div>

        <div className="subPanel">
          <div className="subPanelHeader">
            <strong>No Result</strong>
            <span className="subMuted">无结果最多</span>
          </div>
          <div className="kvList" data-testid="search-logs-no-result">
            {aggregates.noResultQueries.length ? (
              aggregates.noResultQueries.map((x) => (
                <div key={x.query} className="kvRow">
                  <div className="kvKey">{x.query}</div>
                  <div className="kvVal">{x.count}</div>
                </div>
              ))
            ) : (
              <div className="emptyLine">暂无数据</div>
            )}
          </div>
        </div>
      </div>

      <div className="tableWrap">
        <div className="tableHeader">
          <div>Query</div>
          <div>Type</div>
          <div>Hits</div>
          <div>Latency</div>
          <div>Time</div>
        </div>

        {(data?.items ?? []).map((r) => (
          <div key={r.id} className="tableRow" data-testid="search-log-row">
            <div className="cell">
              <span className="mono" data-testid="search-log-query">
                {r.query}
              </span>
            </div>
            <div className="cell">
              <span className="subMuted">{r.queryType}</span>
            </div>
            <div className="cell">
              <span className="mono">{r.resultCount}</span>
            </div>
            <div className="cell">
              <span className="mono">{r.latencyMs}ms</span>
            </div>
            <div className="cell">
              <span className="subMuted">{r.createdAt.slice(0, 19).replace("T", " ")}</span>
            </div>
          </div>
        ))}

        {!busy && data && data.items.length === 0 ? <div className="emptyLine">暂无日志</div> : null}
      </div>

      <div className="pager">
        <div className="pagerLeft">
          <Button className="btn" disabled={busy || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一页
          </Button>
          <Button className="btn" disabled={busy || page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
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
              { value: "100", label: "100" },
            ]}
          >
          </Select>
        </div>
      </div>
    </div>
  );
}
