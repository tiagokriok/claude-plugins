import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Quote } from '../types'

const pending = atom({ plugin: 'quote', key: 'pending' } as const, null)
const dismissed = atom({ plugin: 'quote', key: 'dismissed' } as const, null)
const quotes = atom({ plugin: 'quote', key: 'quotes' } as const, [], { shape: 'quotes-2' })
const editing = atom({ plugin: 'quote', key: 'editing' } as const, null)

const asBlock = ({ text, comment }: Quote) => {
  const quoted = text
    .trimEnd()
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n')
  return comment.trim() ? `${quoted}\n\nComentário sobre a citação acima: ${comment.trim()}` : quoted
}

export const withQuotes = (list: readonly Quote[], text: string) =>
  list.length === 0 ? text : `${list.map(asBlock).join('\n\n')}\n\n${text}`.trimEnd()

const preview = (text: string, room: number) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > room ? `${flat.slice(0, Math.max(1, room - 1))}…` : flat
}

const addQuote = async ($: EngineInterface, text: string) => {
  const list = await read($, quotes)
  const at = list.findIndex(q => q.text === text)
  if (at === -1) {
    await update($, quotes, l => [...l, { text, comment: '' }])
    await update($, editing, () => list.length)
  } else {
    await update($, editing, () => at)
  }
  await update($, dismissed, () => text)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'quote',
      description: 'Add the selected transcript text to the quotes sent with the next prompt',
    })
    $.clock.every(600, async () => {
      const selected = await $.ui.selection()
      const text = selected?.text.trim() ? selected.text : null
      if (text === (await read($, pending))) return
      await update($, pending, () => text)
    })
    return next(e)
  })

  on('command.run', { command: 'quote' }, async $ => {
    const selected = await $.ui.selection()
    if (!selected?.text.trim()) {
      return { text: 'Nothing selected. Select text in the transcript first.' }
    }
    await addQuote($, selected.text)
    return { text: `Quoted (${(await read($, quotes)).length} pending).` }
  })

  on('prompt.submit', async ($, e, next) => {
    const list = await read($, quotes)
    await update($, quotes, () => [])
    await update($, editing, () => null)
    const selected = await $.ui.selection()
    const last = selected?.text ?? (await read($, pending))
    await update($, dismissed, () => last)
    return next(list.length === 0 ? e : { ...e, text: withQuotes(list, e.text) })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const text = await read($, pending)
    const list = await read($, quotes)
    const edit = await read($, editing)
    const canAdd = !!text && text !== (await read($, dismissed)) && !list.some(q => q.text === text)
    if (e.props.hasSurvey || (!canAdd && list.length === 0)) {
      return next(e)
    }
    const { Box, Button, Text, Input } = $.ui.resolve(e)
    const editingQuote = edit === null ? undefined : list[edit]

    if (edit !== null && editingQuote) {
      return (
        <Box flexDirection="row">
          <Text color="cyan">❝{edit + 1} {preview(editingQuote.text, 24)} </Text>
          <Input
            key={`comment-${edit}`}
            autoFocus
            placeholder="comentário (opcional)"
            submitLabel="salvar"
            value={editingQuote.comment}
            onSubmit={async value => {
              await update($, quotes, l => l.map((q, i) => (i === edit ? { ...q, comment: value.trim() } : q)))
              await update($, editing, () => null)
            }}
          />
          <Button key="done" label="ok" onPress={() => update($, editing, () => null)} />
          <Button
            key="remove"
            label="remover"
            onPress={async () => {
              await update($, quotes, l => l.filter((_, i) => i !== edit))
              await update($, editing, () => null)
            }}
          />
        </Box>
      )
    }

    const room = Math.max(10, e.props.bodyColumns - 20 - list.length * 6 - (list.length > 0 ? 10 : 0))
    return (
      <Box flexDirection="row">
        {list.map((q, i) => (
          <Button
            key={`q${i}`}
            plain
            label={`❝${i + 1}${q.comment ? '💬' : ''} `}
            onPress={() => update($, editing, () => i)}
          />
        ))}
        {list.length > 0 && <Button key="clear" label="limpar" onPress={() => update($, quotes, () => [])} />}
        {canAdd && text && (
          <>
            <Text dimColor wrap="truncate-end"> {preview(text, room)} </Text>
            <Button key="quote" label="Citar" variant="primary" onPress={() => addQuote($, text)} />
            <Button key="dismiss" label="x" onPress={() => update($, dismissed, () => text)} />
          </>
        )}
      </Box>
    )
  })
}
