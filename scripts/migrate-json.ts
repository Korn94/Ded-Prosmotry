// scripts/migrate-json.ts
import { readFileSync, existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { db } from '../server/database/db'
import * as schema from '../server/database/schema'
import { randomUUID } from 'node:crypto'

const DATA_DIR = join(process.cwd(), 'data')
const OLD_FILE = join(DATA_DIR, 'videos.json')
const BACKUP_FILE = join(DATA_DIR, 'videos.json.backup')

// Типы старого формата (из вашего предыдущего кода)
interface OldViewHistoryEntry {
  date: string
  views: number
}

interface OldTrackedVideo {
  videoId: string
  url: string
  groupName: string
  addedAt: string
  viewsHistory?: OldViewHistoryEntry[]
}

async function migrate() {
  console.log('🚀 [Миграция] Начало переноса данных из videos.json в SQLite...')

  // 1. Проверка наличия старого файла
  if (!existsSync(OLD_FILE)) {
    console.log('ℹ️ [Миграция] Файл videos.json не найден. Миграция не требуется.')
    return
  }

  // 2. Защита от повторного запуска (проверяем, есть ли уже видео в БД)
  const existingVideos = db.select({ id: schema.videos.id }).from(schema.videos).all()
  if (existingVideos.length > 0) {
    console.warn('⚠️ [Миграция] База данных уже содержит видео. Миграция прервана во избежание дублирования.')
    console.warn('   Если вы хотите запустить миграцию заново, удалите файл data/analytics.db')
    return
  }

  // 3. Чтение старого файла
  let oldVideos: OldTrackedVideo[] = []
  try {
    const content = readFileSync(OLD_FILE, 'utf-8')
    oldVideos = JSON.parse(content)
    console.log(`📖 [Миграция] Прочитано ${oldVideos.length} видео из старого формата.`)
  } catch (err) {
    console.error('❌ [Миграция] Ошибка чтения videos.json:', err)
    process.exit(1)
  }

  if (oldVideos.length === 0) {
    console.log('ℹ️ [Миграция] Файл пуст. Нечего мигрировать.')
    return
  }

  // 4. Анализ групп (информируем пользователя о потере метаданных)
  const uniqueGroups = new Set(oldVideos.map(v => v.groupName).filter(Boolean))
  if (uniqueGroups.size > 0) {
    console.warn(`⚠️ [Миграция] В старом файле использовались группы: ${Array.from(uniqueGroups).join(', ')}.`)
    console.warn('   Согласно ТЗ, все видео будут привязаны к "Без сообщества" (communityId = null).')
  }

  // 5. Перенос данных в БД (в транзакции для скорости и атомарности)
  console.log('⏳ [Миграция] Запись данных в SQLite...')
  let totalHistoryRecords = 0
  
  db.transaction((tx) => {
    for (const oldVideo of oldVideos) {
      // Вставка самого видео
      tx.insert(schema.videos).values({
        id: oldVideo.videoId,
        url: oldVideo.url,
        title: null, // В старом формате название не хранилось
        communityId: null, // Все старые видео идут в "Без сообщества"
        contentId: null,
        addedAt: oldVideo.addedAt,
      }).run()

      // Вставка истории просмотров
      if (oldVideo.viewsHistory && oldVideo.viewsHistory.length > 0) {
        const historyValues = oldVideo.viewsHistory.map(entry => ({
          id: randomUUID(),
          videoId: oldVideo.videoId,
          passId: null, // Исторические замеры не привязаны к обходам
          date: entry.date,
          views: entry.views,
        }))
        
        tx.insert(schema.viewsHistory).values(historyValues).run()
        totalHistoryRecords += historyValues.length
      }
    }
  })

  console.log(`✅ [Миграция] Успешно перенесено: ${oldVideos.length} видео и ${totalHistoryRecords} записей истории.`)

  // 6. Создание бэкапа (согласно п. 5.4 ТЗ)
  try {
    renameSync(OLD_FILE, BACKUP_FILE)
    console.log(`💾 [Миграция] Старый файл переименован в: ${BACKUP_FILE}`)
  } catch (err) {
    console.warn('⚠️ [Миграция] Не удалось переименовать старый файл. Сделайте бэкап вручную.', err)
  }

  console.log('🎉 [Миграция] Завершена успешно!')
}

migrate().catch(err => {
  console.error('❌ [Миграция] Критическая ошибка:', err)
  process.exit(1)
})
