// server/api/parse-views.post.ts
// Парсинг просмотров по ссылкам БЕЗ записи в локальную БД
import { defineEventHandler, readBody, createError } from 'h3'
import { parseVideoPage } from '../utils/okRuParser'
import { z } from 'zod'

const ParseViewsSchema = z.object({
  links: z.union([z.string(), z.array(z.string())])
})

export default defineEventHandler(async (event) => {
  console.log('[API] POST /api/parse-views')

  const body = await readBody(event)
  const parsed = ParseViewsSchema.safeParse(body)

  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Неверный формат данных: необходимо передать поле "links"'
    })
  }

  // Нормализуем ссылки
  const linkList = Array.isArray(parsed.data.links)
    ? parsed.data.links
    : parsed.data.links.split(/[\n,;\s]+/).filter(Boolean)

  if (linkList.length === 0) {
    throw createError({
      statusCode: 400,
      message: 'Не передано ни одной ссылки'
    })
  }

  console.log(`[API] Получено ссылок: ${linkList.length}`)

  // Создаем NDJSON стрим (только чтение, без обращений к БД)
  const stream = new ReadableStream({
    async start(controller) {
      let ok = 0
      let errors = 0
      let processed = 0
      let totalViews = 0

      for (const link of linkList) {
        processed++

        // Извлекаем videoId
        const match = link.trim().match(/ok\.ru\/video\/(\d+)/i)
        if (!match) {
          const errorMsg = JSON.stringify({
            type: 'progress',
            current: processed,
            total: linkList.length,
            link,
            status: 'error',
            error: 'Неверный формат ссылки (ожидается ok.ru/video/ID)'
          })
          controller.enqueue(new TextEncoder().encode(errorMsg + '\n'))
          errors++
          continue
        }

        const videoId = match[1]!
        const url = `https://ok.ru/video/${videoId}`

        try {
          // Только парсим страницу — ничего не сохраняем
          const result = await parseVideoPage(url, videoId)

          const hasViews = !result.error && result.views !== -1
          if (hasViews) {
            totalViews += result.views
            ok++
          }

          const progressMsg = JSON.stringify({
            type: 'progress',
            current: processed,
            total: linkList.length,
            videoId: result.videoId,
            link,
            title: result.title,
            communityName: result.community?.name ?? null,
            views: hasViews ? result.views : -1,
            status: hasViews ? 'ok' : 'error',
            error: result.error || (hasViews ? undefined : 'Не удалось определить количество просмотров')
          })
          controller.enqueue(new TextEncoder().encode(progressMsg + '\n'))

          if (!hasViews) errors++
        } catch (err) {
          const errorMsg = JSON.stringify({
            type: 'progress',
            current: processed,
            total: linkList.length,
            link,
            status: 'error',
            error: (err as Error).message
          })
          controller.enqueue(new TextEncoder().encode(errorMsg + '\n'))
          errors++
        }

        // Задержка между запросами (антифрод)
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500))
      }

      const doneMsg = JSON.stringify({
        type: 'done',
        ok,
        errors,
        total: linkList.length,
        totalViews
      })
      controller.enqueue(new TextEncoder().encode(doneMsg + '\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache'
    }
  })
})
