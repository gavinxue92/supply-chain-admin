<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <el-card>
    <template #header>{{ route.meta.title || '首页' }}</template>
    <el-empty :description="`${route.meta.title || '首页'}功能将在后续切片中实现`" />
  </el-card>
</template>
