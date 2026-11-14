import { expect, test } from 'claude-code/testing'

import { withQuotes } from '../hooks/register'

test('withQuotes prepends each quote with its optional comment', async () => {
  expect(withQuotes([], 'hi')).toBe('hi')
  expect(withQuotes([{ text: 'a\nb', comment: ' por quê? ' }, { text: 'c', comment: '' }], 'reply')).toBe(
    '> a\n> b\n\nComentário sobre a citação acima: por quê?\n\n> c\n\nreply',
  )
  expect(withQuotes([{ text: 'x', comment: 'só isso' }], '')).toBe('> x\n\nComentário sobre a citação acima: só isso')
})
