#!/usr/bin/env node
// Actualiza las skills vendoreadas de craft desde su upstream y reaplica los parches locales.
//
// Uso:
//   node scripts/update-skills.mjs                 # todas las que tengan upstream definido
//   node scripts/update-skills.mjs impeccable      # solo una
//
// Lee plugins/craft/skills/SOURCES.json. Para cada skill con upstream.repo:
//   1) clona el upstream (shallow + sparse en upstream.path)
//   2) reemplaza el contenido de la skill local
//   3) reaplica los parches declarados (ver applyPatches)
// Al final revisá con `git diff --stat` antes de commitear.

import { execFileSync } from "node:child_process";
import {
  readFileSync, writeFileSync, rmSync, cpSync, mkdtempSync,
  existsSync, readdirSync, statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(repoRoot, "plugins", "craft", "skills");
const manifestPath = join(skillsDir, "SOURCES.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const only = process.argv[2];
const targets = manifest.skills.filter((s) => !only || s.name === only);

if (only && targets.length === 0) {
  console.error(`No existe la skill "${only}" en SOURCES.json`);
  process.exit(1);
}

// Sin shell: los argumentos van directo a git, asi un valor del manifiesto no puede inyectar comandos.
const git = (args) => execFileSync("git", args, { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });

function listFiles(dir) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) {
        if (e === "templates") continue; // las plantillas multi-plataforma NO se parchean
        walk(p);
      } else out.push(p);
    }
  })(dir);
  return out;
}

// Reaplica los parches locales sobre la skill recien traida del upstream.
function applyPatches(skill) {
  const dir = join(skillsDir, skill.name);
  const patches = skill.patches || [];
  const usesPluginRoot = patches.includes("plugin-root-paths");
  for (const f of listFiles(dir)) {
    const orig = readFileSync(f, "utf8");
    let txt = orig;
    if (usesPluginRoot) {
      const n = skill.name;
      txt = txt.split(`.claude/skills/${n}/`).join(`\${CLAUDE_PLUGIN_ROOT}/skills/${n}/`);
      txt = txt.split(`node skills/${n}/`).join(`node \${CLAUDE_PLUGIN_ROOT}/skills/${n}/`);
      txt = txt.split(`python3 skills/${n}/`).join(`python3 \${CLAUDE_PLUGIN_ROOT}/skills/${n}/`);
    }
    for (const r of skill.replacements || []) txt = txt.split(r.find).join(r.replace);
    if (txt !== orig) writeFileSync(f, txt);
  }
}

let updated = 0, skipped = 0;
for (const skill of targets) {
  const up = skill.upstream || {};
  if (!up.repo) {
    console.log(`SKIP  ${skill.name} — sin upstream (completá SOURCES.json)`);
    skipped++;
    continue;
  }
  if (skill.autoUpdate === false) {
    console.log(`SKIP  ${skill.name} — actualización manual (el upstream usa build/genera). Ver "notes" en SOURCES.json.`);
    skipped++;
    continue;
  }
  const ref = up.ref || "main";
  console.log(`PULL  ${skill.name}  <-  ${up.repo} @ ${ref} : ${up.path || "."}`);
  const tmp = mkdtempSync(join(tmpdir(), "craft-skill-"));
  try {
    git(["clone", "--depth", "1", "--filter=blob:none", "--sparse", "--branch", ref, up.repo, tmp]);
    if (up.path) git(["-C", tmp, "sparse-checkout", "set", up.path]);
    const src = up.path ? join(tmp, up.path) : tmp;
    if (!existsSync(src)) throw new Error(`el path "${up.path}" no existe en el upstream`);
    const dest = join(skillsDir, skill.name);
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
    rmSync(join(dest, ".git"), { recursive: true, force: true }); // por si path estaba vacio
    applyPatches(skill);
    console.log(`  OK  parches: ${(skill.patches || []).join(", ") || "ninguno"}`);
    updated++;
  } catch (e) {
    console.error(`  ERROR ${skill.name}: ${String(e.message).split("\n")[0]}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`\n${updated} actualizada(s), ${skipped} sin upstream.`);
console.log("Revisá: git diff --stat   y   git status   antes de commitear.");
