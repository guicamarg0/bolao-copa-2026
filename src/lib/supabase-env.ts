export interface SupabaseEnv {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const validUrl = isValidHttpUrl(url);

  return {
    url,
    anonKey,
    isConfigured: validUrl && anonKey.length > 0,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().isConfigured;
}
