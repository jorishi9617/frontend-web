"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authenticate } from "@/lib/api";
import { useSession } from "@/lib/session";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const setSession = useSession((state) => state.setSession);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const session = await authenticate(mode, email, password);
      setSession(session);
      router.replace("/home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="mb-2 text-3xl font-semibold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      <p className="mb-8 text-slate-400">Sign in to start a secure video call.</p>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm">Email
          <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="block text-sm">Password
          <input className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 p-3" type="password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-indigo-500 p-3 font-medium disabled:opacity-50">
          {busy ? "Please wait..." : mode === "login" ? "Sign in" : "Register"}
        </button>
      </form>
      <p className="mt-6 text-sm text-slate-400">
        {mode === "login" ? "New here? " : "Already registered? "}
        <Link className="text-indigo-300" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </main>
  );
}
