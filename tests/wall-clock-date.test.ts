import test from "node:test";
import assert from "node:assert/strict";
import { register } from "tsx/esm/api";

register();

const { wallClockIsoDate } = await import("../agent/src/utils.ts");

const KYIV = "Europe/Kyiv";

test("wall-clock dates without an offset are read in the given zone, winter and summer", () => {
  assert.equal(wallClockIsoDate("2026-11-23T17:11:33.944623", KYIV), "2026-11-23T15:11:33.944Z");
  assert.equal(wallClockIsoDate("2026-07-01T09:00:00", KYIV), "2026-07-01T06:00:00.000Z");
  assert.equal(wallClockIsoDate("2026-07-01 09:00", KYIV), "2026-07-01T06:00:00.000Z");
  assert.equal(wallClockIsoDate("2026-11-23", KYIV), "2026-11-22T22:00:00.000Z");
});

test("wall-clock dates on either side of a Kyiv clock change use the offset in force", () => {
  // Clocks went back from 04:00 to 03:00 on 25 October 2026.
  assert.equal(wallClockIsoDate("2026-10-25T02:30:00", KYIV), "2026-10-24T23:30:00.000Z");
  assert.equal(wallClockIsoDate("2026-10-25T05:00:00", KYIV), "2026-10-25T03:00:00.000Z");
  // Clocks went forward from 03:00 to 04:00 on 29 March 2026.
  assert.equal(wallClockIsoDate("2026-03-29T02:30:00", KYIV), "2026-03-29T00:30:00.000Z");
  assert.equal(wallClockIsoDate("2026-03-29T05:00:00", KYIV), "2026-03-29T02:00:00.000Z");
});

test("wall-clock parsing keeps explicit offsets and rejects unusable values", () => {
  assert.equal(wallClockIsoDate("2026-11-23T17:11:33Z", KYIV), "2026-11-23T17:11:33.000Z");
  assert.equal(wallClockIsoDate("2026-11-23T17:11:33+01:00", KYIV), "2026-11-23T16:11:33.000Z");
  assert.equal(wallClockIsoDate("", KYIV), null);
  assert.equal(wallClockIsoDate("yesterday", KYIV), null);
  assert.equal(wallClockIsoDate(null, KYIV), null);
});
