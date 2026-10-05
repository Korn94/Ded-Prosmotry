<!-- app/pages/add-community.vue -->
<template>
  <div class="page-container">
    <header class="page-header">
      <h1>👥 Добавить сообщество</h1>
      <p class="subtitle">Вставьте ссылку на сообщество OK.RU</p>
    </header>

    <div class="form-card">
      <input
        v-model="communityUrl"
        type="text"
        placeholder="https://ok.ru/group/123456789"
        :disabled="isProcessing"
      />

      <div class="actions">
        <button
          @click="handleAddCommunity"
          :disabled="isProcessing || !communityUrl.trim()"
          class="btn btn-green"
        >
          <Icon v-if="isProcessing" name="lucide:loader-2" class="spin" size="18" />
          <Icon v-else name="lucide:plus" size="18" />
          {{ isProcessing ? 'Добавление...' : 'Добавить сообщество' }}
        </button>
      </div>
    </div>

    <div v-if="result" class="result-card">
      <div class="result-icon">✅</div>
      <h2>Сообщество добавлено</h2>
      <div class="result-info">
        <div class="info-row">
          <span class="label">Название:</span>
          <span class="value">{{ result.name }}</span>
        </div>
        <div class="info-row">
          <span class="label">Подписчиков:</span>
          <span class="value">{{ formatNumber(result.subscribers) }}</span>
        </div>
      </div>
      <NuxtLink to="/add-videos" class="btn btn-blue">
        <Icon name="lucide:video" size="18" />
        Добавить видео в это сообщество
      </NuxtLink>
    </div>

    <div v-if="error" class="error-card">
      <div class="error-icon">❌</div>
      <p>{{ error }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { formatNumber } from '~/composables/useFormat'

interface CommunityResult {
  id: string
  name: string
  subscribers: number | null
}

const communityUrl = ref('')
const isProcessing = ref(false)
const result = ref<CommunityResult | null>(null)
const error = ref<string | null>(null)

async function handleAddCommunity() {
  if (!communityUrl.value.trim()) return

  isProcessing.value = true
  result.value = null
  error.value = null

  try {
    const response = await $fetch<{ success: boolean; community?: CommunityResult; error?: string }>('/api/communities', {
      method: 'POST',
      body: { url: communityUrl.value.trim() }
    })

    if (response.success && response.community) {
      result.value = response.community
      communityUrl.value = ''
    } else {
      error.value = response.error || 'Не удалось добавить сообщество'
    }
  } catch (err) {
    error.value = (err as Error).message
    console.error('[AddCommunity] Ошибка:', err)
  } finally {
    isProcessing.value = false
  }
}
</script>

<style lang="scss" scoped>
.page-container {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 2rem;
  
  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    color: var(--text);
  }
  
  .subtitle {
    margin: 0;
    color: var(--text-secondary);
  }
}

.form-card {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: var(--shadow);

  input {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    color: var(--text);
    padding: 1rem;
    font-size: 1rem;
    margin-bottom: 1rem;

    &::placeholder {
      color: var(--text-secondary);
    }

    &:focus {
      outline: none;
      border-color: var(--blue);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }
}

.result-card {
  background: var(--bg-lighter);
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  box-shadow: var(--shadow);
  text-align: center;

  .result-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }

  h2 {
    margin: 0 0 2rem 0;
    font-size: 1.5rem;
    color: var(--text);
  }

  .result-info {
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 1.5rem;
    margin-bottom: 2rem;
    text-align: left;

    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);

      &:last-child {
        border-bottom: none;
      }

      .label {
        color: var(--text-secondary);
        font-weight: 500;
      }

      .value {
        color: var(--text);
        font-weight: 700;
      }
    }
  }
}

.error-card {
  background: rgba(244, 67, 54, 0.1);
  border: 1px solid var(--red);
  border-radius: var(--radius-lg);
  padding: 2rem;
  text-align: center;

  .error-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  p {
    margin: 0;
    color: var(--red);
    font-weight: 500;
  }
}

.btn {
  @include btn-base;
  
  &-green {
    background: var(--green);
    color: white;
    &:hover:not(:disabled) { background: #388e3c; }
  }

  &-blue {
    background: var(--blue);
    color: white;
    &:hover:not(:disabled) { background: #1976d2; }
  }

  .spin {
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>