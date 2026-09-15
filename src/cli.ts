import { parseArgs } from 'node:util';
import { configFromEnv, loadDeployment } from './config.ts';
import { run } from './run.ts';
import { rpcSource } from './source.ts';
import { loadSpecs } from './specs.ts';

const USAGE = 'usage: npm run index -- --data <dir> [--reset] [--to-ledger <n>]';

const { values } = parseArgs({
  options: {
    data: { type: 'string' },
    reset: { type: 'boolean', default: false },
    'to-ledger': { type: 'string' },
  },
});

if (!values.data) {
  console.error(USAGE);
  process.exit(2);
}

let toLedger: number | undefined;
if (values['to-ledger'] !== undefined) {
  toLedger = Number(values['to-ledger']);
  if (!Number.isInteger(toLedger) || toLedger <= 0) {
    console.error(`--to-ledger must be a positive integer\n${USAGE}`);
    process.exit(2);
  }
}

const config = configFromEnv();
const deployment = await loadDeployment(config.deployment);
const result = await run(
  { source: rpcSource(config, deployment), deployment, specs: loadSpecs(), log: (message) => console.log(message) },
  { dataDir: values.data, reset: values.reset, toLedger },
);

const { state } = result;
console.log(
  `indexed ${deployment.network} to ledger ${state.nextLedger - 1}: ` +
    `${result.eventsApplied} events applied, ${Object.keys(state.programmes).length} programmes known`,
);
process.exitCode = result.exitCode;
