export default function SearchBox(props: { defaultValue: string }) {
  return (
    <form className="heroRow" action="/search" data-testid="search-page-form">
      <input
        className="input"
        name="q"
        defaultValue={props.defaultValue}
        placeholder="例如：Redis 缓存一致性怎么做？"
        data-testid="search-page-input"
      />
      <button className="btn btnPrimary" type="submit">
        搜索
      </button>
    </form>
  );
}
