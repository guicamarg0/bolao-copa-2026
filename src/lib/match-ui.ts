import type { Match } from "@/lib/types";

export const STAGE_LABEL: Record<Match["stage"], string> = {
  group: "Fase de grupos",
  round_of_32: "32 avos",
  round_of_16: "Oitavas",
  quarterfinal: "Quartas",
  semifinal: "Semifinal",
  third_place: "3º lugar",
  final: "Final",
};

export function formatKickoff(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function getMatchCountdown(value: string): string {
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) {
    return "Em andamento ou encerrado";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) {
    return `Faltam ${days}d ${hours % 24}h`;
  }

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `Faltam ${hours}h ${minutes}m`;
}
