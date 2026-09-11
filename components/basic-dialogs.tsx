"use client";
import { useState } from "react";
import { Modal, Footer } from "./ui";
import { api } from "@/lib/client";
import { categorySchema } from "@/lib/validation";
import type { Category } from "@/lib/types";
export function LoginDialog({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", "POST", { password });
      onSuccess();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="管理验证" onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label htmlFor="admin-password">管理密码</label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={!!error}
            autoFocus
            disabled={busy}
          />
          {error ? (
            <p role="alert" className="field-error">
              {error}
            </p>
          ) : null}
        </div>
        <Footer
          busy={busy}
          onClose={onClose}
          label={busy ? "验证中…" : "进入管理"}
        />
      </form>
    </Modal>
  );
}
export function CategoryDialog({
  category,
  onClose,
  onSaved,
}: {
  category?: Category;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(category?.name || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const valid = categorySchema.safeParse({ name });
    if (!valid.success) {
      setError(valid.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(
        "/api/admin/categories" + (category ? "/" + category.id : ""),
        category ? "PATCH" : "POST",
        valid.data,
      );
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={category ? "编辑分类" : "添加分类"}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit} noValidate>
        <div className="modal-body">
          <label htmlFor="category-name">
            分类名称 <em>*</em>
          </label>
          <div className="input-count">
            <input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              aria-invalid={!!error}
              autoFocus
              disabled={busy}
            />
            <span>{name.length}/30</span>
          </div>
          {error ? (
            <p role="alert" className="field-error">
              {error}
            </p>
          ) : null}
        </div>
        <Footer busy={busy} onClose={onClose} />
      </form>
    </Modal>
  );
}
export function ConfirmDialog({
  title,
  message,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <p>{message}</p>
          <p className="muted">删除后无法恢复。</p>
          {error ? (
            <p role="alert" className="field-error">
              {error}
            </p>
          ) : null}
        </div>
        <Footer busy={busy} onClose={onClose} label="确认删除" danger />
      </form>
    </Modal>
  );
}
