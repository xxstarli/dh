"use client";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { Site } from "@/lib/types";
import { SiteIcon } from "./icon";
import { Menu } from "./ui";
export function SiteCard({
  site,
  admin,
  disabled,
  onEdit,
  onDelete,
}: {
  site: Site;
  admin: boolean;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id: site.id, disabled: !admin || disabled });
  const body = (
    <>
      <SiteIcon url={site.icon_url} name={site.name} />
      <span className="site-text">
        <strong>{site.name}</strong>
        <span>{site.description || new URL(site.url).hostname}</span>
      </span>
    </>
  );
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
      className={"site-wrap" + (isDragging ? " dragging" : "")}
      data-site-id={site.id}
    >
      {admin ? (
        <div className="site-card managed">
          <button
            className="drag-handle"
            aria-label={"拖动网站 " + site.name}
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={20} />
          </button>
          {body}
          <Menu
            name={site.name}
            onEdit={onEdit}
            onDelete={onDelete}
            url={site.url}
            disabled={disabled}
          />
        </div>
      ) : (
        <a
          className="site-card"
          href={site.url}
          target="_blank"
          rel="noopener noreferrer"
          title={
            site.name + " — " + (site.description || new URL(site.url).hostname)
          }
        >
          {body}
        </a>
      )}
    </div>
  );
}
