import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const modulesRoot = fileURLToPath(new URL('../../src/modules', import.meta.url))
const importPattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g

interface SourceFile {
  path: string
  moduleName: string
  imports: string[]
}

function firstPathSegment(path: string): string {
  const segment = path.split(sep).at(0)
  if (!segment) throw new Error(`Expected a path below ${modulesRoot}: ${path}`)
  return segment
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name)
      return entry.isDirectory()
        ? collectTypeScriptFiles(path)
        : Promise.resolve(extname(entry.name) === '.ts' ? [path] : [])
    }),
  )
  return nested.flat()
}

async function loadSources(): Promise<SourceFile[]> {
  const paths = await collectTypeScriptFiles(modulesRoot)
  return Promise.all(
    paths.map(async (path) => {
      const content = await readFile(path, 'utf8')
      const imports = Array.from(content.matchAll(importPattern), (match) => match[1]).filter(
        (specifier): specifier is string => specifier !== undefined,
      )
      return {
        path,
        moduleName: firstPathSegment(relative(modulesRoot, path)),
        imports,
      }
    }),
  )
}

function sourceLabel(source: SourceFile): string {
  return relative(modulesRoot, source.path)
}

function resolveModuleImport(source: SourceFile, specifier: string) {
  if (!specifier.startsWith('.')) return undefined
  const target = resolve(dirname(source.path), specifier).replace(/\.js$/, '.ts')
  const targetRelative = relative(modulesRoot, target)
  if (targetRelative.startsWith(`..${sep}`)) return undefined
  return {
    target,
    targetModule: firstPathSegment(targetRelative),
  }
}

describe('module architecture boundaries', () => {
  it('keeps Hono out of services', async () => {
    const sources = (await loadSources()).filter((source) =>
      source.path.includes(`${sep}service${sep}`),
    )
    const violations = sources.flatMap((source) =>
      source.imports
        .filter((specifier) => specifier === 'hono' || specifier.startsWith('hono/'))
        .map((specifier) => `${sourceLabel(source)} -> ${specifier}`),
    )

    expect(violations).toEqual([])
  })

  it('keeps database access out of routers', async () => {
    const sources = (await loadSources()).filter((source) =>
      source.path.includes(`${sep}router${sep}`),
    )
    const violations = sources.flatMap((source) =>
      source.imports
        .filter(
          (specifier) =>
            specifier === '@nexus/database' ||
            specifier.startsWith('@nexus/database/') ||
            specifier === 'drizzle-orm' ||
            specifier.startsWith('drizzle-orm/'),
        )
        .map((specifier) => `${sourceLabel(source)} -> ${specifier}`),
    )

    expect(violations).toEqual([])
  })

  it('allows cross-module imports only through the target public API', async () => {
    const violations: string[] = []
    for (const source of await loadSources()) {
      for (const specifier of source.imports) {
        const target = resolveModuleImport(source, specifier)
        if (!target || target.targetModule === source.moduleName) continue
        const expectedPublicApi = resolve(modulesRoot, target.targetModule, 'index.ts')
        if (target.target !== expectedPublicApi) {
          violations.push(`${sourceLabel(source)} -> ${specifier}`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('keeps repositories away from foreign module schemas', async () => {
    const sources = (await loadSources()).filter((source) =>
      source.path.includes(`${sep}repo${sep}`),
    )
    const violations = sources.flatMap((source) =>
      source.imports.flatMap((specifier) => {
        const target = resolveModuleImport(source, specifier)
        if (
          !target ||
          target.targetModule === source.moduleName ||
          !target.target.endsWith(`${sep}repo${sep}schema.ts`)
        ) {
          return []
        }
        return [`${sourceLabel(source)} -> ${specifier}`]
      }),
    )

    expect(violations).toEqual([])
  })

  it('keeps the module dependency graph acyclic', async () => {
    const graph = new Map<string, Set<string>>()
    for (const source of await loadSources()) {
      const dependencies = graph.get(source.moduleName) ?? new Set<string>()
      for (const specifier of source.imports) {
        const target = resolveModuleImport(source, specifier)
        if (target && target.targetModule !== source.moduleName)
          dependencies.add(target.targetModule)
      }
      graph.set(source.moduleName, dependencies)
    }

    const visiting = new Set<string>()
    const visited = new Set<string>()
    const cycles: string[] = []

    function visit(moduleName: string, path: string[]) {
      if (visiting.has(moduleName)) {
        cycles.push([...path, moduleName].join(' -> '))
        return
      }
      if (visited.has(moduleName)) return
      visiting.add(moduleName)
      for (const dependency of graph.get(moduleName) ?? []) visit(dependency, [...path, moduleName])
      visiting.delete(moduleName)
      visited.add(moduleName)
    }

    for (const moduleName of graph.keys()) visit(moduleName, [])
    expect(cycles).toEqual([])
  })
})
