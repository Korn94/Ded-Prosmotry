<!-- app/pages/passes.vue -->
<template>
  <div class="page-container">
    <header class="page-header">
      <h1>🔄 История обходов</h1>
      <p class="subtitle">Журнал всех снятий статистики</p>
    </header>

    <div v-if="loading" class="loader">
      <Icon name="lucide:loader-2" class="spin" size="24" />
      <span>Загрузка истории...</span>
    </div>

    <div v-else-if="error" class="error-block">
      <p>Ошибка: {{ error }}</p>
      <button @click="fetchPasses" class="btn btn-blue">Повторить</button>
    </div>

    <div v-else class="data-card">
      <table class="crm-table">
        <thead>
          <tr>
            <th>Дата и время</th>
            <th>Метка</th>
            <th>Тип</th>
            <th class="num">Видео</th>
            <th class="num">Ошибки</th>
            <th>Статус</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pass in passes" :key="pass.id">
            <td>{{ formatDateTime(pass.startedAt) }}</td>
            <td class="pass-label">{{ pass.label }}</td>
            <td>
              <span class="type-badge" :class="pass.type">
                {{ getTypeText(pass.type) }}
              </span>
            </td>
            <td class="num">{{ pass.videoCount }}</td>
            <td class="num" :class="{ 'text-red': pass.errorCount > 0 }">
              {{ pass.errorCount }}
            </td>
            <td>
              <span class="status-badge" :class="pass.status">
                {{ getStatusText(pass.status) }}
              </span>
            </td>
          </tr>
          <tr v-if="passes.length === 0">
            <td colspan="6" class="empty">История обходов пуста. Нажмите "Обновить" на странице видео.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { formatDateTime } from '~/composables/useFormat'

interface Pass {
  id: string
  label: string
  type: 'community' | 'multi' | 'global'
  communityIds: string[]
  startedAt: string
  finishedAt: string | null
  status: 'in_progress' | 'completed' | 'cancelled'
  videoCount: number
  errorCount: number
}

const passes = ref<Pass[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

function getTypeText(type: string): string {
  switch (type) {
    case 'community': return 'Сообщество'
    case 'multi': return 'Несколько'
    case 'global': return 'Все видео'
    default: return type
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'completed': return '✅ Завершён'
    case 'in_progress': return '⏳ В процессе'
    case 'cancelled': return '❌ Отменён'
    default: return status
  }
}

async function fetchPasses() {
  loading.value = true
  error.value = null
  try {
    passes.value = await $fetch<Pass[]>('/api/passes')
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

onMounted(fetchPasses)
</script>

<style lang="scss" scoped>
.page-container { max-width: 1200px; margin: 0 auto; }
.page-header { margin-bottom: 2rem;
  h1 { margin: 0 0 0.5rem 0; font-size: 1.75rem; color: var(--text); }
  .subtitle { margin: 0; color: var(--text-secondary); }
}
.loader { display: flex; align-items: center; gap: 0.75rem; padding: 2rem; background: var(--bg-lighter); border-radius: var(--radius-lg); color: var(--text-secondary);
  .spin { animation: spin 1s linear infinite; }
}
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.error-block { padding: 2rem; background: rgba(244, 67, 54, 0.1); border: 1px solid var(--red); border-radius: var(--radius-lg); color: var(--red); text-align: center;
  button { margin-top: 1rem; }
}
.data-card { background: var(--bg-lighter); border-radius: var(--radius-lg); overflow: hidden; box-shadow: var(--shadow); }
.pass-label { font-weight: 500; }
.text-red { color: var(--red); font-weight: 600; }
.type-badge {
  display: inline-block; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 600;
  &.community { background: rgba(156, 39, 176, 0.2); color: var(--purple); }
  &.multi { background: rgba(33, 150, 243, 0.2); color: var(--blue); }
  &.global { background: rgba(255, 152, 0, 0.2); color: var(--growth-neutral); }
}
.status-badge {
  display: inline-block; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); font-size: 0.8rem; font-weight: 600;
  &.completed { background: rgba(76, 175, 80, 0.2); color: var(--green); }
  &.in_progress { background: rgba(255, 152, 0, 0.2); color: var(--growth-neutral); }
  &.cancelled { background: rgba(244, 67, 54, 0.2); color: var(--red); }
}
.empty { text-align: center; color: var(--text-secondary); padding: 3rem !important; }
.btn { @include btn-base;
  &-blue { background: var(--blue); color: white; &:hover { background: #1976d2; } }
}
</style>