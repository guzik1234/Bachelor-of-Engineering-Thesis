"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { buttonStyles } from "@/components/ui/button";
import { LogoMark } from "@/components/ui/logo-mark";
import { LoadingState } from "@/components/ui/spinner";

type Status = "verifying" | "success" | "error";

const TITLES: Record<Status, string> = {
  verifying: "Potwierdzanie e-maila...",
  success: "E-mail potwierdzony",
  error: "Nie udało się potwierdzić",
};

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Brak tokenu weryfikacyjnego w linku. Sprawdź, czy skopiowałeś/aś cały link z maila.");
      return;
    }
    api
      .verifyEmail(token)
      .then((res) => {
        setStatus("success");
        setMessage(res.detail);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof ApiError ? err.message : "Nie udało się potwierdzić adresu e-mail.");
      });
  }, [token]);

  return (
    <Card className="w-full max-w-md animate-fade-up p-8 text-center">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Link href="/">
          <LogoMark className="h-11 w-11 rounded-xl" />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{TITLES[status]}</h1>
      </div>

      {status === "verifying" && <LoadingState label="Trwa weryfikacja..." />}

      {status !== "verifying" && (
        <p className={cn("text-sm", status === "success" ? "text-slate-600" : "text-red-600")}>{message}</p>
      )}

      {status === "error" && (
        <p className="mt-2 text-sm text-slate-500">
          Link mógł wygasnąć — możesz poprosić o nowy na stronie logowania.
        </p>
      )}

      {status !== "verifying" && (
        <Link href="/login" className={buttonStyles("primary", "md", "mt-6 w-full")}>
          Przejdź do logowania
        </Link>
      )}
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-brand-radial" />
      <Suspense fallback={<LoadingState label="Wczytywanie..." />}>
        <VerifyEmailContent />
      </Suspense>
    </main>
  );
}
