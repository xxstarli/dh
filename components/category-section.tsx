"use client";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Folder,
  Star,
  Bot,
  Monitor,
  Briefcase,
  Palette,
  WalletCards,
  GripVertical,
  Pencil,
  Plus,
} from "lucide-react";
import type { Category, Site } from "@/lib/types";
import { SiteCard } from "./site-card";
import { Menu } from "./ui";
function CategoryIcon({ name }: { name: string }) {
  const Icon = /常用/.test(name)
    ? Star
    : /AI|人工智能/i.test(name)
      ? Bot
      : /开发/.test(name)
        ? Monitor
        : /办公/.test(name)
          ? Briefcase
          : /设计/.test(name)
            ? Palette
            : /卡牌/.test(name)
              ? WalletCards
              : Folder;
  return (
    <Icon
      className={"category-icon " + (Icon === Star ? "star" : "")}
      size={21}
    />
  );
}
export function CategorySection({
  category,
  admin,
  disabled,
  onEdit,
  onDelete,
  onAddSite,
  onEditSite,
  onDeleteSite,
  onSortSites,
}: {
  category: Category;
  admin: boolean;
  disabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddSite: () => void;
  onEditSite: (s: Site) => void;
  onDeleteSite: (s: Site) => void;
  onSortSites: (id: string, ids: string[]) => void;
}) {
  const {
    setNodeRef,
    transform,
    transition,
    isDragging,
    attributes,
    listeners,
  } = useSortable({ id: category.id, disabled: !admin || disabled });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  function end(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const ids = category.sites.map((s) => s.id);
    const from = ids.indexOf(String(event.active.id)),
      to = ids.indexOf(String(event.over.id));
    if (from >= 0 && to >= 0)
      onSortSites(category.id, arrayMove(ids, from, to));
  }
  return (
    <section
      aria-label={category.name}
      data-category-id={category.id}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
      className={
        "category" +
        (admin ? " managed-category" : "") +
        (isDragging ? " dragging" : "")
      }
    >
      <header className="category-header">
        {admin ? (
          <button
            className="drag-handle category-drag"
            aria-label={"拖动分类 " + category.name}
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical size={20} />
          </button>
        ) : null}
        <CategoryIcon name={category.name} />
        <h2>{category.name}</h2>
        <span className="count" aria-label={category.sites.length + " 个网站"}>
          {category.sites.length}
        </span>
        {admin ? (
          <>
            <button
              className="icon-button edit-category"
              aria-label={"编辑分类 " + category.name}
              onClick={onEdit}
              disabled={disabled}
            >
              <Pencil size={14} />
            </button>
            <span className="category-menu">
              <Menu
                name={category.name}
                category
                onEdit={onEdit}
                onDelete={onDelete}
                disabled={disabled}
              />
            </span>
          </>
        ) : null}
      </header>
      <DndContext
        id={"sites-" + category.id}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={end}
      >
        <SortableContext
          items={category.sites.map((s) => s.id)}
          strategy={rectSortingStrategy}
        >
          <div className="site-grid">
            {category.sites.map((s) => (
              <SiteCard
                key={s.id}
                site={s}
                admin={admin}
                disabled={disabled}
                onEdit={() => onEditSite(s)}
                onDelete={() => onDeleteSite(s)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {admin ? (
        <>
          {category.sites.length === 0 ? (
            <p className="category-empty">暂无网站</p>
          ) : null}
          <button
            className="add-button"
            onClick={onAddSite}
            disabled={disabled}
          >
            <Plus size={18} />
            添加网站
          </button>
        </>
      ) : null}
    </section>
  );
}
