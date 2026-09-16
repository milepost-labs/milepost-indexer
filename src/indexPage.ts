import type { State } from './types.ts';

/**
 * The page at the site root.
 *
 * Everything else published here is JSON for machines, so the root had nothing
 * and answered 404 — which reads as a broken deploy rather than a file host
 * working as intended. This page says what is published, when it last updated,
 * and that the lists are advisory.
 *
 * It is a convenience, not an interface: integrators read the JSON files, and
 * nothing here is covered by the versioning rule in docs/outputs.md.
 */

export interface IndexPageContext {
  indexedAt: string;
  /** The published path prefix, e.g. `v1`. */
  version: string;
}

/**
 * Programme names come from contract events, so they are arbitrary text from
 * whoever created the programme and are escaped before they reach the page.
 */
function escape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const compare = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function indexPage(state: State, { indexedAt, version }: IndexPageContext): string {
  const programmes = Object.values(state.programmes).sort((a, b) => compare(a.id, b.id));
  const indexedToLedger = state.nextLedger - 1;
  const unhandled = Object.values(state.unhandledEvents).reduce((total, count) => total + count, 0);

  const warnings = [
    state.gap
      ? 'Indexing stopped for longer than the network keeps events, so some are missing from these lists.'
      : null,
    state.complete
      ? null
      : 'Indexing started after the contracts were deployed, so events from before that are missing.',
  ].filter((warning): warning is string => warning !== null);

  const programmeItems = programmes
    .map((programme) => {
      const name = programme.name === null ? 'Unnamed programme' : escape(programme.name);
      return `        <li>
          <a href="${version}/programmes/${escape(programme.id)}/awards.json">${name}</a>
          <span class="id">${escape(programme.id)}</span>
        </li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Milepost index</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, sans-serif; margin: 0 auto; max-width: 42rem; padding: 2rem 1rem; }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .lede { color: GrayText; margin-top: 0; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.25rem 1rem; }
  dt { color: GrayText; }
  dd { margin: 0; }
  code, .id { font-family: ui-monospace, monospace; font-size: 0.85em; word-break: break-all; }
  .id { color: GrayText; display: block; }
  ul { padding-left: 1.2rem; }
  .warning { border-left: 3px solid orange; padding-left: 0.75rem; }
</style>
</head>
<body>
<h1>Milepost index</h1>
<p class="lede">Lists rebuilt from Milepost contract events, published as JSON about every ten minutes.</p>

<p>
  The contracts store everything under per-address keys and keep no lists, so
  there is no on-chain way to ask who holds an award. These files answer that.
  <strong>They say where to look, not what is true</strong>: read every entry back
  from the contract before relying on it.
</p>
${warnings.map((warning) => `<p class="warning">${escape(warning)}</p>`).join('\n')}

<h2>Status</h2>
<dl>
  <dt>Network</dt><dd>${escape(state.network)}</dd>
  <dt>Registry</dt><dd><code>${escape(state.registry)}</code></dd>
  <dt>Ledgers</dt><dd>${state.fromLedger} to ${indexedToLedger}</dd>
  <dt>Updated</dt><dd><time datetime="${escape(indexedAt)}">${escape(indexedAt)}</time></dd>
  <dt>Programmes</dt><dd>${programmes.length}</dd>
  <dt>Events without a handler</dt><dd>${unhandled}</dd>
</dl>

<h2>Files</h2>
<ul>
  <li><a href="${version}/meta.json">${version}/meta.json</a> — what is indexed, and how fresh it is</li>
  <li><a href="${version}/programmes.json">${version}/programmes.json</a> — every programme the registry has deployed</li>
</ul>

<h2>Awards by programme</h2>
${programmes.length === 0 ? '<p>No programmes indexed yet.</p>' : `      <ul>\n${programmeItems}\n      </ul>`}

<p>
  <a href="https://github.com/milepost-labs/milepost-indexer">milepost-indexer</a> builds these files;
  <a href="https://github.com/milepost-labs/milepost-indexer/blob/main/docs/outputs.md">docs/outputs.md</a>
  documents each one.
</p>
</body>
</html>
`;
}
