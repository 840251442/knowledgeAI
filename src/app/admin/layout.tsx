"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { loadAuthSession } from "@/lib/auth/client-session";

import "./admin.css";

function NavLink({
  href,
  label,
  pill,
  active,
}: {
  href: string;
  label: string;
  pill: string;
  active: boolean;
}) {
  return (
    <Link className={active ? "navLink navLinkActive" : "navLink"} href={href} prefetch={false}>
      <span>{label}</span>
      <span className="pill">{pill}</span>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<"ADMIN" | "PERSONAL" | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  useEffect(() => {
    const syncRole = () => {
      const session = loadAuthSession();
      setRole(session?.role ?? null);
      setRoleReady(true);
    };

    queueMicrotask(syncRole);
    window.addEventListener("storage", syncRole);
    window.addEventListener("ka-auth-session-change", syncRole as EventListener);
    return () => {
      window.removeEventListener("storage", syncRole);
      window.removeEventListener("ka-auth-session-change", syncRole as EventListener);
    };
  }, []);

  if (pathname === "/admin/login") {
    return <div className="main">{children}</div>;
  }

  const isAdmin = role === "ADMIN";
  const isPersonal = role === "PERSONAL";
  const showMenu = roleReady && (isAdmin || isPersonal);
  const showSidebarSkeleton = !roleReady;

  return (
    <div className="adminApp">
      {showMenu || showSidebarSkeleton ? (
        <aside className="sidebar">
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div>
              <h1 className="brandTitle">KnowledgeAI</h1>
              <p className="brandSub">后台管理</p>
            </div>
          </div>

          {showSidebarSkeleton ? (
            <div className="sidebarSkeleton" aria-hidden="true">
              <span className="sidebarSkeletonItem" />
              <span className="sidebarSkeletonItem" />
              <span className="sidebarSkeletonItem" />
              <span className="sidebarSkeletonItem" />
            </div>
          ) : (
            <nav className="nav">
              <NavLink
                href="/admin/articles"
                label="文章管理"
                pill="文章"
                active={pathname.startsWith("/admin/articles")}
              />
              {isAdmin ? (
                <NavLink
                  href="/admin/categories"
                  label="分类管理"
                  pill="分类"
                  active={pathname.startsWith("/admin/categories")}
                />
              ) : null}
              {isAdmin ? (
                <NavLink
                  href="/admin/tags"
                  label="标签管理"
                  pill="标签"
                  active={pathname.startsWith("/admin/tags")}
                />
              ) : null}
              {isAdmin ? (
                <NavLink
                  href="/admin/comments"
                  label="评论管理"
                  pill="评论"
                  active={pathname.startsWith("/admin/comments")}
                />
              ) : null}
              {isAdmin ? (
                <NavLink
                  href="/admin/search-logs"
                  label="搜索日志"
                  pill="日志"
                  active={pathname.startsWith("/admin/search-logs")}
                />
              ) : null}
              <NavLink href="/admin/logout" label="退出" pill="退出" active={pathname.startsWith("/admin/logout")} />
              {isAdmin ? (
                <Link
                  className="navLink"
                  href="/"
                  prefetch={false}
                  onClick={(event) => {
                    event.preventDefault();
                    window.location.assign("/");
                  }}
                >
                  <span>返回公开站</span>
                  <span className="pill">公开站</span>
                </Link>
              ) : null}
            </nav>
          )}
        </aside>
      ) : null}

      <div className="main">{children}</div>
    </div>
  );
}
