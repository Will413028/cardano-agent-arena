// Item 8b: full cause of Kupmios getProtocolParameters failure
import { Effect, Cause } from "effect";
import { provider } from "./lib.mjs";
const exit = await Effect.runPromiseExit(provider().effect.getProtocolParameters());
console.log(exit._tag);
if (exit._tag === "Failure") { const e = Cause.squash(exit.cause); console.log("message:", e.message); let c = e.cause, d = 0; while (c && d < 5) { console.log(`cause[${d}]:`, String(c.message ?? c).slice(0, 2000)); c = c.cause; d++; } }
