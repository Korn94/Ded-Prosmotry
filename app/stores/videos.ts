// app/stores/videos.ts
import { defineStore } from 'pinia'
import type { ApiVideoDto } from '~~/shared/types/api'

export const useVideoStore = defineStore('videos', () => {
  const videos = ref<ApiVideoDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchVideos() {
    loading.value = true
    error.value = null
    try {
      videos.value = await $fetch<ApiVideoDto[]>('/api/videos')
    } catch (err) {
      error.value = (err as Error).message
      console.error('[Store] Ошибка загрузки видео:', err)
    } finally {
      loading.value = false
    }
  }

  return { videos, loading, error, fetchVideos }
})
