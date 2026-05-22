import type { Match, Prediction, Profile } from "@/lib/types";

export const FIXTURE_DEFAULT_PASSWORD = "123456";

export const FIXTURE_PROFILES: Profile[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@bolao.local",
    username: "admin",
    displayName: "Administrador",
    isAdmin: true,
    isActive: true,
    createdAt: "2026-05-22T00:00:00.000Z",
  },
];

export const FIXTURE_MATCHES: Match[] = [];

export const FIXTURE_PREDICTIONS: Prediction[] = [];
