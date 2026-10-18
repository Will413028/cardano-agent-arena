import { Data } from "@lucid-evolution/lucid";
console.log("full lucid import ok", typeof Data.to, "rss MiB", (process.memoryUsage().rss / 1048576).toFixed(0));
