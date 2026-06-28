export enum TeamCode {
  AFRICA_DO_SUL = "RSA",
  ALGERIA = "ALG",
  ARGENTINA = "ARG",
  ARABIA_SAUDITA = "KSA",
  AUSTRALIA = "AUS",
  AUSTRIA = "AUT",
  BELGIUM = "BEL",
  BOLIVIA = "BOL",
  BOSNIA_HERZEGOVINA = "BIH",
  BRAZIL = "BRA",
  CABO_VERDE = "CPV",
  CAMEROON = "CMR",
  CANADA = "CAN",
  CHILE = "CHI",
  COLOMBIA = "COL",
  COREIA_DO_SUL = "KOR",
  COSTA_DO_MARFIM = "CIV",
  COSTA_RICA = "CRC",
  CROATIA = "CRO",
  CURACAO = "CUW",
  CZECHIA = "CZE",
  DENMARK = "DEN",
  ESCOCIA = "SCO",
  ECUADOR = "ECU",
  EGYPT = "EGY",
  EL_SALVADOR = "SLV",
  ENGLAND = "ENG",
  FRANCE = "FRA",
  GERMANY = "GER",
  GHANA = "GHA",
  HAITI = "HAI",
  HONDURAS = "HON",
  IRAN = "IRN",
  IRAQ = "IRQ",
  ITALY = "ITA",
  JAMAICA = "JAM",
  JAPAN = "JPN",
  JORDANIA = "JOR",
  MEXICO = "MEX",
  MOROCCO = "MAR",
  NETHERLANDS = "NED",
  NEW_ZEALAND = "NZL",
  NIGERIA = "NGA",
  NORWAY = "NOR",
  PANAMA = "PAN",
  PARAGUAY = "PAR",
  PERU = "PER",
  POLAND = "POL",
  PORTUGAL = "POR",
  QATAR = "QAT",
  RD_CONGO = "COD",
  SENEGAL = "SEN",
  SERBIA = "SRB",
  SPAIN = "ESP",
  SWEDEN = "SWE",
  SWITZERLAND = "SUI",
  TUNISIA = "TUN",
  TURKEY = "TUR",
  UKRAINE = "UKR",
  UNITED_STATES = "USA",
  URUGUAY = "URU",
  UZBEKISTAO = "UZB",
  VENEZUELA = "VEN",
}

export interface TeamInfo {
  code: TeamCode;
  name: string;
  flag: string;
}

export interface TeamFlagAsset {
  src: string;
  alt: string;
  label: string;
}

const FLAG_ASSET_BY_TEAM_CODE: Record<TeamCode, string> = {
  [TeamCode.AFRICA_DO_SUL]: "za",
  [TeamCode.ALGERIA]: "dz",
  [TeamCode.ARGENTINA]: "ar",
  [TeamCode.ARABIA_SAUDITA]: "sa",
  [TeamCode.AUSTRALIA]: "au",
  [TeamCode.AUSTRIA]: "at",
  [TeamCode.BELGIUM]: "be",
  [TeamCode.BOLIVIA]: "bo",
  [TeamCode.BOSNIA_HERZEGOVINA]: "ba",
  [TeamCode.BRAZIL]: "br",
  [TeamCode.CABO_VERDE]: "cv",
  [TeamCode.CAMEROON]: "cm",
  [TeamCode.CANADA]: "ca",
  [TeamCode.CHILE]: "cl",
  [TeamCode.COLOMBIA]: "co",
  [TeamCode.COREIA_DO_SUL]: "kr",
  [TeamCode.COSTA_DO_MARFIM]: "ci",
  [TeamCode.COSTA_RICA]: "cr",
  [TeamCode.CROATIA]: "hr",
  [TeamCode.CURACAO]: "cw",
  [TeamCode.CZECHIA]: "cz",
  [TeamCode.DENMARK]: "dk",
  [TeamCode.ESCOCIA]: "gb-sct",
  [TeamCode.ECUADOR]: "ec",
  [TeamCode.EGYPT]: "eg",
  [TeamCode.EL_SALVADOR]: "sv",
  [TeamCode.ENGLAND]: "gb-eng",
  [TeamCode.FRANCE]: "fr",
  [TeamCode.GERMANY]: "de",
  [TeamCode.GHANA]: "gh",
  [TeamCode.HAITI]: "ht",
  [TeamCode.HONDURAS]: "hn",
  [TeamCode.IRAN]: "ir",
  [TeamCode.IRAQ]: "iq",
  [TeamCode.ITALY]: "it",
  [TeamCode.JAMAICA]: "jm",
  [TeamCode.JAPAN]: "jp",
  [TeamCode.JORDANIA]: "jo",
  [TeamCode.MEXICO]: "mx",
  [TeamCode.MOROCCO]: "ma",
  [TeamCode.NETHERLANDS]: "nl",
  [TeamCode.NEW_ZEALAND]: "nz",
  [TeamCode.NIGERIA]: "ng",
  [TeamCode.NORWAY]: "no",
  [TeamCode.PANAMA]: "pa",
  [TeamCode.PARAGUAY]: "py",
  [TeamCode.PERU]: "pe",
  [TeamCode.POLAND]: "pl",
  [TeamCode.PORTUGAL]: "pt",
  [TeamCode.QATAR]: "qa",
  [TeamCode.RD_CONGO]: "cd",
  [TeamCode.SENEGAL]: "sn",
  [TeamCode.SERBIA]: "rs",
  [TeamCode.SPAIN]: "es",
  [TeamCode.SWEDEN]: "se",
  [TeamCode.SWITZERLAND]: "ch",
  [TeamCode.TUNISIA]: "tn",
  [TeamCode.TURKEY]: "tr",
  [TeamCode.UKRAINE]: "ua",
  [TeamCode.UNITED_STATES]: "us",
  [TeamCode.URUGUAY]: "uy",
  [TeamCode.UZBEKISTAO]: "uz",
  [TeamCode.VENEZUELA]: "ve",
};

export const WORLD_CUP_2026_TEAMS: TeamInfo[] = [
  { code: TeamCode.AFRICA_DO_SUL, name: "Africa do Sul", flag: "🇿🇦" },
  { code: TeamCode.ALGERIA, name: "Argelia", flag: "🇩🇿" },
  { code: TeamCode.ARGENTINA, name: "Argentina", flag: "🇦🇷" },
  { code: TeamCode.ARABIA_SAUDITA, name: "Arabia Saudita", flag: "🇸🇦" },
  { code: TeamCode.AUSTRALIA, name: "Australia", flag: "🇦🇺" },
  { code: TeamCode.AUSTRIA, name: "Austria", flag: "🇦🇹" },
  { code: TeamCode.BELGIUM, name: "Belgica", flag: "🇧🇪" },
  { code: TeamCode.BOLIVIA, name: "Bolivia", flag: "🇧🇴" },
  { code: TeamCode.BOSNIA_HERZEGOVINA, name: "Bosnia e Herzegovina", flag: "🇧🇦" },
  { code: TeamCode.BRAZIL, name: "Brasil", flag: "🇧🇷" },
  { code: TeamCode.CABO_VERDE, name: "Cabo Verde", flag: "🇨🇻" },
  { code: TeamCode.CAMEROON, name: "Camaroes", flag: "🇨🇲" },
  { code: TeamCode.CANADA, name: "Canada", flag: "🇨🇦" },
  { code: TeamCode.CHILE, name: "Chile", flag: "🇨🇱" },
  { code: TeamCode.COLOMBIA, name: "Colombia", flag: "🇨🇴" },
  { code: TeamCode.COREIA_DO_SUL, name: "Coreia do Sul", flag: "🇰🇷" },
  { code: TeamCode.COSTA_DO_MARFIM, name: "Costa do Marfim", flag: "🇨🇮" },
  { code: TeamCode.COSTA_RICA, name: "Costa Rica", flag: "🇨🇷" },
  { code: TeamCode.CROATIA, name: "Croacia", flag: "🇭🇷" },
  { code: TeamCode.CURACAO, name: "Curacao", flag: "🇨🇼" },
  { code: TeamCode.CZECHIA, name: "Tchequia", flag: "🇨🇿" },
  { code: TeamCode.DENMARK, name: "Dinamarca", flag: "🇩🇰" },
  {
    code: TeamCode.ESCOCIA,
    name: "Escocia",
    flag: "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
  },
  { code: TeamCode.ECUADOR, name: "Equador", flag: "🇪🇨" },
  { code: TeamCode.EGYPT, name: "Egito", flag: "🇪🇬" },
  { code: TeamCode.EL_SALVADOR, name: "El Salvador", flag: "🇸🇻" },
  { code: TeamCode.ENGLAND, name: "Inglaterra", flag: "🇬🇧" },
  { code: TeamCode.FRANCE, name: "Franca", flag: "🇫🇷" },
  { code: TeamCode.GERMANY, name: "Alemanha", flag: "🇩🇪" },
  { code: TeamCode.GHANA, name: "Gana", flag: "🇬🇭" },
  { code: TeamCode.HAITI, name: "Haiti", flag: "🇭🇹" },
  { code: TeamCode.HONDURAS, name: "Honduras", flag: "🇭🇳" },
  { code: TeamCode.IRAN, name: "Ira", flag: "🇮🇷" },
  { code: TeamCode.IRAQ, name: "Iraque", flag: "🇮🇶" },
  { code: TeamCode.ITALY, name: "Italia", flag: "🇮🇹" },
  { code: TeamCode.JAMAICA, name: "Jamaica", flag: "🇯🇲" },
  { code: TeamCode.JAPAN, name: "Japao", flag: "🇯🇵" },
  { code: TeamCode.JORDANIA, name: "Jordania", flag: "🇯🇴" },
  { code: TeamCode.MEXICO, name: "Mexico", flag: "🇲🇽" },
  { code: TeamCode.MOROCCO, name: "Marrocos", flag: "🇲🇦" },
  { code: TeamCode.NETHERLANDS, name: "Paises Baixos", flag: "🇳🇱" },
  { code: TeamCode.NEW_ZEALAND, name: "Nova Zelandia", flag: "🇳🇿" },
  { code: TeamCode.NIGERIA, name: "Nigeria", flag: "🇳🇬" },
  { code: TeamCode.NORWAY, name: "Noruega", flag: "🇳🇴" },
  { code: TeamCode.PANAMA, name: "Panama", flag: "🇵🇦" },
  { code: TeamCode.PARAGUAY, name: "Paraguai", flag: "🇵🇾" },
  { code: TeamCode.PERU, name: "Peru", flag: "🇵🇪" },
  { code: TeamCode.POLAND, name: "Polonia", flag: "🇵🇱" },
  { code: TeamCode.PORTUGAL, name: "Portugal", flag: "🇵🇹" },
  { code: TeamCode.QATAR, name: "Catar", flag: "🇶🇦" },
  { code: TeamCode.RD_CONGO, name: "RD Congo", flag: "🇨🇩" },
  { code: TeamCode.SENEGAL, name: "Senegal", flag: "🇸🇳" },
  { code: TeamCode.SERBIA, name: "Servia", flag: "🇷🇸" },
  { code: TeamCode.SPAIN, name: "Espanha", flag: "🇪🇸" },
  { code: TeamCode.SWEDEN, name: "Suecia", flag: "🇸🇪" },
  { code: TeamCode.SWITZERLAND, name: "Suica", flag: "🇨🇭" },
  { code: TeamCode.TUNISIA, name: "Tunisia", flag: "🇹🇳" },
  { code: TeamCode.TURKEY, name: "Turquia", flag: "🇹🇷" },
  { code: TeamCode.UKRAINE, name: "Ucrania", flag: "🇺🇦" },
  { code: TeamCode.UNITED_STATES, name: "EUA", flag: "🇺🇸" },
  { code: TeamCode.URUGUAY, name: "Uruguai", flag: "🇺🇾" },
  { code: TeamCode.UZBEKISTAO, name: "Uzbequistao", flag: "🇺🇿" },
  { code: TeamCode.VENEZUELA, name: "Venezuela", flag: "🇻🇪" },
];

function normalizeTeamKey(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

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
  africa: TeamCode.AFRICA_DO_SUL,
  africadosul: TeamCode.AFRICA_DO_SUL,
  southafrica: TeamCode.AFRICA_DO_SUL,
  argelia: TeamCode.ALGERIA,
  algeria: TeamCode.ALGERIA,
  arabiasaudita: TeamCode.ARABIA_SAUDITA,
  saudiarabia: TeamCode.ARABIA_SAUDITA,
  belgica: TeamCode.BELGIUM,
  belgium: TeamCode.BELGIUM,
  bosniaeherzegovina: TeamCode.BOSNIA_HERZEGOVINA,
  bosniaherzegovina: TeamCode.BOSNIA_HERZEGOVINA,
  caboverde: TeamCode.CABO_VERDE,
  capeverde: TeamCode.CABO_VERDE,
  canada: TeamCode.CANADA,
  coreiadosul: TeamCode.COREIA_DO_SUL,
  southkorea: TeamCode.COREIA_DO_SUL,
  republicofkorea: TeamCode.COREIA_DO_SUL,
  costadomarfim: TeamCode.COSTA_DO_MARFIM,
  cotedivoire: TeamCode.COSTA_DO_MARFIM,
  ivorycoast: TeamCode.COSTA_DO_MARFIM,
  croacia: TeamCode.CROATIA,
  curacao: TeamCode.CURACAO,
  tchequia: TeamCode.CZECHIA,
  czechia: TeamCode.CZECHIA,
  czechrepublic: TeamCode.CZECHIA,
  escocia: TeamCode.ESCOCIA,
  scotland: TeamCode.ESCOCIA,
  eua: TeamCode.UNITED_STATES,
  usa: TeamCode.UNITED_STATES,
  estadosunidos: TeamCode.UNITED_STATES,
  unitedstates: TeamCode.UNITED_STATES,
  unitedstatesofamerica: TeamCode.UNITED_STATES,
  franca: TeamCode.FRANCE,
  france: TeamCode.FRANCE,
  alemanha: TeamCode.GERMANY,
  germany: TeamCode.GERMANY,
  haiti: TeamCode.HAITI,
  inglaterra: TeamCode.ENGLAND,
  england: TeamCode.ENGLAND,
  ira: TeamCode.IRAN,
  iran: TeamCode.IRAN,
  iraque: TeamCode.IRAQ,
  iraq: TeamCode.IRAQ,
  japao: TeamCode.JAPAN,
  japan: TeamCode.JAPAN,
  jordania: TeamCode.JORDANIA,
  jordan: TeamCode.JORDANIA,
  mexico: TeamCode.MEXICO,
  marrocos: TeamCode.MOROCCO,
  morocco: TeamCode.MOROCCO,
  paisesbaixos: TeamCode.NETHERLANDS,
  holanda: TeamCode.NETHERLANDS,
  netherlands: TeamCode.NETHERLANDS,
  novazelandia: TeamCode.NEW_ZEALAND,
  newzealand: TeamCode.NEW_ZEALAND,
  noruega: TeamCode.NORWAY,
  norway: TeamCode.NORWAY,
  panama: TeamCode.PANAMA,
  paraguai: TeamCode.PARAGUAY,
  portugal: TeamCode.PORTUGAL,
  catar: TeamCode.QATAR,
  qatar: TeamCode.QATAR,
  rdcongo: TeamCode.RD_CONGO,
  drcongo: TeamCode.RD_CONGO,
  congodr: TeamCode.RD_CONGO,
  democraticrepublicofthecongo: TeamCode.RD_CONGO,
  senegal: TeamCode.SENEGAL,
  espanha: TeamCode.SPAIN,
  spain: TeamCode.SPAIN,
  suecia: TeamCode.SWEDEN,
  sweden: TeamCode.SWEDEN,
  suica: TeamCode.SWITZERLAND,
  switzerland: TeamCode.SWITZERLAND,
  tunisia: TeamCode.TUNISIA,
  turquia: TeamCode.TURKEY,
  turkey: TeamCode.TURKEY,
  uruguai: TeamCode.URUGUAY,
  uzbequistao: TeamCode.UZBEKISTAO,
  uzbekistan: TeamCode.UZBEKISTAO,
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

export function getTeamInfoByName(name: string | null | undefined): TeamInfo | null {
  const key = normalizeTeamKey(name);
  if (!key) {
    return null;
  }

  return TEAM_BY_NORMALIZED_NAME.get(key) ?? null;
}

export function getTeamInfoByCode(code: string | null | undefined): TeamInfo | null {
  const normalizedCode = code?.trim().toUpperCase();
  if (!normalizedCode) {
    return null;
  }

  return TEAM_BY_CODE.get(normalizedCode as TeamCode) ?? null;
}

export function getTeamFlagAsset(team: TeamInfo): TeamFlagAsset {
  const flagCode = FLAG_ASSET_BY_TEAM_CODE[team.code];
  return {
    src: `https://flagcdn.com/${flagCode}.svg`,
    alt: `Bandeira de ${team.name}`,
    label: team.code,
  };
}

export function getTeamFlagAssetByName(name: string | null | undefined): TeamFlagAsset | null {
  const team = getTeamInfoByName(name);
  return team ? getTeamFlagAsset(team) : null;
}

export function getAllTeamNames(): string[] {
  return WORLD_CUP_2026_TEAMS.map((team) => team.name);
}
