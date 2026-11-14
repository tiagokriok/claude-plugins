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
