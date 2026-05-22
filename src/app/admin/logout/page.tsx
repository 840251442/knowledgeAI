"use client";

import { useEffect } from "react";

export default function AdminLogoutPage() {
  useEffect(() => {
    let cancelled = false;

    async function logout() {
      try {
        await fetch("/api/admin/logout", {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
      } finally {
        if (!cancelled) {
          window.location.replace("/admin/login");
        }
      }
    }

    void logout();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="adminLoginPage">
      <div className="adminLoginCard">
        <h1>正在退出…</h1>
        <p>请稍候，正在清理登录状态并跳转到登录页。</p>
      </div>
    </main>
  );
}

