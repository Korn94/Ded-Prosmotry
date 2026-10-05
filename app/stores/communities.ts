// app/stores/communities.ts
import { defineStore } from 'pinia'
import type { ApiCommunityDto } from '~~/shared/types/api'

export const useCommunityStore = defineStore('communities', () => {
  const communities = ref<ApiCommunityDto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCommunities() {
    loading.value = true
    error.value = null
    try {
      communities.value = await $fetch<ApiCommunityDto[]>('/api/communities')
    } catch (err) {
      error.value = (err as Error).message
      console.error('[Store] Ошибка загрузки сообществ:', err)
    } finally {
      loading.value = false
    }
  }

  return { communities, loading, error, fetchCommunities }
})
