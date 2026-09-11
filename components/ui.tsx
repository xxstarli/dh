"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { X, MoreHorizontal, Pencil, Trash2, ExternalLink } from "lucide-react";
export function Modal({
  title,
  children,
  onClose,
  busy = false,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const [returnTarget] = useState(() =>
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement | null)
      : null,
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => {
              const target =
                returnTarget?.isConnected && returnTarget !== document.body
                  ? returnTarget
                  : document.querySelector<HTMLElement>(".manage-button");
              target?.focus();
            });
          }}
          aria-describedby={undefined}
          className={"modal " + (wide ? "site-modal" : "")}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <header className="modal-header">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close
              className="icon-button"
              aria-label="关闭弹窗"
              disabled={busy}
            >
              <X size={22} />
            </Dialog.Close>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function Menu({
  name,
  category = false,
  onEdit,
  onDelete,
  url,
  disabled = false,
}: {
  name: string;
  category?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  url?: string;
  disabled?: boolean;
}) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className="icon-button more-button"
        aria-label={name + "更多操作"}
        disabled={disabled}
      >
        <MoreHorizontal size={21} />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          className="menu"
          align="end"
          sideOffset={5}
          collisionPadding={12}
        >
          <Dropdown.Item onSelect={onEdit}>
            <Pencil size={16} />
            {category ? "编辑分类" : "编辑"}
          </Dropdown.Item>
          <Dropdown.Item className="danger-text" onSelect={onDelete}>
            <Trash2 size={16} />
            {category ? "删除分类" : "删除"}
          </Dropdown.Item>
          {url ? (
            <Dropdown.Item asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} />
                打开网站
              </a>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
export function Footer({
  busy,
  onClose,
  label = "保存",
  danger = false,
}: {
  busy: boolean;
  onClose: () => void;
  label?: string;
  danger?: boolean;
}) {
  return (
    <footer className="modal-footer">
      <button
        type="button"
        className="button secondary"
        onClick={onClose}
        disabled={busy}
      >
        取消
      </button>
      <button
        type="submit"
        className={"button " + (danger ? "danger" : "primary")}
        disabled={busy}
      >
        {busy ? (danger ? "删除中…" : "保存中…") : label}
      </button>
    </footer>
  );
}
