<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import type { Product } from '../types/product.types';
import { useLocalStorage } from '@vueuse/core';

const products = ref<Product[]>([]);
const productOptions = ref(<SelectMenuItem<Product>[]>[]);
const loading = ref(true);
const error = ref<string | null>(null);
const selected = useLocalStorage('selectedProduct', null);

const fetchProducts = async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await $fetch(`/api/products`, {
      method: 'POST',
      body: {
        limit: 100,
      },
    });
    if (data.success) {
      products.value = data.products;
    } else {
      error.value = data.error || 'Failed to load products';
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
};

watch(products, (newProducts) => {
  productOptions.value = Array.isArray(newProducts)
    ? newProducts.map((product) => ({
        label: `${product.PartNumber} - ${product.ProductDescription}`,
        value: product.PartNumber,
      }))
    : [];
});

const selectProduct = (product: Product | null) => {
  selected.value = product;
};

onMounted(fetchProducts);
</script>

<style>
ul {
  list-style: none;
  padding: 0;
}
li {
  margin-bottom: 8px;
}
button {
  padding: 8px 16px;
  font-size: 1rem;
  cursor: pointer;
}
</style>

<template>
  <div>
    <h1>Termék kiválasztása</h1>
    <div v-if="loading">Betöltés...</div>
    <div v-else-if="error">Hiba: {{ error }}</div>
    <div v-else>
      <USelectMenu
        class="w-full"
        v-model="selected"
        :items="productOptions"
        :search-input="{
          placeholder: 'Keresés...',
          icon: 'i-lucide-search',
        }"
        placeholder="Válasszon egy terméket"
        @onSelect="selectProduct(selected)"
      >
        <template #item="{ item }">
          <div class="flex items-center space-x-2">
            <span>{{ item.label }} - {{ item.value }}</span>
          </div>
        </template>
      </USelectMenu>
    </div>
  </div>
</template>
