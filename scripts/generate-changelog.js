#!/usr/bin/env node
// Generates src/lib/changelog-data.json from git history, for the in-app
// "What's new" changelog. Reads commit subjects tagged "(vX.Y.Z)" -- the
// convention this repo already follows for every version-bumping commit (see
// CLAUDE.md) -- so no separate changelog needs to be hand-maintained.
//
// Run `npm run changelog` and commit the result before pushing. This can't
// run at Docker build time (the image's build context excludes .git), so the
// generated file must be checked in like any other build artifact here.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'lib', 'changelog-data.json');
const VERSION_RE = /\(v(\d+\.\d+\.\d+)\)\s*$/;
const MAX_ENTRIES = 200;

function loadEntries() {
  let log;
  try {
    log = execFileSync('git', ['log', '--pretty=format:%H%x1f%aI%x1f%s', '-n', String(MAX_ENTRIES * 4)], {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
    });
  } catch {
    return [];
  }

  const entries = [];
  for (const line of log.split('\n')) {
    if (!line) continue;
    const [hash, date, subject] = line.split('\x1f');
    const match = subject && subject.match(VERSION_RE);
    if (!match) continue;
    entries.push({
      version: match[1],
      message: subject.replace(VERSION_RE, '').trim(),
      date,
      hash: hash.slice(0, 7),
    });
    if (entries.length >= MAX_ENTRIES) break;
  }
  return entries;
}

const entries = loadEntries();
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(entries, null, 2) + '\n');
console.log(`Wrote ${entries.length} changelog entries to ${path.relative(process.cwd(), OUTPUT_PATH)}`);
