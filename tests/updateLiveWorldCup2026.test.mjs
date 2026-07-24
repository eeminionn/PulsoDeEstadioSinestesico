import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { writePayloadIfChanged } from "../scripts/updateLiveWorldCup2026.mjs";

const basePayload = {
  year: 2026,
  tournament_name: "FIFA World Cup 2026",
  host: "United States / Mexico / Canada",
  source: "https://example.test/games",
  summary: {
    totalMatches: 1,
    finishedMatches: 0,
    totalGoals: 0,
    currentLeader: "En juego"
  },
  matches: [{ id: "LIVE-2026-001", finished: false }]
};

test("keeps the file byte-for-byte unchanged when match data is identical", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pulso-updater-"));
  const filePath = path.join(directory, "live.json");
  const original = `${JSON.stringify(
    { ...basePayload, updated_at: "2026-07-24T08:00:00.000Z" },
    null,
    2
  )}\n`;
  await writeFile(filePath, original, "utf8");

  const result = await writePayloadIfChanged(
    filePath,
    basePayload,
    () => new Date("2026-07-24T09:00:00.000Z")
  );

  assert.equal(result.changed, false);
  assert.equal(await readFile(filePath, "utf8"), original);
  assert.equal(result.payload.updated_at, "2026-07-24T08:00:00.000Z");
});

test("writes a new timestamp when semantic match data changes", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "pulso-updater-"));
  const filePath = path.join(directory, "live.json");
  await writeFile(
    filePath,
    `${JSON.stringify(
      { ...basePayload, updated_at: "2026-07-24T08:00:00.000Z" },
      null,
      2
    )}\n`,
    "utf8"
  );
  const changedPayload = {
    ...basePayload,
    summary: {
      ...basePayload.summary,
      finishedMatches: 1,
      totalGoals: 2
    },
    matches: [{ id: "LIVE-2026-001", finished: true }]
  };

  const result = await writePayloadIfChanged(
    filePath,
    changedPayload,
    () => new Date("2026-07-24T09:00:00.000Z")
  );
  const written = JSON.parse(await readFile(filePath, "utf8"));

  assert.equal(result.changed, true);
  assert.equal(written.updated_at, "2026-07-24T09:00:00.000Z");
  assert.equal(written.summary.finishedMatches, 1);
  assert.equal(written.matches[0].finished, true);
});
