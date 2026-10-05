// nuxt.config.ts
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  
  // Директория приложения (Nuxt 4 по умолчанию использует app/)
  srcDir: 'app/',
  serverDir: './server',

  modules: ['@pinia/nuxt', '@nuxt/icon'],

  // Подключение глобального CSS
  css: ['~/assets/styles/index.scss'],

  // Автоматический импорт SCSS переменных и миксинов
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          // Используем @use, чтобы переменные были доступны во всех компонентах
          additionalData: `
            @use "~/assets/styles/variables" as *;
            @use "~/assets/styles/mixins" as *;
          `,
        },
      },
    },
  },

  // Настройка иконок (Lucide)
  icon: {
    serverBundle: {
      remote: 'jsdelivr',
    },
  },
})
