"use client";

import { useMemo, useState } from "react";

type LoginState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string };

export default function AdminLoginPage() {
  const [email, setEmail] = useState("admin@knowledgeai.dev");
  const [password, setPassword] = useState("dev");
  const [state, setState] = useState<LoginState>({ type: "idle" });

  const canSubmit = useMemo(() => email.trim() && password, [email, password]);

  async function onSubmit() {
    if (!canSubmit) return;
    setState({ type: "loading" });
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json()) as
        | { success: true; data: unknown }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "登录失败" : json.error.message });
        return;
      }
      window.location.href = "/admin/articles";
    } catch {
      setState({ type: "error", message: "网络错误" });
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>后台登录</h1>
      <p style={{ marginTop: 10, color: "rgba(255,255,255,.72)" }}>
        使用种子账号登录后进入后台文章管理。
      </p>
      <form
        data-testid="admin-login-form"
        style={{
          marginTop: 18,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,.12)",
          background: "rgba(255,255,255,.05)",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
        onSubmit={(e) => {
          e.preventDefault();
          void onSubmit();
        }}
      >
        <input
          data-testid="admin-login-email"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(0,0,0,.16)",
            color: "rgba(255,255,255,.92)",
            padding: "11px 12px",
            borderRadius: 14,
            fontSize: 14,
            outline: "none",
          }}
        />
        <input
          data-testid="admin-login-password"
          placeholder="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(0,0,0,.16)",
            color: "rgba(255,255,255,.92)",
            padding: "11px 12px",
            borderRadius: 14,
            fontSize: 14,
            outline: "none",
          }}
        />
        {state.type === "error" ? (
          <div
            style={{
              borderRadius: 14,
              border: "1px solid rgba(239,68,68,.35)",
              background: "rgba(239,68,68,.12)",
              padding: "10px 12px",
              color: "rgba(255,255,255,.88)",
              fontSize: 13,
            }}
          >
            {state.message}
          </div>
        ) : null}
        <button
          data-testid="admin-login-submit"
          type="submit"
          disabled={!canSubmit || state.type === "loading"}
          style={{
            width: "100%",
            border: "1px solid rgba(124,58,237,.44)",
            background:
              "linear-gradient(135deg, rgba(124,58,237,.85), rgba(6,182,212,.55))",
            color: "rgba(255,255,255,.92)",
            padding: "11px 12px",
            borderRadius: 14,
            fontSize: 14,
            cursor: "pointer",
            opacity: !canSubmit || state.type === "loading" ? 0.7 : 1,
          }}
        >
          {state.type === "loading" ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
