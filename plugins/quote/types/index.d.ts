export type Quote = { id: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    quote: {
      pending: string | null
      dismissed: string | null
      quotes: Shaped<Quote[]>
      nextId: number
    }
  }
}
