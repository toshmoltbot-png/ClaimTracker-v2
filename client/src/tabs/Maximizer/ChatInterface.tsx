import { useEffect, useState } from 'react'
import { apiClient } from '@/lib/api'
import { buildClaimSummary } from '@/lib/claimWorkflow'
import { useClaimStore } from '@/store/claimStore'
import { useUIStore } from '@/store/uiStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  followUps?: string[]
}

const SESSION_KEY = 'claimtracker-v2-maximizer-history'

function loadSessionHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as ChatMessage[]) : []
  } catch {
    return []
  }
}

export function ChatInterface() {
  const data = useClaimStore((state) => state.data)
  const pushToast = useUIStore((state) => state.pushToast)
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadSessionHistory())
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages))
  }, [messages])

  useEffect(() => {
    void apiClient.maximizerMetrics({ event: 'maximizer_opened', claimSummary: buildClaimSummary(data) }).catch(() => undefined)
  }, [data])

  async function sendMessage(message: string) {
    const trimmed = message.trim()
    if (!trimmed || sending) return

    const nextUserMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: trimmed }
    const history = [...messages, nextUserMessage]
    setMessages(history)
    setInput('')
    setSending(true)

    try {
      const response = await apiClient.maximizerChat({
        message: trimmed,
        claimSummary: buildClaimSummary(data),
        history: history.map((entry) => ({ role: entry.role, content: entry.content })),
      })
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.reply,
        followUps: response.followUps || [],
      }
      setMessages((current) => [...current, assistantMessage])
      void apiClient.maximizerMetrics({
        event: 'maximizer_response',
        messageLength: trimmed.length,
        followUpCount: assistantMessage.followUps?.length || 0,
        metrics: response.metrics || {},
      }).catch(() => undefined)
    } catch (error) {
      pushToast(error instanceof Error ? error.message : 'Maximizer request failed.', 'error')
    } finally {
      setSending(false)
    }
  }

  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')

  return (
    <section className="panel grid gap-4 px-6 py-6">
      <div className="rounded-3xl border border-[color:var(--border)] bg-slate-950/40 px-4 py-4">
        <p className="text-xs uppercase tracking-[0.3em] text-sky-300">Conversation</p>
        <div className="mt-4 space-y-3">
          {messages.length ? (
            messages.map((message) => (
              <div
                className={`rounded-2xl px-4 py-4 text-sm leading-7 ${
                  message.role === 'assistant'
                    ? 'border border-[color:var(--border)] bg-slate-900/80 text-slate-200'
                    : 'bg-sky-400/15 text-sky-50'
                }`}
                key={message.id}
              >
                {message.content}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">
              Start with a claim strategy question, such as missing categories, evidence gaps, or negotiation prep.
            </div>
          )}
          {sending ? <div className="text-sm text-slate-400">Thinking…</div> : null}
        </div>
      </div>

      {lastAssistant?.followUps?.length ? (
        <div className="flex flex-wrap gap-2">
          {lastAssistant.followUps.map((prompt) => (
            <button className="button-secondary" key={prompt} onClick={() => void sendMessage(prompt)} type="button">
              {prompt}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        className="field min-h-32"
        onChange={(event) => setInput(event.target.value)}
        placeholder="Ask for missing categories, overlooked expenses, adjuster pushback prep, or follow-up strategy..."
        value={input}
      />
      <div className="flex justify-end">
        <button className="button-primary" disabled={sending || !input.trim()} onClick={() => void sendMessage(input)} type="button">
          Send
        </button>
      </div>
    </section>
  )
}
