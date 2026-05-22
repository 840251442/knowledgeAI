"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "antd";

import PublicAuthModal from "@/components/auth/PublicAuthModal";

import "./public.css";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const [openAuth, setOpenAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  useEffect(() => {
    if (!openAuth) return;

    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenAuth(false);
      }
    }

    window.addEventListener("keydown", onKeydown);
    return () => {
      window.removeEventListener("keydown", onKeydown);
    };
  }, [openAuth]);

  return (
    <div className="publicShell">
      <header className="topbar">
        <div className="brandRow">
          <div className="brandLogo" aria-hidden="true" />
          <div>
            <p className="brandName">KnowledgeAI</p>
            <p className="brandDesc">公开知识库 · 混合搜索</p>
          </div>
        </div>
        <nav className="navRow">
          <Link className="chipLink" href="/">
            首页
          </Link>
          <Link className="chipLink" href="/admin/login">
            后台
          </Link>
          <Button
            className="chipLink chipLinkPrimary"
            htmlType="button"
            onClick={() => {
              setAuthMode("login");
              setOpenAuth(true);
            }}
          >
            登录
          </Button>
        </nav>
      </header>
      {children}
      <PublicAuthModal
        open={openAuth}
        mode={authMode}
        onClose={() => setOpenAuth(false)}
        onModeChange={setAuthMode}
      />
    </div>
  );
}

