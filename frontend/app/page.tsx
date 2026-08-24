"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-24 text-center">
      <h1 className="text-4xl font-bold text-slate-900">
        Spersonalizowane ścieżki edukacyjne dla programistów
      </h1>
      <p className="text-lg text-slate-600">
        Wybierz technologię, określ swój poziom i dostępny czas — model AI zbuduje dla Ciebie
        dopasowaną ścieżkę nauki wraz z materiałami, zadaniami i quizami.
      </p>
      {!loading && (
        <div className="flex gap-4">
          {user ? (
            <Link href="/dashboard" className="rounded-md bg-slate-900 px-5 py-2.5 text-white">
              Przejdź do panelu
            </Link>
          ) : (
            <>
              <Link href="/register" className="rounded-md bg-slate-900 px-5 py-2.5 text-white">
                Zacznij naukę
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-slate-300 px-5 py-2.5 text-slate-900"
              >
                Zaloguj się
              </Link>
            </>
          )}
        </div>
      )}
    </main>
  );
}
