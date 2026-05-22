"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type AuthMode = "login" | "signup";

function buildSyntheticEmail(username: string): string {
  const normalized = username.trim().toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]/g, "-");
  return `${safe || "user"}@bolao.local`;
}

export function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  const supabaseEnabled = isSupabaseConfigured();

  async function handleSupabaseAuth() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      throw new Error("Supabase não configurado.");
    }

    const normalizedUsername = username.trim().toLowerCase();
    const syntheticEmail = buildSyntheticEmail(normalizedUsername);
    const normalizedDisplayName = displayName.trim();

    if (mode === "signup") {
      const { data, error: signUpError } = await client.auth.signUp({
        email: syntheticEmail,
        password,
        options: {
          data: {
            display_name: normalizedDisplayName,
            username: normalizedUsername,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.user) {
        const profilePayload = {
          id: data.user.id,
          email: data.user.email ?? syntheticEmail,
          username: normalizedUsername,
          display_name: normalizedDisplayName,
          is_admin: false,
        };

        const firstAttempt = await client
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" });

        if (firstAttempt.error) {
          const fallbackAttempt = await client
            .from("profiles")
            .upsert(
              {
                id: data.user.id,
                email: data.user.email ?? syntheticEmail,
                display_name: normalizedDisplayName,
                is_admin: false,
              },
              { onConflict: "id" },
            );

          if (fallbackAttempt.error) {
            throw fallbackAttempt.error;
          }
        }
      }

      if (!data.session) {
        setMessage("Cadastro criado. Confirme o email para liberar o acesso.");
        return;
      }
    } else {
      const { error: signInError } = await client.auth.signInWithPassword({
        email: syntheticEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }
    }
  }

  async function handleLocalAuth() {
    const endpoint =
      mode === "signup" ? "/api/local-auth/signup" : "/api/local-auth/login";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username,
        displayName,
        password,
      }),
    });

    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
    };

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error ?? "Não foi possível autenticar.");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsLoading(true);

    try {
      if (mode === "signup" && !displayName.trim()) {
        throw new Error("Informe nome.");
      }
      if (!username.trim()) {
        throw new Error("Informe usuário.");
      }
      if (!password.trim()) {
        throw new Error("Informe senha.");
      }

      if (supabaseEnabled) {
        await handleSupabaseAuth();
      } else {
        await handleLocalAuth();
      }

      router.push("/");
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível autenticar.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/15 bg-[linear-gradient(160deg,rgba(15,31,58,0.95),rgba(11,30,58,0.86))] p-6 shadow-[0_20px_60px_rgba(3,9,22,0.45)] backdrop-blur-md">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-3xl uppercase tracking-[0.09em] text-white">
          Acesso
        </h2>
        <span className="rounded-full border border-white/12 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
          {supabaseEnabled ? "Supabase Auth" : "Modo local/Postgres"}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "login" ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10"
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
            mode === "signup"
              ? "bg-white/15 text-white"
              : "text-slate-300 hover:bg-white/10"
          }`}
        >
          Cadastro
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" ? (
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-wide text-slate-300">Nome público</span>
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Seu nome no ranking"
            />
          </label>
        ) : null}

        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-slate-300">Usuário</span>
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="seu-usuario"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-wide text-slate-300">Senha</span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-red-400/45 bg-red-500/15 px-3 py-2 text-sm text-red-100">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="rounded-xl border border-amber-300/45 bg-amber-500/15 px-3 py-2 text-sm text-amber-100">
            {message}
          </p>
        ) : null}

        <Button type="submit" disabled={isLoading} className="mt-2 w-full">
          {isLoading ? "Processando..." : mode === "login" ? "Entrar" : "Criar conta"}
        </Button>
      </form>
    </section>
  );
}
