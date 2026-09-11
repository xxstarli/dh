"use client";
import { useRef, useState } from "react";
import { CheckCircle2, RefreshCw, Upload } from "lucide-react";
import type { Category, Site } from "@/lib/types";
import { siteSchema, normalizeUrl } from "@/lib/validation";
import { api } from "@/lib/client";
import { SiteIcon } from "./icon";
import { Modal, Footer } from "./ui";
export function SiteDialog({
  site,
  categoryId,
  categories,
  onClose,
  onSaved,
}: {
  site?: Site;
  categoryId: string;
  categories: Category[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(site?.name || ""),
    [url, setUrl] = useState(site?.url || ""),
    [description, setDescription] = useState(site?.description || ""),
    [category, setCategory] = useState(site?.category_id || categoryId);
  const [icon, setIcon] = useState<{
    type: Site["icon_type"];
    url: string | null;
  }>({ type: site?.icon_type || "default", url: site?.icon_url || null });
  const [busy, setBusy] = useState(false),
    [fetching, setFetching] = useState(false),
    [uploading, setUploading] = useState(false),
    [attempted, setAttempted] = useState(!!site),
    [error, setError] = useState(""),
    [iconError, setIconError] = useState(""),
    [errors, setErrors] = useState<Record<string, string>>({});
  const uploadRef = useRef<HTMLInputElement>(null),
    generation = useRef(0),
    lastFetched = useRef(site?.url || ""),
    lock = useRef(false);
  const validUrl = (() => {
    try {
      return normalizeUrl(url);
    } catch {
      return null;
    }
  })();
  function changeUrl(next: string) {
    setUrl(next);
    generation.current++;
    setFetching(false);
    if (icon.type !== "custom") {
      setIcon({ type: "default", url: null });
      setAttempted(false);
      lastFetched.current = "";
    }
  }
  async function fetchIcon(force = false) {
    let normalized: string;
    try {
      normalized = normalizeUrl(url);
      setUrl(normalized);
      setErrors((v) => ({ ...v, url: "" }));
    } catch {
      setErrors((v) => ({ ...v, url: "请输入正确的 HTTP / HTTPS 网站地址" }));
      return;
    }
    if (
      !force &&
      (icon.type === "custom" || lastFetched.current === normalized)
    )
      return;
    const current = ++generation.current;
    setFetching(true);
    setIconError("");
    lastFetched.current = normalized;
    if (force) setIcon({ type: "default", url: null });
    try {
      const response = await api<{ success: boolean; icon_url: string | null }>(
        "/api/admin/favicon",
        "POST",
        { url: normalized },
      );
      if (current === generation.current) {
        setIcon({
          type: response.icon_url ? "auto" : "default",
          url: response.icon_url,
        });
        setAttempted(true);
      }
    } catch (e) {
      if (current === generation.current) {
        setIcon({ type: "default", url: null });
        setAttempted(true);
        setIconError((e as Error).message);
      }
    } finally {
      if (current === generation.current) setFetching(false);
    }
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setIconError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setIconError("仅支持 PNG、JPG、WebP 图片");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setIconError("图片大小不能超过 2MB");
      return;
    }
    generation.current++;
    setFetching(false);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const result = await api<{ icon_url: string }>(
        "/api/admin/uploads/site-icon",
        "POST",
        form,
      );
      setIcon({ type: "custom", url: result.icon_url });
    } catch (e) {
      setIconError((e as Error).message);
    } finally {
      setUploading(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (lock.current || uploading) return;
    const valid = siteSchema.safeParse({
      name,
      url,
      description,
      category_id: category,
      icon_type: icon.type,
      icon_url: icon.url,
    });
    if (!valid.success) {
      const fields: Record<string, string> = {};
      for (const issue of valid.error.issues)
        fields[String(issue.path[0])] = issue.message;
      setErrors(fields);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setErrors({});
    generation.current++;
    setFetching(false);
    try {
      await api(
        "/api/admin/sites" + (site ? "/" + site.id : ""),
        site ? "PATCH" : "POST",
        valid.data,
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const fieldError = (field: string) =>
    errors[field] ? (
      <p className="field-error" role="alert">
        {errors[field]}
      </p>
    ) : null;
  return (
    <Modal
      title={site ? "编辑网站" : "添加网站"}
      onClose={() => {
        generation.current++;
        onClose();
      }}
      busy={busy || uploading}
      wide
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body site-fields">
          <fieldset disabled={busy} className="fields">
            <div className="field">
              <label htmlFor="site-name">
                网站名称 <em>*</em>
              </label>
              <div className="input-count">
                <input
                  id="site-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  autoFocus
                  aria-invalid={!!errors.name}
                />
                <span>{name.length}/30</span>
              </div>
              {fieldError("name")}
            </div>
            <div className="field">
              <label htmlFor="site-url">
                网站地址 <em>*</em>
              </label>
              <div className="input-count">
                <input
                  id="site-url"
                  value={url}
                  onChange={(e) => changeUrl(e.target.value)}
                  onBlur={() => void fetchIcon()}
                  placeholder="https://www.example.com"
                  aria-invalid={!!errors.url}
                />
                {validUrl ? (
                  <CheckCircle2 className="valid-check" size={20} />
                ) : null}
              </div>
              {fieldError("url")}
              <p className="hint">
                请输入完整的网址，如：https://www.example.com
              </p>
            </div>
            <div className="field">
              <label>网站图标</label>
              <div className="icon-editor">
                <SiteIcon url={icon.url} name={name || "网站"} large />
                <div className="icon-options">
                  <p
                    className={icon.url ? "icon-status success" : "icon-status"}
                  >
                    {icon.url ? <CheckCircle2 size={19} /> : null}
                    {uploading
                      ? "正在上传图片…"
                      : fetching
                        ? "正在获取网站图标…"
                        : icon.type === "custom"
                          ? "已使用自定义图标"
                          : icon.url
                            ? "已自动获取网站图标"
                            : attempted
                              ? "未获取到网站图标，将使用默认图标"
                              : "填写网址后自动获取网站图标"}
                  </p>
                  <div className="icon-actions">
                    <button
                      type="button"
                      className="button secondary"
                      disabled={fetching || uploading}
                      onClick={() => void fetchIcon(true)}
                    >
                      <RefreshCw
                        size={18}
                        className={fetching ? "spinning" : ""}
                      />
                      {icon.type === "custom" ? "恢复自动获取" : "重新获取"}
                    </button>
                    <button
                      type="button"
                      className="button upload-button"
                      disabled={uploading}
                      onClick={() => uploadRef.current?.click()}
                    >
                      <Upload size={18} />
                      上传图片
                    </button>
                  </div>
                  <input
                    className="visually-hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    ref={uploadRef}
                    aria-label="上传网站图标"
                    onChange={(e) => void upload(e.target.files?.[0])}
                  />
                  <p className="hint">
                    支持 PNG、JPG、WebP 格式，大小不超过 2MB
                  </p>
                </div>
              </div>
              {iconError ? (
                <p role="alert" className="field-error">
                  {iconError}
                </p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="site-description">网站说明</label>
              <div className="input-count">
                <input
                  id="site-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={50}
                  aria-invalid={!!errors.description}
                />
                <span>{description.length}/50</span>
              </div>
              {fieldError("description")}
              <p className="hint">选填，将显示在网站卡片下方</p>
            </div>
            <div className="field">
              <label htmlFor="site-category">
                所属分类 <em>*</em>
              </label>
              <select
                id="site-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-invalid={!!errors.category_id}
              >
                <option value="" disabled>
                  请选择分类
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fieldError("category_id")}
            </div>
          </fieldset>
          {error ? (
            <p role="alert" className="field-error">
              {error}
            </p>
          ) : null}
        </div>
        <Footer busy={busy || uploading} onClose={onClose} />
      </form>
    </Modal>
  );
}
