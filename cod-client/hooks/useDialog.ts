import { useState } from "react";

/**
 * useDialog Hook
 * 
 * Manages dialog state with open/close functionality and optional data.
 * 
 * @example
 * ```tsx
 * const { open, data, openDialog, closeDialog } = useDialog<Customer>();
 * 
 * <Button onClick={() => openDialog(customer)}>Edit</Button>
 * <Dialog open={open} onOpenChange={closeDialog}>
 *   {data && <CustomerForm customer={data} />}
 * </Dialog>
 * ```
 */
export function useDialog<T = any>() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const openDialog = (initialData?: T) => {
    if (initialData) {
      setData(initialData);
    }
    setOpen(true);
  };

  const closeDialog = () => {
    setOpen(false);
    setTimeout(() => setData(null), 200); // Clear after animation
  };

  return { open, data, openDialog, closeDialog };
}
