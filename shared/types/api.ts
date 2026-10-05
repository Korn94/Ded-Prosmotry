// shared/types/api.ts
// DTO (Data Transfer Objects) для общения между сервером и клиентом

export interface ApiVideoDto {
  id: string
  url: string
  title: string | null
  addedAt: string
  communityId: string | null
  communityName: string | null // null = "Без сообщества" (Личный профиль)
}

export interface ApiCommunityDto {
  id: string
  okGroupId: string
  name: string
  url: string
  videoCount: number
  subscribers: number
  totalViews: number
  engagement: number      // Накопленная вовлечённость
  activity: number        // Текущая активность (прирост за последний обход)
  trend: string           // Тип тренда (sharp_up, up, stable, etc.)
  trendPercent: number    // Процент изменения
  trendIcon: string       // Эмодзи стрелочки
}

export interface ApiPassSummaryDto {
  id: string
  label: string
  date: string          // YYYY-MM-DD
  videoCount: number
  totalViews: number
  subscribers: number
  engagement: number
}

export interface ApiCommunityVideoDto {
  id: string
  url: string
  title: string | null
  addedAt: string
  currentViews: number
  previousViews: number
  growth: number        // дельта с прошлого обхода
}

export interface ApiCommunityDetailDto {
  id: string
  okGroupId: string
  name: string
  url: string
  createdAt: string
  subscribers: number
  subscribersChange: number // изменение за последний месяц
  totalViews: number
  videoCount: number
  engagement: number
  activity: number
  trendIcon: string
  passesHistory: ApiPassSummaryDto[]
  videos: ApiCommunityVideoDto[]
}
