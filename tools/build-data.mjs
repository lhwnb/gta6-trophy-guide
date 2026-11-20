// Build script. Merges the untouched official list with the hand-written guide text and writes the
// three data files the app loads, plus the single data.js bundle that makes file:// work.
//
//   node tools/build-data.mjs
//
// Nothing here fetches anything. Read tools/orig-trophies.json only.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dataDir = join(root, 'app', 'data');

const { c1 } = await import('./content-1.mjs');
const { c2 } = await import('./content-2.mjs');
const { c3 } = await import('./content-3.mjs');
const { c4 } = await import('./content-4.mjs');
const authored = { ...c1, ...c2, ...c3, ...c4 };

const orig = JSON.parse(readFileSync(join(here, 'orig-trophies.json'), 'utf8'));
const official = orig.trophies;

const fail = [];
const warn = [];

if (official.length !== 55) fail.push(`official list has ${official.length} entries, expected 55`);

const gradeCount = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
for (const t of official) gradeCount[t.grade] = (gradeCount[t.grade] || 0) + 1;
if (gradeCount.platinum !== 1 || gradeCount.gold !== 2 || gradeCount.silver !== 6 || gradeCount.bronze !== 46) {
  fail.push(`grade counts wrong: ${JSON.stringify(gradeCount)}`);
}

const CHANNEL = [
  'Prologue -- Leonida State Penitentiary',
  'Chapter 1 -- The Keys',
  'Chapter 2 -- Ambrosia',
  'Chapter 3 -- Vice City',
  'Chapter 4 -- Grassrivers',
  'Finale -- The Score',
  'Post-game -- Free roam',
];

const nonAscii = (s) => /[^\x00-\x7F]/.test(s);

const trophies = official.map((t) => {
  const a = authored[t.id];
  if (!a) { fail.push(`id ${t.id} (${t.name}) has no authored content`); return null; }
  if (!Array.isArray(a.steps) || a.steps.length < 3 || a.steps.length > 6) {
    fail.push(`id ${t.id}: steps must be 3-6, got ${a.steps ? a.steps.length : 'none'}`);
  }
  if (!(a.difficulty >= 1 && a.difficulty <= 5)) fail.push(`id ${t.id}: difficulty out of range`);
  if (!(a.minutes > 0)) fail.push(`id ${t.id}: minutes must be positive`);
  if (!CHANNEL.includes(a.chapter)) fail.push(`id ${t.id}: unknown chapter "${a.chapter}"`);
  if (!Array.isArray(a.sources) || a.sources.length === 0) fail.push(`id ${t.id}: sources missing`);
  if (typeof a.missable !== 'boolean') fail.push(`id ${t.id}: missable must be a boolean`);
  if (a.missable && !a.note) fail.push(`id ${t.id}: missable without a why-note`);
  for (const s of a.steps) {
    if (nonAscii(s)) warn.push(`id ${t.id}: non-ascii in a step`);
    if (/["\u201c\u201d]/.test(s)) warn.push(`id ${t.id}: curly or double quote in a step`);
  }

  const guide = a.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    grade: t.grade,
    chapter: a.chapter,
    chapterIndex: CHANNEL.indexOf(a.chapter),
    where: a.where,
    type: a.type,
    difficulty: a.difficulty,
    minutes: a.minutes,
    missable: a.missable,
    missableNote: a.missable ? a.note : '',
    spoiler: !!a.spoiler,
    hint: t.guide,
    guide,
    steps: a.steps,
    sources: a.sources,
    order: 0,
  };
}).filter(Boolean);

// roadmap + missables: authored ids only, names injected here so the official spellings are never retyped.
const roadmapSrc = JSON.parse(readFileSync(join(here, 'roadmap.src.json'), 'utf8'));
const missablesSrc = JSON.parse(readFileSync(join(here, 'missables.src.json'), 'utf8'));

const byId = new Map(trophies.map((t) => [t.id, t]));
const seen = new Map();
let order = 0;
const stages = roadmapSrc.stages.map((st) => {
  for (const id of st.trophies) {
    if (!byId.has(id)) fail.push(`roadmap stage ${st.id}: unknown trophy id ${id}`);
    if (seen.has(id)) fail.push(`trophy ${id} appears in two stages (${seen.get(id)} and ${st.id})`);
    seen.set(id, st.id);
    order += 1;
    const t = byId.get(id);
    if (t) { t.order = order; t.stage = st.id; t.stageName = st.name; }
  }
  return {
    id: st.id,
    name: st.name,
    hours: st.hours,
    window: st.window,
    summary: st.summary,
    short: st.short || '',
    risk: st.risk || '',
    missable: st.missable || [],
    todo: st.todo || [],
    trophies: st.trophies,
    trophyNames: st.trophies.map((id) => (byId.get(id) || { name: `#${id}` }).name),
    count: st.trophies.length,
  };
});

const missing = trophies.filter((t) => !t.order).map((t) => t.id);
if (missing.length) fail.push(`trophies in no roadmap stage: ${missing.join(', ')}`);

const totalHours = stages.reduce((n, s) => n + s.hours, 0);
const roadmap = {
  headline: roadmapSrc.headline,
  headlineLong: roadmapSrc.headlineLong,
  intro: roadmapSrc.intro,
  assumptions: roadmapSrc.assumptions,
  first: roadmapSrc.first,
  stages,
  totalHours,
  hoursNote: roadmapSrc.hoursNote,
  orderNote: roadmapSrc.orderNote,
};

const entries = missablesSrc.entries.map((e) => {
  const t = byId.get(e.id);
  if (!t) fail.push(`missables: unknown trophy id ${e.id}`);
  if (t && !t.missable) fail.push(`missables: trophy ${e.id} is not flagged missable`);
  return {
    id: e.id,
    name: t ? t.name : `#${e.id}`,
    grade: t ? t.grade : '',
    chapter: t ? t.chapter : '',
    flag: e.flag,
    lockPoint: e.lockPoint,
    lockDetail: e.lockDetail,
    action: e.action,
    recovery: e.recovery,
    severity: e.severity,
    order: t ? t.order : 0,
  };
});
const missableIds = trophies.filter((t) => t.missable).map((t) => t.id);
const declared = new Set(entries.map((e) => e.id));
for (const id of missableIds) if (!declared.has(id)) fail.push(`trophy ${id} is missable but has no missables entry`);
if (entries.length !== missableIds.length) fail.push(`missables file has ${entries.length} entries, list has ${missableIds.length}`);

const missables = {
  intro: missablesSrc.intro,
  footNote: missablesSrc.footNote || '',
  checkpointAdvice: missablesSrc.checkpointAdvice,
  count: entries.length,
  entries,
  notMissable: missablesSrc.notMissable,
};

const guides = trophies.filter((t) => t.guide && t.guide.trim().length > 40);
const words = trophies.reduce((n, t) => n + t.guide.split(/\s+/).length, 0);
const meta = {
  title: 'GTA VI trophy guide -- Leonida',
  game: orig.game || 'Grand Theft Auto VI',
  platform: orig.platform || '',
  list: orig.list || '',
  built: 'generated by tools/build-data.mjs',
  count: trophies.length,
  chapters: CHANNEL,
  gradeCount,
  missableCount: missableIds.length,
  spoilerCount: trophies.filter((t) => t.spoiler).length,
  totalMinutes: trophies.reduce((n, t) => n + t.minutes, 0),
  guideWords: words,
  roadmapHours: totalHours,
  difficulty: trophies.reduce((acc, t) => { acc[t.difficulty] = (acc[t.difficulty] || 0) + 1; return acc; }, {}),
};

if (fail.length) {
  console.error('BUILD FAILED');
  for (const f of fail) console.error('  ' + f);
  process.exit(1);
}

trophies.sort((a, b) => a.id - b.id);
mkdirSync(dataDir, { recursive: true });

const writeJson = (name, value) => {
  const text = JSON.stringify(value, null, 1) + '\n';
  writeFileSync(join(dataDir, name), text);
  return Buffer.byteLength(text);
};

const bTrophies = writeJson('trophies.json', {
  game: meta.game,
  platform: meta.platform,
  list: meta.list,
  generatedBy: 'tools/build-data.mjs',
  chapters: CHANNEL,
  trophies,
});
const bRoadmap = writeJson('roadmap.json', roadmap);
const bMissables = writeJson('missables.json', missables);

const bundle = `window.GTA6 = ${JSON.stringify({ meta, trophies, roadmap, missables })};\n`;
writeFileSync(join(dataDir, 'data.js'), bundle);

console.log('ok');
console.log('  trophies.json  ', bTrophies, 'bytes,', trophies.length, 'trophies');
console.log('  roadmap.json   ', bRoadmap, 'bytes,', stages.length, 'stages,', totalHours, 'hours');
console.log('  missables.json ', bMissables, 'bytes,', entries.length, 'entries');
console.log('  data.js        ', Buffer.byteLength(bundle), 'bytes');
console.log('  guides non-blank', guides.length, '/', trophies.length);
console.log('  guide words     ', words);
console.log('  est. minutes    ', meta.totalMinutes, '(sum of per-trophy estimates)');
if (warn.length) { console.log('  warnings:'); for (const w of [...new Set(warn)]) console.log('    ' + w); }
