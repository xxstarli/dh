"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import {
  Search,
  Settings,
  CheckCircle2,
  Info,
  Plus,
  X,
  FolderOpen,
} from "lucide-react";
import type { NavigationData, Category, Site } from "@/lib/types";
import { filterCategories } from "@/lib/validation";
import { api } from "@/lib/client";
import { BrandIcon } from "./icon";
import { CategorySection } from "./category-section";
import { LoginDialog, CategoryDialog, ConfirmDialog } from "./basic-dialogs";
import { SiteDialog } from "./site-dialog";
const subscribeReady = () => () => {};
const ready = () => true;
const serverReady = () => false;
type Editor =
  | { type: "category"; category?: Category }
  | { type: "site"; site?: Site; categoryId: string }
  | { type: "delete-category"; category: Category }
  | { type: "delete-site"; site: Site }
  | null;
export function Navigation({
  initialData,
  initialAdmin,
}: {
  initialData: NavigationData;
  initialAdmin: boolean;
}) {
  const [data, setData] = useState(initialData),
    [admin, setAdmin] = useState(initialAdmin),
    [search, setSearch] = useState(""),
    [loginOpen, setLoginOpen] = useState(false),
    [editor, setEditor] = useState<Editor>(null),
    [message, setMessage] = useState(""),
    [sorting, setSorting] = useState(false),
    [loggingOut, setLoggingOut] = useState(false);
  const sortLock = useRef(false);
  const hydrated = useSyncExternalStore(subscribeReady, ready, serverReady);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    document.title = data.settings.site_name;
  }, [data.settings.site_name]);
  useEffect(() => {
    const expired = () => {
      setAdmin(false);
      setLoginOpen(true);
      setMessage("管理会话已失效，请重新验证；当前表单内容已保留。");
    };
    window.addEventListener("admin-expired", expired);
    const check = () => {
      if (admin && !document.hidden)
        void api<{ authenticated: boolean }>("/api/admin/session")
          .then((r) => {
            if (!r.authenticated) expired();
          })
          .catch(() => {});
    };
    window.addEventListener("focus", check);
    const interval = setInterval(check, 60000);
    return () => {
      window.removeEventListener("admin-expired", expired);
      window.removeEventListener("focus", check);
      clearInterval(interval);
    };
  }, [admin]);
  async function refresh() {
    try {
      setData(await api<NavigationData>("/api/navigation"));
    } catch {
      setMessage("修改已保存，但刷新数据失败，请刷新页面查看最新数据。");
    }
  }
  async function logout() {
    if (loggingOut || sorting) return;
    setLoggingOut(true);
    try {
      await api("/api/admin/logout", "POST");
      setAdmin(false);
      setEditor(null);
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setLoggingOut(false);
    }
  }
  async function persistOrder(
    next: NavigationData,
    path: string,
    payload: unknown,
  ) {
    if (sortLock.current) return;
    sortLock.current = true;
    setSorting(true);
    const previous = data;
    setData(next);
    try {
      await api(path, "PUT", payload);
    } catch (e) {
      setData(previous);
      setMessage((e as Error).message + "，已恢复原顺序。");
    } finally {
      sortLock.current = false;
      setSorting(false);
    }
  }
  function sortCategories(event: DragEndEvent) {
    if (
      !event.over ||
      event.active.id === event.over.id ||
      sortLock.current ||
      search.trim()
    )
      return;
    const from = data.categories.findIndex((c) => c.id === event.active.id),
      to = data.categories.findIndex((c) => c.id === event.over?.id);
    if (from < 0 || to < 0) return;
    const categories = arrayMove(data.categories, from, to);
    void persistOrder(
      { ...data, categories },
      "/api/admin/categories/reorder",
      { category_ids: categories.map((c) => c.id) },
    );
  }
  function sortSites(id: string, ids: string[]) {
    if (sortLock.current || search.trim()) return;
    const categories = data.categories.map((c) =>
      c.id === id
        ? {
            ...c,
            sites: ids.map((siteId) => c.sites.find((s) => s.id === siteId)!),
          }
        : c,
    );
    void persistOrder({ ...data, categories }, "/api/admin/sites/reorder", {
      category_id: id,
      site_ids: ids,
    });
  }
  function requestCategoryDelete(category: Category) {
    if (category.sites.length) {
      setMessage(
        `当前分类下还有 ${category.sites.length} 个网站，请先移动或删除这些网站。`,
      );
      return;
    }
    setEditor({ type: "delete-category", category });
  }
  const visible = filterCategories(data.categories, search, admin),
    disabled = !hydrated || sorting || loggingOut;
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <BrandIcon url={data.settings.site_logo} />
            <div>
              <h1>{data.settings.site_name}</h1>
              <p>高效上网，从这里开始</p>
            </div>
          </div>
          <div className="search-box">
            <Search size={20} />
            <input
              aria-label="搜索网站"
              placeholder="搜索网站..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearch("");
              }}
            />
            {search ? (
              <button
                className="icon-button"
                aria-label="清除搜索"
                onClick={() => setSearch("")}
              >
                <X size={17} />
              </button>
            ) : null}
          </div>
          <button
            className="button primary manage-button"
            disabled={disabled}
            onClick={() => (admin ? void logout() : setLoginOpen(true))}
          >
            {admin ? <CheckCircle2 size={19} /> : <Settings size={18} />}
            <span>{loggingOut ? "退出中…" : admin ? "完成管理" : "管理"}</span>
          </button>
        </div>
      </header>
      <main className={"page-content" + (admin ? " admin-content" : "")}>
        {admin ? (
          <div className="admin-banner">
            <Info size={20} />
            <span>
              当前处于管理模式，可添加、编辑、删除和拖动排序分类或网站。
            </span>
          </div>
        ) : null}
        {admin && search.trim() ? (
          <p className="search-note">
            搜索期间暂停拖动排序。
            <button onClick={() => setSearch("")}>清除搜索</button>
            后可调整顺序。
          </p>
        ) : null}
        {message ? (
          <div className="notice" role="alert">
            <span>{message}</span>
            <button
              className="icon-button"
              aria-label="关闭提示"
              onClick={() => setMessage("")}
            >
              <X size={18} />
            </button>
          </div>
        ) : null}
        <DndContext
          id="categories"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={sortCategories}
        >
          <SortableContext
            items={visible.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {visible.map((c) => (
              <CategorySection
                key={c.id}
                category={c}
                admin={admin}
                disabled={disabled || !!search.trim()}
                onEdit={() => setEditor({ type: "category", category: c })}
                onDelete={() =>
                  requestCategoryDelete(
                    data.categories.find((v) => v.id === c.id)!,
                  )
                }
                onAddSite={() => setEditor({ type: "site", categoryId: c.id })}
                onEditSite={(s) =>
                  setEditor({ type: "site", site: s, categoryId: c.id })
                }
                onDeleteSite={(s) =>
                  setEditor({ type: "delete-site", site: s })
                }
                onSortSites={sortSites}
              />
            ))}
          </SortableContext>
        </DndContext>
        {!visible.length ? (
          <div className="empty-state">
            <FolderOpen size={36} />
            <h2>
              {search.trim()
                ? "没有找到相关网站"
                : !data.categories.length
                  ? "还没有添加分类"
                  : "暂无网站"}
            </h2>
            {search.trim() ? (
              <button
                className="button secondary"
                onClick={() => setSearch("")}
              >
                清除搜索
              </button>
            ) : admin ? (
              <button
                className="add-button"
                onClick={() => setEditor({ type: "category" })}
              >
                <Plus size={18} />
                添加第一个分类
              </button>
            ) : (
              <p>进入管理模式，开始整理你的常用网站。</p>
            )}
          </div>
        ) : null}
        {admin && data.categories.length > 0 ? (
          <button
            className="add-button add-category"
            disabled={disabled}
            onClick={() => setEditor({ type: "category" })}
          >
            <Plus size={20} />
            添加分类
          </button>
        ) : null}
      </main>
      {editor?.type === "category" ? (
        <CategoryDialog
          category={editor.category}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      ) : null}
      {editor?.type === "site" ? (
        <SiteDialog
          site={editor.site}
          categoryId={editor.categoryId}
          categories={data.categories}
          onClose={() => setEditor(null)}
          onSaved={refresh}
        />
      ) : null}
      {editor?.type === "delete-site" ? (
        <ConfirmDialog
          title="删除网站"
          message={`确定删除“${editor.site.name}”吗？`}
          onClose={() => setEditor(null)}
          onConfirm={async () => {
            await api("/api/admin/sites/" + editor.site.id, "DELETE");
            await refresh();
          }}
        />
      ) : null}
      {editor?.type === "delete-category" ? (
        <ConfirmDialog
          title="删除分类"
          message={`确定删除“${editor.category.name}”分类吗？`}
          onClose={() => setEditor(null)}
          onConfirm={async () => {
            await api("/api/admin/categories/" + editor.category.id, "DELETE");
            await refresh();
          }}
        />
      ) : null}
      {loginOpen ? (
        <LoginDialog
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            setAdmin(true);
            setLoginOpen(false);
            setMessage("");
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}
