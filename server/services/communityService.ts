// server/services/communityService.ts
import { db } from '../database/db'
import { communities, subscribersHistory } from '../database/schema'
import { eq, desc } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { parseCommunityPage } from '../utils/okRuParser'

/**
 * Проверяет, есть ли свежие данные о подписчиках (не старше 1 дня)
 */
function hasRecentSubscribers(communityId: string): boolean {
  const latest = db.select({ date: subscribersHistory.date })
    .from(subscribersHistory)
    .where(eq(subscribersHistory.communityId, communityId))
    .orderBy(desc(subscribersHistory.date))
    .limit(1)
    .get()

  if (!latest) return false

  const lastDate = new Date(latest.date)
  const now = new Date()
  const diffDays = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)

  return diffDays < 1 // данные свежие, если меньше 1 дня
}

/**
 * Запрашивает страницу сообщества и сохраняет подписчиков в историю
 */
async function refreshSubscribers(communityId: string, url: string): Promise<void> {
  try {
    const parsed = await parseCommunityPage(url)

    if (parsed?.subscribers !== null && parsed?.subscribers !== undefined) {
      const today = new Date().toISOString().split('T')[0]!

      // Проверяем, нет ли уже записи за сегодня
      const existingToday = db.select()
        .from(subscribersHistory)
        .where(eq(subscribersHistory.communityId, communityId))
        .all()
        .find(s => s.date === today)

      if (!existingToday) {
        db.insert(subscribersHistory).values({
          id: randomUUID(),
          communityId,
          passId: null,
          date: today,
          subscribers: parsed.subscribers
        }).run()

        console.log(`[Сообщества] Сохранено ${parsed.subscribers} подписчиков`)
      }
    }
  } catch (err) {
    console.warn(`[Сообщества] Не удалось получить подписчиков:`, (err as Error).message)
  }
}

/**
 * Находит или создаёт сообщество.
 * При создании автоматически парсит страницу для получения подписчиков.
 */
export async function findOrCreateCommunity(
  okGroupId: string,
  name: string,
  url: string
): Promise<string> {
  // Ищем существующее сообщество
  const existing = db
    .select()
    .from(communities)
    .where(eq(communities.okGroupId, okGroupId))
    .get()

  if (existing) {
    console.log(`[Сообщества] Найдено существующее: "${existing.name}" (${okGroupId})`)

    // Обновляем название, если текущее является заглушкой
    const isPlaceholderName = existing.name === `Сообщество ${okGroupId}` ||
                              existing.name.startsWith('Сообщество ')

    if (isPlaceholderName && name && name !== existing.name) {
      db.update(communities)
        .set({ name, url })
        .where(eq(communities.id, existing.id))
        .run()

      console.log(`[Сообщества] Обновлено название: "${existing.name}" → "${name}"`)
    }

    // Если нет свежих данных о подписчиках — запрашиваем страницу
    if (!hasRecentSubscribers(existing.id)) {
      console.log(`[Сообщества] Обновление подписчиков для "${name}"...`)
      await refreshSubscribers(existing.id, existing.url)
    }

    return existing.id
  }

  // Создаём новое сообщество
  const id = randomUUID()
  db.insert(communities).values({
    id,
    okGroupId,
    name,
    url,
    createdAt: new Date().toISOString()
  }).run()

  console.log(`[Сообщества] Создано новое: "${name}" (${okGroupId})`)

  // Сразу парсим страницу для получения подписчиков нового сообщества
  console.log(`[Сообщества] Запрос подписчиков для нового сообщества "${name}"...`)
  await refreshSubscribers(id, url)

  return id
}

export async function addCommunityByUrl(url: string): Promise<{ id: string; name: string; subscribers: number | null }> {
  const parsed = await parseCommunityPage(url)

  if (!parsed) {
    throw new Error(`Не удалось распарсить сообщество по ссылке: ${url}`)
  }

  const id = await findOrCreateCommunity(parsed.okGroupId, parsed.name, parsed.url)

  return {
    id,
    name: parsed.name,
    subscribers: parsed.subscribers
  }
}
