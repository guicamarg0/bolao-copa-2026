import { AppShell } from "@/components/app-shell";
import { MatchCard } from "@/components/match-card";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getDashboardSummary } from "@/lib/data";

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "upcoming" | "finished" | "champion";
}) {
  return (
    <Surface className="p-4">
      <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
      <p className="font-display text-5xl leading-none tracking-[0.08em] text-white">
        {value}
      </p>
      <div className="mt-2">
        <Badge tone={tone}>
          {tone === "champion"
            ? "Elite"
            : tone === "finished"
              ? "Concluído"
              : "Programado"}
        </Badge>
      </div>
    </Surface>
  );
}

export default async function DashboardPage() {
  const viewer = await requireAuthenticatedViewer();
  const summary = await getDashboardSummary();

  return (
    <AppShell
      title="WorldBet 26"
      subtitle="Centro de comando premium para palpites, jogos e corrida pelo topo do ranking"
      viewer={viewer}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Jogos cadastrados" value={summary.totalMatches} tone="upcoming" />
        <StatCard
          label="Jogos finalizados"
          value={summary.finishedMatches}
          tone="finished"
        />
        <StatCard
          label="Top participantes"
          value={summary.topParticipants.length}
          tone="champion"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <div className="space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-[0.09em]">
            Próximas partidas
          </h2>
          {summary.upcomingMatches.length === 0 ? (
            <Surface className="p-6 text-center">
              <p className="text-lg font-semibold text-slate-100">Agenda concluída</p>
              <p className="text-sm text-slate-300">
                No momento não há partidas futuras cadastradas.
              </p>
            </Surface>
          ) : (
            <div className="grid gap-4">
              {summary.upcomingMatches.map((match, index) => (
                <MatchCard key={match.id} match={match} featured={index === 0} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="font-display text-2xl uppercase tracking-[0.09em]">Top ranking</h2>
          <Surface className="p-4">
            {summary.topParticipants.length === 0 ? (
              <p className="text-sm text-slate-300">Ainda sem pontuação consolidada.</p>
            ) : (
              <ol className="space-y-2">
                {summary.topParticipants.map((participant, index) => (
                  <li
                    key={participant.userId}
                    className="flex items-center justify-between rounded-xl border border-white/8 bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display text-2xl leading-none text-white/85">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          {participant.displayName}
                        </p>
                        <p className="text-xs text-slate-400">
                          {participant.exactScores} placares exatos
                        </p>
                      </div>
                    </div>
                    <Badge tone={index === 0 ? "champion" : "upcoming"}>
                      {participant.totalPoints} pts
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
          </Surface>
        </div>
      </section>
    </AppShell>
  );
}
