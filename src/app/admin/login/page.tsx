"use client";

import { useMemo, useState } from "react";
import { Button, Input } from "antd";
import Image from "next/image";

type LoginState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string };

type AuthMode = "login" | "register";

export default function AdminLoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [state, setState] = useState<LoginState>({ type: "idle" });
  const [successMessage, setSuccessMessage] = useState("");

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false;
    if (mode === "register") return confirmPassword.length > 0;
    return true;
  }, [email, password, confirmPassword, mode]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setState({ type: "idle" });
    setSuccessMessage("");
    setConfirmPassword("");
  }

  async function onSubmit() {
    if (!canSubmit) return;
    if (mode === "register" && password !== confirmPassword) {
      setState({ type: "error", message: "两次输入的密码不一致" });
      return;
    }

    setState({ type: "loading" });
    setSuccessMessage("");
    try {
      const endpoint = mode === "register" ? "/api/auth/register" : "/api/admin/login";
      const payload = mode === "register" ? { email, password } : { email, password };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as
        | { success: true; data: unknown }
        | { success: false; error: { message: string } };
      if (!res.ok || !json.success) {
        setState({ type: "error", message: json.success ? "认证失败" : json.error.message });
        return;
      }

      if (mode === "register") {
        setSuccessMessage("注册成功，正在进入后台…");
      } else {
        setSuccessMessage("登录成功，正在进入后台…");
      }
      window.location.href = "/admin/articles";
    } catch {
      setState({ type: "error", message: "网络错误" });
    }
  }

  return (
    <main className="adminLoginPage">
      <div className="adminLoginCard">
        <div className="adminLoginBrand" aria-hidden="true">
          <Image
            className="adminLoginBrandImage"
            src="/assets/login-mascot.png"
            alt=""
            width={72}
            height={72}
          />
        </div>
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
          {mode === "register" ? (
            <Input.Password
              placeholder="确认密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
            />
          ) : null}
          {state.type === "error" ? <div className="adminLoginError">{state.message}</div> : null}
          {successMessage ? <div className="authSuccess">{successMessage}</div> : null}
          <Button
            data-testid="admin-login-submit"
            htmlType="submit"
            type="primary"
            disabled={!canSubmit || state.type === "loading"}
            className="btn btnPrimary adminLoginSubmit"
          >
            {state.type === "loading"
              ? mode === "register"
                ? "注册中…"
                : "登录中…"
              : mode === "register"
                ? "注册并进入后台"
                : "登录"}
          </Button>
          <p className="adminLoginSwitch">
            {mode === "register" ? "已有账号？" : "暂时没有账号？"}
            <Button
              className="adminLoginInlineBtn"
              htmlType="button"
              onClick={() => switchMode(mode === "register" ? "login" : "register")}
            >
              {mode === "register" ? "去登录" : "去注册"}
            </Button>
          </p>
        </form>
      </div>
    </main>
  );
}
