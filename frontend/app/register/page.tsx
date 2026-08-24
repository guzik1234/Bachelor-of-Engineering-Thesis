"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(email, password, fullName || undefined);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nie udało się utworzyć konta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-bold">Załóż konto</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Imię i nazwisko (opcjonalnie)
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          E-mail
          <input
            type="email"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Hasło
          <input
            type="password"
            required
            minLength={8}
            className="rounded-md border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Tworzenie konta..." : "Zarejestruj się"}
        </button>
      </form>
      <p className="text-sm text-slate-600">
        Masz już konto?{" "}
        <Link href="/login" className="underline">
          Zaloguj się
        </Link>
      </p>
    </main>
  );
}
