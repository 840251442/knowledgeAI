import Link from "next/link";

import "./admin.css";

function NavLink({
  href,
  label,
  pill,
}: {
  href: string;
  label: string;
  pill: string;
}) {
  return (
    <Link className="navLink" href={href} prefetch={false}>
      <span>{label}</span>
      <span className="pill">{pill}</span>
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
          <NavLink href="/admin/articles" label="文章管理" pill="Admin" />
          <NavLink href="/admin/categories" label="分类管理" pill="Tax" />
          <NavLink href="/admin/tags" label="标签管理" pill="Tag" />
          <NavLink href="/admin/search-logs" label="搜索日志" pill="Logs" />
          <NavLink href="/admin/logout" label="退出" pill="Out" />
          <Link className="navLink" href="/">
            <span>返回公开站</span>
            <span className="pill">Public</span>
          </Link>
        </nav>
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}
