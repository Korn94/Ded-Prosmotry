// app/composables/useStreamProgress.ts
export interface StreamProgressEvent {
  type: 'progress' | 'done' | 'error'
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
}

export type ProgressCallback = (event: StreamProgressEvent) => void

export async function readStreamProgress(
  url: string,
  onProgress: ProgressCallback,
  options: { method?: string, body?: any } = {}
): Promise<StreamProgressEvent> {
  const response = await fetch(url, { 
    method: options.method || 'POST',
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson, application/json'
    }
  })

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
    function processLines() {
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        
        try {
          const event: StreamProgressEvent = JSON.parse(line)
          
          if (event.type === 'error') {
            onProgress(event)
            reject(new Error(event.message || event.error || 'Server error'))
            return
          }
          
          if (event.type === 'done') {
            onProgress(event)
            resolve(event)
            return
          }
          
          onProgress(event)
        } catch (err) {
          console.warn('[StreamProgress] Ошибка парсинга строки:', line.substring(0, 100), err)
        }
      }

      reader.read().then(({ done, value }) => {
        if (done) {
          // Если буфер не пуст, пытаемся распарсить последнюю строку
          if (buffer.trim()) {
            try {
              const event = JSON.parse(buffer)
              if (event.type === 'done') {
                onProgress(event)
                resolve(event)
                return
              }
            } catch {}
          }
          reject(new Error('Stream ended without done event'))
          return
        }
        
        buffer += decoder.decode(value, { stream: true })
        processLines()
      }).catch(reject)
    }

    processLines()
  })
}
