import { AppShell } from "@/components/app-shell";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { ScoringSystemButton } from "@/components/scoring-system-button";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getLeaderboard } from "@/lib/data";

export default async function RankingPage() {
  const viewer = await requireAuthenticatedViewer();
  const leaderboard = await getLeaderboard();

  return (
    <AppShell
      title="Rankings"
      subtitle="Podium premium com visão geral e semanal da disputa"
      viewer={viewer}
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <ScoringSystemButton />
        </div>
        <LeaderboardTable rows={leaderboard} />
      </div>
    </AppShell>
  );
}
