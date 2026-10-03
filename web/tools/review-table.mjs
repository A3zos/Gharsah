// Writes web/src/i18n/REVIEW.md: ar | en | id of every landing-page string and the
// parent area's plan strings, straight from the locale files (re-run after edits).
// Run from web/:  node tools/review-table.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(new URL(`../src/i18n/${p}`, import.meta.url), 'utf8'));
const core = { ar: load('ar.json'), en: load('en.json'), id: load('id.json') };
const parent = { ar: load('ar/parent.json'), en: load('en/parent.json'), id: load('id/parent.json') };

const LANDING = ['meta', 'header', 'hero', 'phone', 'how', 'parents', 'sources', 'plans', 'footer'];
const PARENT_PLAN = ['plan', 'plans', 'pilotChip'];

function rows(files, sections) {
  const out = [];
  const walk = (ar, en, id, path) => {
    if (ar !== null && typeof ar === 'object') {
      for (const k of Object.keys(ar)) walk(ar[k], en?.[k], id?.[k], path ? `${path}.${k}` : k);
      return;
    }
    out.push([path, ar, en, id]);
  };
  for (const s of sections) if (files.ar[s] !== undefined) walk(files.ar[s], files.en[s], files.id[s], s);
  return out;
}

const cell = (v) =>
  String(v ?? '—')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');
const table = (title, rs) =>
  [
    `## ${title} (${rs.length})`,
    '',
    '| Key | العربية | English | Bahasa Indonesia |',
    '|---|---|---|---|',
    ...rs.map(([k, a, e, i]) => `| \`${k}\` | ${cell(a)} | ${cell(e)} | ${cell(i)} |`),
    '',
  ].join('\n');

const landing = rows(core, LANDING);
const plans = rows(parent, PARENT_PLAN);
const md = [
  '# Translation review — landing page + parent plans',
  '',
  'Generated from `web/src/i18n/*.json` by `web/tools/review-table.mjs` — edit the locale',
  'files, not this page. Arabic is the source of truth; terms follow `GLOSSARY.md`.',
  'Placeholders like `{n}` / `{name}` are filled at runtime. Quran and hadith text never',
  'appear here: ayat / hadith stay Arabic; their translations come only from QuranEnc /',
  'HadeethEnc.',
  '',
  table('Landing page', landing),
  table('Parent area — plans', plans),
].join('\n');
writeFileSync(new URL('../src/i18n/REVIEW.md', import.meta.url), md);
console.log(`REVIEW.md: ${landing.length} landing + ${plans.length} plan strings`);
