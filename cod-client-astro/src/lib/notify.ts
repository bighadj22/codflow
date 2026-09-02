import { toast } from "react-hot-toast";

const FLASH_KEY = "codflow:toast";

type FlashToast = {
  message: string;
  type: "success" | "error";
};

function show({ message, type }: FlashToast): void {
  toast[type](message);
}

function flash(message: string, type: FlashToast["type"]): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type } satisfies FlashToast));
  } catch {
    show({ message, type });
  }
}

export const notify = {
  success(message: string): void {
    toast.success(message);
  },
  error(message: string): void {
    toast.error(message);
  },
  flashSuccess(message: string): void {
    flash(message, "success");
  },
  flashError(message: string): void {
    flash(message, "error");
  },
};

export function consumeFlashToast(): void {
  if (typeof window === "undefined") return;

  let value: string | null;
  try {
    value = window.sessionStorage.getItem(FLASH_KEY);
    window.sessionStorage.removeItem(FLASH_KEY);
  } catch {
    return;
  }

  if (!value) return;

  try {
    const parsed = JSON.parse(value) as Partial<FlashToast>;
    if (typeof parsed.message !== "string" || (parsed.type !== "success" && parsed.type !== "error")) return;
    show({ message: parsed.message, type: parsed.type });
  } catch {}
}
