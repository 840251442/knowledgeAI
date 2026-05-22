"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "antd";

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
    <main className="adminLoginPage">
      <div className="adminLoginCard">
        <h1>后台登录</h1>
        <p>使用种子账号登录后进入后台文章管理。</p>
        <form
          data-testid="admin-login-form"
          className="adminLoginForm"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <Input
            data-testid="admin-login-email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
          <Input.Password
            data-testid="admin-login-password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
          {state.type === "error" ? <div className="adminLoginError">{state.message}</div> : null}
          <Button
            data-testid="admin-login-submit"
            htmlType="submit"
            type="primary"
            disabled={!canSubmit || state.type === "loading"}
            className="btn btnPrimary adminLoginSubmit"
          >
            {state.type === "loading" ? "登录中…" : "登录"}
          </Button>
        </form>
      </div>
    </main>
  );
}
