export interface Site {
  id: string;
  category_id: string;
  name: string;
  url: string;
  icon_type: "auto" | "custom" | "default";
  icon_url: string | null;
  description: string | null;
  sort_order: number;
}
export interface Category {
  id: string;
  name: string;
  sort_order: number;
  sites: Site[];
}
export interface NavigationData {
  settings: { site_name: string; site_logo: string | null };
  categories: Category[];
}
