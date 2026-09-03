import { useState, type SyntheticEvent } from "react";
import { LogOut, Menu, Search } from "lucide-react";
import { useIdentity } from "@/features/auth/components/RequireAuth";
import { authClient } from "@/lib/auth/client";
import { notify } from "@/lib/notify";
import { useLocale, useT } from "@/i18n/react";
import { Logo } from "@/components/brand/Logo";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";

export function Brand() {
  return (
    <a href="/" className="flex min-w-0 items-center" aria-label="CodFlow — home">
      <Logo variant="light" height={26} />
    </a>
  );
}


export function AccountControl({ onDark = false }: { onDark?: boolean }) {
  const identity = useIdentity();
  const tA = useT("auth");
  const [signOutBusy, setSignOutBusy] = useState(false);
  const initial = (identity?.user.name ?? identity?.user.email ?? "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  async function signOut() {
    if (signOutBusy) return;
    setSignOutBusy(true);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        notify.error(tA("unexpected_error"));
        return;
      }
      notify.flashSuccess(tA("sign_out_success"));
      window.location.replace("/sign-in");
    } catch {
      notify.error(tA("unexpected_error"));
    } finally {
      setSignOutBusy(false);
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <a
        href="/profile"
        className="flex min-w-0 items-center gap-2 rounded-lg p-1 -m-1 transition-colors hover:bg-white/10"
        aria-label={tA("profile_link_aria")}
        title={tA("profile_link_aria")}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand text-xs font-bold text-brand-foreground">
          {initial}
        </span>
        <span className="hidden min-w-0 text-start lg:block">
          <span
            className={`block max-w-36 truncate text-xs font-semibold ${onDark ? "text-white" : "text-foreground"}`}
          >
            {identity?.user.name ?? identity?.user.email}
          </span>
        </span>
      </a>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={signOutBusy}
        aria-busy={signOutBusy}
        aria-label={tA("sign_out_aria")}
        className={
          onDark
            ? "grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-white/75 transition-colors hover:bg-white/15 hover:text-white"
            : "grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        }
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}


export function DashboardTopbar({ onMenu }: { onMenu?: () => void }) {
  const locale = useLocale();
  const tN = useT("navigation");
  const [query, setQuery] = useState("");

  function submitSearch(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    window.location.assign(
      value ? `/orders?search=${encodeURIComponent(value)}` : "/orders",
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-[var(--topbar)] px-3 text-white sm:px-4">
      <div className="flex w-auto shrink-0 items-center gap-2 md:w-64 md:ps-3.5">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label={tN("mobile.more")}
            className="grid size-10 place-items-center rounded-lg bg-white/10 text-white md:hidden"
          >
            <Menu size={19} />
          </button>
        )}
        <Brand />
      </div>
      <div className="hidden min-w-0 flex-1 justify-center sm:flex">
        <form
          onSubmit={submitSearch}
          className="relative block w-full max-w-[640px]"
        >
          <Search
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-white/55"
          />
          <input
            type="search"
            aria-label={tN("navbar.search_placeholder")}
            placeholder={tN("navbar.search_placeholder")}
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            className="h-9 w-full rounded-lg border border-white/15 bg-white/10 ps-10 pe-3 text-sm text-white outline-none transition-colors placeholder:text-white/55 hover:bg-white/15 focus:border-white/30 focus:bg-white/15 focus:ring-2 focus:ring-white/20"
          />
        </form>
      </div>
      <div className="ms-auto flex items-center gap-2">
        <div className="hidden md:block">
          <LanguageSwitcher locale={locale} inverted />
        </div>
        <ThemeSwitcher inverted />
        <AccountControl onDark />
      </div>
    </header>
  );
}

