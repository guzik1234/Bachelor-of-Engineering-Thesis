"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-brand-radial" />
      <Card className="w-full max-w-md animate-fade-up p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link href="/">
            <LogoMark className="h-11 w-11 rounded-xl" />
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Załóż konto</h1>
          <p className="text-sm text-slate-500">Zacznij naukę z dopasowaną ścieżką AI</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Imię i nazwisko (opcjonalnie)">
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jan Kowalski" />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@example.com"
            />
          </Field>
          <Field label="Hasło" hint="Minimum 8 znaków">
            <Input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? "Tworzenie konta..." : "Zarejestruj się"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Masz już konto?{" "}
          <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
            Zaloguj się
          </Link>
        </p>
      </Card>
    </main>
  );
}
