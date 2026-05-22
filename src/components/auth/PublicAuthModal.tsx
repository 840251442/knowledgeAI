"use client";

import { useMemo, useState } from "react";
import { Button } from "antd";

import type { ApiResponse } from "@/types/api";

type AuthMode = "login" | "register";

type AuthResponse = {
  userId: string;
  role: "ADMIN" | "PERSONAL";
  email: string | null;
  phone: string | null;
};

export default function PublicAuthModal(props: {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => identifier.trim().length > 0 && password.length > 0, [identifier, password]);

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    resetFeedback();
    setSubmitting(true);

    try {
      const response =
        props.mode === "register"
          ? await fetch("/api/auth/register", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email: identifier.trim(), password }),
            })
          : await fetch("/api/auth/login/password", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ identifier: identifier.trim(), password }),
            });

      const json = (await response.json()) as ApiResponse<AuthResponse>;
      if (!response.ok || !json.success) {
        setError(json.success ? "认证失败" : json.error.message);
        return;
      }

      setMessage(props.mode === "register" ? "注册成功，正在进入个人中心…" : "登录成功，正在进入个人中心…");
      window.location.href = "/me/articles";
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  if (!props.open) return null;

  return (
    <div
      className="authModalMask"
      role="dialog"
      aria-modal="true"
      aria-label={props.mode === "register" ? "注册" : "登录"}
      onClick={props.onClose}
    >
      <div className="authModal" onClick={(event) => event.stopPropagation()}>
        <Button className="authModalClose" htmlType="button" aria-label="关闭" onClick={props.onClose}>
          ×
        </Button>
        <h3>{props.mode === "register" ? "注册账号" : "账号登录"}</h3>
        <form className="authForm" onSubmit={submit}>
          <label htmlFor="auth-identifier">邮箱</label>
          <input
            id="auth-identifier"
            className="input"
            placeholder="请输入邮箱"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
          />
          <label htmlFor="auth-password">密码</label>
          <input
            id="auth-password"
            className="input"
            type="password"
            placeholder={props.mode === "register" ? "设置密码" : "请输入密码"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          {message ? <div className="authMessage">{message}</div> : null}
          {error ? <div className="authError">{error}</div> : null}

          <Button className="btn btnPrimary" type="primary" htmlType="submit" disabled={!canSubmit || submitting}>
            {submitting ? (props.mode === "register" ? "注册中…" : "登录中…") : props.mode === "register" ? "注册" : "登录"}
          </Button>

          <p className="authHint">
            {props.mode === "register" ? "已有账号？" : "没有账号？"}
            <Button
              className="authInlineBtn"
              htmlType="button"
              onClick={() => {
                resetFeedback();
                props.onModeChange(props.mode === "register" ? "login" : "register");
              }}
            >
              {props.mode === "register" ? "去登录" : "去注册"}
            </Button>
          </p>
        </form>
      </div>
    </div>
  );
}
