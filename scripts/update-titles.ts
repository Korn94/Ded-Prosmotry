// scripts/update-titles.ts
import { db } from '../server/database/db'
import { videos } from '../server/database/schema'
import { isNull, eq } from 'drizzle-orm'
import { parseVideoPage } from '../server/utils/okRuParser'

async function updateAllTitles() {
  console.log('🚀 [Update Titles] Начало обновления названий видео...')

  // Находим все видео без названия
  const videosWithoutTitle = db.select()
    .from(videos)
    .where(isNull(videos.title))
    .all()

  if (videosWithoutTitle.length === 0) {
    console.log('✅ [Update Titles] Все видео уже имеют названия')
    return
  }

  console.log(`📋 [Update Titles] Найдено видео без названия: ${videosWithoutTitle.length}`)

  let updated = 0
  let errors = 0

  for (const video of videosWithoutTitle) {
    console.log(`⏳ [Update Titles] Парсинг: ${video.id}...`)
    
    try {
      const parsed = await parseVideoPage(video.url, video.id)
      
      if (parsed.title) {
        db.update(videos)
          .set({ title: parsed.title })
          .where(eq(videos.id, video.id))
          .run()
        
        console.log(`✅ [Update Titles] ${video.id}: "${parsed.title}"`)
        updated++
      } else {
        console.warn(`⚠️ [Update Titles] ${video.id}: название не найдено`)
        errors++
      }
    } catch (err) {
      console.error(`❌ [Update Titles] ${video.id}: ошибка -`, (err as Error).message)
      errors++
    }

    // Задержка между запросами (антифрод)
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 500))
  }

  console.log(`\n🎉 [Update Titles] Завершено!`)
  console.log(`   Обновлено: ${updated}`)
  console.log(`   Ошибок: ${errors}`)
}

updateAllTitles().catch(err => {
  console.error('❌ [Update Titles] Критическая ошибка:', err)
  process.exit(1)
})
