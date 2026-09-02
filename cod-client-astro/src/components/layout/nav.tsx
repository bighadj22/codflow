import {
  Building2,
  FolderOpen,
  Gift,
  Layers,
  LayoutDashboard,
  Package,
  PackageX,
  Settings,
  Shield,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { canScope, useIdentity } from "@/features/auth/components/RequireAuth";
import { useT } from "@/i18n/react";

export type NavLeaf = {
  kind: "leaf";
  label: string;
  icon: LucideIcon;
  href: string;
  scope?: string;
  badge?: string;
};

export type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  scope?: string;
  badge?: string;
  children: NavLeaf[];
};

export type NavNode = NavLeaf | NavGroup;

export type NavSection = {
  label: string;
  items: NavNode[];
};

export function useNavSections(): NavSection[] {
  const identity = useIdentity();
  const tN = useT("navigation");
  const sections: NavSection[] = [
    {
      label: tN("sidebar.general"),
      items: [
        {
          kind: "leaf",
          href: "/dashboard",
          label: tN("sidebar.dashboard"),
          icon: LayoutDashboard,
          scope: "dashboard:view",
        },
        {
          kind: "group",
          id: "orders",
          label: tN("sidebar.orders"),
          icon: ShoppingCart,
          scope: "orders:read",
          children: [
            {
              kind: "leaf",
              href: "/orders",
              label: tN("sidebar.orders_all"),
              icon: ShoppingCart,
              scope: "orders:read",
            },
            {
              kind: "leaf",
              href: "/orders/abandoned",
              label: tN("sidebar.orders_abandoned"),
              icon: PackageX,
              scope: "abandoned_orders:read",
            },
          ],
        },
        {
          kind: "group",
          id: "customers",
          label: tN("sidebar.customers"),
          icon: Users,
          scope: "customers:read",
          children: [
            {
              kind: "leaf",
              href: "/customers",
              label: tN("sidebar.customers"),
              icon: Users,
              scope: "customers:read",
            },
            {
              kind: "leaf",
              href: "/customer-groups",
              label: tN("sidebar.customer_groups"),
              icon: Layers,
              scope: "customer_groups:read",
            },
            {
              kind: "leaf",
              href: "/customer-tags",
              label: tN("sidebar.customer_tags"),
              icon: Tag,
              scope: "customer_tags:read",
            },
          ],
        },
        {
          kind: "leaf",
          href: "/reviews",
          label: tN("sidebar.reviews"),
          icon: Star,
          scope: "reviews:read",
        },
      ],
    },
    {
      label: tN("sidebar.inventory"),
      items: [
        {
          kind: "group",
          id: "products",
          label: tN("sidebar.products"),
          icon: Layers,
          href: "/products",
          scope: "products:read",
          children: [
            {
              kind: "leaf",
              href: "/product-groups",
              label: tN("sidebar.categories"),
              icon: FolderOpen,
              scope: "product_groups:read",
            },
            {
              kind: "leaf",
              href: "/products/stock",
              label: tN("sidebar.stock_management"),
              icon: Package,
              scope: "products:read",
            },
            {
              kind: "leaf",
              href: "/offers",
              label: tN("sidebar.offers"),
              icon: Gift,
              scope: "offers:read",
            },
          ],
        },
        {
          kind: "group",
          id: "delivery",
          label: tN("sidebar.delivery"),
          icon: Truck,
          scope: "delivery:read",
          children: [
            {
              kind: "leaf",
              href: "/delivery/drivers",
              label: tN("sidebar.delivery_drivers"),
              icon: Truck,
              scope: "delivery:read",
            },
            {
              kind: "leaf",
              href: "/delivery/companies",
              label: tN("sidebar.delivery_companies"),
              icon: Building2,
              scope: "delivery:read",
            },
            {
              kind: "leaf",
              href: "/delivery/shipping-profiles",
              label: tN("sidebar.delivery_shipping"),
              icon: Package,
              scope: "delivery:read",
            },
          ],
        },
      ],
    },
    {
      label: tN("sidebar.system"),
      items: [
        {
          kind: "leaf",
          href: "/team",
          label: tN("sidebar.team"),
          icon: Shield,
          scope: "admin",
        },
        {
          kind: "leaf",
          href: "/mcp",
          label: tN("sidebar.mcp"),
          icon: Sparkles,
          scope: "mcp:view",
          badge: "BETA",
        },
        {
          kind: "leaf",
          href: "/settings",
          label: tN("sidebar.settings"),
          icon: Settings,
          scope: "admin",
        },
      ],
    },
  ];

  return sections
    .map((section) => ({
      ...section,
      items: section.items
        .map((item) =>
          item.kind === "group"
            ? {
                ...item,
                children: item.children.filter(
                  (child) =>
                    !child.scope ||
                    child.scope === "admin"
                      ? identity?.role === "admin"
                      : canScope(identity, child.scope),
                ),
              }
            : item,
        )
        .filter((item) => {
          if (item.scope) {
            if (item.scope === "admin") {
              if (identity?.role !== "admin") return false;
            } else if (!canScope(identity, item.scope)) {
              return false;
            }
          }
          if (item.kind === "group") return item.children.length > 0;
          return true;
        }),
    }))
    .filter((section) => section.items.length > 0);
}

export function isCurrentPath(currentPath: string, href: string): boolean {
  if (href === "/") return currentPath === "/";
  if (href === "/orders") {
    return (
      currentPath === "/orders" ||
      (currentPath.startsWith("/orders/") &&
        currentPath !== "/orders/abandoned")
    );
  }
  if (href === "/products") {
    return (
      currentPath === "/products" ||
      (currentPath.startsWith("/products/") &&
        currentPath !== "/products/stock")
    );
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}
