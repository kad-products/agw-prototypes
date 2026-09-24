// Server-only. Import only inside getStaticProps, never in client components.
import path from 'path'
import fs from 'fs'
import yaml from 'js-yaml'
import type { StanceContent, ValueContent } from './types'

// Set CONTENT_SET=real to load Karen's framework content (local only).
// Defaults to 'fake' so the app always runs without the real content present.
const CONTENT_SET = process.env.CONTENT_SET ?? 'fake'
const CONTENT_DIR = path.join(process.cwd(), 'content', CONTENT_SET)

function loadYaml<T>(relativePath: string): T {
  const fullPath = path.join(CONTENT_DIR, relativePath)
  const raw = fs.readFileSync(fullPath, 'utf8')
  return yaml.load(raw) as T
}

function loadDir<T>(dir: string): T[] {
  const fullDir = path.join(CONTENT_DIR, dir)
  const files = fs
    .readdirSync(fullDir)
    .filter(f => f.endsWith('.yaml'))
    .sort()
  return files.map(f => loadYaml<T>(path.join(dir, f)))
}

export function loadStances(): StanceContent[] {
  const stances = loadDir<StanceContent>('stances')
  return stances.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
}

export function loadValues(): ValueContent[] {
  return loadDir<ValueContent>('values')
}

export function loadConceptContent<T>(concept: string): T {
  return loadYaml<T>(`concepts/${concept}.yaml`)
}
