"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setUnverified(false);
    setResendState("idle");
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setUnverified(true);
      }
      setError(err instanceof ApiError ? err.message : "Nie udało się zalogować.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResendState("sending");
    try {
      await api.resendVerification(email);
    } finally {
      setResendState("sent");
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
          <h1 className="text-2xl font-bold text-slate-900">Zaloguj się</h1>
          <p className="text-sm text-slate-500">Wróć do swoich ścieżek edukacyjnych</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="E-mail">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ty@example.com"
            />
          </Field>
          <Field label="Hasło">
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              <p>{error}</p>
              {unverified && (
                <div className="mt-2">
                  {resendState === "sent" ? (
                    <p className="text-red-700">
                      Jeśli konto istnieje, wysłaliśmy nowy link weryfikacyjny — sprawdź skrzynkę.
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendState === "sending" || !email}
                      className="font-medium text-red-700 underline hover:text-red-800 disabled:opacity-60"
                    >
                      {resendState === "sending" ? "Wysyłanie..." : "Wyślij link weryfikacyjny ponownie"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <Button type="submit" disabled={submitting} className="mt-1 w-full">
            {submitting ? "Logowanie..." : "Zaloguj się"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Nie masz konta?{" "}
          <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
            Zarejestruj się
          </Link>
        </p>
      </Card>
    </main>
  );
}
