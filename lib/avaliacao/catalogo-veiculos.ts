/**
 * Catálogo estático de marcas e modelos (Agenda › Avaliação).
 * Sem tabela: a lista vive no código (mesmo padrão de `MARCAS_VEICULOS`).
 * Valor fora do catálogo = preenchimento manual (“Não encontrou?”).
 */

/** Modelos mais comuns no mercado BR por marca. Marcas sem lista → só manual. */
export const MODELOS_POR_MARCA: Readonly<Record<string, readonly string[]>> = {
  Audi: ["A3", "A4", "A5", "A6", "Q3", "Q5", "Q7", "Q8", "e-tron", "TT"],
  BMW: ["118i", "320i", "330e", "X1", "X3", "X5", "X6", "Z4", "iX", "i4"],
  BYD: ["Dolphin", "Dolphin Mini", "Seal", "Song Plus", "Yuan Plus", "Shark", "Han"],
  Chery: ["Tiggo 5X", "Tiggo 7", "Tiggo 8", "Arrizo 6", "Arrizo 5"],
  "CAOA Chery": ["Tiggo 5X", "Tiggo 7 Pro", "Tiggo 8", "Arrizo 6 Pro"],
  Chevrolet: [
    "Onix",
    "Onix Plus",
    "Tracker",
    "Spin",
    "S10",
    "Montana",
    "Equinox",
    "Trailblazer",
    "Cruze",
    "Prisma",
    "Cobalt",
  ],
  Citroën: ["C3", "C4 Cactus", "Aircross", "Jumpy", "Jumper", "Basalt"],
  Fiat: [
    "Argo",
    "Cronos",
    "Mobi",
    "Pulse",
    "Fastback",
    "Strada",
    "Toro",
    "Fiorino",
    "Uno",
    "Palio",
    "Siena",
    "Ducato",
  ],
  Ford: ["Ka", "EcoSport", "Ranger", "Territory", "Maverick", "Bronco Sport", "Mustang"],
  GWM: ["Haval H6", "Haval H6 GT", "Ora 03", "Tank 300", "Poer"],
  Haval: ["H6", "H6 GT", "Jolion"],
  Honda: ["City", "Civic", "HR-V", "WR-V", "CR-V", "Fit", "Accord", "ZR-V"],
  Hyundai: ["HB20", "HB20S", "Creta", "Tucson", "ix35", "Santa Fe", "Ioniq 5", "HR"],
  JAC: ["E-JS1", "iEV40", "T40", "T50", "T60"],
  Jeep: ["Renegade", "Compass", "Commander", "Wrangler", "Gladiator"],
  Kia: ["Sportage", "Sorento", "Cerato", "Stonic", "Niro", "EV6", "Carnival"],
  "Land Rover": ["Discovery", "Discovery Sport", "Range Rover Evoque", "Range Rover Sport", "Defender"],
  "Mercedes-Benz": ["A 200", "C 180", "C 200", "CLA", "GLA", "GLB", "GLC", "GLE", "Sprinter"],
  MG: ["ZS", "HS", "MG4", "MG5", "Marvel R"],
  Mini: ["Cooper", "Countryman", "Clubman"],
  "Mini Cooper": ["Cooper", "Countryman", "Clubman"],
  Mitsubishi: ["L200", "Outlander", "Eclipse Cross", "Pajero Sport", "ASX"],
  Nissan: ["Kicks", "Versa", "Sentra", "Frontier", "Leaf", "X-Trail"],
  Peugeot: ["208", "2008", "3008", "5008", "Partner", "Expert", "Boxer"],
  Porsche: ["911", "Cayenne", "Macan", "Panamera", "Taycan", "Boxster"],
  RAM: ["1500", "2500", "3500", "Rampage"],
  Renault: ["Kwid", "Stepway", "Logan", "Sandero", "Duster", "Oroch", "Master", "Captur"],
  Subaru: ["Forester", "XV", "Outback", "Impreza", "WRX"],
  Suzuki: ["Jimny", "S-Cross", "Vitara", "Swift"],
  Tesla: ["Model 3", "Model Y", "Model S", "Model X"],
  Toyota: [
    "Corolla",
    "Corolla Cross",
    "Yaris",
    "Hilux",
    "SW4",
    "RAV4",
    "SW4 Diamond",
    "Etios",
    "Prius",
    "Camry",
  ],
  Troller: ["T4"],
  Volkswagen: [
    "Gol",
    "Polo",
    "Virtus",
    "T-Cross",
    "Nivus",
    "Taos",
    "Tiguan",
    "Amarok",
    "Saveiro",
    "Jetta",
    "Voyage",
    "Fox",
  ],
  Volvo: ["XC40", "XC60", "XC90", "C40", "EX30", "S60"],
  "Alfa Romeo": ["Giulia", "Stelvio", "Tonale"],
  Jaguar: ["E-Pace", "F-Pace", "XE", "XF", "I-Pace"],
  Lexus: ["UX", "NX", "RX", "ES", "LX"],
  Iveco: ["Daily", "Tector", "Stralis"],
  Scania: ["R", "S", "G", "P"],
  Agrale: ["Marruá", "A8000", "A8700"],
  Effa: ["V21", "V22", "Start"],
  Lifan: ["X60", "X80", "620"],
  Mahindra: ["Pickup", "Scorpio"],
  Smart: ["Fortwo", "#1"],
  SsangYong: ["Tivoli", "Korando", "Rexton", "Actyon"],
  Changan: ["CS35", "CS55", "Hunter"],
  Geely: ["Coolray", "Azkarra", "Geometry C"],
  "Great Wall": ["Poer", "Wingle", "Haval H6"],
  DFSK: ["Glory 560", "500", "IX5"],
  Foton: ["Tunland", "Aumark", "View"],
  Shineray: ["T20", "T22", "X30"],
  Isuzu: ["D-Max", "NPR"],
  Cadillac: ["Escalade", "XT4", "XT5", "CT5"],
  Chrysler: ["Pacifica", "300C"],
  Dodge: ["Ram", "Charger", "Durango", "Journey"],
  Ferrari: ["Roma", "SF90", "296", "F8"],
  "Aston Martin": ["DB11", "DBX", "Vantage"],
  Bentley: ["Bentayga", "Continental", "Flying Spur"],
  Maserati: ["Ghibli", "Levante", "Quattroporte", "Grecale"],
  McLaren: ["720S", "Artura", "GT"],
  "Rolls-Royce": ["Ghost", "Cullinan", "Phantom"],
  Lamborghini: ["Huracán", "Urus", "Revuelto"],
  Bugatti: ["Chiron", "Veyron"],
  Acura: ["MDX", "RDX", "TLX"],
  Infiniti: ["QX50", "QX60", "Q50"],
  Hummer: ["H3", "EV"],
  Opel: ["Corsa", "Astra", "Mokka"],
  Seat: ["Ibiza", "Leon", "Arona", "Ateca"],
  Skoda: ["Octavia", "Kodiaq", "Kamiq", "Superb"],
  Saab: ["9-3", "9-5"],
};

/** Marcas do catálogo (ordenadas), sem “Outra” — o escape é “Não encontrou?”. */
export const MARCAS_CATALOGO: readonly string[] = Object.freeze(
  [
    ...new Set([
      ...Object.keys(MODELOS_POR_MARCA),
      "AM Gen",
      "Asia Motors",
      "Daihatsu",
      "Datsun",
      "Eagle",
      "Higer",
      "KTM",
      "Lada",
      "Lancia",
      "Lincoln",
      "Lotus",
      "Maruti",
      "Maybach",
      "Mercury",
      "Oldsmobile",
      "Pagani",
      "Plymouth",
      "Pontiac",
      "Proton",
      "Saturn",
      "Triumph",
      "Vauxhall",
      "Vector",
      "Venturi",
      "Volare",
      "Willys",
      "Zotye",
    ]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR")),
);

export function ehMarcaDoCatalogo(marca: string | null | undefined): boolean {
  const m = marca?.trim();
  if (!m) return false;
  return MARCAS_CATALOGO.some((x) => x.toLowerCase() === m.toLowerCase());
}

export function modelosDaMarca(marca: string | null | undefined): readonly string[] {
  const m = marca?.trim();
  if (!m) return [];
  const chave = MARCAS_CATALOGO.find((x) => x.toLowerCase() === m.toLowerCase());
  if (!chave) return [];
  return MODELOS_POR_MARCA[chave] ?? [];
}

export function ehModeloDoCatalogo(
  marca: string | null | undefined,
  modelo: string | null | undefined,
): boolean {
  const mod = modelo?.trim();
  if (!mod) return false;
  return modelosDaMarca(marca).some((x) => x.toLowerCase() === mod.toLowerCase());
}

/** Normaliza para a grafia canônica do catálogo (se existir). */
export function marcaCanonica(marca: string | null | undefined): string | null {
  const m = marca?.trim();
  if (!m) return null;
  return MARCAS_CATALOGO.find((x) => x.toLowerCase() === m.toLowerCase()) ?? m;
}
