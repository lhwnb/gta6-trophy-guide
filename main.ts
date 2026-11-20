// trophy-guide entry point: packs this directory's static guide for the judge.
//
// The guide itself is app/ (plain HTML, CSS and ES modules that a browser
// opens at app/index.html with no build step and no network) plus the PNG
// shots in screenshots/. This program copies both beside the output root and
// writes dossier.json there: the scorer's view of the entry, built by the
// vendored library in vendor/makefun-frontend.ts, which must stay untouched
// because dossier.json has to be byte-for-byte what the scorer's own copy of
// that library produces.
//
// The output root is MAKEFUN_OUTPUT_DIR, or /output inside the grader's
// container:  MAKEFUN_OUTPUT_DIR=out node main.ts
// Node 22, standard library only, no network, nothing written outside the
// output root.

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

/** This program's own directory: app/, screenshots/ and vendor/ live beside it. */
const SOURCE_ROOT = dirname(fileURLToPath(import.meta.url));

/**
 * The caps the scorer applies (reference/gate.json). Only text_max_bytes
 * shapes the dossier's bytes; the rest make buildDossier refuse exactly what
 * the scorer would refuse, rather than shipping an entry that dies there.
 */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Where the packaged entry goes: the environment's override, else the container's /output. */
function outputRoot(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

/** Recursive directory copy, one plain file at a time (no globs, no links). */
function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name);
    const dst = join(to, entry.name);
    if (entry.isDirectory()) copyTree(src, dst);
    else copyFileSync(src, dst);
  }
}

/** Ship the guide: every file under app/, keeping its relative path. */
function copyApp(out: string): void {
  copyTree(join(SOURCE_ROOT, 'app'), join(out, 'app'));
}

/** Ship the screenshots, and leave the directory present even when there are none yet. */
function copyScreenshots(out: string): void {
  const from = join(SOURCE_ROOT, 'screenshots');
  const to = join(out, 'screenshots');
  mkdirSync(to, { recursive: true });
  if (existsSync(from)) copyTree(from, to);
}

/** Build dossier.json in the output root and return the size written. */
function writeDossier(out: string): number {
  const bytes = buildDossier(out, CAPS);
  writeFileSync(join(out, 'dossier.json'), bytes);
  return bytes.length;
}

function main(): void {
  const out = outputRoot();
  mkdirSync(out, { recursive: true });
  copyApp(out);
  copyScreenshots(out);
  const dossierBytes = writeDossier(out);
  console.log(`trophy-guide: app/ + screenshots/ -> ${out}, dossier.json ${dossierBytes} bytes`);
}

main();
