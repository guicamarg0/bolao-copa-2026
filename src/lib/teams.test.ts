import { describe, expect, it } from "vitest";
import { getTeamInfoByName } from "@/lib/teams";

const GROUP_STAGE_TEAM_NAMES = [
  "Mexico",
  "Africa do Sul",
  "Coreia do Sul",
  "Tchequia",
  "Canada",
  "Bosnia e Herzegovina",
  "EUA",
  "Paraguai",
  "Catar",
  "Suica",
  "Brasil",
  "Marrocos",
  "Haiti",
  "Escocia",
  "Australia",
  "Turquia",
  "Alemanha",
  "Curacao",
  "Paises Baixos",
  "Japao",
  "Costa do Marfim",
  "Equador",
  "Suecia",
  "Tunisia",
  "Espanha",
  "Cabo Verde",
  "Belgica",
  "Egito",
  "Arabia Saudita",
  "Uruguai",
  "Ira",
  "Nova Zelandia",
  "Franca",
  "Senegal",
  "Iraque",
  "Noruega",
  "Argentina",
  "Argelia",
  "Austria",
  "Jordania",
  "Portugal",
  "RD Congo",
  "Inglaterra",
  "Croacia",
  "Gana",
  "Panama",
  "Uzbequistao",
  "Colombia",
] as const;

const GROUP_STAGE_TEAM_NAMES_WITH_ACCENTS = [
  "México",
  "África do Sul",
  "Bósnia e Herzegovina",
  "Países Baixos",
  "Curaçao",
  "Tchéquia",
  "Suíça",
  "Tunísia",
  "Irã",
  "Colômbia",
] as const;

describe("getTeamInfoByName", () => {
  it("resolve todas as selecoes da fase de grupos", () => {
    for (const name of GROUP_STAGE_TEAM_NAMES) {
      const team = getTeamInfoByName(name);
      expect(team, `${name} deveria existir no mapa de times`).not.toBeNull();
      expect(team?.flag, `${name} deveria ter bandeira`).toBeTruthy();
    }
  });

  it("resolve variacoes com acentos", () => {
    for (const name of GROUP_STAGE_TEAM_NAMES_WITH_ACCENTS) {
      const team = getTeamInfoByName(name);
      expect(team, `${name} deveria ser reconhecido com acento`).not.toBeNull();
      expect(team?.flag, `${name} deveria ter bandeira`).toBeTruthy();
    }
  });
});
