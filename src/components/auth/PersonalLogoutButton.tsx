"use client";

import { useState } from "react";

export default function PersonalLogoutButton() {
  const [loading, setLoading] = useState(false);

  async function logout() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/auth?mode=login";
    }
  }

  return (
    <button className="chipLink" type="button" onClick={() => void logout()} disabled={loading}>
      {loading ? "退出中…" : "退出登录"}
    </button>
  );
}