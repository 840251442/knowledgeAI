import Link from "next/link";

import "./public.css";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
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
        </nav>
      </header>
      {children}
    </div>
  );
}

