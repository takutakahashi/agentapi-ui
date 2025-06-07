<template>
  <div class="welcome-component">
    <h2>{{ message }}</h2>
    <button @click="updateMessage" type="button">
      Update Message
    </button>
  </div>
</template>

<script setup lang="ts">
const message = ref<string>('Hello from TypeScript component!')

const updateMessage = (): void => {
  message.value = `Updated at ${new Date().toLocaleTimeString()}`
}
</script>

<style scoped>
.welcome-component {
  margin: 2rem 0;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

h2 {
  color: #2b6cb0;
  margin-bottom: 1rem;
}

button {
  background-color: #3182ce;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
}

button:hover {
  background-color: #2c5aa0;
}
</style>