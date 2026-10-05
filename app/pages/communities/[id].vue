<!-- app/pages/communities/[id].vue -->
<template>
  <div class="page-container">
    <div v-if="loading" class="loader">
      <Icon name="lucide:loader-2" class="spin" size="24" />
      <span>Загрузка сообщества...</span>
    </div>

    <div v-else-if="error" class="error-block">
      <p>❌ {{ error }}</p>
      <button @click="loadData" class="btn btn-blue">Повторить</button>
    </div>

    <template v-else-if="data">
      <!-- Шапка -->
      <header class="community-header">
        <div class="header-main">
          <div>
            <NuxtLink to="/communities" class="back-link">
              <Icon name="lucide:arrow-left" size="16" />
              К списку сообществ
            </NuxtLink>
            <h1>{{ data.name }}</h1>
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
            {{ isUpdating ? 'Обновление...' : 'Обновить сообщество' }}
          </button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Подписчиков</div>
            <div class="stat-value">{{ formatNumber(data.subscribers) }}</div>
            <div 
              class="stat-change" 
              :class="data.subscribersChange >= 0 ? 'positive' : 'negative'"
              v-if="data.subscribersChange !== 0"
            >
              {{ data.subscribersChange >= 0 ? '+' : '' }}{{ formatNumber(data.subscribersChange) }}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Всего видео</div>
            <div class="stat-value">{{ data.videoCount }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Сумма просмотров</div>
            <div class="stat-value">{{ formatNumber(data.totalViews) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Вовлечённость</div>
            <div class="stat-value">{{ data.engagement.toFixed(2) }}</div>
            <div class="stat-sub">{{ getEngagementLabel(data.engagement) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Активность</div>
            <div 
              class="stat-value" 
              :class="data.activity > 0 ? 'positive' : data.activity < 0 ? 'negative' : ''"
            >
              {{ data.activity > 0 ? '+' : '' }}{{ formatNumber(data.activity) }}
            </div>
            <div class="stat-sub">за последний обход</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Тренд</div>
            <div class="stat-value trend">{{ data.trendIcon }}</div>
          </div>
        </div>
      </header>

      <!-- 🆕 ГРАФИКИ ПО НЕДЕЛЯМ -->
      <div v-if="weeklyStats" class="charts-grid">
        <WeeklyTrendChart 
          :weekly-data="weeklyStats.weeklyData"
          :video-count="weeklyStats.videoCount"
          :total-views="weeklyStats.totalViews"
          title-text="📈 Тренд просмотров по неделям"
          color="#9c27b0"
        />

        <WeeklyGrowthChart 
          :weekly-data="weeklyStats.weeklyData"
          title-text="📊 Прирост просмотров по неделям"
        />
      </div>

      <!-- График вовлечённости -->
      <section class="section">
        <h2>📈 Вовлечённость по обходам</h2>
        <div class="chart-card">
          <LineChart 
            :points="engagementPoints" 
            color="#9c27b0"
            :format-y="(v: number) => v.toFixed(2)"
          />
        </div>
      </section>

      <!-- Таблица обходов -->
      <section class="section">
        <h2>🔄 История обходов</h2>
        <div class="data-card">
          <table class="crm-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th class="num">Видео</th>
                <th class="num">Просмотры</th>
                <th class="num">Подписчики</th>
                <th>Вовлечённость</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(pass, idx) in reversedPasses" :key="pass.id">
                <td>#{{ reversedPasses.length - idx }}</td>
                <td>{{ formatDate(pass.date) }}</td>
                <td class="num">{{ pass.videoCount }}</td>
                <td class="num">{{ formatNumber(pass.totalViews) }}</td>
                <td class="num">{{ formatNumber(pass.subscribers) }}</td>
                <td>
                  <span class="engagement-badge" :class="getEngagementClass(pass.engagement)">
                    {{ pass.engagement.toFixed(2) }}
                  </span>
                </td>
              </tr>
              <tr v-if="data.passesHistory.length === 0">
                <td colspan="6" class="empty">Пока не было ни одного обхода</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Таблица видео -->
      <section class="section">
        <h2>🎬 Видео в сообществе</h2>
        <div class="data-card">
          <table class="crm-table">
            <thead>
              <tr>
                <th>Название</th>
                <th class="num">Просмотры</th>
                <th class="num">Рост с прошлого обхода</th>
                <th>Дата добавления</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="video in data.videos" :key="video.id">
                <td>
                  <a :href="video.url" target="_blank" class="video-link">
                    {{ video.title || `Видео #${video.id}` }}
                  </a>
                </td>
                <td class="num">{{ formatNumber(video.currentViews) }}</td>
                <td class="num" :class="getGrowthClass(video.growth)">
                  {{ video.growth > 0 ? '+' : '' }}{{ formatNumber(video.growth) }}
                </td>
                <td>{{ formatDate(video.addedAt) }}</td>
                <td>
                  <NuxtLink :to="`/videos/${video.id}`" class="btn-icon" title="Подробнее">
                    <Icon name="lucide:arrow-right" size="16" />
                  </NuxtLink>
                </td>
              </tr>
              <tr v-if="data.videos.length === 0">
                <td colspan="5" class="empty">В сообществе пока нет видео</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <ProgressOverlay
      v-if="isUpdating"
      :label="`Обновление: ${data?.name}`"
      :current="progressCurrent"
      :total="progressTotal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { ApiCommunityDetailDto } from '~~/shared/types/api'
import { formatNumber, formatDate } from '~/composables/useFormat'
import { readStreamProgress } from '~/composables/useStreamProgress'
import LineChart from '~/components/charts/LineChart.vue'
import WeeklyTrendChart from '~/components/charts/WeeklyTrendChart.vue'
import WeeklyGrowthChart from '~/components/charts/WeeklyGrowthChart.vue'

interface WeeklyStats {
  weeklyData: Array<{ startDate: string; totalViews: number; growth: number }>
  totalViews: number
  videoCount: number
}

const route = useRoute()
const communityId = route.params.id as string

const data = ref<ApiCommunityDetailDto | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const weeklyStats = ref<WeeklyStats | null>(null)

const isUpdating = ref(false)
const progressCurrent = ref(0)
const progressTotal = ref(0)

const engagementPoints = computed(() => 
  data.value?.passesHistory.map(p => ({
    label: formatDate(p.date),
    value: p.engagement
  })) ?? []
)

const reversedPasses = computed(() => 
  [...(data.value?.passesHistory ?? [])].reverse()
)

function getEngagementLabel(eng: number): string {
  if (eng > 1) return 'Высокая'
  if (eng >= 0.1) return 'Нормальная'
  return 'Мёртвое'
}

function getEngagementClass(eng: number): string {
  if (eng > 1) return 'high'
  if (eng >= 0.1) return 'normal'
  return 'dead'
}

function getGrowthClass(growth: number): string {
  if (growth > 0) return 'growth-positive'
  if (growth < 0) return 'growth-negative'
  return 'growth-neutral'
}

async function loadData() {
  loading.value = true
  error.value = null
  try {
    // Параллельно загружаем основные данные и недельную статистику
    const [communityData, weeklyData] = await Promise.all([
      $fetch<ApiCommunityDetailDto>(`/api/communities/${communityId}`),
      $fetch<WeeklyStats>(`/api/analytics/community-weekly/${communityId}`)
    ])
    
    data.value = communityData
    weeklyStats.value = weeklyData
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function handleUpdate() {
  if (!data.value) return
  
  isUpdating.value = true
  progressCurrent.value = 0
  progressTotal.value = 0

  try {
    await readStreamProgress('/api/update-stats', (event) => {
      if (event.type === 'progress') {
        progressCurrent.value = event.current || 0
        progressTotal.value = event.total || 0
      } else if (event.type === 'done') {
        loadData() // Обновляем все данные после завершения обхода
      }
    }, { 
      method: 'POST', 
      body: { communityIds: [communityId] } 
    })
  } catch (err) {
    console.error('[CommunityDetail] Ошибка обновления:', err)
  } finally {
    isUpdating.value = false
  }
}

onMounted(loadData)
</script>

<style lang="scss" scoped>
.page-container { max-width: 1400px; margin: 0 auto; }

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

.community-header {
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
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
      font-variant-numeric: tabular-nums;

      &.positive { color: var(--green); }
      &.negative { color: var(--red); }
      &.trend { font-size: 2rem; }
    }

    .stat-change {
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: 0.25rem;

      &.positive { color: var(--green); }
      &.negative { color: var(--red); }
    }

    .stat-sub {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
    }
  }
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
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

.video-link { 
  color: var(--link); 
  font-weight: 500; 
  text-decoration: none; 
  &:hover { text-decoration: underline; }
}

.engagement-badge {
  display: inline-block;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 700;
  font-family: monospace;
  
  &.high { background: rgba(76, 175, 80, 0.2); color: var(--green); }
  &.normal { background: rgba(33, 150, 243, 0.2); color: var(--blue); }
  &.dead { background: rgba(244, 67, 54, 0.2); color: var(--red); }
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