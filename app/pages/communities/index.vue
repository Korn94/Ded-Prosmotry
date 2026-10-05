<!-- app/pages/communities/index.vue -->
<template>
  <div class="page-container">
    <header class="page-header">
      <div>
        <h1>👥 Сообщества</h1>
        <p class="subtitle">Оценка эффективности и «живости» сообществ</p>
      </div>
      <NuxtLink to="/add-community" class="btn btn-green">
        <Icon name="lucide:plus" size="16" />
        Добавить сообщество
      </NuxtLink>
    </header>

    <!-- График активности (из прошлого шага) -->
    <DailyActivityChart />

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
      <div class="filter-chips">
        <label class="chip" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          Все
        </label>
        <label class="chip alive" :class="{ active: filter === 'alive' }" @click="filter = 'alive'">
          🔥 Живые
        </label>
        <label class="chip dead" :class="{ active: filter === 'dead' }" @click="filter = 'dead'">
          💀 Мёртвые
        </label>
      </div>
    </div>

    <div v-if="communityStore.loading" class="loader">
      <Icon name="lucide:loader-2" class="spin" size="24" />
      <span>Загрузка и расчёт метрик...</span>
    </div>

    <div v-else class="data-card">
      <table class="crm-table">
        <thead>
          <tr>
            <th>Сообщество</th>
            <th class="num">Видео</th>
            <th class="num">Подписчики</th>
            <th class="num">Просмотры</th>
            <th>Вовлечённость</th>
            <th class="num">Активность</th>
            <th>Тренд</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in filteredCommunities" :key="c.id" class="community-row">
            <td>
              <div class="comm-name">
                <a :href="c.url" target="_blank">{{ c.name }}</a>
              </div>
            </td>
            <td class="num">{{ c.videoCount }}</td>
            <td class="num">{{ formatNumber(c.subscribers) }}</td>
            <td class="num">{{ formatNumber(c.totalViews) }}</td>
            <td>
              <span class="engagement-badge" :class="getEngagementClass(c.engagement)">
                {{ c.engagement.toFixed(2) }}
              </span>
            </td>
            <td class="num" :class="c.activity > 0 ? 'text-green' : c.activity < 0 ? 'text-red' : ''">
              {{ c.activity > 0 ? '+' : '' }}{{ formatNumber(c.activity) }}
            </td>
            <td>
              <span class="trend-indicator" :class="`trend-${c.trend}`" :title="`Изменение: ${c.trendPercent}%`">
                {{ c.trendIcon }}
              </span>
            </td>
            <td class="actions-cell">
              <button 
                @click="handleUpdateCommunity(c.id, c.name)" 
                :disabled="isUpdating"
                class="btn-icon"
                title="Запустить обход сообщества"
              >
                <Icon 
                  :name="updatingCommunityId === c.id ? 'lucide:loader-2' : 'lucide:refresh-cw'" 
                  :class="{ spin: updatingCommunityId === c.id }" 
                  size="16" 
                />
              </button>
              <NuxtLink :to="`/communities/${c.id}`" class="btn-icon" title="Подробнее">
                <Icon name="lucide:arrow-right" size="16" />
              </NuxtLink>
            </td>
          </tr>
          <tr v-if="filteredCommunities.length === 0">
            <td colspan="8" class="empty">
              {{ communityStore.communities.length === 0 ? 'Нет добавленных сообществ' : 'Ничего не найдено по фильтру' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ProgressOverlay
      v-if="isUpdating"
      :label="`Обновление: ${updatingCommunityName}`"
      :current="progressCurrent"
      :total="progressTotal"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCommunityStore } from '~/stores/communities'
import { formatNumber } from '~/composables/useFormat'
import { readStreamProgress } from '~/composables/useStreamProgress'
import DailyActivityChart from '~/components/charts/DailyActivityChart.vue'

const communityStore = useCommunityStore()

const searchQuery = ref('')
const filter = ref<'all' | 'alive' | 'dead'>('all')

const isUpdating = ref(false)
const updatingCommunityId = ref<string | null>(null)
const updatingCommunityName = ref('')
const progressCurrent = ref(0)
const progressTotal = ref(0)

const filteredCommunities = computed(() => {
  let list = communityStore.communities
  
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(c => c.name.toLowerCase().includes(q))
  }
  
  if (filter.value === 'alive') {
    list = list.filter(c => c.engagement >= 0.1)
  } else if (filter.value === 'dead') {
    list = list.filter(c => c.engagement < 0.1 && c.videoCount > 0)
  }
  
  return list
})

function getEngagementClass(eng: number): string {
  if (eng > 1) return 'high'
  if (eng >= 0.1) return 'normal'
  return 'dead'
}

async function handleUpdateCommunity(communityId: string, name: string) {
  isUpdating.value = true
  updatingCommunityId.value = communityId
  updatingCommunityName.value = name
  progressCurrent.value = 0
  progressTotal.value = 0

  try {
    await readStreamProgress('/api/update-stats', (event) => {
      if (event.type === 'progress') {
        progressCurrent.value = event.current || 0
        progressTotal.value = event.total || 0
      } else if (event.type === 'done') {
        console.log('[Communities] Обход завершён')
        communityStore.fetchCommunities() // Обновляем метрики
      }
    }, { 
      method: 'POST', 
      body: { communityIds: [communityId] } 
    })
  } catch (err) {
    console.error('[Communities] Ошибка обновления:', err)
  } finally {
    isUpdating.value = false
    updatingCommunityId.value = null
  }
}

onMounted(() => {
  if (communityStore.communities.length === 0) {
    communityStore.fetchCommunities()
  }
})
</script>

<style lang="scss" scoped>
.page-container { max-width: 1400px; margin: 0 auto; }
.page-header { 
  display: flex; justify-content: space-between; align-items: flex-start; 
  margin-bottom: 1.5rem; gap: 2rem;
  h1 { margin: 0 0 0.5rem 0; font-size: 1.75rem; color: var(--text); }
  .subtitle { margin: 0; color: var(--text-secondary); }
}

.filters-bar {
  display: flex;
  gap: 1.5rem;
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
    min-width: 250px;
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

  .filter-chips {
    display: flex;
    gap: 0.5rem;
  }

  .chip {
    padding: 0.5rem 1rem;
    background: var(--bg-lighter);
    border: 1px solid var(--border);
    border-radius: 99px;
    font-size: 0.85rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.2s;
    user-select: none;

    &:hover { border-color: var(--text-secondary); }
    &.active {
      background: var(--blue);
      border-color: var(--blue);
      color: white;
    }
    &.alive.active { background: var(--green); border-color: var(--green); }
    &.dead.active { background: var(--red); border-color: var(--red); }
  }
}

.loader { display: flex; align-items: center; gap: 0.75rem; padding: 2rem; background: var(--bg-lighter); border-radius: var(--radius-lg); color: var(--text-secondary);
  .spin { animation: spin 1s linear infinite; }
}
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.data-card { background: var(--bg-lighter); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow); }

.comm-name a { color: var(--link); font-weight: 600; text-decoration: none; &:hover { text-decoration: underline; } }

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

.text-green { color: var(--green); font-weight: 600; }
.text-red { color: var(--red); font-weight: 600; }

.trend-indicator {
  font-size: 1.1rem;
  &.trend-sharp_up, &.trend-up { filter: drop-shadow(0 0 2px var(--green)); }
  &.trend-sharp_down, &.trend-down { filter: drop-shadow(0 0 2px var(--red)); }
}

.actions-cell {
  display: flex;
  gap: 0.5rem;
}

.btn-icon {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  padding: 0.4rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  text-decoration: none;
  
  &:hover:not(:disabled) {
    background: var(--bg-input);
    color: var(--text);
    border-color: var(--blue);
  }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}

.empty { text-align: center; color: var(--text-secondary); padding: 3rem !important; }

.btn { @include btn-base;
  &-green { background: var(--green); color: white; &:hover { background: #388e3c; } }
}
</style>