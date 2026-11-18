"use client";

import type { PublicTeam, TeamId } from "@/lib/types";

type Props = {
  teams: { a: PublicTeam; b: PublicTeam };
  phase: string;
  winner: TeamId | "tie" | null;
  big?: boolean;
};

export function DualMeters({ teams, phase, winner, big }: Props) {
  const useScore = phase === "result";
  const aH = Math.min(100, useScore ? normalize(teams.a.score, teams) : teams.a.live);
  const bH = Math.min(100, useScore ? normalize(teams.b.score, teams) : teams.b.live);

  return (
    <div className={`meters ${big ? "meters-big" : ""}`}>
      <MeterSide
        team={teams.a}
        height={aH}
        display={useScore ? teams.a.score : Math.round(teams.a.live)}
        win={winner === "a"}
        pulse={phase === "live"}
      />
      <div className="meters-vs" aria-hidden>
        <span>VS</span>
      </div>
      <MeterSide
        team={teams.b}
        height={bH}
        display={useScore ? teams.b.score : Math.round(teams.b.live)}
        win={winner === "b"}
        pulse={phase === "live"}
      />
    </div>
  );
}

function normalize(score: number, teams: { a: PublicTeam; b: PublicTeam }) {
  const max = Math.max(teams.a.score, teams.b.score, 1);
  return (score / max) * 100;
}

function MeterSide({
  team,
  height,
  display,
  win,
  pulse,
}: {
  team: PublicTeam;
  height: number;
  display: number;
  win: boolean;
  pulse: boolean;
}) {
  return (
    <div className={`meter-col ${win ? "meter-win" : ""}`}>
      <div className="meter-head">
        {team.captainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={team.captainPhoto} alt="" className="captain-pic" />
        ) : (
          <div className="captain-pic captain-placeholder" style={{ borderColor: team.color }} />
        )}
        <div>
          <div className="meter-name" style={{ color: team.color }}>
            {team.name}
          </div>
          <div className="meter-meta">{team.count} в зале</div>
        </div>
      </div>
      <div className="meter-rail">
        <div
          className={`meter-fill ${pulse ? "meter-pulse" : ""}`}
          style={{
            height: `${Math.max(4, height)}%`,
            background: `linear-gradient(180deg, ${team.color} 0%, color-mix(in srgb, ${team.color} 35%, #000) 100%)`,
            boxShadow: `0 0 40px color-mix(in srgb, ${team.color} 55%, transparent)`,
          }}
        />
      </div>
      <div className="meter-score" style={{ color: team.color }}>
        {display}
      </div>
    </div>
  );
}
