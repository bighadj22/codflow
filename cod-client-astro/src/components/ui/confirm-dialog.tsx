import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { useT } from "@/i18n/react";
import { Button } from "./button";
import { Dialog } from "./dialog";

export type ConfirmDialogOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmRequest = ConfirmDialogOptions & {
  resolve: (confirmed: boolean) => void;
};

const ConfirmDialogContext = createContext<
  ((options: ConfirmDialogOptions) => Promise<boolean>) | null
>(null);

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const common = useT("common");
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const requestRef = useRef<ConfirmRequest | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const confirm = useCallback(
    (options: ConfirmDialogOptions) =>
      new Promise<boolean>((resolve) => {
        requestRef.current?.resolve(false);
        const next = { ...options, resolve };
        requestRef.current = next;
        setRequest(next);
      }),
    [],
  );

  const settle = useCallback((confirmed: boolean) => {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    current?.resolve(confirmed);
  }, []);

  useEffect(() => () => requestRef.current?.resolve(false), []);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <Dialog
        open={request !== null}
        onClose={() => settle(false)}
        title={request?.title ?? ""}
        description={request?.description}
        icon={
          request?.tone === "danger" ? (
            <AlertTriangle
              size={18}
              strokeWidth={2}
              className="text-destructive"
              aria-hidden="true"
            />
          ) : (
            <HelpCircle size={18} strokeWidth={2} aria-hidden="true" />
          )
        }
        role="alertdialog"
        initialFocusRef={cancelRef}
        showClose={false}
        className="max-w-md"
        footer={
          request && (
            <>
              <Button
                ref={cancelRef}
                type="button"
                variant="secondary"
                onClick={() => settle(false)}
              >
                {request.cancelLabel ?? common("cancel")}
              </Button>
              <Button
                type="button"
                variant={request.tone === "danger" ? "danger" : "primary"}
                onClick={() => settle(true)}
              >
                {request.confirmLabel ?? common("confirm")}
              </Button>
            </>
          )
        }
      />
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm)
    throw new Error(
      "useConfirmDialog must be used within ConfirmDialogProvider",
    );
  return confirm;
}
