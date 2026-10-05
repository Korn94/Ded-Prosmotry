<!-- app/pages/videos/[id].vue -->
<template>
  <div class="page-container">
    <div v-if="loading" class="loader">
      <Icon name="lucide:loader-2" class="spin" size="24" />
      <span>Загрузка видео...</span>
    </div>

    <div v-else-if="error" class="error-block">
      <p>❌ {{ error }}</p>
      <button @click="loadData" class="btn btn-blue">Повторить</button>
    </div>

    <template v-else-if="data">
      <!-- Шапка -->
      <header class="video-header">
        <div class="header-main">
          <div>
            <NuxtLink :to="backLink" class="back-link">
              <Icon name="lucide:arrow-left" size="16" />
              {{ backLabel }}
            </NuxtLink>
            <h1>{{ data.title || `Видео #${data.id}` }}</h1>
            <a :href="data.url" target="_blank" class="external-link">
              <Icon name="lucide:external-link" size="14" />
              Открыть на OK.RU
            </a>
          </div>

          <button
            @click="handleUpdate"
            :disabled="isUpdating"
            class="btn btn-blue"
          >
            <Icon 
              :name="isUpdating ? 'lucide:loader-2' : 'lucide:refresh-cw'" 
              :class="{ spin: isUpdating }" 
              size="18" 
            />
            {{ isUpdating ? 'Обновление...' : 'Обновить просмотры' }}
          </button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Текущие просмотры</div>
            <div class="stat-value">{{ formatNumber(data.currentViews) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Рост с прошлого замера</div>
            <div 
              class="stat-value" 
              :class="data.growth > 0 ? 'positive' : data.growth < 0 ? 'negative' : ''"
            >
              {{ data.growth > 0 ? '+' : '' }}{{ formatNumber(data.growth) }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Сообщество</div>
            <div class="stat-value community">
              <NuxtLink 
                v-if="data.communityId" 
                :to="`/communities/${data.communityId}`"
              >
                {{ data.communityName }}
              </NuxtLink>
              <span v-else>Без сообщества</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Добавлено</div>
            <div class="stat-value">{{ formatDate(data.addedAt) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Всего замеров</div>
            <div class="stat-value">{{ data.measurements.length }}</div>
          </div>
        </div>
      </header>

      <!-- График просмотров -->
      <section class="section">
        <h2>📈 Динамика просмотров</h2>
        <div class="chart-card">
          <LineChart 
            :points="chartPoints" 
            color="#4caf50"
          />
        </div>
      </section>

      <!-- Таблица замеров -->
      <section class="section">
        <h2>📋 История замеров</h2>
        <div class="data-card">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Дата и время</th>
                <th class="num">Просмотры</th>
                <th class="num">Рост</th>
                <th>Обход</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="m in data.measurements" :key="m.id">
                <td>{{ formatDateTime(m.recordedAt) }}</td>
                <td class="num">{{ formatNumber(m.views) }}</td>
                <td class="num" :class="getGrowthClass(m.growth)">
                  {{ m.growth > 0 ? '+' : '' }}{{ formatNumber(m.growth) }}
                </td>
                <td class="pass-cell">
                  <NuxtLink 
                    v-if="m.passStartedAt" 
                    :to="`/passes`"
                    class="pass-link"
                  >
                    {{ m.passLabel }}
                  </NuxtLink>
                  <span v-else class="no-pass">—</span>
                </td>
              </tr>
              <tr v-if="data.measurements.length === 0">
                <td colspan="4" class="empty">Ещё не было ни одного замера</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <ProgressOverlay
      v-if="isUpdating"
      label="Обновление видео"
      :current="progressCurrent"
      :total="progressTotal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatNumber, formatDate, formatDateTime, getGrowthClass } from '~/composables/useFormat'
import { readStreamProgress } from '~/composables/useStreamProgress'
import LineChart from '~/components/charts/LineChart.vue'

interface Measurement {
  id: string
  views: number
  recordedAt: string
  growth: number
  passLabel: string
  passStartedAt: string | null
}

interface VideoDetail {
  id: string
  url: string
  title: string | null
  addedAt: string
  communityId: string | null
  communityName: string | null
  communityUrl: string | null
  currentViews: number
  previousViews: number
  growth: number
  history: Array<{ date: string; views: number }>
  measurements: Measurement[]
}

const route = useRoute()
const router = useRouter()
const videoId = route.params.id as string

const data = ref<VideoDetail | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const isUpdating = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)

// Определяем ссылку "Назад" на основе того, откуда пришли
const backLink = computed(() => {
  if (data.value?.communityId) {
    return `/communities/${data.value.communityId}`
  }
  return '/my-videos'
})

const backLabel = computed(() => {
  if (data.value?.communityId) {
    return `К сообществу: ${data.value.communityName}`
  }
  return 'К моим видео'
})

const chartPoints = computed(() => 
  data.value?.history
    .filter(h => h.views !== -1)
    .map(h => ({
      label: formatDate(h.date),
      value: h.views
    })) ?? []
)

async function loadData() {
  loading.value = true
  error.value = null
  try {
    data.value = await $fetch<VideoDetail>(`/api/videos/${videoId}`)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function handleUpdate() {
  isUpdating.value = true
  progressCurrent.value = 0
  progressTotal.value = 0

  try {
    await readStreamProgress('/api/update-stats', (event) => {
      if (event.type === 'progress') {
        progressCurrent.value = event.current || 0
        progressTotal.value = event.total || 0
      } else if (event.type === 'done') {
        loadData()
      }
    }, { 
      method: 'POST', 
      body: { videoIds: [videoId] } 
    })
  } catch (err) {
    console.error('[VideoDetail] Ошибка обновления:', err)
  } finally {
    isUpdating.value = false
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.page-container { max-width: 1200px; margin: 0 auto; }

.loader { 
  display: flex; align-items: center; gap: 0.75rem; 
  padding: 2rem; background: var(--bg-lighter); 
  border-radius: var(--radius-lg); color: var(--text-secondary);
  .spin { animation: spin 1s linear infinite; }
}

.error-block { 
  padding: 2rem; background: rgba(244, 67, 54, 0.1); 
  border: 1px solid var(--red); border-radius: var(--radius-lg); 
  color: var(--red); text-align: center;
  button { margin-top: 1rem; }
}

.video-header {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);

  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 2rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    margin-bottom: 0.5rem;
    text-decoration: none;
    
    &:hover { color: var(--text); }
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    color: var(--text);
  }

  .external-link {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    color: var(--link);
    font-size: 0.9rem;
    text-decoration: none;
    
    &:hover { text-decoration: underline; }
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1rem;

    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 1.4rem;
      font-weight: 700;
      color: var(--text);
      font-variant-numeric: tabular-nums;

      &.positive { color: var(--green); }
      &.negative { color: var(--red); }
      
      &.community {
        font-size: 1rem;
        
        a {
          color: var(--link);
          text-decoration: none;
          &:hover { text-decoration: underline; }
        }
      }
    }
  }
}

.section {
  margin-bottom: 2rem;

  h2 {
    font-size: 1.3rem;
    color: var(--text);
    margin: 0 0 1rem 0;
  }
}

.chart-card {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow);
}

.data-card { 
  background: var(--bg-lighter); 
  border-radius: var(--radius-lg); 
  overflow: hidden; 
  box-shadow: var(--shadow); 
}

.pass-cell {
  .pass-link {
    color: var(--link);
    text-decoration: none;
    font-size: 0.9rem;
    
    &:hover { text-decoration: underline; }
  }
  
  .no-pass {
    color: var(--text-secondary);
    font-size: 0.9rem;
  }
}

.empty { 
  text-align: center; 
  color: var(--text-secondary); 
  padding: 3rem !important; 
}

.btn { 
  @include btn-base;
  &-blue { 
    background: var(--blue); 
    color: white; 
    &:hover:not(:disabled) { background: #1976d2; } 
  }
}

@keyframes spin { 
  from { transform: rotate(0deg); } 
  to { transform: rotate(360deg); } 
}
</style>