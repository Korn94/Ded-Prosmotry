// server/utils/okRuParser.ts
import { load } from 'cheerio'

const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
}

const REQUEST_TIMEOUT_MS = 10000
const MAX_RETRIES = 2

export interface ParsedVideoData {
  videoId: string
  title: string | null
  views: number // -1 = ошибка
  community: ParsedCommunityData | null
  error?: string
}

export interface ParsedCommunityData {
  okGroupId: string
  name: string
  url: string
  subscribers: number | null
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Декодирует HTML entities в строке (&quot; → ", &amp; → & и т.д.)
 */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
}

/**
 * Извлекает JSON из data-props веб-компонента autoplay-layer-movie-author
 */
function parseMovieAuthorProps(html: string): {
  name?: string
  subscribersCount?: number
  id?: string
  type?: string
} | null {
  const match = html.match(/<autoplay-layer-movie-author[^>]*data-props="([^"]+)"[^>]*>/i)
  if (!match || !match[1]) return null

  try {
    const decoded = decodeHtmlEntities(match[1])
    const parsed = JSON.parse(decoded)
    return {
      name: parsed.name,
      subscribersCount: typeof parsed.subscribersCount === 'number' ? parsed.subscribersCount : undefined,
      id: parsed.id,
      type: parsed.type
    }
  } catch (err) {
    console.warn('[Парсер] Ошибка парсинга data-props:', (err as Error).message)
    return null
  }
}

/**
 * Извлекает количество просмотров из meta-тега или текста
 */
function parseViews($: ReturnType<typeof load>): number {
  // Способ 1: meta тег
  const metaInteractionCount = $('meta[itemprop="interactionCount"]').attr('content')
  if (metaInteractionCount) {
    const match = metaInteractionCount.match(/UserViews:(\d+)/i)
    if (match && match[1]) {
      return parseInt(match[1], 10)
    }
  }

  // Способ 2: текст на странице
  let views = -1
  $('.vp-layer-info_cnt .vp-layer-info_i').each((_, elem) => {
    const text = $(elem).text().trim()
    if (text.includes('просмотров') || text.includes('просмотра') || text.includes('просмотр')) {
      const match = text.replace(/\s+/g, ' ').trim().match(/([\d,.]+)\s*(K|M|)/i)
      if (match && match[1]) {
        let num = parseFloat(match[1].replace(/,/g, '.'))
        const suffix = match[2] ? match[2].toUpperCase() : undefined
        if (suffix === 'K') num *= 1000
        if (suffix === 'M') num *= 1000000
        views = Math.round(num)
        return false
      }
    }
  })

  return views
}

/**
 * Извлекает информацию о сообществе из HTML страницы видео
 */
function parseCommunity($: ReturnType<typeof load>, html: string): ParsedCommunityData | null {
  // Пытаемся извлечь данные из data-props веб-компонента
  const movieAuthorData = parseMovieAuthorProps(html)

  // === СПОСОБ 0 (Приоритетный): Прямое использование data-props для GROUP ===
  if (movieAuthorData?.type === 'GROUP' && movieAuthorData.id) {
    const okGroupId = movieAuthorData.id
    const name = movieAuthorData.name || `Сообщество ${okGroupId}`
    const subscribers = movieAuthorData.subscribersCount ?? null

    console.log(`[Парсер] Сообщество из data-props: "${name}" (ID: ${okGroupId}, подписчиков: ${subscribers ?? 'нет'})`)

    // Дополнительная проверка: ищем ссылку на группу для подтверждения
    const hasGroupLink = html.includes(`/group/${okGroupId}`) || html.includes(`groupId=${okGroupId}`)

    if (hasGroupLink || name !== `Сообщество ${okGroupId}`) {
      return {
        okGroupId,
        name,
        url: `https://ok.ru/group/${okGroupId}`,
        subscribers
      }
    }
  }

  // === СПОСОБ 1: Ищем ссылку на страницу видео сообщества ===
  const groupVideoLinkMatch = html.match(/href="[^"]*\/group\/(\d+)\/video[^"]*"/i)

  if (groupVideoLinkMatch && groupVideoLinkMatch[1]) {
    const okGroupId = groupVideoLinkMatch[1]

    console.log(`[Парсер] Найдена ссылка на сообщество: /group/${okGroupId}/video`)

    // Дополнительная проверка: ищем groupId в URL-параметрах для подтверждения
    const groupIdParamMatch = html.match(new RegExp(`groupId=${okGroupId}`, 'g'))
    if (groupIdParamMatch && groupIdParamMatch.length >= 2) {
      console.log(`[Парсер] Подтверждено: groupId=${okGroupId} встречается ${groupIdParamMatch.length} раз(а)`)
    }

    // Ищем название сообщества
    let name: string | null = null

    // Используем название из data-props если есть и ID совпадает
    if (movieAuthorData?.name && movieAuthorData.id === okGroupId) {
      name = movieAuthorData.name
    }

    // Вариант A: Ищем в <title> страницы
    if (!name) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i)
      if (titleMatch && titleMatch[1]) {
        const parts = titleMatch[1].trim().split('|').map(p => p.trim())
        if (parts.length > 1) {
          name = parts[parts.length - 1]!
        }
      }
    }

    // Вариант B: Ищем в мета-теге og:title
    if (!name) {
      const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i)
      if (ogTitleMatch && ogTitleMatch[1]) {
        const parts = ogTitleMatch[1].split('|').map(p => p.trim())
        if (parts.length > 1) {
          name = parts[parts.length - 1]!
        }
      }
    }

    // Вариант C: Ищем текст рядом с ссылкой на сообщество в DOM
    if (!name) {
      const $groupLinks = $(`a[href*="/group/${okGroupId}"]`)
      $groupLinks.each((_, elem) => {
        const text = $(elem).text().trim()
        if (
          text &&
          !text.includes('Все видео') &&
          !text.toLowerCase().includes('video') &&
          text.length > 2 &&
          text.length < 100
        ) {
          name = text
          return false // break
        }
      })
    }

    // Fallback: если название не найдено, используем ID
    if (!name) {
      name = `Сообщество ${okGroupId}`
      console.warn(`[Парсер] Не удалось найти название сообщества ${okGroupId}, используется ID`)
    }

    // Извлекаем подписчиков
    let subscribers: number | null = null

    // Приоритет 1: из data-props
    if (movieAuthorData?.subscribersCount && movieAuthorData.id === okGroupId) {
      subscribers = movieAuthorData.subscribersCount
    }

    // Приоритет 2: из элемента .autoplay_layer_movie_author_movie-author_subscribers
    if (subscribers === null) {
      const subsElement = $('.autoplay_layer_movie_author_movie-author_subscribers')
      if (subsElement.length) {
        const text = subsElement.text().trim()
        const match = text.match(/([\d.,]+)\s*(тыс\.?|k|млн\.?|m)?/i)
        if (match && match[1]) {
          let num = parseFloat(match[1].replace(/,/g, '.'))
          const suffix = match[2]?.toLowerCase()
          if (suffix?.includes('тыс') || suffix === 'k') num *= 1000
          if (suffix?.includes('млн') || suffix === 'm') num *= 1000000
          if (!isNaN(num) && num > 0) {
            subscribers = Math.round(num)
          }
        }
      }
    }

    return {
      okGroupId,
      name,
      url: `https://ok.ru/group/${okGroupId}`,
      subscribers
    }
  }

  // === СПОСОБ 2 (Fallback): Ищем groupId в JSON-данных внутри скриптов ===
  const groupIdJsonMatch = html.match(/"groupId"\s*:\s*(\d+)/)
  if (groupIdJsonMatch && groupIdJsonMatch[1]) {
    const okGroupId = groupIdJsonMatch[1]
    console.log(`[Парсер] Найден groupId в JSON (fallback): ${okGroupId}`)

    let name: string | null = null

    // Ищем название через compilationTitle
    const compilationMatch = html.match(/"compilationTitle"\s*:\s*"([^"]+)"/)
    if (compilationMatch && compilationMatch[1]) {
      name = compilationMatch[1]
    }

    // Если compilationTitle нет, пробуем найти name в JSON
    if (!name) {
      const nameMatches = html.match(/"name"\s*:\s*"([^"]+)"/g)
      if (nameMatches) {
        for (const match of nameMatches) {
          const extracted = match.match(/"name"\s*:\s*"([^"]+)"/)
          if (extracted && extracted[1] && !extracted[1].toLowerCase().includes('video')) {
            name = extracted[1]
            break
          }
        }
      }
    }

    // Пытаемся извлечь URL сообщества из href с groupId
    const urlMatch = html.match(new RegExp(`href="(/[^"]+).*groupId=${okGroupId}`))
    const communityUrl = urlMatch && urlMatch[1]
      ? `https://ok.ru${urlMatch[1].split('?')[0]}`
      : `https://ok.ru/group/${okGroupId}`

    // Используем подписчиков из data-props если ID совпадает
    const subscribers = (movieAuthorData?.id === okGroupId && movieAuthorData.subscribersCount)
      ? movieAuthorData.subscribersCount
      : null

    if (name) {
      return { okGroupId, name, url: communityUrl, subscribers }
    }

    console.warn(`[Парсер] Найден groupId=${okGroupId} в JSON, но название не определено`)
    return {
      okGroupId,
      name: `Сообщество ${okGroupId}`,
      url: communityUrl,
      subscribers
    }
  }

  return null
}

/**
 * Парсит страницу видео и извлекает все данные
 */
export async function parseVideoPage(videoUrl: string, videoId: string): Promise<ParsedVideoData> {
  let lastError: string | undefined

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Парсер] Запрос к видео ${videoId} (попытка ${attempt}/${MAX_RETRIES})`)

      const html = await $fetch<string>(videoUrl, {
        headers: BROWSER_HEADERS,
        responseType: 'text',
        timeout: REQUEST_TIMEOUT_MS
      })

      const $ = load(html)
      const titleElement = $('h1.vp-layer-info_h.textWrap')
      const title = titleElement.text().trim() || null
      const views = parseViews($)
      const community = parseCommunity($, html)

      if (views === -1) {
        console.warn(`[Парсер] Видео ${videoId}: не удалось найти просмотры`)
      }

      if (community) {
        console.log(`[Парсер] Видео ${videoId}: определено сообщество "${community.name}" (${community.okGroupId})`)
      }

      return { videoId, title, views, community }
    } catch (err) {
      lastError = (err as Error).message
      console.error(`[Парсер] Видео ${videoId}: ошибка попытки ${attempt}:`, lastError)

      if (attempt < MAX_RETRIES) {
        await delay(2000)
      }
    }
  }

  return {
    videoId,
    title: null,
    views: -1,
    community: null,
    error: lastError || 'Неизвестная ошибка'
  }
}

/**
 * Парсит страницу сообщества для получения количества подписчиков
 */
export async function parseCommunityPage(communityUrl: string): Promise<ParsedCommunityData | null> {
  try {
    console.log(`[Парсер] Запрос к сообществу: ${communityUrl}`)

    const html = await $fetch<string>(communityUrl, {
      headers: BROWSER_HEADERS,
      responseType: 'text',
      timeout: REQUEST_TIMEOUT_MS
    })

    const $ = load(html)

    // 1. Извлекаем okGroupId из URL или HTML
    const urlMatch = communityUrl.match(/\/group\/(\d+)/)
    const htmlMatch = html.match(/groupId=(\d+)/) || html.match(/"groupId"\s*:\s*"?(\d+)"?/)
    const okGroupId = urlMatch?.[1] || htmlMatch?.[1]

    if (!okGroupId) {
      console.warn(`[Парсер] Не удалось извлечь ID сообщества из ${communityUrl}`)
      return null
    }

    // 2. Извлекаем название (несколько стратегий)
    let name: string | null = null

    // Стратегия A: og:title
    const ogTitle = $('meta[property="og:title"]').attr('content')
    if (ogTitle) {
      const firstPart = ogTitle.split('|')[0]?.trim()
      if (firstPart) name = firstPart
    }

    // Стратегия B: h1 заголовок
    if (!name) {
      const h1 = $('h1').first().text().trim()
      if (h1 && h1.length > 1 && h1.length < 200) name = h1
    }

    // Стратегия C: специфичные классы OK.ru
    if (!name) {
      const cardName = $('.ucard__name, .group-card__name, .grp_name').first().text().trim()
      if (cardName) name = cardName
    }

    if (!name) {
      name = `Сообщество ${okGroupId}`
    }

    // 3. Извлекаем подписчиков (несколько стратегий)
    let subscribers: number | null = null

    // Стратегия A: поиск по тексту body
    const allText = $('body').text()
    const subsMatch = allText.match(/([\d\s.,]+)\s*(тыс\.?|k|млн\.?|m)?\s*(подписчик|участник|subscriber|member)/i)
    if (subsMatch && subsMatch[1]) {
      let num = parseFloat(subsMatch[1].replace(/\s/g, '').replace(',', '.'))
      const suffix = subsMatch[2]?.toLowerCase()
      if (suffix?.includes('тыс') || suffix === 'k') num *= 1000
      if (suffix?.includes('млн') || suffix === 'm') num *= 1000000
      if (!isNaN(num) && num > 0) subscribers = Math.round(num)
    }

    // Стратегия B: поиск по CSS-селекторам
    if (!subscribers) {
      const selectors = [
        '.group-card__followers .group-card__count',
        '.ucard__stats-item',
        '.grp_subs_count',
        '[class*="subscribers"] [class*="count"]',
        '[class*="followers"] [class*="count"]'
      ]

      for (const selector of selectors) {
        const elem = $(selector).first()
        if (elem.length) {
          const text = elem.text().trim()
          const match = text.match(/([\d\s.,]+)\s*(тыс\.?|k|млн\.?|m)?/i)
          if (match && match[1]) {
            let num = parseFloat(match[1].replace(/\s/g, '').replace(',', '.'))
            const suffix = match[2]?.toLowerCase()
            if (suffix?.includes('тыс') || suffix === 'k') num *= 1000
            if (suffix?.includes('млн') || suffix === 'm') num *= 1000000
            if (!isNaN(num) && num > 0) {
              subscribers = Math.round(num)
              break
            }
          }
        }
      }
    }

    console.log(`[Парсер] Сообщество "${name}": ${subscribers ?? 'неизвестно'} подписчиков`)

    return { okGroupId, name, url: communityUrl, subscribers }
  } catch (err) {
    console.error(`[Парсер] Ошибка парсинга сообщества ${communityUrl}:`, (err as Error).message)
    return null
  }
}
