import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getLeaderboard, getPredictionsForUser } from "@/lib/data";

export default async function PerfilPage() {
  const viewer = await requireAuthenticatedViewer();
  const [predictions, leaderboard] = await Promise.all([
    getPredictionsForUser(viewer.id),
    getLeaderboard(),
  ]);

  const position = leaderboard.findIndex((row) => row.userId === viewer.id) + 1;
  const current = leaderboard.find((row) => row.userId === viewer.id);

  return (
    <AppShell
      title="Meu Perfil"
      subtitle="Visão pessoal de desempenho e status no bolão"
      viewer={viewer}
    >
      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Surface className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-300">Participante</p>
              <h2 className="mt-1 font-display text-5xl uppercase tracking-[0.08em] text-white">
                {viewer.displayName}
              </h2>
              <p className="text-sm text-slate-300">@{viewer.username}</p>
            </div>
            <Badge tone={viewer.isAdmin ? "admin" : "upcoming"}>
              {viewer.isAdmin ? "Admin" : "Usuário"}
            </Badge>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-display text-4xl text-white">{predictions.length}</p>
              <p className="text-xs text-slate-300">Palpites enviados</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-display text-4xl text-white">
                {position > 0 ? position : "-"}
              </p>
              <p className="text-xs text-slate-300">Posição atual</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="font-display text-4xl text-white">
                {current?.totalPoints ?? 0}
              </p>
              <p className="text-xs text-slate-300">Pontos totais</p>
            </div>
          </div>
        </Surface>

        <Surface className="p-5">
          <h3 className="font-display text-3xl uppercase tracking-[0.08em] text-white">
            Performance
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span>Placares exatos</span>
              <strong>{current?.exactScores ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span>Acertos de resultado</span>
              <strong>{current?.resultHits ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span>Acertos de diferença</span>
              <strong>{current?.goalDiffHits ?? 0}</strong>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <span>Gol de um time</span>
              <strong>{current?.oneTeamGoalHits ?? 0}</strong>
            </div>
          </div>
        </Surface>
      </section>
    </AppShell>
  );
}
