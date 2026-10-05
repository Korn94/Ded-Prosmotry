<!-- app/pages/my-videos.vue -->
<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>🎬 Мои видео</h1>
        <p class="subtitle">Видео из личного профиля (просмотры суммируются со всех репостов)</p>
      </div>
      
      <button 
        @click="handleUpdateAll" 
        :disabled="isUpdating || loading" 
        class="btn btn-blue"
      >
        <Icon v-if="isUpdating" name="lucide:loader-2" class="spin" size="18" />
        <Icon v-else name="lucide:refresh-cw" size="18" />
        {{ isUpdating ? 'Обновление...' : 'Обновить все' }}
      </button>
    </header>

    <div v-if="loading && !isUpdating" class="loader">
      <Icon name="lucide:loader-2" class="spin" size="24" />
      <span>Загрузка аналитики...</span>
    </div>

    <template v-else>
      <!-- График активности по дням -->
      <DailyActivityChart />

      <!-- График тренда по неделям (общая сумма) -->
      <WeeklyTrendChart 
        :weekly-data="data?.weeklyData ?? []"
        :video-count="data?.videos.length ?? 0"
        :total-views="data?.totalViews ?? 0"
      />

      <!-- НОВЫЙ ГРАФИК: Прирост по неделям -->
      <WeeklyGrowthChart 
        :weekly-data="data?.weeklyData ?? []"
      />

      <!-- Фильтры -->
      <div class="filters-bar">
        <div class="search-box">
          <Icon name="lucide:search" size="16" />
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Поиск по названию..." 
          />
        </div>
        
        <div class="period-switcher">
          <span class="label">Период роста:</span>
          <button 
            v-for="p in [7, 14, 30]" 
            :key="p"
            @click="selectedPeriod = p"
            class="period-btn"
            :class="{ active: selectedPeriod === p }"
          >
            {{ p }} дн.
          </button>
        </div>

        <label class="checkbox-filter">
          <input type="checkbox" v-model="onlyWithGrowth" />
          <span>Только с ростом</span>
        </label>
      </div>

      <!-- Таблица видео -->
      <div class="data-card">
        <table class="crm-table">
          <thead>
            <tr>
              <th @click="sortBy('title')" class="sortable">
                Название
                <Icon v-if="sortField === 'title'" :name="sortDir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'" size="14" />
              </th>
              <th @click="sortBy('currentViews')" class="sortable num">
                Просмотры
                <Icon v-if="sortField === 'currentViews'" :name="sortDir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'" size="14" />
              </th>
              <th @click="sortBy('growth')" class="sortable num">
                Рост за {{ selectedPeriod }} дн.
                <Icon v-if="sortField === 'growth'" :name="sortDir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'" size="14" />
              </th>
              <th @click="sortBy('addedAt')" class="sortable">
                Дата добавления
                <Icon v-if="sortField === 'addedAt'" :name="sortDir === 'asc' ? 'lucide:arrow-up' : 'lucide:arrow-down'" size="14" />
              </th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="video in sortedVideos" :key="video.id">
              <td>
                <a :href="video.url" target="_blank" class="video-link">
                  {{ video.title || `Видео #${video.id}` }}
                </a>
              </td>
              <td class="num">{{ formatNumber(video.currentViews) }}</td>
              <td class="num" :class="getGrowthClass(currentGrowth(video))">
                {{ formatGrowth(currentGrowth(video)) }}
              </td>
              <td>{{ formatDate(video.addedAt) }}</td>
              <td>
                <NuxtLink :to="`/videos/${video.id}`" class="btn-icon" title="Подробнее">
                  <Icon name="lucide:arrow-right" size="16" />
                </NuxtLink>
              </td>
            </tr>
            <tr v-if="sortedVideos.length === 0">
              <td colspan="5" class="empty">
                {{ data?.videos.length === 0 ? 'Нет видео без привязки к сообществу' : 'Ничего не найдено по фильтру' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <ProgressOverlay
      v-if="isUpdating"
      label="Обновление всех видео"
      :current="progressCurrent"
      :total="progressTotal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { formatNumber, formatDate } from '~/composables/useFormat'
import { readStreamProgress } from '~/composables/useStreamProgress'
import DailyActivityChart from '~/components/charts/DailyActivityChart.vue'
import WeeklyTrendChart from '~/components/charts/WeeklyTrendChart.vue'
import WeeklyGrowthChart from '~/components/charts/WeeklyGrowthChart.vue'

interface VideoStat {
  id: string
  url: string
  title: string | null
  addedAt: string
  currentViews: number
  growth7: number
  growth14: number
  growth30: number
}

interface MyVideosResponse {
  videos: VideoStat[]
  weeklyData: Array<{ startDate: string; totalViews: number; growth: number }>
  totalViews: number
}

const data = ref<MyVideosResponse | null>(null)
const loading = ref(true)

const searchQuery = ref('')
const selectedPeriod = ref<7 | 14 | 30>(7)
const onlyWithGrowth = ref(false)

const sortField = ref<'title' | 'currentViews' | 'growth' | 'addedAt'>('currentViews')
const sortDir = ref<'asc' | 'desc'>('desc')

const isUpdating = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)

function currentGrowth(video: VideoStat): number {
  if (selectedPeriod.value === 7) return video.growth7
  if (selectedPeriod.value === 14) return video.growth14
  return video.growth30
}

function getGrowthClass(growth: number): string {
  if (growth > 0) return 'growth-positive'
  if (growth < 0) return 'growth-negative'
  return 'growth-neutral'
}

function formatGrowth(growth: number): string {
  const sign = growth >= 0 ? '+' : ''
  return `${sign}${formatNumber(growth)}`
}

const filteredVideos = computed(() => {
  let list = data.value?.videos ?? []
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(v => (v.title || v.id).toLowerCase().includes(q))
  }
  
  if (onlyWithGrowth.value) {
    list = list.filter(v => currentGrowth(v) > 0)
  }
  
  return list
})

const sortedVideos = computed(() => {
  const list = [...filteredVideos.value]
  
  list.sort((a, b) => {
    let valA: any, valB: any
    
    switch (sortField.value) {
      case 'title':
        valA = a.title || a.id
        valB = b.title || b.id
        break
      case 'currentViews':
        valA = a.currentViews
        valB = b.currentViews
        break
      case 'growth':
        valA = currentGrowth(a)
        valB = currentGrowth(b)
        break
      case 'addedAt':
        valA = a.addedAt
        valB = b.addedAt
        break
    }
    
    if (valA < valB) return sortDir.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  
  return list
})

function sortBy(field: typeof sortField.value) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = field === 'title' || field === 'addedAt' ? 'asc' : 'desc'
  }
}

async function loadData() {
  loading.value = true
  try {
    data.value = await $fetch<MyVideosResponse>('/api/analytics/my-videos')
  } catch (err) {
    console.error('[MyVideos] Ошибка загрузки:', err)
  } finally {
    loading.value = false
  }
}

async function handleUpdateAll() {
  if (isUpdating.value) return

  isUpdating.value = true
  progressCurrent.value = 0
  progressTotal.value = 0

  try {
    await readStreamProgress('/api/update-stats', (event) => {
      if (event.type === 'progress') {
        progressCurrent.value = event.current || 0
        progressTotal.value = event.total || 0
      } else if (event.type === 'done') {
        console.log('[MyVideos] Обход завершён, обновляем данные...')
        loadData()
      }
    }, { method: 'POST', body: { updateAll: true } })
  } catch (err) {
    console.error('[MyVideos] Ошибка обновления:', err)
  } finally {
    isUpdating.value = false
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.page-container { max-width: 1400px; margin: 0 auto; }

.page-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: flex-start; 
  margin-bottom: 2rem; 
  gap: 2rem;
  flex-wrap: wrap;
  
  h1 { margin: 0 0 0.5rem 0; font-size: 1.75rem; color: var(--text); }
  .subtitle { margin: 0; color: var(--text-secondary); }
}

.loader { 
  display: flex; 
  align-items: center; 
  gap: 0.75rem; 
  padding: 2rem; 
  background: var(--bg-lighter); 
  border-radius: var(--radius-lg); 
  color: var(--text-secondary);
  .spin { animation: spin 1s linear infinite; }
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.filters-bar {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  align-items: center;
  flex-wrap: wrap;

  .search-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-lighter);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 0.5rem 1rem;
    flex: 1;
    min-width: 200px;
    color: var(--text-secondary);

    input {
      background: transparent;
      border: none;
      color: var(--text);
      outline: none;
      width: 100%;
      font-size: 0.95rem;
    }
  }

  .period-switcher {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--bg-lighter);
    border-radius: var(--radius-md);
    padding: 0.25rem;
    border: 1px solid var(--border);

    .label {
      padding: 0 0.75rem;
      color: var(--text-secondary);
      font-size: 0.85rem;
    }

    .period-btn {
      background: transparent;
      border: none;
      color: var(--text-secondary);
      padding: 0.4rem 0.9rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:hover { color: var(--text); }
      &.active {
        background: var(--blue);
        color: white;
      }
    }
  }

  .checkbox-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.9rem;
    user-select: none;

    input {
      cursor: pointer;
      width: 16px;
      height: 16px;
    }
  }
}

.data-card { 
  background: var(--bg-lighter); 
  border-radius: var(--radius-lg); 
  overflow: hidden; 
  box-shadow: var(--shadow); 
}

.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
  
  &:hover { color: var(--text); }
  
  svg { 
    margin-left: 0.25rem; 
    vertical-align: middle;
    opacity: 0.7;
  }
}

.video-link { 
  color: var(--link); 
  font-weight: 500; 
  text-decoration: none; 
  &:hover { text-decoration: underline; }
}

.growth-positive { color: var(--green); font-weight: 600; }
.growth-negative { color: var(--red); font-weight: 600; }
.growth-neutral { color: var(--text-secondary); }

.btn-icon {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  padding: 0.4rem;
  cursor: pointer;
  display: inline-flex;
  text-decoration: none;
  transition: all 0.2s;
  
  &:hover {
    background: var(--bg-input);
    color: var(--text);
    border-color: var(--blue);
  }
}

.empty { text-align: center; color: var(--text-secondary); padding: 3rem !important; }

.btn { 
  @include btn-base;
  &-blue { 
    background: var(--blue); 
    color: white; 
    &:hover:not(:disabled) { background: #1976d2; }
    &:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
  }
}
</style>