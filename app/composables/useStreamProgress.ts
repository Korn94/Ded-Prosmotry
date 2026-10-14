// app/composables/useStreamProgress.ts
export interface StreamProgressEvent {
  type: 'progress' | 'done' | 'error' | 'start' | 'ping'
  current?: number
  total?: number
  videoId?: string
  link?: string
  title?: string | null
  communityName?: string | null
  views?: number
  status?: string
  error?: string
  added?: number
  updated?: number
  errors?: number
  message?: string
  /** Сколько секунд сервер ждёт ответа OK.RU (событие ping) */
  waited?: number
  /** Тип ошибки элемента: 'network' — сеть/таймаут, 'parse' — не найдены данные на странице */
  errorType?: 'network' | 'parse'
}

export type ProgressCallback = (event: StreamProgressEvent) => void

// Если сервер молчит дольше этого — считаем, что соединение потеряно.
// Сервер шлёт ping каждые 5 сек, пока висит запрос к OK.RU, поэтому такая
// пауза означает проблему именно на пути браузер → сервер (обрыв/медленный VPN).
const STALL_TIMEOUT_MS = 45000
const STALL_CHECK_MS = 5000

// Заголовки ответа тоже не должны висеть вечно
const INITIAL_RESPONSE_TIMEOUT_MS = 60000

export async function readStreamProgress(
  url: string,
  onProgress: ProgressCallback,
  options: { method?: string, body?: any } = {}
): Promise<StreamProgressEvent> {
  // Не даём запросу виснуть вечно, если сервер/сеть не отвечают на заголовки
  const abortController = new AbortController()
  const headerTimer = setTimeout(() => abortController.abort(), INITIAL_RESPONSE_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(url, { 
      method: options.method || 'POST',
      body: options.body ? JSON.stringify(options.body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/x-ndjson, application/json'
      },
      signal: abortController.signal
    })
  } catch (err) {
    if (abortController.signal.aborted) {
      throw new Error(`Сервер не ответил дольше ${INITIAL_RESPONSE_TIMEOUT_MS / 1000} секунд — проверьте соединение (возможно, медленный VPN)`)
    }
    throw err
  } finally {
    clearTimeout(headerTimer)
  }

  // Проверяем, не вернул ли сервер обычную JSON-ошибку
  const contentType = response.headers.get('content-type') || ''
  
  if (!response.ok) {
    // HTTP ошибка (400, 500 и т.д.)
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const errorData = await response.json()
      errorMessage = errorData.message || errorData.error || errorMessage
    } catch {}
    throw new Error(errorMessage)
  }

  // Если сервер вернул JSON вместо NDJSON (например, ошибка валидации)
  if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
    const jsonData = await response.json()
    if (jsonData.error) {
      throw new Error(jsonData.error)
    }
    // Если это нормальный JSON-ответ (не стрим), возвращаем как done
    return jsonData as StreamProgressEvent
  }

  const body = response.body
  if (!body) {
    throw new Error('Response body is not readable')
  }

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  return new Promise<StreamProgressEvent>((resolve, reject) => {
    let settled = false
    let lastActivity = Date.now()

    const stallTimer = setInterval(() => {
      if (Date.now() - lastActivity > STALL_TIMEOUT_MS) {
        settleReject(new Error(
          `Сервер не отвечает дольше ${Math.round(STALL_TIMEOUT_MS / 1000)} секунд — проверьте соединение (возможно, медленный VPN или пропал интернет)`
        ))
      }
    }, STALL_CHECK_MS)

    function settleResolve(event: StreamProgressEvent) {
      if (settled) return
      settled = true
      clearInterval(stallTimer)
      resolve(event)
    }

    function settleReject(err: unknown) {
      if (settled) return
      settled = true
      clearInterval(stallTimer)
      reject(err)
    }

    function processLines() {
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        
        try {
          const event: StreamProgressEvent = JSON.parse(line)
          
          if (event.type === 'error') {
            onProgress(event)
            settleReject(new Error(event.message || event.error || 'Server error'))
            return
          }
          
          if (event.type === 'done') {
            onProgress(event)
            settleResolve(event)
            return
          }
          
          // progress / start / ping — отдаём наружу
          onProgress(event)
        } catch (err) {
          console.warn('[StreamProgress] Ошибка парсинга строки:', line.substring(0, 100), err)
        }
      }

      reader.read().then(({ done, value }) => {
        lastActivity = Date.now()

        if (done) {
          // Если буфер не пуст, пытаемся распарсить последнюю строку
          if (buffer.trim()) {
            try {
              const event = JSON.parse(buffer)
              if (event.type === 'done') {
                onProgress(event)
                settleResolve(event)
                return
              }
            } catch {}
          }
          settleReject(new Error('Stream ended without done event'))
          return
        }
        
        buffer += decoder.decode(value, { stream: true })
        processLines()
      }).catch(settleReject)
    }

    processLines()
  })
}

/**
 * Человекочитаемая подсказка для оверлея прогресса по событиям start/ping.
 * Для остальных событий возвращает пустую строку.
 */
export function getStreamHint(event: StreamProgressEvent): string {
  if (event.type === 'start') {
    return `Обрабатывается ${event.current} из ${event.total} — запрашиваем OK.RU…`
  }

  if (event.type === 'ping') {
    const waited = event.waited ?? 0
    return waited >= 15
      ? `Ожидание ответа… ${waited} сек (возможно, медленное соединение)`
      : `Ожидание ответа… ${waited} сек`
  }

  return ''
}
