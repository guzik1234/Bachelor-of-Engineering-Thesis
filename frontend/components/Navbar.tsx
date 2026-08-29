"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/ui/logo-mark";

const LINKS = [
  { href: "/dashboard", label: "Ścieżki" },
  { href: "/stats", label: "Statystyki" },
  { href: "/onboarding", label: "Preferencje" },
];

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const initials = (user?.full_name || user?.email || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <nav className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-slate-900">
          <LogoMark />
          <span className="hidden sm:inline">AI Ścieżki Edukacyjne</span>
        </Link>

        {user && (
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="mr-1 hidden items-center gap-1 rounded-full bg-slate-100/80 p-1 sm:flex">
              {LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                      active ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials || "U"}
            </div>
            <button
              onClick={logout}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              Wyloguj
            </button>
          </div>
        )}
      </div>

      {user && (
        <div className="flex items-center gap-1 overflow-x-auto border-t border-slate-200/70 px-4 py-1.5 sm:hidden">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex-none rounded-full px-3 py-1 text-sm font-medium transition",
                  active ? "bg-brand-50 text-brand-700" : "text-slate-500"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
