import { AppShell } from "@/components/app-shell";
import { MatchesBoard } from "@/components/matches-board";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getMatches } from "@/lib/data";

export default async function JogosPage() {
  const viewer = await requireAuthenticatedViewer();
  const matches = await getMatches();

  return (
    <AppShell
      title="Jogos"
      subtitle="Calendário oficial com cards estilo broadcast, filtros por fase e status ao vivo"
      viewer={viewer}
    >
      <MatchesBoard matches={matches} />
    </AppShell>
  );
}
