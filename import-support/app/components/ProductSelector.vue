<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useDebounceFn, useLocalStorage } from '@vueuse/core';
import type { Product } from '../types/product.types';

const props = defineProps<{}>();

const searchTerm = ref('');
const isOpen = ref(false);
const selected = useState<Product | null>('selectedProduct', () => null);
const ptrProductTree = useState<Product | null>('ptrProductTree', () => null);
const loading = ref(false);
const error = ref<string | null>(null);
const rawItems = ref<Product[]>([]);
const highlightedIndex = ref(-1);

let suppressSearch = false;
let suppressOpen = false;

/* ------------------ SEARCH LOGIC ------------------ */
const doSearch = async (query: string) => {
  loading.value = true;
  error.value = null;
  rawItems.value = [];

  console.log('Searching for:', query);
  try {
    const data = await $fetch(`/api/products`, {
      method: 'POST',
      body: { searchTerm: query },
    });
    rawItems.value = Array.isArray(data.products) ? data.products : [];
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      error.value = 'Failed to fetch data';
      rawItems.value = [];
    }
  } finally {
    loading.value = false;
  }
};

const debouncedSearch = useDebounceFn((query: string) => {
  if (query.length < 3) {
    rawItems.value = [];
    return;
  }
  doSearch(query);
}, 500);

watch(searchTerm, (q) => {
  if (suppressSearch) return;
  debouncedSearch(q);
});

const formattedItems = computed(() => {
  return (rawItems.value ?? []).map((i: any) => {
    return {
      ...i,
      name: i.productDescription,
      id: i.partNumber,
    };
  });
});

const fetchPtrProductTree = async (productId: string) => {
  try {
    const data = await $fetch(`/api/ptr-product-tree`, {
      method: 'POST',
      body: {
        productId: productId,
      },
    });
    return data.products || null;
  } catch (err: any) {
    return null;
  }
};

/* ------------------ SELECT HANDLING ------------------ */
async function selectItem(item: any) {
  if (!item || item.disabled) return;
  selected.value = item;

  suppressSearch = true;
  suppressOpen = true;

  ptrProductTree.value = await fetchPtrProductTree(item.PartNumber);

  searchTerm.value = item.PartNumber + ' - ' + item.ProductDescription;
  isOpen.value = false;
  nextTick(() => {
    suppressSearch = false;

    setTimeout(() => {
      suppressOpen = false;
    }, 50);
  });
}

watch(isOpen, (open) => {
  if (open) highlightedIndex.value = -1;
});
</script>

<template>
  <div class="relative w-full flex flex-col" ref="wrapRef">
    <!-- Search input -->
    <input
      type="text"
      class="w-full border rounded px-3 py-2 text-lg"
      :placeholder="'Keresés...'"
      v-model="searchTerm"
      @focus="if (!suppressOpen) isOpen = true;"
    />

    <!-- Dropdown -->
    <div
      v-if="isOpen"
      ref="dropdownRef"
      tabindex="0"
      class="absolute top-full left-0 w-full bg-white border shadow-lg z-50 max-h-80 overflow-auto"
    >
      <!-- Loading -->
      <div v-if="loading" class="p-3 text-gray-500 flex items-center gap-3">
        <UIcon class="animate-spin" name="i-lucide-loader-pinwheel" />
        Betöltés...
      </div>

      <!-- No results -->
      <div v-else-if="formattedItems.length === 0" class="p-3 text-gray-400">
        Nincs adat
      </div>

      <!-- Results -->
      <div
        v-for="(item, index) in formattedItems"
        :key="item.id"
        :data-item-index="index"
        class="p-3"
        :class="[
          item.class,
          index === highlightedIndex ? 'bg-blue-100' : 'hover:bg-blue-50',
          item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        ]"
        @click="!item.disabled && selectItem(item)"
        @mouseenter="highlightedIndex = index"
      >
        <div class="font-medium">
          {{ item.PartNumber }} - {{ item.ProductDescription }}
        </div>

        <div class="text-sm text-gray-500"></div>
      </div>
    </div>
  </div>
</template>
