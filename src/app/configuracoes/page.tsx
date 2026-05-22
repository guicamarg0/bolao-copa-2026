import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AppShell } from "@/components/app-shell";
import { SettingsFeedbackToast } from "@/components/settings-feedback-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Surface } from "@/components/ui/surface";
import { requireAuthenticatedViewer } from "@/lib/auth-guard";
import { updateAppUserCredentials } from "@/lib/app-db";
import { isSupabaseConfigured } from "@/lib/supabase-env";
import { getSupabaseServerClient } from "@/lib/supabase-server";

function toSafeQueryValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function updateCredentials(formData: FormData) {
  "use server";

  const viewer = await requireAuthenticatedViewer();
  const username = String(formData.get("username") ?? "").trim();
  const nextPassword = String(formData.get("password") ?? "").trim();
  const confirmPassword = String(formData.get("confirm_password") ?? "").trim();

  let destination = "/configuracoes?cred=1";

  try {
    if (!username) {
      throw new Error("Informe um usuario.");
    }

    if (nextPassword || confirmPassword) {
      if (nextPassword.length < 6) {
        throw new Error("A nova senha deve ter ao menos 6 caracteres.");
      }
      if (nextPassword !== confirmPassword) {
        throw new Error("A confirmacao da senha nao confere.");
      }
    }

    if (isSupabaseConfigured()) {
      const client = await getSupabaseServerClient();
      if (!client) {
        throw new Error("Cliente Supabase indisponivel.");
      }

      const {
        data: { user },
      } = await client.auth.getUser();

      if (!user || user.id !== viewer.id) {
        throw new Error("Sessao invalida. Faca login novamente.");
      }

      const usernameCheck = await client
        .from("profiles")
        .select("id")
        .ilike("username", username.toLowerCase());

      const takenByOther = (usernameCheck.data ?? []).some((row) => row.id !== viewer.id);
      if (takenByOther) {
        throw new Error("Usuario ja esta em uso.");
      }

      const updateProfile = await client
        .from("profiles")
        .update({ username: username.toLowerCase() })
        .eq("id", viewer.id);
      if (updateProfile.error) {
        throw updateProfile.error;
      }

      if (nextPassword) {
        const passwordResult = await client.auth.updateUser({ password: nextPassword });
        if (passwordResult.error) {
          throw passwordResult.error;
        }
      }
    } else {
      await updateAppUserCredentials({
        userId: viewer.id,
        username,
        password: nextPassword || undefined,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao atualizar conta.";
    destination = `/configuracoes?error=${encodeURIComponent(message)}`;
  }

  revalidatePath("/configuracoes");
  redirect(destination);
}

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ cred?: string; error?: string }>;
}) {
  const viewer = await requireAuthenticatedViewer();
  const query = await searchParams;

  const credSaved = toSafeQueryValue(query.cred) === "1";
  const errorMessage = toSafeQueryValue(query.error);

  return (
    <AppShell
      title="Configuracoes"
      subtitle="Seguranca da conta: alteracao de usuario e senha"
      viewer={viewer}
    >
      <SettingsFeedbackToast
        successMessage={credSaved ? "Credenciais atualizadas com sucesso." : undefined}
        errorMessage={errorMessage || undefined}
      />

      <Surface className="mx-auto max-w-2xl p-5">
        <h2 className="font-display text-3xl uppercase tracking-[0.08em] text-white">
          Seguranca da conta
        </h2>
        <p className="mt-1 text-sm text-slate-300">
          Atualize seu usuario e senha com validacao de regras em tempo de envio.
        </p>

        <form action={updateCredentials} className="mt-4 space-y-3">
          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
            Usuario
            <Input name="username" defaultValue={viewer.username} />
          </label>
          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
            Nova senha
            <Input type="password" name="password" placeholder="********" />
          </label>
          <label className="space-y-1 text-xs uppercase tracking-wide text-slate-300">
            Confirmar senha
            <Input type="password" name="confirm_password" placeholder="********" />
          </label>
          <Button className="mt-2">Atualizar conta</Button>
        </form>
      </Surface>
    </AppShell>
  );
}
