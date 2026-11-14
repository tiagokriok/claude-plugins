export type Quote = { text: string; comment: string }

declare module 'claude-code' {
  interface PluginState {
    quote: {
      pending: string | null
      dismissed: string | null
      quotes: Shaped<Quote[]>
      editing: number | null
    }
  }
}
