<template>
  <main class="app">
    <header><router-link to="/"><h1>DC 打王分寶 Editor</h1></router-link></header>
    <router-view />
  </main>
</template>

<style>
.app { max-width: 900px; margin: 0 auto; padding: 16px; font-family: system-ui, sans-serif; }
header a { text-decoration: none; color: inherit; }
button { cursor: pointer; }
</style>
