import { main } from "./cli";

const code = await main(
  process.argv.slice(2),
  {
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
  },
  process.env,
);
process.exitCode = code;
