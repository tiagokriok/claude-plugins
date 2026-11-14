import { expect, test } from 'claude-code/testing'

import { parseDiff } from '../hooks/register'

test('parseDiff splits files and counts lines', async () => {
  const raw = [
    'diff --git a/a.ts b/a.ts',
    'index 1..2 100644',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,2 +1,2 @@',
    '-old',
    '+new',
    '+more',
    'diff --git a/b.md b/b.md',
    '@@ -1 +1 @@',
    '-x',
  ].join('\n')
  const files = parseDiff(raw)
  expect(files.map(f => [f.path, f.add, f.del])).toEqual([['a.ts', 2, 1], ['b.md', 0, 1]])
  expect(files[0]?.lines[0]).toBe('@@ -1,2 +1,2 @@')
})

import { isPipelineRunning } from '../hooks/register'

test('isPipelineRunning picks the auto-merge state', async () => {
  for (const s of ['running', 'pending', 'created', 'waiting_for_resource', 'in_progress']) expect(isPipelineRunning(s)).toBe(true)
  for (const s of ['success', 'failed', 'none', 'canceled', 'skipped']) expect(isPipelineRunning(s)).toBe(false)
})

import { mergeArgv, verdict } from '../hooks/register'
import type { Pr } from '../types'

const base: Pr = {
  provider: 'github', headSha: 'abc123', number: 7, title: 't', url: 'u', state: 'open', isDraft: false,
  author: 'a', source: 's', target: 'main', body: '', mergeStatus: 'clean', isAutoMerge: false,
  pipeline: 'success', jobs: [], comments: [], activity: [], files: [], updatedAt: '',
}

test('merge is pinned to the head commit seen', async () => {
  expect(mergeArgv(base)).toContain('--match-head-commit')
  expect(mergeArgv(base)).toContain('abc123')
  expect(mergeArgv({ ...base, provider: 'gitlab' })).toEqual(expect.arrayContaining(['--sha', 'abc123']))
})

test('verdict is green only when everything is clean', async () => {
  expect(verdict(base)).toEqual({ text: 'ready to merge', color: 'success' })
  expect(verdict({ ...base, pipeline: 'running' }).color).toBe('warning')
  expect(verdict({ ...base, pipeline: 'failed', jobs: [{ name: 'x', status: 'failure' }] })).toEqual({ text: 'check failed', color: 'error' })
  expect(verdict({ ...base, mergeStatus: 'dirty' }).text).toBe('conflicts')
  expect(verdict({ ...base, isDraft: true }).text).toBe('draft')
  expect(verdict({ ...base, provider: 'gitlab', mergeStatus: 'not_approved' }).text).toBe('needs approval')
  expect(verdict({ ...base, state: 'merged' }).color).toBe('merged')
})
