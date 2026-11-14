import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Entry, FileDiff, Job, Pr, Provider, Tab } from '../types'

const PANE = 'pr-panel'
const pr = atom({ plugin: 'pr-panel', key: 'pr' } as const, null, { shape: 'pr-1' })
const error = atom({ plugin: 'pr-panel', key: 'error' } as const, null)
const isLoading = atom({ plugin: 'pr-panel', key: 'isLoading' } as const, false)
const tab = atom({ plugin: 'pr-panel', key: 'tab' } as const, 'summary')
const page = atom({ plugin: 'pr-panel', key: 'page' } as const, 0)
const file = atom({ plugin: 'pr-panel', key: 'file' } as const, 0)
const isConfirming = atom({ plugin: 'pr-panel', key: 'isConfirming' } as const, false)
const isCopied = atom({ plugin: 'pr-panel', key: 'isCopied' } as const, false)

const TABS: { id: Tab; label: string; hotkey: string }[] = [
  { id: 'summary', label: 'Resumo', hotkey: '1' },
  { id: 'comments', label: 'Comentários', hotkey: '2' },
  { id: 'pipeline', label: 'Pipeline', hotkey: '3' },
  { id: 'code', label: 'Código', hotkey: '4' },
  { id: 'activity', label: 'Atividade', hotkey: '5' },
]

type Any = Record<string, any>

export const parseDiff = (raw: string): FileDiff[] => {
  const files: FileDiff[] = []
  let current: FileDiff | undefined
  for (const line of raw.split('\n')) {
    const head = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
    if (head) {
      current = { path: head[2] ?? '?', add: 0, del: 0, lines: [] }
      files.push(current!)
      continue
    }
    if (!current) continue
    if (/^(index |--- |\+\+\+ |new file|deleted file|similarity|rename )/.test(line)) continue
    if (line.startsWith('+')) current.add += 1
    else if (line.startsWith('-')) current.del += 1
    current.lines.push(line)
  }
  return files
}

const byDate = (a: Entry, b: Entry) => b.at.localeCompare(a.at)

const ghCheck = (c: Any): Job => ({
  name: c.name ?? c.context ?? '?',
  status: String(c.conclusion || c.state || c.status || '?').toLowerCase(),
})

const ghPipeline = (jobs: Job[]) => {
  if (jobs.length === 0) return 'none'
  if (jobs.some(j => ['failure', 'error', 'cancelled', 'timed_out'].includes(j.status))) return 'failed'
  if (jobs.some(j => ['in_progress', 'queued', 'pending', 'expected', 'waiting'].includes(j.status))) return 'running'
  return 'success'
}

export const isPipelineRunning = (status: string) =>
  /running|pending|created|preparing|scheduled|waiting|queued|in_progress/.test(status)

const tone = (status: string) =>
  /success|pass|merged|clean/.test(status) ? 'success'
  : /fail|error|cancel|timed|dirty|conflict|blocked/.test(status) ? 'error'
  : /skip|neutral|manual|none|unknown/.test(status) ? 'inactive'
  : 'warning'

const badge = (p: Pr) =>
  p.state === 'merged' ? { label: 'MERGED', color: 'merged' }
  : p.state === 'closed' ? { label: 'CLOSED', color: 'error' }
  : p.isDraft ? { label: 'DRAFT', color: 'inactive' }
  : { label: 'OPEN', color: 'success' }

const glyph = (status: string) =>
  /success|pass|merged/.test(status) ? '✔'
  : /fail|error|cancel|timed/.test(status) ? '✘'
  : /skip|neutral|manual|none/.test(status) ? '○'
  : '◷'

const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000)
  if (!Number.isFinite(s)) return ''
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}

const run = async ($: EngineInterface, argv: string[]) => {
  const out = await $.process.run(argv, { timeoutMs: 60_000 })
  if (out.exitCode !== 0) throw new Error((out.stderr || out.stdout).trim().split('\n').slice(-3).join(' '))
  return out.stdout as string
}

const detect = async ($: EngineInterface): Promise<Provider> => {
  const url = (await run($, ['git', 'remote', 'get-url', 'origin'])).trim()
  return /github/i.test(url) ? 'github' : 'gitlab'
}

const fetchGithub = async ($: EngineInterface): Promise<Pr> => {
  const fields = 'number,title,url,state,isDraft,author,headRefName,baseRefName,body,comments,reviews,commits,statusCheckRollup,autoMergeRequest,mergeStateStatus,updatedAt'
  const [json, diff] = await Promise.all([
    run($, ['gh', 'pr', 'view', '--json', fields]),
    run($, ['gh', 'pr', 'diff']).catch(() => ''),
  ])
  const d: Any = JSON.parse(json)
  const jobs = (d.statusCheckRollup ?? []).map(ghCheck)
  const comments: Entry[] = [
    ...(d.comments ?? []).map((c: Any) => ({ author: c.author?.login ?? '?', text: c.body ?? '', at: c.createdAt ?? '' })),
    ...(d.reviews ?? []).filter((r: Any) => r.body).map((r: Any) => ({ author: r.author?.login ?? '?', text: r.body, at: r.submittedAt ?? '' })),
  ].sort(byDate)
  const activity: Entry[] = [
    ...(d.commits ?? []).map((c: Any) => ({ author: c.authors?.[0]?.login || c.authors?.[0]?.name || '?', text: `commit ${c.messageHeadline}`, at: c.committedDate ?? '' })),
    ...(d.reviews ?? []).map((r: Any) => ({ author: r.author?.login ?? '?', text: `review ${String(r.state).toLowerCase()}`, at: r.submittedAt ?? '' })),
    ...(d.comments ?? []).map((c: Any) => ({ author: c.author?.login ?? '?', text: 'comentou', at: c.createdAt ?? '' })),
  ].sort(byDate)
  return {
    provider: 'github', number: d.number, title: d.title, url: d.url, state: String(d.state).toLowerCase(),
    isDraft: !!d.isDraft, author: d.author?.login ?? '?', source: d.headRefName, target: d.baseRefName,
    body: d.body ?? '', mergeStatus: String(d.mergeStateStatus ?? '').toLowerCase(), isAutoMerge: !!d.autoMergeRequest,
    pipeline: ghPipeline(jobs), jobs, comments, activity, files: parseDiff(diff), updatedAt: d.updatedAt ?? '',
  }
}

const fetchGitlab = async ($: EngineInterface): Promise<Pr> => {
  const d: Any = JSON.parse(await run($, ['glab', 'mr', 'view', '-F', 'json']))
  const iid = d.iid
  const pipelineId = d.head_pipeline?.id ?? d.pipeline?.id
  const [notesRaw, jobsRaw, diff] = await Promise.all([
    run($, ['glab', 'api', `projects/:id/merge_requests/${iid}/notes?per_page=100&sort=desc`]).catch(() => '[]'),
    pipelineId ? run($, ['glab', 'api', `projects/:id/pipelines/${pipelineId}/jobs?per_page=100`]).catch(() => '[]') : Promise.resolve('[]'),
    run($, ['glab', 'mr', 'diff', String(iid), '--raw']).catch(() => ''),
  ])
  const notes: Any[] = JSON.parse(notesRaw)
  const jobs: Job[] = JSON.parse(jobsRaw).map((j: Any) => ({ name: `${j.stage}: ${j.name}`, status: j.allow_failure && j.status === 'failed' ? 'failed (allowed)' : j.status }))
  const toEntry = (n: Any): Entry => ({ author: n.author?.username ?? '?', text: n.body ?? '', at: n.created_at ?? '' })
  return {
    provider: 'gitlab', number: iid, title: d.title, url: d.web_url, state: d.state, isDraft: !!d.draft,
    author: d.author?.username ?? '?', source: d.source_branch, target: d.target_branch, body: d.description ?? '',
    mergeStatus: d.detailed_merge_status ?? d.merge_status ?? '', isAutoMerge: !!(d.merge_when_pipeline_succeeds || d.auto_merge_enabled),
    pipeline: d.head_pipeline?.status ?? d.pipeline?.status ?? 'none', jobs,
    comments: notes.filter(n => !n.system).map(toEntry).sort(byDate),
    activity: notes.map(toEntry).sort(byDate),
    files: parseDiff(diff), updatedAt: d.updated_at ?? '',
  }
}

const refresh = async ($: EngineInterface) => {
  await update($, isLoading, () => true)
  try {
    const data = (await detect($)) === 'github' ? await fetchGithub($) : await fetchGitlab($)
    await update($, pr, () => data)
    await update($, error, () => null)
  } catch (err) {
    await update($, error, () => (err instanceof Error ? err.message : String(err)))
  } finally {
    await update($, isLoading, () => false)
  }
}

const act = async ($: EngineInterface, label: string, argv: (p: Pr) => string[]) => {
  const current = await read($, pr)
  if (!current) return
  try {
    await run($, argv(current))
    $.ui.toast(`${label}: ok`)
  } catch (err) {
    $.ui.toast(`${label} falhou: ${err instanceof Error ? err.message : err}`)
  }
  await update($, isConfirming, () => false)
  await refresh($)
}

const mergeArgv = (p: Pr) =>
  p.provider === 'github'
    ? ['gh', 'pr', 'merge', String(p.number), '--squash']
    : ['glab', 'mr', 'merge', String(p.number), '--yes', '--auto-merge=false']

const autoArgv = (p: Pr) =>
  p.provider === 'github'
    ? ['gh', 'pr', 'merge', String(p.number), p.isAutoMerge ? '--disable-auto' : '--auto', ...(p.isAutoMerge ? [] : ['--squash'])]
    : p.isAutoMerge
      ? ['glab', 'api', '-X', 'POST', `projects/:id/merge_requests/${p.number}/cancel_merge_when_pipeline_succeeds`]
      : ['glab', 'mr', 'merge', String(p.number), '--yes', '--auto-merge']


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'pr-panel', description: 'Show this branch PR/MR in a side pane' })
    $.clock.every(60_000, async () => {
      if (await read($, pr)) void refresh($)
    })
    return next(e)
  })

  on('command.run', { command: 'pr-panel' }, async $ => {
    await $.ui.open({ id: PANE, title: 'Pull request' })
    void refresh($)
    return { text: 'PR pane opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const data = await read($, pr)
    const err = await read($, error)
    const loading = await read($, isLoading)
    const current = await read($, tab)
    const pageNo = await read($, page)
    const width = e.props.bodyColumns
    const rows = Math.max(8, (e.viewport?.rows ?? 30) - 8)

    if (!data) {
      return (
        <Box flexDirection="column">
          <Text dimColor>{loading ? 'Carregando…' : err ? `Erro: ${err}` : 'Nenhum PR/MR para esta branch.'}</Text>
          <Button key="refresh" label="Atualizar" onPress={() => refresh($)} />
        </Box>
      )
    }

    const pager = (total: number, size: number) => {
      const last = Math.max(0, Math.ceil(total / size) - 1)
      const at = Math.min(pageNo, last)
      return {
        at,
        node: last > 0 && (
          <Box>
            <Button key="prev" label="◀" plain onPress={() => update($, page, n => Math.max(0, n - 1))} />
            <Text dimColor> {at + 1}/{last + 1} </Text>
            <Button key="next" label="▶" plain onPress={() => update($, page, n => Math.min(last, n + 1))} />
          </Box>
        ),
      }
    }

    const entries = (list: Entry[], size: number, max: number) => {
      if (list.length === 0) return <Text dimColor>Nada ainda.</Text>
      const p = pager(list.length, size)
      return (
        <Box flexDirection="column">
          {list.slice(p.at * size, p.at * size + size).map((c, i) => (
            <Box key={`e${i}`} flexDirection="column" marginBottom={1}>
              <Text bold>@{c.author} <Text dimColor>{ago(c.at)}</Text></Text>
              <Text>{c.text.length > max ? `${c.text.slice(0, max)}…` : c.text}</Text>
            </Box>
          ))}
          {p.node}
        </Box>
      )
    }

    const body = (() => {
      switch (current) {
        case 'summary':
          return (
            <Box flexDirection="column" gap={1}>
              <Box flexDirection="column">
                <Text><Text color="subtle">branch   </Text>{data.source} <Text color="subtle">→</Text> {data.target}</Text>
                <Text><Text color="subtle">autor    </Text>@{data.author} <Text color="subtle">· atualizado há {ago(data.updatedAt)}</Text></Text>
                <Text><Text color="subtle">pipeline </Text><Text color={tone(data.pipeline)}>{glyph(data.pipeline)} {data.pipeline}</Text></Text>
                <Text><Text color="subtle">merge    </Text><Text color={tone(data.mergeStatus)}>{data.mergeStatus || '?'}</Text>{data.isAutoMerge ? <Text color="success"> · auto-merge ligado</Text> : ''}</Text>
                <Text><Text color="subtle">mudanças </Text>{data.files.length} arquivos <Text color="diffAdded">+{data.files.reduce((s, f) => s + f.add, 0)}</Text> <Text color="diffRemoved">−{data.files.reduce((s, f) => s + f.del, 0)}</Text> <Text color="subtle">· {data.comments.length} comentários</Text></Text>
              </Box>
              <Box flexDirection="column" borderStyle="round" borderColor="subtle" paddingX={1}>
                <Markdown key="body" text={data.body.split('\n').slice(0, rows).join('\n') || '_Sem descrição._'} />
              </Box>
            </Box>
          )
        case 'comments':
          return entries(data.comments, 4, 400)
        case 'activity':
          return entries(data.activity.map(a => ({ ...a, text: a.text.split('\n')[0] ?? '' })), Math.max(3, Math.floor(rows / 3)), 120)
        case 'pipeline': {
          const p = pager(data.jobs.length, rows)
          return (
            <Box flexDirection="column">
              <Text bold>{glyph(data.pipeline)} {data.pipeline}</Text>
              {data.jobs.slice(p.at * rows, p.at * rows + rows).map((j, i) => (
                <Text key={`j${i}`} wrap="truncate-end">{glyph(j.status)} {j.name} <Text dimColor>{j.status}</Text></Text>
              ))}
              {p.node}
            </Box>
          )
        }
      }
    })


    const codeTab = async () => {
      const idx = Math.min(await read($, file), Math.max(0, data.files.length - 1))
      const f = data.files[idx]
      if (!f) return <Text dimColor>Sem diff.</Text>
      const p = pager(f.lines.length, rows - 2)
      return (
        <Box flexDirection="column">
          <Box>
            <Button key="fprev" label="◀ arq" plain onPress={async () => { await update($, file, n => Math.max(0, n - 1)); await update($, page, () => 0) }} />
            <Text bold wrap="truncate-end"> {idx + 1}/{data.files.length} {f.path} <Text color="green">+{f.add}</Text> <Text color="red">−{f.del}</Text> </Text>
            <Button key="fnext" label="arq ▶" plain onPress={async () => { await update($, file, n => Math.min(data.files.length - 1, n + 1)); await update($, page, () => 0) }} />
          </Box>
          {f.lines.slice(p.at * (rows - 2), p.at * (rows - 2) + rows - 2).map((l, i) => (
            <Text key={`l${i}`} wrap="truncate-end" color={l.startsWith('+') ? 'green' : l.startsWith('-') ? 'red' : undefined} dimColor={l.startsWith('@@')}>{l || ' '}</Text>
          ))}
          {p.node}
        </Box>
      )
    }

    const confirming = await read($, isConfirming)
    const isOpen = data.state === 'open' || data.state === 'opened'

    const copied = await read($, isCopied)
    const isRunning = isPipelineRunning(data.pipeline)
    const b = badge(data)

    return (
      <Box flexDirection="column" width={width} gap={1}>
        <Box flexDirection="column">
          <Box>
            <Text backgroundColor={b.color} color="inverseText" bold> {b.label} </Text>
            <Text color="subtle"> {data.provider === 'github' ? 'GitHub #' : 'GitLab !'}{data.number}</Text>
            {loading && <Text color="subtle"> · atualizando…</Text>}
          </Box>
          <Text bold wrap="truncate-end">{data.title}</Text>
        </Box>
        <Box flexWrap="wrap" columnGap={1}>
          <Button key="copy" label={copied ? '✔ Copiado' : 'Copiar link'} hotkey="c" variant={copied ? 'primary' : undefined}
            onPress={async press => {
              const res = await $.ui.copy({ text: data.url, surface: press.surface })
              if (!res.isCopied) { $.ui.toast(`Não copiou: ${res.reason}`); return }
              $.ui.toast(`Link copiado: ${data.url}`)
              await update($, isCopied, () => true)
              $.clock.after(2000, () => void update($, isCopied, () => false))
            }} />
          <Button key="refresh" label="Atualizar" hotkey="r" onPress={() => refresh($)} />
          {isOpen && (isRunning || data.isAutoMerge) && (
            <Button key="auto" label={data.isAutoMerge ? 'Cancelar auto-merge' : 'Auto-merge'} hotkey="a"
              onPress={() => act($, 'Auto-merge', autoArgv)} />
          )}
          {isOpen && !isRunning && !data.isAutoMerge && !confirming && <Button key="merge" label="Merge" hotkey="m" onPress={() => update($, isConfirming, () => true)} />}
          {isOpen && confirming && <Button key="confirm" label="Confirmar merge" variant="primary" hotkey="y" onPress={() => act($, 'Merge', mergeArgv)} />}
          {isOpen && confirming && <Button key="cancel" label="Cancelar" hotkey="n" onPress={() => update($, isConfirming, () => false)} />}
        </Box>
        <Box flexDirection="column">
          <Box flexWrap="wrap">
            {TABS.map(t => (
              <Button key={`tab-${t.id}`} plain hotkey={t.hotkey} variant={t.id === current ? 'primary' : undefined}
                onPress={async () => { await update($, tab, () => t.id); await update($, page, () => 0) }}>
                <Text bold={t.id === current} underline={t.id === current} color={t.id === current ? 'suggestion' : 'subtle'}>{t.label}</Text>{'  '}
              </Button>
            ))}
          </Box>
          <Text color="subtle">{'─'.repeat(Math.max(1, width))}</Text>
        </Box>
        {err && <Text color="error" wrap="truncate-end">{err}</Text>}
        {current === 'code' ? await codeTab() : body()}
      </Box>
    )
  })
}
