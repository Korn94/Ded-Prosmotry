<!-- app/layouts/default.vue -->
<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="logo">
        <Icon name="lucide:bar-chart-3" size="24" />
        <span>OK Analytics</span>
      </div>
      
      <nav class="nav-menu">
        <NuxtLink to="/my-videos" class="nav-item" active-class="active">
          <Icon name="lucide:user" size="18" />
          <span>Мои видео</span>
        </NuxtLink>
        
        <NuxtLink to="/communities" class="nav-item" active-class="active">
          <Icon name="lucide:users" size="18" />
          <span>Сообщества</span>
        </NuxtLink>

        <div class="nav-divider"></div>

        <NuxtLink to="/add-videos" class="nav-item" active-class="active">
          <Icon name="lucide:plus-circle" size="18" />
          <span>Добавить видео</span>
        </NuxtLink>
        
        <NuxtLink to="/passes" class="nav-item" active-class="active">
          <Icon name="lucide:history" size="18" />
          <span>История обходов</span>
        </NuxtLink>
      </nav>
    </aside>

    <main class="main-content">
      <slot />
    </main>
  </div>
</template>

<style lang="scss" scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-dark);
}

.sidebar {
  width: 260px;
  background: var(--bg-lighter);
  border-right: 1px solid var(--border);
  padding: 1.5rem 0;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0 1.5rem 1.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    margin-bottom: 1rem;
  }

  .nav-menu {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0 0.75rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    text-decoration: none;
    font-weight: 500;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text);
    }

    &.active {
      background: var(--blue);
      color: white;
      
      &:hover {
        background: #1976d2;
      }
    }
  }

  .nav-divider {
    height: 1px;
    background: var(--border);
    margin: 1rem 0;
  }
}

.main-content {
  flex: 1;
  padding: 2rem;
  overflow-x: hidden;
}

@include mobile {
  .app-layout {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    position: relative;
    flex-direction: row;
    padding: 1rem;
    overflow-x: auto;
    
    .logo { display: none; }
    .nav-menu { flex-direction: row; padding: 0; gap: 0.5rem; }
    .nav-item { white-space: nowrap; padding: 0.5rem 1rem; font-size: 0.9rem; }
    .nav-divider { display: none; }
  }
  .main-content { padding: 1rem; }
}
</style>