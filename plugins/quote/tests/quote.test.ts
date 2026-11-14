import { expect, test } from 'claude-code/testing'

import { expandTokens, tokenFor } from '../hooks/register'

const q1 = { id: 1, text: 'line one\nline "two"]' }
const q2 = { id: 2, text: 'other' }

test('tokenFor makes a one-line token with a safe preview', async () => {
  expect(tokenFor(q1)).toBe(`[C1 "line one line 'two''"] → `)
})

test('expandTokens turns tokens and their notes into blocks in place', async () => {
  const out = expandTokens(`${tokenFor(q1)}why?\nmiddle\n${tokenFor(q2)}\nend`, [q1, q2])
  expect(out.startsWith('<quote id="C1">\nline one\nline "two"]\n</quote>\n<note for="C1">why?</note>\nmiddle\n<quote id="C2">\nother\n</quote>\nend\n\n(<quote>')).toBe(true)
})

test('expandTokens leaves text without known tokens alone', async () => {
  expect(expandTokens('plain', [q1])).toBe('plain')
  expect(expandTokens('[C9 "x"] → hi', [q1])).toBe('[C9 "x"] → hi')
})
