export type Phase = "lobby" | "countdown" | "live" | "result";

export type TeamId = "a" | "b";

export type TeamConfig = {
  name: string;
  color: string;
  captainPhoto: string | null;
};

export type Guest = {
  id: string;
  token: string;
  name: string;
  team: TeamId;
  lastLevel: number;
  lastSeen: number;
};

export type EventData = {
  id: string;
  hostToken: string;
  screenToken: string;
  title: string;
  teams: { a: TeamConfig; b: TeamConfig };
  roundSec: number;
  phase: Phase;
  round: number;
  guests: Guest[];
  /** Sum of clap samples during the current/last live round */
  score: { a: number; b: number };
  /** Peak instantaneous team level for hall meters */
  live: { a: number; b: number };
  sampleCount: { a: number; b: number };
  winner: TeamId | "tie" | null;
  countdownEndsAt: number | null;
  liveEndsAt: number | null;
  createdAt: number;
};

export type PublicTeam = {
  name: string;
  color: string;
  captainPhoto: string | null;
  count: number;
  score: number;
  live: number;
};

export type PublicState = {
  id: string;
  title: string;
  phase: Phase;
  round: number;
  roundSec: number;
  teams: { a: PublicTeam; b: PublicTeam };
  winner: TeamId | "tie" | null;
  remainingMs: number;
  guestCount: number;
  role: "host" | "guest" | "screen";
  me?: { id: string; name: string; team: TeamId } | null;
  screenToken?: string;
};
