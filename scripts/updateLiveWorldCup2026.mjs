import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputPath = path.join(rootDir, "live_worldcup_2026.json");

const HOST_NAMES = new Set(["United States", "Mexico", "Canada"]);
const API = {
  games: "https://worldcup26.ir/get/games",
  teams: "https://worldcup26.ir/get/teams",
  stadiums: "https://worldcup26.ir/get/stadiums"
};

async function fetchJson(url, tries = 5) {
  let lastError = null;

  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "user-agent": "PulsoDeEstadioSinestesico/1.0"
        }
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }

      return await res.json();
    } catch (error) {
      lastError = error;
      await wait(800 * (i + 1));
    }
  }

  throw lastError;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stageLabel(game) {
  const type = String(game.type || "").toLowerCase();
  if (type === "group") return `group ${game.group}`;
  if (type === "r32") return "round of 32";
  if (type === "r16") return "round of 16";
  if (type === "qf") return "quarter-finals";
  if (type === "sf") return "semi-finals";
  if (type === "third") return "third place";
  if (type === "final") return "final";
  return game.group || "world cup 2026";
}

function parseDate(raw) {
  const [mm, dd, yyyyAndTime] = String(raw || "").split("/");
  if (!yyyyAndTime) return "";
  const [yyyy, time] = yyyyAndTime.split(" ");
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")} ${time || "00:00"}`;
}

function parseMinuteToken(token) {
  const clean = token.replace(/\(p\)|\(og\)/gi, "").trim();
  const match = clean.match(/(\d+)'(?:\+(\d+)')?/);
  if (!match) return { minute: 0, label: "" };
  const base = Number(match[1] || 0);
  const extra = Number(match[2] || 0);
  return {
    minute: base + extra,
    label: extra > 0 ? `${base}+${extra}'` : `${base}'`
  };
}

function parseScorers(raw, teamCode) {
  if (!raw || raw === "null") return [];

  const entries = [...String(raw).matchAll(/"([^"]+)"/g)].map(match => match[1]);

  return entries.map((entry, index) => {
    const { minute, label } = parseMinuteToken(entry);
    const player = entry
      .replace(/(\d+)'(?:\+\d+')?/, "")
      .replace(/\(p\)|\(og\)/gi, "")
      .trim();

    return {
      order: index,
      minute,
      label,
      team: teamCode,
      player: player || "Gol"
    };
  });
}

function compactCodeFromLabel(label) {
  const text = String(label || "").trim();
  if (!text) return "TBD";

  const matchNumber = text.match(/Match\s+(\d+)/i);
  if (matchNumber) return `M${matchNumber[1]}`;

  if (/Winner Group/i.test(text)) {
    const group = text.match(/Group\s+([A-Z])/i);
    return group ? `W${group[1].toUpperCase()}` : "WG";
  }

  if (/Runner-up Group/i.test(text)) {
    const group = text.match(/Group\s+([A-Z])/i);
    return group ? `R${group[1].toUpperCase()}` : "RG";
  }

  if (/3rd Group/i.test(text)) {
    const groups = [...text.matchAll(/Group\s+([A-Z])/gi)].map(match => match[1].toUpperCase());
    return groups.length ? `3${groups[0]}` : "3RD";
  }

  const initials = text
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return initials.slice(0, 4) || "TBD";
}

function normalizeGame(game, teamsById, stadiumsById) {
  const homeTeam = teamsById.get(String(game.home_team_id));
  const awayTeam = teamsById.get(String(game.away_team_id));
  const stadium = stadiumsById.get(String(game.stadium_id));

  const home = homeTeam?.name_en || game.home_team_label || "Por definir";
  const away = awayTeam?.name_en || game.away_team_label || "Por definir";
  const hCode = homeTeam?.fifa_code || compactCodeFromLabel(game.home_team_label || home);
  const aCode = awayTeam?.fifa_code || compactCodeFromLabel(game.away_team_label || away);
  const hScore = Number(game.home_score || 0);
  const aScore = Number(game.away_score || 0);
  const totalGoals = hScore + aScore;
  const type = String(game.type || "").toLowerCase();
  const finished = String(game.finished || "").toUpperCase() === "TRUE";

  const goals = [
    ...parseScorers(game.home_scorers, hCode),
    ...parseScorers(game.away_scorers, aCode)
  ].sort((a, b) => a.minute - b.minute || a.order - b.order)
    .map(({ order, ...goal }) => goal);

  const homeWins = finished && hScore > aScore;
  const awayWins = finished && aScore > hScore;

  return {
    id: `LIVE-2026-${String(game.id).padStart(3, "0")}`,
    sourceId: String(game.id),
    date: parseDate(game.local_date),
    stage: stageLabel(game),
    city: stadium?.city_en || "",
    country: stadium?.country_en || "",
    home,
    away,
    hCode,
    aCode,
    hScore,
    aScore,
    totalGoals,
    margin: Math.max(1, Math.abs(hScore - aScore) || 1),
    extra: Number(type !== "group" && finished && String(game.time_elapsed || "").includes("120")),
    pens: Number(String(game.time_elapsed || "").toLowerCase().includes("pen")),
    final: Number(type === "final"),
    semi: Number(type === "sf"),
    ko: Number(type !== "group"),
    champion: Number(type === "final" && (homeWins || awayWins)),
    hostTeam: Number(HOST_NAMES.has(home) || HOST_NAMES.has(away)),
    finished,
    liveState: String(game.time_elapsed || "").toLowerCase(),
    goals
  };
}

function buildSummary(matches) {
  const finished = matches.filter(match => match.finished);
  const totalGoals = finished.reduce((sum, match) => sum + match.totalGoals, 0);
  const currentLeader = finished.length
    ? `En juego · ${finished.length}/${matches.length} partidos cerrados`
    : "En juego";

  return {
    totalMatches: matches.length,
    finishedMatches: finished.length,
    totalGoals,
    currentLeader
  };
}

async function main() {
  const [gamesData, teamsData, stadiumsData] = await Promise.all([
    fetchJson(API.games),
    fetchJson(API.teams),
    fetchJson(API.stadiums)
  ]);

  const teamsById = new Map((teamsData.teams || []).map(team => [String(team.id), team]));
  const stadiumsById = new Map((stadiumsData.stadiums || []).map(stadium => [String(stadium.id), stadium]));

  const matches = (gamesData.games || []).map(game => normalizeGame(game, teamsById, stadiumsById));
  const payload = {
    year: 2026,
    tournament_name: "FIFA World Cup 2026",
    host: "United States / Mexico / Canada",
    updated_at: new Date().toISOString(),
    source: API.games,
    summary: buildSummary(matches),
    matches
  };

  await mkdir(rootDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Actualizado: ${outputPath}`);
  console.log(`Partidos: ${payload.summary.totalMatches}`);
  console.log(`Cerrados: ${payload.summary.finishedMatches}`);
}

main().catch(error => {
  console.error("No se pudo actualizar live_worldcup_2026.json");
  console.error(error);
  process.exit(1);
});
