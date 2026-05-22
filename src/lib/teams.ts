export enum TeamCode {
  ARGENTINA = "ARG",
  AUSTRALIA = "AUS",
  AUSTRIA = "AUT",
  BELGIUM = "BEL",
  BOLIVIA = "BOL",
  BRAZIL = "BRA",
  CAMEROON = "CMR",
  CANADA = "CAN",
  CHILE = "CHI",
  COLOMBIA = "COL",
  COSTA_RICA = "CRC",
  CROATIA = "CRO",
  CZECHIA = "CZE",
  DENMARK = "DEN",
  ECUADOR = "ECU",
  EGYPT = "EGY",
  EL_SALVADOR = "SLV",
  ENGLAND = "ENG",
  FRANCE = "FRA",
  GERMANY = "GER",
  GHANA = "GHA",
  HONDURAS = "HON",
  IRAN = "IRN",
  ITALY = "ITA",
  JAMAICA = "JAM",
  JAPAN = "JPN",
  MEXICO = "MEX",
  MOROCCO = "MAR",
  NETHERLANDS = "NED",
  NIGERIA = "NGA",
  PANAMA = "PAN",
  PARAGUAY = "PAR",
  PERU = "PER",
  POLAND = "POL",
  PORTUGAL = "POR",
  QATAR = "QAT",
  SAUDI_ARABIA = "KSA",
  SENEGAL = "SEN",
  SERBIA = "SRB",
  SOUTH_KOREA = "KOR",
  SPAIN = "ESP",
  SWITZERLAND = "SUI",
  TUNISIA = "TUN",
  UKRAINE = "UKR",
  UNITED_STATES = "USA",
  URUGUAY = "URU",
  VENEZUELA = "VEN",
  ALGERIA = "ALG",
}

export interface TeamInfo {
  code: TeamCode;
  name: string;
  flag: string;
}

export const WORLD_CUP_2026_TEAMS: TeamInfo[] = [
  { code: TeamCode.ARGENTINA, name: "Argentina", flag: "🇦🇷" },
  { code: TeamCode.AUSTRALIA, name: "Australia", flag: "🇦🇺" },
  { code: TeamCode.AUSTRIA, name: "Austria", flag: "🇦🇹" },
  { code: TeamCode.BELGIUM, name: "Belgica", flag: "🇧🇪" },
  { code: TeamCode.BOLIVIA, name: "Bolivia", flag: "🇧🇴" },
  { code: TeamCode.BRAZIL, name: "Brasil", flag: "🇧🇷" },
  { code: TeamCode.CAMEROON, name: "Camaroes", flag: "🇨🇲" },
  { code: TeamCode.CANADA, name: "Canada", flag: "🇨🇦" },
  { code: TeamCode.CHILE, name: "Chile", flag: "🇨🇱" },
  { code: TeamCode.COLOMBIA, name: "Colombia", flag: "🇨🇴" },
  { code: TeamCode.COSTA_RICA, name: "Costa Rica", flag: "🇨🇷" },
  { code: TeamCode.CROATIA, name: "Croacia", flag: "🇭🇷" },
  { code: TeamCode.CZECHIA, name: "Tchequia", flag: "🇨🇿" },
  { code: TeamCode.DENMARK, name: "Dinamarca", flag: "🇩🇰" },
  { code: TeamCode.ECUADOR, name: "Equador", flag: "🇪🇨" },
  { code: TeamCode.EGYPT, name: "Egito", flag: "🇪🇬" },
  { code: TeamCode.EL_SALVADOR, name: "El Salvador", flag: "🇸🇻" },
  { code: TeamCode.ENGLAND, name: "Inglaterra", flag: "🇬🇧" },
  { code: TeamCode.FRANCE, name: "Franca", flag: "🇫🇷" },
  { code: TeamCode.GERMANY, name: "Alemanha", flag: "🇩🇪" },
  { code: TeamCode.GHANA, name: "Gana", flag: "🇬🇭" },
  { code: TeamCode.HONDURAS, name: "Honduras", flag: "🇭🇳" },
  { code: TeamCode.IRAN, name: "Ira", flag: "🇮🇷" },
  { code: TeamCode.ITALY, name: "Italia", flag: "🇮🇹" },
  { code: TeamCode.JAMAICA, name: "Jamaica", flag: "🇯🇲" },
  { code: TeamCode.JAPAN, name: "Japao", flag: "🇯🇵" },
  { code: TeamCode.MEXICO, name: "Mexico", flag: "🇲🇽" },
  { code: TeamCode.MOROCCO, name: "Marrocos", flag: "🇲🇦" },
  { code: TeamCode.NETHERLANDS, name: "Holanda", flag: "🇳🇱" },
  { code: TeamCode.NIGERIA, name: "Nigeria", flag: "🇳🇬" },
  { code: TeamCode.PANAMA, name: "Panama", flag: "🇵🇦" },
  { code: TeamCode.PARAGUAY, name: "Paraguai", flag: "🇵🇾" },
  { code: TeamCode.PERU, name: "Peru", flag: "🇵🇪" },
  { code: TeamCode.POLAND, name: "Polonia", flag: "🇵🇱" },
  { code: TeamCode.PORTUGAL, name: "Portugal", flag: "🇵🇹" },
  { code: TeamCode.QATAR, name: "Catar", flag: "🇶🇦" },
  { code: TeamCode.SAUDI_ARABIA, name: "Arabia Saudita", flag: "🇸🇦" },
  { code: TeamCode.SENEGAL, name: "Senegal", flag: "🇸🇳" },
  { code: TeamCode.SERBIA, name: "Servia", flag: "🇷🇸" },
  { code: TeamCode.SOUTH_KOREA, name: "Coreia do Sul", flag: "🇰🇷" },
  { code: TeamCode.SPAIN, name: "Espanha", flag: "🇪🇸" },
  { code: TeamCode.SWITZERLAND, name: "Suica", flag: "🇨🇭" },
  { code: TeamCode.TUNISIA, name: "Tunisia", flag: "🇹🇳" },
  { code: TeamCode.UKRAINE, name: "Ucrania", flag: "🇺🇦" },
  { code: TeamCode.UNITED_STATES, name: "Estados Unidos", flag: "🇺🇸" },
  { code: TeamCode.URUGUAY, name: "Uruguai", flag: "🇺🇾" },
  { code: TeamCode.VENEZUELA, name: "Venezuela", flag: "🇻🇪" },
  { code: TeamCode.ALGERIA, name: "Argelia", flag: "🇩🇿" },
];

function normalizeTeamKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const TEAM_BY_NORMALIZED_NAME = new Map<string, TeamInfo>(
  WORLD_CUP_2026_TEAMS.map((team) => [normalizeTeamKey(team.name), team]),
);

const TEAM_ALIASES: Record<string, TeamCode> = {
  usa: TeamCode.UNITED_STATES,
  eua: TeamCode.UNITED_STATES,
  estadosunidos: TeamCode.UNITED_STATES,
  coreiadosul: TeamCode.SOUTH_KOREA,
  arabiasaudita: TeamCode.SAUDI_ARABIA,
  iran: TeamCode.IRAN,
  ira: TeamCode.IRAN,
  england: TeamCode.ENGLAND,
  franca: TeamCode.FRANCE,
  frana: TeamCode.FRANCE,
  mexico: TeamCode.MEXICO,
  canad: TeamCode.CANADA,
  canada: TeamCode.CANADA,
  japao: TeamCode.JAPAN,
  holanda: TeamCode.NETHERLANDS,
};

const TEAM_BY_CODE = new Map<TeamCode, TeamInfo>(
  WORLD_CUP_2026_TEAMS.map((team) => [team.code, team]),
);

for (const [alias, code] of Object.entries(TEAM_ALIASES)) {
  const team = TEAM_BY_CODE.get(code);
  if (team) {
    TEAM_BY_NORMALIZED_NAME.set(alias, team);
  }
}

export function getTeamInfoByName(name: string): TeamInfo | null {
  const key = normalizeTeamKey(name);
  return TEAM_BY_NORMALIZED_NAME.get(key) ?? null;
}

export function getAllTeamNames(): string[] {
  return WORLD_CUP_2026_TEAMS.map((team) => team.name);
}
