// Redaction benchmark: scrub a 1 MB snapshot-like string with 1 and with 20
// registered values, and a JSON-like tool result of the same size.
// Values are random, with some JSON- and URL-escapable characters, so the
// encoded variants register too. Runs against the built package:
// `pnpm --filter @turnkey/browser-secrets bench` (builds first).
import { randomBytes } from "node:crypto";
import { RedactionRegistry } from "../dist/index.mjs";

const SIZE = 1024 * 1024;
const ITERATIONS = 200;
const WARMUP = 20;

function makeSnapshot(values) {
  const row = (i) =>
    `{"uid":"e${i}","role":"textbox","name":"Field ${i}","value":"public text ${i}","frame_origin":"https://shop.example"},`;
  const parts = [];
  let length = 0;
  let i = 0;
  while (length < SIZE) {
    // Plant a registered value roughly every 64 KB.
    const piece =
      i % 400 === 0 && values.length > 0
        ? `"leak":"${values[(i / 400) % values.length]}",`
        : row(i);
    parts.push(piece);
    length += piece.length;
    i++;
  }
  return parts.join("").slice(0, SIZE);
}

function percentile(sorted, p) {
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ];
}

function measure(label, fn) {
  for (let i = 0; i < WARMUP; i++) fn();
  const times = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime.bigint();
    fn();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  times.sort((a, b) => a - b);
  console.log(
    `${label.padEnd(42)} p50 ${percentile(times, 50).toFixed(2)} ms  p95 ${percentile(times, 95).toFixed(2)} ms`,
  );
}

console.log(
  `Node ${process.version}, ${ITERATIONS} iterations after ${WARMUP} warmup, input ${SIZE} chars`,
);
for (const count of [1, 20]) {
  const values = Array.from(
    { length: count },
    (_, i) =>
      randomBytes(9 + (i % 9)).toString("base64") + (i % 3 ? "" : ' "q"/+'),
  );
  const registry = new RedactionRegistry();
  registry.registerValues(
    values.map((value, i) => ({ value, secretId: `s${i}` })),
  );
  const text = makeSnapshot(values);
  const clean = makeSnapshot([]);
  const output = registry.scrubText(text);
  if (values.some((v) => output.includes(v))) throw new Error("value survived");

  measure(`scrubText 1 MB, ${count} value(s), with matches`, () =>
    registry.scrubText(text),
  );
  measure(`scrubText 1 MB, ${count} value(s), no matches`, () =>
    registry.scrubText(clean),
  );
  const json = {
    snapshot: text.slice(0, SIZE / 2),
    log: text.slice(SIZE / 2).split(","),
  };
  measure(`scrub JSON ~1 MB, ${count} value(s)`, () => registry.scrub(json));
}
