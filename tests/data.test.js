import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EXERCISES, WORKOUTS } from "../js/data.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("todo treino só referencia exercícios existentes", () => {
  for (const [key, w] of Object.entries(WORKOUTS)) {
    for (const id of w.exercises) assert.ok(EXERCISES[id], `${key} → ${id}`);
  }
});

test("toda imagem referenciada existe com início e fim", () => {
  for (const [id, ex] of Object.entries(EXERCISES)) {
    const folders = ex.levels ? ex.levels.map((l) => l.img) : [ex.img];
    for (const f of folders) {
      for (const n of [0, 1]) assert.ok(existsSync(join(root, "assets/ex", f, `${n}.jpg`)), `${id}: ${f}/${n}.jpg`);
    }
  }
});

test("faixas de repetição fazem sentido", () => {
  for (const [id, ex] of Object.entries(EXERCISES)) {
    assert.ok(ex.repMin > 0 && ex.repMin < ex.repMax, id);
    assert.ok(ex.sets >= 1 && ex.sets <= 5, id);
    assert.ok(["dumbbell", "bodyweight"].includes(ex.type), id);
  }
});
