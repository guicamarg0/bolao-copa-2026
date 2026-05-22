import { isSupabaseConfigured } from "@/lib/supabase-env";

export type StorageMode = "supabase" | "postgres" | "sqlite";

export function isPostgresConnectionConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getStorageMode(): StorageMode {
  if (isSupabaseConfigured()) {
    return "supabase";
  }
  if (isPostgresConnectionConfigured()) {
    return "postgres";
  }
  return "sqlite";
}
