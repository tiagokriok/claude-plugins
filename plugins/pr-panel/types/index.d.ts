export type Provider = 'github' | 'gitlab'
export type Job = { name: string; status: string }
export type Entry = { author: string; text: string; at: string }
export type FileDiff = { path: string; add: number; del: number; lines: string[] }
export type Pr = {
  provider: Provider
  headSha: string
  number: number
  title: string
  url: string
  state: string
  isDraft: boolean
  author: string
  source: string
  target: string
  body: string
  mergeStatus: string
  isAutoMerge: boolean
  pipeline: string
  jobs: Job[]
  comments: Entry[]
  activity: Entry[]
  files: FileDiff[]
  updatedAt: string
}
export type ListItem = {
  number: number
  title: string
  author: string
  isDraft: boolean
  source: string
  updatedAt: string
  verdict: string
  color: string
}
export type Tab = 'summary' | 'comments' | 'pipeline' | 'code' | 'activity'

declare module 'claude-code' {
  interface PluginState {
    'pr-panel': {
      pr: Shaped<Pr | null>
      error: string | null
      isLoading: boolean
      tab: Tab
      page: number
      file: number
      isConfirming: boolean
      isCopied: boolean
      repo: string | null
      view: 'list' | 'detail'
      selected: number | null
      prList: Shaped<ListItem[]>
      listPage: number
    }
  }
}
