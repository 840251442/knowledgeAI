"use client";

import { useState } from "react";
import { Button } from "antd";

export default function PersonalLogoutButton(props?: {
  label?: string;
  redirectTo?: string;
  testId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const label = props?.label ?? "退出登录";
  const redirectTo = props?.redirectTo ?? "/admin/login";
  const testId = props?.testId;

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = redirectTo;
    }
  }

  return (
    <Button className="chipLink" htmlType="button" onClick={() => void logout()} disabled={loading} data-testid={testId}>
      {loading ? "退出中…" : label}
    </Button>
  );
}