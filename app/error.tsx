"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="empty-state">
      <h1>暂时无法加载导航</h1>
      <p>请检查数据库和初始化配置，然后重试。</p>
      <button className="button primary" onClick={reset}>
        重新加载
      </button>
    </main>
  );
}
