import { MapPin, PackageOpen, Star } from "lucide-react";
import { useLocale } from "@/i18n/react";
import {
  TableCell,
  TableRow,
} from "@/components/ui";
import { formatMoney, orderTotal } from "@/features/orders/model";
import type {
  DeliveryCompany,
  Driver,
  OrderListItem,
} from "@/features/orders/types";
import { OrderStatus } from "@/features/orders/components/OrderStatus";
import { OrderDelivery } from "@/features/orders/components/OrderDelivery";
import { OrderRowActions } from "@/features/orders/components/OrderFulfillmentActions";

interface RowProps {
  order: OrderListItem;
  drivers: Driver[];
  companies: DeliveryCompany[];
  onChanged: () => void | Promise<void>;
  onError: (message: string) => void;
}

export function OrderDesktopRow({ order, drivers, companies, onChanged, onError }: RowProps) {
  const locale = useLocale();
  return (
    <TableRow className="border-b border-border last:border-0 transition-colors hover:bg-muted/40">
      <TableCell>
        <a
          href={`/orders/${order.id}`}
          className="inline-flex items-center gap-2 font-semibold text-link underline-offset-4 hover:underline"
        >
          <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
            <PackageOpen size={14} />
          </span>
          {order.orderNumber}
          {(order.hasReview ?? 0) > 0 && (
            <Star size={12} className="fill-warning text-warning" />
          )}
        </a>
      </TableCell>
      <TableCell>
        <p className="font-medium text-foreground">{order.customerName}</p>
      </TableCell>
      <TableCell>
        <span className="text-xs text-muted-foreground" dir="ltr">
          {order.phone}
        </span>
      </TableCell>
      <TableCell>
        <OrderStatus order={order} onChanged={onChanged} onError={onError} />
      </TableCell>
      <TableCell>
        <span className="inline-flex max-w-44 items-start gap-1.5 truncate text-xs font-medium">
          <MapPin size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          {order.wilaya}
          {order.commune ? ` · ${order.commune}` : ""}
        </span>
      </TableCell>
      <TableCell>
        <OrderDelivery order={order} companies={companies} />
      </TableCell>
      <TableCell className="text-end font-bold tabular-nums text-foreground">
        {formatMoney(orderTotal(order), locale)}
      </TableCell>
      <TableCell className="text-end">
        <OrderRowActions
          order={order}
          drivers={drivers}
          companies={companies}
          onChanged={onChanged}
          onError={onError}
        />
      </TableCell>
    </TableRow>
  );
}

export function OrderMobileCard({ order, drivers, companies, onChanged, onError }: RowProps) {
  const locale = useLocale();
  return (
    <article className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <a
              href={`/orders/${order.id}`}
              className="text-sm font-semibold text-link hover:underline"
            >
              {order.orderNumber}
            </a>
            {(order.hasReview ?? 0) > 0 && (
              <Star size={12} className="fill-warning text-warning" />
            )}
          </div>
          <p className="mt-0.5 truncate text-sm font-medium text-foreground">
            {order.customerName}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {order.phone}
          </p>
        </div>
        <div className="flex items-start gap-1">
          <OrderStatus order={order} onChanged={onChanged} onError={onError} />
          <OrderRowActions
            order={order}
            drivers={drivers}
            companies={companies}
            onChanged={onChanged}
            onError={onError}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <MapPin size={13} />
          {order.wilaya}
          {order.commune ? ` · ${order.commune}` : ""}
        </span>
        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
          {formatMoney(orderTotal(order), locale)}
        </span>
      </div>
      <div className="mt-2">
        <OrderDelivery order={order} companies={companies} />
      </div>
    </article>
  );
}
