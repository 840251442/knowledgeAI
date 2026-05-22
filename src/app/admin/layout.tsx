"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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

  return (
    <div className="adminApp">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <div>
            <h1 className="brandTitle">KnowledgeAI</h1>
            <p className="brandSub">后台管理</p>
          </div>
        </div>

        <nav className="nav">
          <NavLink href="/admin/articles" label="文章管理" pill="文章" active={pathname.startsWith("/admin/articles")} />
          <NavLink href="/admin/categories" label="分类管理" pill="分类" active={pathname.startsWith("/admin/categories")} />
          <NavLink href="/admin/tags" label="标签管理" pill="标签" active={pathname.startsWith("/admin/tags")} />
          <NavLink href="/admin/search-logs" label="搜索日志" pill="日志" active={pathname.startsWith("/admin/search-logs")} />
          <NavLink href="/admin/logout" label="退出" pill="退出" active={pathname.startsWith("/admin/logout")} />
          <Link className="navLink" href="/">
            <span>返回公开站</span>
            <span className="pill">公开站</span>
          </Link>
        </nav>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}
