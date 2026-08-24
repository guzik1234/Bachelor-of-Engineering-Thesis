"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="font-semibold text-slate-900">
          AI Ścieżki Edukacyjne
        </Link>
        {user && (
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{user.full_name || user.email}</span>
            <Link href="/onboarding" className="text-slate-600 hover:text-slate-900">
              Preferencje
            </Link>
            <button onClick={logout} className="text-slate-600 hover:text-slate-900">
              Wyloguj
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
