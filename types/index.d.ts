export type Level = 'off' | 'lite' | 'full'
export type Suggestion = { name: string; reason: string; manual: boolean } | null

declare module 'claude-code' {
  interface PluginState {
    'skill-whisper': { level: Level; suggestion: Suggestion }
  }
}
