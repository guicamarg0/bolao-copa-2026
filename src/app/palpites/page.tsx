import { AppShell } from "@/components/app-shell";
import { PredictionBoard } from "@/components/prediction-board";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { getMatches, getPredictionsForUser } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase-env";

export default async function PalpitesPage() {
  const viewer = await requireAuthenticatedViewer();
  const [matches, predictions] = await Promise.all([
    getMatches(),
    getPredictionsForUser(viewer.id),
  ]);

  const supabaseEnabled = isSupabaseConfigured();

  return (
    <AppShell
      title="Palpites"
      subtitle="Experiência de aposta fantasy com edição por partida e histórico de jogos fechados"
      viewer={viewer}
    >
      <PredictionBoard
        matches={matches}
        initialPredictions={predictions}
        viewer={viewer}
        supabaseEnabled={supabaseEnabled}
      />
    </AppShell>
  );
}
