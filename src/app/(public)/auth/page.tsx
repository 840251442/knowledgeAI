"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "antd";

import type { ApiResponse } from "@/types/api";

type AuthMode = "login" | "register";
type AuthMethod = "password" | "phone";

type AuthResponse = {
  userId: string;
  role: "ADMIN" | "PERSONAL";
  email: string | null;
  phone: string | null;
};

type OtpResponse = {
  id: string;
  phone: string;
  purpose: "LOGIN" | "REGISTER";
  code: string | null;
};

function buttonClass(active: boolean) {
  return active ? "btn btnPrimary" : "btn";
}

export default function PersonalAuthPage() {
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "login" ? "login" : "register";

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [method, setMethod] = useState<AuthMethod>("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestingOtp, setRequestingOtp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const response = await fetch("/api/me/articles", { cache: "no-store" });
      if (!cancelled && response.ok) {
        window.location.replace("/me/articles");
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  function resetFeedback() {
    setMessage("");
    setError("");
  }

  async function requestOtp() {
    const targetPhone = phone.trim();
    if (!targetPhone) {
      setError("请先输入手机号");
      return;
    }

    resetFeedback();
    setRequestingOtp(true);
    try {
      const response = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: targetPhone, purpose: mode === "register" ? "REGISTER" : "LOGIN" }),
      });
      const json = (await response.json()) as ApiResponse<OtpResponse>;
      if (!response.ok || !json.success) {
        setError(json.success ? "验证码发送失败" : json.error.message);
        return;
      }

      const hint = json.data.code ? `验证码已生成，开发环境验证码：${json.data.code}` : "验证码已发送";
      setMessage(hint);
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setRequestingOtp(false);
    }
  }

  async function submit() {
    resetFeedback();
    setSubmitting(true);

    try {
      let response: Response;
      if (method === "password") {
        if (mode === "register") {
          response = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: identifier.trim(), password }),
          });
        } else {
          response = await fetch("/api/auth/login/password", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ identifier: identifier.trim(), password }),
          });
        }
      } else if (mode === "register") {
        response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: phone.trim(), password, otpCode: otpCode.trim() }),
        });
      } else {
        response = await fetch("/api/auth/login/phone", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: phone.trim(), code: otpCode.trim() }),
        });
      }

      const json = (await response.json()) as ApiResponse<AuthResponse>;
      if (!response.ok || !json.success) {
        setError(json.success ? "认证失败" : json.error.message);
        return;
      }

      setMessage(mode === "register" ? "注册成功，正在进入个人中心…" : "登录成功，正在进入个人中心…");
      window.location.href = "/me/articles";
    } catch {
      setError("网络错误，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  }

  const formTestId = mode === "register" ? "personal-register-form" : "personal-login-form";
  const submitLabel =
    submitting ? (mode === "register" ? "注册中…" : "登录中…") : mode === "register" ? "注册并进入个人中心" : "登录进入个人中心";

  return (
    <main className="panel authShell">
      <div className="authCard">
        <div className="authHeader">
          <h1>{mode === "register" ? "个人用户注册" : "个人用户登录"}</h1>
          <p>支持邮箱密码登录，或手机号验证码登录。手机号注册时仍需设置密码，后续可改用密码登录。</p>
        </div>

        <div className="authTabs">
          <Button className={buttonClass(mode === "register")} htmlType="button" onClick={() => { resetFeedback(); setMode("register"); }}>
            注册
          </Button>
          <Button className={buttonClass(mode === "login")} htmlType="button" onClick={() => { resetFeedback(); setMode("login"); }}>
            登录
          </Button>
          <Button className={buttonClass(method === "password")} htmlType="button" onClick={() => { resetFeedback(); setMethod("password"); }}>
            邮箱 / 密码
          </Button>
          <Button className={buttonClass(method === "phone")} htmlType="button" onClick={() => { resetFeedback(); setMethod("phone"); }}>
            手机 / 验证码
          </Button>
        </div>

        <div className="authSplit">
          <form
            className="authForm"
            data-testid={formTestId}
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            {method === "password" ? (
              <>
                <input
                  className="input"
                  data-testid="personal-auth-email"
                  placeholder={mode === "register" ? "邮箱" : "邮箱或手机号"}
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                />
                <input
                  className="input"
                  data-testid="personal-auth-password"
                  placeholder="密码"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </>
            ) : (
              <>
                <input
                  className="input"
                  data-testid="personal-auth-phone"
                  placeholder="手机号"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                />
                {mode === "register" ? (
                  <input
                    className="input"
                    data-testid="personal-auth-password"
                    placeholder="设置登录密码"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                ) : null}
                <div className="authActions">
                  <input
                    className="input"
                    data-testid="personal-auth-otp"
                    placeholder="验证码"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value)}
                  />
                  <Button className="btn" htmlType="button" onClick={() => void requestOtp()} disabled={requestingOtp}>
                    {requestingOtp ? "发送中…" : "获取验证码"}
                  </Button>
                </div>
              </>
            )}

            {message ? <div className="authSuccess">{message}</div> : null}
            {error ? <div className="authError">{error}</div> : null}

            <Button className="btn btnPrimary" data-testid="personal-auth-submit" disabled={submitting} type="primary" htmlType="submit">
              {submitLabel}
            </Button>
          </form>

          <aside className="authAside">
            <strong>当前已接好的能力</strong>
            <p>邮箱密码注册与登录已直连现有认证 API，成功后会写入会话 Cookie。</p>
            <p>手机号模式支持验证码登录；手机号注册时会校验 OTP，并同时设置密码。</p>
            <p>完成认证后会进入个人文章页，查看自己的草稿、待审核和已发布状态。</p>
            <div className="authHint">
              还想去后台？<Button className="chipLink" href="/admin/login">管理员登录</Button>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}