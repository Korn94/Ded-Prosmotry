// scripts/restore-from-backup.ts
// ============================================================================
// Восстановление data/analytics.db из:
//   1) G:/Work/Ded/data/videos.json        — старый формат (29 видео, история до 2026-09-07)
//   2) backup-db-ded/Новая папка/Untitled-*.txt — ответы API на 2026-10-05
//      (сообщества, обходы, замеры, тайтлы, currentViews + growth7/14)
//
// Запуск: node_modules/.bin/tsx scripts/restore-from-backup.ts
// ============================================================================
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { db } from '../server/database/db'
import * as schema from '../server/database/schema'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Источники
// ---------------------------------------------------------------------------
const OLD_JSON = 'G:/Work/Ded/data/videos.json'
const API_DIR = join(process.cwd(), 'backup-db-ded', 'Новая папка')

const COMMUNITY_ID = '7dd1c225-2075-45e2-9c90-baf8ec88bd3f' // «Местная доска объявлений…»
const COMMUNITY_VIDEO_ID = '16906427175174' // видео, принадлежащее сообществу

// Известные ID обходов из Untitled-5 (communities/{id}.get → passesHistory)
const PASS = {
  upd0913a: '8f078844-dc7c-4221-a529-e3a6036f052e', // «Обновление 1 видео», 2026-09-13
  upd0913b: 'c6241c78-7d23-4c75-9baa-7c6271a6f67c', // «Обновление 1 видео», 2026-09-13
  go0914: 'be287efb-3a5d-4750-aeb9-e317dc7b76a2', // «Обход 14 сент. 2026, 18:30»
  upd0914: 'a4b4eaff-43ef-43a4-a231-645492b3b6d4', // «Обновление 1 видео», 2026-09-14
  upd0921: '95adac82-aca6-49ea-8990-06037427fa42', // «Обновление 1 видео», 2026-09-21
  go0921: 'd45c44fd-d6d4-4965-9d71-1ee162386d2b', // «Обход 21 сент. 2026, 20:01»
  go0928: 'f49f73de-7563-4771-9095-bf229542a292', // «Обход 28 сент. 2026, 18:35»
  go1005: '946fbae7-b910-4df8-957f-5f7393319da2', // «Обход 05 окт. 2026, 17:39»
}
// ID двух обходов 12 сент неизвестны (их нет в ответах API) — генерируем новые
const PASS_GO0912 = randomUUID() // «Обход 12 сент. 2026, 21:44» @2026-09-12T18:44:48.728Z
const PASS_GO0912B = randomUUID() // «Обход 13 сент. 2026, 00:27» @2026-09-12T21:27:57.068Z

// ---------------------------------------------------------------------------
// Типы (по схеме API)
// ---------------------------------------------------------------------------
interface ApiVideoRow {
  id: string
  url: string
  title: string | null
  addedAt: string
  currentViews: number
  growth7: number
  growth14: number
  growth30: number
}
interface ApiMyVideos {
  videos: ApiVideoRow[]
  weeklyData: { startDate: string; totalViews: number; growth: number }[]
  totalViews: number
}
interface ApiCommunityRow {
  id: string
  okGroupId: string
  name: string
  url: string
  videoCount: number
  subscribers: number
  totalViews: number
}
interface ApiPassSummary {
  id: string
  label: string
  date: string
  videoCount: number
  totalViews: number
  subscribers: number
}
interface ApiCommunityDetail {
  id: string
  okGroupId: string
  name: string
  url: string
  createdAt: string
  subscribers: number
  passesHistory: ApiPassSummary[]
  videos: { id: string; url: string; title: string | null; addedAt: string; currentViews: number; previousViews: number }[]
}
interface ApiMeasurement {
  id: string
  views: number
  recordedAt: string
  passLabel: string
  passStartedAt: string
}
interface ApiVideoDetail {
  id: string
  url: string
  title: string | null
  addedAt: string
  currentViews: number
  history: { date: string; views: number }[]
  measurements: ApiMeasurement[]
}
interface OldVideo {
  videoId: string
  url: string
  groupName: string
  addedAt: string
  viewsHistory?: { date: string; views: number }[]
}

// ---------------------------------------------------------------------------
// Загрузка источников
// ---------------------------------------------------------------------------
function loadApi<T>(file: string): T {
  let s = readFileSync(join(API_DIR, file), 'utf8')
  const cut = s.indexOf('// GET')
  if (cut >= 0) s = s.slice(0, cut)
  return JSON.parse(s) as T
}

async function main() {
  console.log('🔧 [Restore] Восстановление data/analytics.db из резервных источников...')

  // 0. Защита от повторного запуска
  const existing = db.select({ id: schema.videos.id }).from(schema.videos).all()
  if (existing.length > 0) {
    console.warn(`⚠️ [Restore] База уже содержит ${existing.length} видео. Восстановление прервано.`)
    console.warn('   Для повторного запуска удалите файл data/analytics.db')
    return
  }
  if (!existsSync(OLD_JSON)) {
    console.error(`❌ [Restore] Не найден ${OLD_JSON}`)
    process.exit(1)
  }

  const oldVideos: OldVideo[] = JSON.parse(readFileSync(OLD_JSON, 'utf8'))
  const myVideos = loadApi<ApiMyVideos>('Untitled-2.txt')
  const communities = loadApi<ApiCommunityRow[]>('Untitled-3.txt')
  const communityDetail = loadApi<ApiCommunityDetail>('Untitled-5.txt')
  const videoDetail = loadApi<ApiVideoDetail>('Untitled-6.txt')

  console.log(`📖 Источники: videos.json=${oldVideos.length} видео, API videos=${myVideos.videos.length}, сообществ=${communities.length}`)

  // Карта «обход по startedAt» → passId (для сопоставления замеров Untitled-6)
  const passByStartedAt = new Map<string, string>([
    ['2026-09-12T18:44:48.728Z', PASS_GO0912],
    ['2026-09-12T21:27:57.068Z', PASS_GO0912B],
    ['2026-09-14T15:30:28.357Z', PASS.go0914],
    ['2026-09-21T17:01:20.077Z', PASS.go0921],
    ['2026-09-28T15:35:15.489Z', PASS.go0928],
    ['2026-10-05T14:39:15.208Z', PASS.go1005],
  ])
  // Дата (YYYY-MM-DD) → глобальный «Обход» этого дня (для привязки синтез. строк)
  const passIdByDate = new Map<string, string>([
    ['2026-09-21', PASS.go0921],
    ['2026-09-28', PASS.go0928],
    ['2026-10-05', PASS.go1005],
  ])

  let totalViewsInserted = 0
  let totalMeasurements = 0

  db.transaction(tx => {
    // -----------------------------------------------------------------------
    // 1. Сообщества (3 шт., Untitled-3 + createdAt из Untitled-5)
    // -----------------------------------------------------------------------
    for (const c of communities) {
      tx.insert(schema.communities).values({
        id: c.id,
        okGroupId: c.okGroupId,
        name: c.name,
        url: c.url,
        // Точное createdAt известно только для основного сообщества;
        // для двух остальных — плейсхолдер на ту же дату (документированное допущение)
        createdAt: c.id === communityDetail.id ? communityDetail.createdAt : '2026-09-13T11:17:28.914Z',
      }).run()
    }
    console.log(`✅ Сообществ: ${communities.length}`)

    // -----------------------------------------------------------------------
    // 2. Видео: 29 «моих» (Untitled-2) + 1 видео сообщества (Untitled-5)
    // -----------------------------------------------------------------------
    for (const v of myVideos.videos) {
      tx.insert(schema.videos).values({
        id: v.id,
        url: v.url,
        title: v.title,
        communityId: null,
        contentId: null,
        addedAt: v.addedAt,
      }).run()
    }
    const cv = communityDetail.videos[0]
    if (cv) {
      tx.insert(schema.videos).values({
        id: cv.id,
        url: cv.url,
        title: cv.title,
        communityId: communityDetail.id,
        contentId: null,
        addedAt: cv.addedAt,
      }).run()
    }
    console.log(`✅ Видео: ${myVideos.videos.length + (cv ? 1 : 0)}`)


    // -----------------------------------------------------------------------
    // 3. Обходы (8 реальных из Untitled-5 + 2 восстановленных из Untitled-6)
    // -----------------------------------------------------------------------
    // Точное startedAt известно для «Обходов» (из measurements Untitled-6);
    // для «Обновление 1 видео» — только дата (плейсхолдер 12:00 UTC).
    const passDefs: {
      id: string, label: string, type: 'community' | 'global',
      communityIds: string[], startedAt: string, videoCount: number
    }[] = [
      { id: PASS.upd0913a, label: 'Обновление 1 видео', type: 'community', communityIds: [COMMUNITY_ID], startedAt: '2026-09-13T12:00:00.000Z', videoCount: 1 },
      { id: PASS.upd0913b, label: 'Обновление 1 видео', type: 'community', communityIds: [COMMUNITY_ID], startedAt: '2026-09-13T12:00:00.000Z', videoCount: 1 },
      { id: PASS.go0914, label: 'Обход 14 сент. 2026, 18:30', type: 'global', communityIds: [], startedAt: '2026-09-14T15:30:28.357Z', videoCount: 28 },
      { id: PASS.upd0914, label: 'Обновление 1 видео', type: 'community', communityIds: [COMMUNITY_ID], startedAt: '2026-09-14T12:00:00.000Z', videoCount: 1 },
      { id: PASS.upd0921, label: 'Обновление 1 видео', type: 'community', communityIds: [COMMUNITY_ID], startedAt: '2026-09-21T12:00:00.000Z', videoCount: 1 },
      { id: PASS.go0921, label: 'Обход 21 сент. 2026, 20:01', type: 'global', communityIds: [], startedAt: '2026-09-21T17:01:20.077Z', videoCount: 28 },
      { id: PASS.go0928, label: 'Обход 28 сент. 2026, 18:35', type: 'global', communityIds: [], startedAt: '2026-09-28T15:35:15.489Z', videoCount: 28 },
      { id: PASS.go1005, label: 'Обход 05 окт. 2026, 17:39', type: 'global', communityIds: [], startedAt: '2026-10-05T14:39:15.208Z', videoCount: 28 },
      // Восстановленные из measurements Untitled-6 (ID неизвестны → новые UUID)
      { id: PASS_GO0912, label: 'Обход 12 сент. 2026, 21:44', type: 'global', communityIds: [], startedAt: '2026-09-12T18:44:48.728Z', videoCount: 0 },
      { id: PASS_GO0912B, label: 'Обход 13 сент. 2026, 00:27', type: 'global', communityIds: [], startedAt: '2026-09-12T21:27:57.068Z', videoCount: 0 },
    ]
    for (const p of passDefs) {
      tx.insert(schema.passes).values({
        id: p.id,
        label: p.label,
        type: p.type,
        communityIds: JSON.stringify(p.communityIds),
        startedAt: p.startedAt,
        finishedAt: null, // точное время окончания неизвестно
        status: 'completed',
        videoCount: p.videoCount,
        errorCount: 0,
      }).run()
    }
    console.log(`✅ Обходов: ${passDefs.length} (8 реальных ID + 2 восстановленных)`)

    // -----------------------------------------------------------------------
    // 4. views_history
    // -----------------------------------------------------------------------
    const historyRows: (typeof schema.viewsHistory.$inferInsert)[] = []

    // 4a. Видео 10746028296906 — берём ПОЛНУЮ историю из Untitled-6 (49 строк до 05.10)
    // Даты замеров → passId (12 сент два замера → разные обходы по порядку)
    const measDateToPass = new Map<string, string>()
    for (const m of videoDetail.measurements) {
      const passId = passByStartedAt.get(m.passStartedAt)
      if (passId) measDateToPass.set(m.recordedAt.split('T')[0], passId)
    }
    const rows0912 = videoDetail.measurements
      .filter(m => m.recordedAt.startsWith('2026-09-12'))
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt)) // по возрастанию: ранний замер → ранний обход
    const passFor0912 = rows0912.map(m => passByStartedAt.get(m.passStartedAt) ?? null)
    let idx0912 = 0
    for (const h of videoDetail.history) {
      let passId: string | null
      if (h.date === '2026-09-12') {
        passId = passFor0912[idx0912++] ?? null
      } else {
        passId = measDateToPass.get(h.date) ?? null
      }
      historyRows.push({
        id: randomUUID(),
        videoId: videoDetail.id,
        passId,
        date: h.date,
        views: h.views,
      })
    }


    // 4b. Остальные 28 «моих» видео — история из videos.json (до 2026-09-07)
    const apiById = new Map(myVideos.videos.map(v => [v.id, v]))
    const skippedGrowth: string[] = []
    for (const old of oldVideos) {
      if (old.videoId === videoDetail.id) continue // уже вставлена полная история из API
      for (const h of old.viewsHistory ?? []) {
        historyRows.push({
          id: randomUUID(),
          videoId: old.videoId,
          passId: null,
          date: h.date,
          views: h.views,
        })
      }
      // 4c. Достраиваем 21.09 / 28.09 / 05.10 из currentViews − growthN (API Untitled-2)
      const api = apiById.get(old.videoId)
      if (api) {
        // Если growth >= currentViews — окно роста не даёт новых данных,
        // синтетические строки исказили бы weekly-график → пропускаем
        if (api.growth7 < api.currentViews && api.growth14 < api.currentViews) {
          const synth: [string, number][] = [
            ['2026-09-21', api.currentViews - api.growth14],
            ['2026-09-28', api.currentViews - api.growth7],
            ['2026-10-05', api.currentViews],
          ]
          for (const [date, views] of synth) {
            historyRows.push({
              id: randomUUID(),
              videoId: old.videoId,
              passId: passIdByDate.get(date) ?? null,
              date,
              views,
            })
          }
        } else {
          skippedGrowth.push(old.videoId)
        }
      }
    }

    // 4d. Видео сообщества — история из totalViews по обходам (Untitled-5, 1 видео)
    for (const p of communityDetail.passesHistory) {
      historyRows.push({
        id: randomUUID(),
        videoId: COMMUNITY_VIDEO_ID,
        passId: p.id,
        date: p.date,
        views: p.totalViews,
      })
    }

    for (let i = 0; i < historyRows.length; i += 500) {
      tx.insert(schema.viewsHistory).values(historyRows.slice(i, i + 500)).run()
    }
    totalViewsInserted = historyRows.length
    console.log(`✅ views_history: ${totalViewsInserted} строк` +
      (skippedGrowth.length ? ` (без синтетики для ${skippedGrowth.length} видео: ${skippedGrowth.join(', ')})` : ''))


    // -----------------------------------------------------------------------
    // 5. measurements
    // -----------------------------------------------------------------------
    const measurementRows: (typeof schema.measurements.$inferInsert)[] = []
    const passStartedById = new Map(passDefs.map(p => [p.id, p.startedAt]))

    // 5a. 6 реальных замеров (UUID из Untitled-6), видео 10746028296906
    for (const m of videoDetail.measurements) {
      measurementRows.push({
        id: m.id,
        passId: passByStartedAt.get(m.passStartedAt) ?? PASS_GO0912,
        videoId: videoDetail.id,
        views: m.views,
        subscribers: null,
        recordedAt: m.recordedAt,
      })
    }

    // 5b. 8 замеров видео сообщества (views = totalViews обхода, из Untitled-5)
    for (const p of communityDetail.passesHistory) {
      measurementRows.push({
        id: randomUUID(),
        passId: p.id,
        videoId: COMMUNITY_VIDEO_ID,
        views: p.totalViews,
        subscribers: p.subscribers,
        recordedAt: passStartedById.get(p.id) ?? `${p.date}T12:00:00.000Z`,
      })
    }

    // 5c. Синтетические замеры для «моих» видео на 21.09 / 28.09 / 05.10
    // (views = восстановленные значения; дают корректные currentViews/growth на странице видео)
    for (const old of oldVideos) {
      if (old.videoId === videoDetail.id) continue
      const api = apiById.get(old.videoId)
      if (!api) continue
      if (!(api.growth7 < api.currentViews && api.growth14 < api.currentViews)) continue
      const synth: [string, number][] = [
        ['2026-09-21', api.currentViews - api.growth14],
        ['2026-09-28', api.currentViews - api.growth7],
        ['2026-10-05', api.currentViews],
      ]
      for (const [date, views] of synth) {
        const passId = passIdByDate.get(date)
        if (!passId) continue
        measurementRows.push({
          id: randomUUID(),
          passId,
          videoId: old.videoId,
          views,
          subscribers: null,
          recordedAt: passStartedById.get(passId)!,
        })
      }
    }

    for (let i = 0; i < measurementRows.length; i += 500) {
      tx.insert(schema.measurements).values(measurementRows.slice(i, i + 500)).run()
    }
    totalMeasurements = measurementRows.length
    console.log(`✅ measurements: ${totalMeasurements} (6 реальных + ${totalMeasurements - 6} восстановленных)`)

    // -----------------------------------------------------------------------
    // 6. subscribers_history (по 8 обходам сообщества, 21804)
    // -----------------------------------------------------------------------
    let subsInserted = 0
    for (const p of communityDetail.passesHistory) {
      tx.insert(schema.subscribersHistory).values({
        id: randomUUID(),
        communityId: COMMUNITY_ID,
        passId: p.id,
        date: p.date,
        subscribers: p.subscribers,
      }).run()
      subsInserted++
    }
    console.log(`✅ subscribers_history: ${subsInserted}`)
  })


  // -------------------------------------------------------------------------
  // Валидация
  // -------------------------------------------------------------------------
  console.log('\n🔍 [Restore] Валидация...')

  const counts = {
    communities: db.select({ n: sql<number>`count(*)` }).from(schema.communities).get()!.n,
    videos: db.select({ n: sql<number>`count(*)` }).from(schema.videos).get()!.n,
    passes: db.select({ n: sql<number>`count(*)` }).from(schema.passes).get()!.n,
    views_history: db.select({ n: sql<number>`count(*)` }).from(schema.viewsHistory).get()!.n,
    measurements: db.select({ n: sql<number>`count(*)` }).from(schema.measurements).get()!.n,
    subscribers_history: db.select({ n: sql<number>`count(*)` }).from(schema.subscribersHistory).get()!.n,
  }
  console.log('   Таблицы:', JSON.stringify(counts))

  // Текущие просмотры «моих» видео = последняя не-ошибочная запись истории
  const allHist = db.select().from(schema.viewsHistory).all()
  const latestByVideo = new Map<string, { date: string; views: number }>()
  for (const h of allHist) {
    if (h.views === -1) continue
    const cur = latestByVideo.get(h.videoId)
    if (!cur || h.date > cur.date) latestByVideo.set(h.videoId, { date: h.date, views: h.views })
  }
  const myIds = new Set(myVideos.videos.map(v => v.id))
  let restoredTotal = 0
  for (const [vid, h] of latestByVideo) {
    if (myIds.has(vid)) restoredTotal += h.views
  }
  const totalOk = restoredTotal === myVideos.totalViews
  console.log(`   Сумма просмотров «моих» видео: ${restoredTotal} (ожидалось ${myVideos.totalViews}) ${totalOk ? '✅' : '❌'}`)

  // Видео сообщества: текущие просмотры из замеров = 13
  const cvMeas = db.select().from(schema.measurements)
    .where(sql`video_id = ${COMMUNITY_VIDEO_ID}`)
    .orderBy(sql`recorded_at desc`).all()
  const cvCurrent = cvMeas[0]?.views ?? 0
  console.log(`   Видео сообщества currentViews: ${cvCurrent} (ожидалось 13) ${cvCurrent === 13 ? '✅' : '❌'}`)

  // Целостность
  const fkCheck = db.all(sql`PRAGMA foreign_key_check`)
  console.log(`   foreign_key_check: ${fkCheck.length === 0 ? '✅ ok' : `❌ ${fkCheck.length} ошибок`}`)
  const integrity = db.all(sql`PRAGMA integrity_check`)
  console.log(`   integrity_check: ${JSON.stringify(integrity)}`)

  if (!totalOk || cvCurrent !== 13 || fkCheck.length > 0) {
    console.error('❌ [Restore] Валидация не пройдена полностью — см. отчёты выше.')
    process.exit(1)
  }
  console.log('\n🎉 [Restore] Восстановление завершено успешно!')
}

main().catch(err => {
  console.error('❌ [Restore] Критическая ошибка:', err)
  process.exit(1)
})

