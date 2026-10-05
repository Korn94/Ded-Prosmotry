// server/database/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

// ============================================================================
// 🏢 Сообщества (Communities)
// ============================================================================
export const communities = sqliteTable('communities', {
  id: text('id').primaryKey(), // UUID
  okGroupId: text('ok_group_id').notNull().unique(), // ID группы на OK.RU
  name: text('name').notNull(),
  url: text('url').notNull(),
  createdAt: text('created_at').notNull(), // ISO string
})

// ============================================================================
// 🎬 Видео (Videos)
// ============================================================================
export const videos = sqliteTable('videos', {
  id: text('id').primaryKey(), // OK.RU videoId (числовой, но храним как text)
  url: text('url').notNull(),
  title: text('title'), // Может быть null, если не спарсилось
  communityId: text('community_id').references(() => communities.id, { onDelete: 'set null' }),
  contentId: text('content_id'), // Для связи дубликатов (будущее)
  addedAt: text('added_at').notNull(), // YYYY-MM-DD
})

// ============================================================================
// 🔄 Обходы (Passes)
// ============================================================================
export const passes = sqliteTable('passes', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  type: text('type', { enum: ['community', 'multi', 'global'] }).notNull(),
  communityIds: text('community_ids'), // <-- ДОБАВИТЬ ЭТО ПОЛЕ (JSON строка)
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  status: text('status', { enum: ['in_progress', 'completed', 'cancelled'] }).notNull(),
  videoCount: integer('video_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
})

// ============================================================================
// 📊 Замеры (Measurements) - Связь Видео и Обхода
// ============================================================================
export const measurements = sqliteTable('measurements', {
  id: text('id').primaryKey(), // UUID
  passId: text('pass_id').notNull().references(() => passes.id, { onDelete: 'cascade' }),
  videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  views: integer('views').notNull(),
  subscribers: integer('subscribers'), // Снэпшот подписчиков на момент замера
  recordedAt: text('recorded_at').notNull(), // Точное время (ISO string)
})

// ============================================================================
// 📈 История просмотров (Денормализовано для быстрых графиков)
// ============================================================================
export const viewsHistory = sqliteTable('views_history', {
  id: text('id').primaryKey(), // UUID
  videoId: text('video_id').notNull().references(() => videos.id, { onDelete: 'cascade' }),
  passId: text('pass_id').references(() => passes.id, { onDelete: 'set null' }),
  date: text('date').notNull(), // YYYY-MM-DD
  views: integer('views').notNull(), // -1 = ошибка парсинга
})

// ============================================================================
// 👥 История подписчиков сообществ
// ============================================================================
export const subscribersHistory = sqliteTable('subscribers_history', {
  id: text('id').primaryKey(), // UUID
  communityId: text('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
  passId: text('pass_id').references(() => passes.id, { onDelete: 'set null' }),
  date: text('date').notNull(), // YYYY-MM-DD
  subscribers: integer('subscribers').notNull(),
})
