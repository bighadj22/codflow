import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

export function Table({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <table
      {...props}
      className={`w-full caption-bottom text-start text-[13.5px] ${className}`}
    />
  );
}

export function TableHeader({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      {...props}
      className={`border-b border-border/80 bg-muted/35 text-[11px] font-bold uppercase tracking-wider text-muted-foreground select-none ${className}`}
    />
  );
}

export function TableBody({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      {...props}
      className={`divide-y divide-border/60 ${className}`}
    />
  );
}

export function TableRow({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      {...props}
      className={`transition-colors hover:bg-muted/25 ${className}`}
    />
  );
}

export function TableHead({
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      {...props}
      className={`px-4 py-2.5 text-start font-semibold align-middle ${className}`}
    />
  );
}

export function TableCell({
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      {...props}
      className={`px-4 py-3 align-middle text-foreground/90 ${className}`}
    />
  );
}
