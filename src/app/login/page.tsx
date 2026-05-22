import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--wb-bg)] px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(29,78,216,0.3),transparent_35%),radial-gradient(circle_at_90%_15%,rgba(22,163,74,0.24),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(212,160,23,0.2),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(160deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:34px_34px]" />

      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-3xl border border-white/15 bg-[linear-gradient(130deg,rgba(13,37,70,0.88),rgba(11,30,58,0.78))] p-7 shadow-[0_20px_60px_rgba(2,8,20,0.45)]">
          <p className="text-xs uppercase tracking-[0.16em] text-blue-200">World Cup 2026</p>
          <h1 className="mt-2 font-display text-6xl leading-none uppercase tracking-[0.1em] text-white md:text-7xl">
            WorldBet 26
          </h1>
          <p className="mt-4 max-w-xl text-sm text-slate-200 md:text-base">
            Plataforma premium de bolão com atmosfera de estádio, ranking competitivo
            e experiência de fantasy game em cada rodada.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/12 bg-white/5 p-3">
              <p className="font-display text-4xl text-white">48</p>
              <p className="text-xs text-slate-300">Seleções</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-white/5 p-3">
              <p className="font-display text-4xl text-white">104</p>
              <p className="text-xs text-slate-300">Partidas</p>
            </div>
            <div className="rounded-xl border border-white/12 bg-white/5 p-3">
              <p className="font-display text-4xl text-white">1</p>
              <p className="text-xs text-slate-300">Campeão</p>
            </div>
          </div>
        </section>

        <AuthForm />
      </div>
    </main>
  );
}
