import { AppShell } from "@/components/app-shell";
import { QualificationBetsBoard } from "@/components/qualification-bets-board";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";

export default async function ApostasPage() {
  const viewer = await requireAuthenticatedViewer();

  return (
    <AppShell
      title="Apostas"
      subtitle="Aposte seus pontos em quem avanca no mata-mata; os palpites de placar continuam valendo normalmente"
      viewer={viewer}
    >
      <QualificationBetsBoard />
    </AppShell>
  );
}
