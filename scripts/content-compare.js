#!/usr/bin/env node
// Compares fake content key structure against real content.
// For each category (stances, values, concepts), reports:
//   MISSING — keys present in fake but absent from all real files in that category
//   EXTRA   — keys present in real but absent from all fake files in that category

const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

const ROOT = path.resolve(__dirname, '..')
const FAKE = path.join(ROOT, 'content', 'fake')
const REAL = path.join(ROOT, 'content', 'real')

// Recursively collect all dot-notation key paths from an object.
// Scalar values are leaves; arrays stop at the key (don't recurse into items).
function collectPaths(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return new Set([prefix])
  }
  const paths = new Set()
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key
    const child = collectPaths(obj[key], full)
    for (const p of child) paths.add(p)
  }
  return paths
}

function loadYaml(filePath) {
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`  ⚠ Could not parse ${filePath}: ${e.message}`)
    return null
  }
}

function yamlFilesIn(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .map(f => path.join(dir, f))
}

// Collect the union of all key paths across a list of files.
function unionPaths(files) {
  const all = new Set()
  for (const f of files) {
    const obj = loadYaml(f)
    if (obj) for (const p of collectPaths(obj)) all.add(p)
  }
  return all
}

function diff(fakeKeys, realKeys, label) {
  const missing = [...fakeKeys].filter(k => !realKeys.has(k)).sort()
  const extra = [...realKeys].filter(k => !fakeKeys.has(k)).sort()
  console.log(`\n── ${label} ─────────────────────────────────`)
  if (missing.length === 0 && extra.length === 0) {
    console.log('  ✓ No differences')
    return
  }
  if (missing.length > 0) {
    console.log('  MISSING in real (add these):')
    for (const k of missing) console.log(`    - ${k}`)
  }
  if (extra.length > 0) {
    console.log('  EXTRA in real (can remove):')
    for (const k of extra) console.log(`    + ${k}`)
  }
}

function compareCategory(subdir, label) {
  const fakeDir = path.join(FAKE, subdir)
  const realDir = path.join(REAL, subdir)

  const fakeFiles = yamlFilesIn(fakeDir)
  const realFiles = yamlFilesIn(realDir)

  if (fakeFiles.length === 0) {
    console.log(`\n── ${label} ─────────────────────────────────`)
    console.log('  ⚠ No fake files found — skipping')
    return
  }
  if (realFiles.length === 0) {
    console.log(`\n── ${label} ─────────────────────────────────`)
    console.log('  ⚠ No real files found — is content/real/ present?')
    return
  }

  const fakeKeys = unionPaths(fakeFiles)
  const realKeys = unionPaths(realFiles)
  diff(fakeKeys, realKeys, label)
}

// For concepts, compare matching filenames individually (e.g. survey.yaml ↔ survey.yaml)
function compareConcepts() {
  const fakeDir = path.join(FAKE, 'concepts')
  const realDir = path.join(REAL, 'concepts')

  const fakeFiles = yamlFilesIn(fakeDir)
  if (fakeFiles.length === 0) return

  for (const ff of fakeFiles) {
    const name = path.basename(ff)
    const rf = path.join(realDir, name)
    const label = `concepts/${name}`

    if (!fs.existsSync(rf)) {
      console.log(`\n── ${label} ─────────────────────────────────`)
      console.log(`  ⚠ No matching real file at content/real/concepts/${name}`)
      continue
    }

    const fakeObj = loadYaml(ff)
    const realObj = loadYaml(rf)
    if (!fakeObj || !realObj) continue

    diff(collectPaths(fakeObj), collectPaths(realObj), label)
  }
}

console.log('Content key comparison: fake → real')
console.log('====================================')
compareCategory('stances', 'stances (union of all stance files)')
compareCategory('values', 'values (union of all value files)')
compareConcepts()
console.log()
