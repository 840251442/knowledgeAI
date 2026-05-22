export default function AdminRouteLoading() {
  return (
    <main>
      <div className="panel adminRouteLoading" aria-live="polite" aria-busy="true">
        <div className="adminRouteLoadingBar" />
        <div className="panelHeader">
          <div className="panelTitle">
            <strong>正在加载页面</strong>
            <span>请稍候，正在准备内容…</span>
          </div>
        </div>

        <div className="adminRouteLoadingBody">
          <div className="adminRouteLoadingCard">
            <span className="adminRouteLoadingLine adminRouteLoadingLineWide" />
            <span className="adminRouteLoadingLine" />
            <span className="adminRouteLoadingLine adminRouteLoadingLineShort" />
          </div>
          <div className="adminRouteLoadingCard">
            <span className="adminRouteLoadingLine adminRouteLoadingLineWide" />
            <span className="adminRouteLoadingLine" />
            <span className="adminRouteLoadingLine adminRouteLoadingLineShort" />
          </div>
          <div className="adminRouteLoadingCard">
            <span className="adminRouteLoadingLine adminRouteLoadingLineWide" />
            <span className="adminRouteLoadingLine" />
            <span className="adminRouteLoadingLine adminRouteLoadingLineShort" />
          </div>
        </div>
      </div>
    </main>
  );
}
