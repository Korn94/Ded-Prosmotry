// server/services/videoService.ts
import { db } from '../database/db'
import { videos, viewsHistory, subscribersHistory } from '../database/schema'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { parseVideoPage } from '../utils/okRuParser'
import { findOrCreateCommunity } from './communityService'

export interface AddVideoResult {
  videoId: string
  url: string
  title: string | null
  views: number
  communityId: string | null
  communityName: string | null
  isNew: boolean
  error?: string
}

/**
 * Обновляет метаданные видео (title), если они пустые.
 * Может вызываться независимо от процесса добавления.
 */
export async function updateVideoMetadata(videoId: string, title: string | null): Promise<boolean> {
  if (!title) return false

  const video = db.select().from(videos).where(eq(videos.id, videoId)).get()

  if (!video) return false

  // Обновляем только если title пустой
  if (!video.title) {
    db.update(videos)
      .set({ title })
      .where(eq(videos.id, videoId))
      .run()

    console.log(`[Видео] Обновлено название для ${videoId}: "${title}"`)
    return true
  }

  return false
}

export async function addVideoByUrl(url: string, videoId: string): Promise<AddVideoResult> {
  console.log(`[Видео] Добавление: ${url}`)

  // Парсим страницу
  const parsed = await parseVideoPage(url, videoId)

  if (parsed.error) {
    return {
      videoId,
      url,
      title: null,
      views: -1,
      communityId: null,
      communityName: null,
      isNew: false,
      error: parsed.error
    }
  }

  // Определяем сообщество (если есть)
  let communityId: string | null = null
  let communityName: string | null = null

  if (parsed.community) {
    communityId = await findOrCreateCommunity(
      parsed.community.okGroupId,
      parsed.community.name,
      parsed.community.url
    )
    communityName = parsed.community.name

    // Сохраняем подписчиков, если они есть в данных парсера
    if (parsed.community.subscribers !== null && parsed.community.subscribers > 0) {
      const todaySubs = new Date().toISOString().split('T')[0]!

      // Проверяем, нет ли уже записи за сегодня
      const existingToday = db.select()
        .from(subscribersHistory)
        .where(eq(subscribersHistory.communityId, communityId))
        .all()
        .find(s => s.date === todaySubs)

      if (!existingToday) {
        db.insert(subscribersHistory).values({
          id: randomUUID(),
          communityId,
          passId: null,
          date: todaySubs,
          subscribers: parsed.community.subscribers
        }).run()

        console.log(`[Сообщества] Сохранено ${parsed.community.subscribers} подписчиков для "${communityName}"`)
      }
    }
  }

  // Проверяем, существует ли видео
  const existing = db
    .select()
    .from(videos)
    .where(eq(videos.id, videoId))
    .get()

  const today = new Date().toISOString().split('T')[0]!

  if (existing) {
    console.log(`[Видео] Уже существует: ${videoId}`)

    // Собираем поля для обновления
    const updates: Record<string, any> = {}

    // Обновляем title, если он пустой
    if (!existing.title && parsed.title) {
      updates.title = parsed.title
      console.log(`[Видео] Обновлено название: "${parsed.title}"`)
    }

    // Привязываем к сообществу, если оно определено и ранее не было привязано
    if (communityId && existing.communityId !== communityId) {
      updates.communityId = communityId
      console.log(`[Видео] Привязано к сообществу: ${communityName} (${communityId})`)
    }

    // Применяем обновления одним запросом, если есть что обновлять
    if (Object.keys(updates).length > 0) {
      db.update(videos)
        .set(updates)
        .where(eq(videos.id, videoId))
        .run()
    }

    // Обновляем историю просмотров
    if (parsed.views !== -1) {
      db.insert(viewsHistory).values({
        id: randomUUID(),
        videoId,
        passId: null,
        date: today,
        views: parsed.views
      }).run()
    }

    return {
      videoId,
      url,
      title: parsed.title || existing.title,
      views: parsed.views,
      communityId: communityId || existing.communityId,
      communityName,
      isNew: false
    }
  }

  // Создаем новое видео
  db.insert(videos).values({
    id: videoId,
    url,
    title: parsed.title,
    communityId,
    contentId: null,
    addedAt: today
  }).run()

  // Сохраняем первый замер
  if (parsed.views !== -1) {
    db.insert(viewsHistory).values({
      id: randomUUID(),
      videoId,
      passId: null,
      date: today,
      views: parsed.views
    }).run()
  }

  console.log(`[Видео] Добавлено новое: ${videoId} (сообщество: ${communityName ?? 'Без сообщества'})`)

  return {
    videoId,
    url,
    title: parsed.title,
    views: parsed.views,
    communityId,
    communityName,
    isNew: true
  }
}
