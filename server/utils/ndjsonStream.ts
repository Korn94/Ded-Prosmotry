// server/utils/ndjsonStream.ts

export interface StreamItemContext {
  current: number
  total: number
  videoId?: string
  link?: string
}

const PING_INTERVAL_MS = 5000

/**
 * Обёртка над NDJSON-стримом прогресса.
 *
 * Помимо событий progress/done умеет слать:
 * - start: «начали обрабатывать элемент N» — фронт сразу показывает, что именно парсится;
 * - ping: heartbeat каждые 5 сек, пока запрос к OK.RU висит (на медленном VPN
 *   одна итерация с ретраями может занять ~50 сек) — без него фронт выглядел бы
 *   «зависшим» и не понимал бы, жива ли связь с сервером.
 */
export function createNdjsonStream(controller: ReadableStreamDefaultController<Uint8Array>) {
  const encoder = new TextEncoder()

  let pingTimer: ReturnType<typeof setInterval> | null = null
  let context: StreamItemContext | null = null
  let waitedSec = 0

  function send(payload: Record<string, unknown>) {
    controller.enqueue(encoder.encode(JSON.stringify(payload) + '\n'))
  }

  function stopPing() {
    if (pingTimer) {
      clearInterval(pingTimer)
      pingTimer = null
    }
  }

  /** Начало обработки элемента: событие start + запуск heartbeat */
  function beginItem(ctx: StreamItemContext) {
    stopPing()
    context = ctx
    waitedSec = 0
    send({ type: 'start', ...ctx })

    pingTimer = setInterval(() => {
      if (!context) return
      waitedSec += PING_INTERVAL_MS / 1000
      try {
        send({ type: 'ping', ...context, waited: waitedSec })
      } catch {
        // Клиент отключился — прекращаем слать heartbeat
        stopPing()
      }
    }, PING_INTERVAL_MS)
  }

  /** Элемент обработан (успех или ошибка) — heartbeat останавливается */
  function endItem() {
    stopPing()
    context = null
  }

  /** Финальное событие (done) и закрытие стрима */
  function finish(payload: Record<string, unknown>) {
    stopPing()
    context = null
    send(payload)
    controller.close()
  }

  return { send, beginItem, endItem, finish }
}