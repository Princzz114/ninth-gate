export type BodyId = "kael" | "mira" | "eatboss" | "rosa" | "andrew" | "jayden" | "shen" | "spice";

export const ROSTER = [
  { id: "eatboss", name: "EAT BOSS", title: "The biter", body: "eatboss", accent: "#f0d4a8" },
  { id: "rosa", name: "ROSA SENPAI", title: "Roll senpai", body: "rosa", accent: "#f08ab8" },
  { id: "andrew", name: "ANDREW", title: "The mandate", body: "andrew", accent: "#c9a227" },
  { id: "jayden", name: "JAYDEN", title: "Street spark", body: "jayden", accent: "#5ee0c0" },
  { id: "shen", name: "SHEN", title: "Glam lash", body: "shen", accent: "#3d6ea8" },
  { id: "spice", name: "SPICE", title: "Blue fire", body: "spice", accent: "#3b7dff" },
  { id: "kael", name: "Kael", title: "Volt striker", body: "kael", accent: "#7ec8e8" },
  { id: "mira", name: "Mira", title: "Ember closer", body: "mira", accent: "#c45c4a" },
  { id: "nyx", name: "Nyx", title: "Shadow stitch", body: "mira", accent: "#8b7dff" },
  { id: "riven", name: "Riven", title: "Rail cutter", body: "kael", accent: "#d4d8de" },
  { id: "sol", name: "Sol", title: "Sun breaker", body: "kael", accent: "#e8b45c" },
  { id: "vex", name: "Vex", title: "Glass knife", body: "mira", accent: "#e07ab0" },
  { id: "oren", name: "Oren", title: "Stone ward", body: "kael", accent: "#a78b6a" },
  { id: "lira", name: "Lira", title: "Gale dancer", body: "mira", accent: "#7ed0c4" },
  { id: "kade", name: "Kade", title: "Iron choir", body: "kael", accent: "#9aa3ad" },
  { id: "asha", name: "Asha", title: "Tide binder", body: "mira", accent: "#5aa8d4" },
  { id: "joss", name: "Joss", title: "Neon thief", body: "kael", accent: "#6ee07a" },
  { id: "rei", name: "Rei", title: "Quiet blade", body: "mira", accent: "#c8ccd4" },
  { id: "noa", name: "Noa", title: "Wire saint", body: "mira", accent: "#b8e0ff" },
  { id: "yara", name: "Yara", title: "Dust monk", body: "mira", accent: "#c4a070" },
  { id: "sen", name: "Sen", title: "Chrome fox", body: "kael", accent: "#f0c8a0" },
  { id: "bryn", name: "Bryn", title: "Frost hook", body: "kael", accent: "#9ad4e8" },
  { id: "ivo", name: "Ivo", title: "Pulse monk", body: "kael", accent: "#b07ae0" },
  { id: "tess", name: "Tess", title: "Rust queen", body: "mira", accent: "#c45c4a" },
  { id: "halo", name: "Halo", title: "Gate warden", body: "mira", accent: "#eceef2" },
] as const;

export type FighterId = (typeof ROSTER)[number]["id"];
export type RosterEntry = (typeof ROSTER)[number];

export function fighterOf(id: FighterId): RosterEntry {
  return ROSTER.find((f) => f.id === id) ?? ROSTER[0]!;
}

export function otherFighter(id: FighterId): FighterId {
  const rest = ROSTER.filter((f) => f.id !== id);
  return rest[Math.floor(Math.random() * rest.length)]!.id;
}
