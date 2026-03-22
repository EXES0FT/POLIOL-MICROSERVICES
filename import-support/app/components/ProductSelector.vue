<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import { useDebounceFn } from '@vueuse/core';
import type { Product } from '../types/product.types';

// withDefaults
const props = withDefaults(
  defineProps<{
    logoSrc?: string;
    title?: string;
    subtitle?: string;
  }>(),
  {
    logoSrc: '/poliol_logo_fekete.png',
    title: 'Termék kereső',
    subtitle:
      'Keress cikkszám vagy megnevezés alapján a gyártási adatok betöltéséhez.',
  },
);

const searchTerm = ref('');
const isOpen = ref(false);
const selected = useState<Product | null>('selectedProduct', () => null);
const ptrProductTree = useState<Product | null>('ptrProductTree', () => null);
const fmProductTree = useState<Product | null>('fmProductTree', () => null);

const loading = ref(false);
const selecting = ref(false);
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
      body: { productId },
    });
    return data.products || null;
  } catch {
    return null;
  }
};

const fetchFmProductTree = async (productId: string) => {
  try {
    const data = await $fetch(`/api/fm-product-tree`, {
      method: 'POST',
      body: { productId },
    });
    return data.products || null;
  } catch {
    return null;
  }
};

/* ------------------ SELECT HANDLING ------------------ */
async function selectItem(item: any) {
  if (!item || item.disabled || selecting.value) return;

  selected.value = item;
  suppressSearch = true;
  suppressOpen = true;
  selecting.value = true;
  error.value = null;

  try {
    const [ptrTree, fmTree] = await Promise.all([
      fetchPtrProductTree(item.PartNumber),
      fetchFmProductTree(item.PartNumber),
    ]);

    ptrProductTree.value = ptrTree;
    fmProductTree.value = fmTree;

    searchTerm.value = `${item.PartNumber} - ${item.ProductDescription}`;
    isOpen.value = false;

    await nextTick();

    suppressSearch = false;
    setTimeout(() => {
      suppressOpen = false;
    }, 50);

    await navigateTo('/info');
  } catch {
    error.value = 'Failed to load product trees';
    suppressSearch = false;
    setTimeout(() => {
      suppressOpen = false;
    }, 50);
  } finally {
    selecting.value = false;
  }
}

watch(isOpen, (open) => {
  if (open) highlightedIndex.value = -1;
});

const resolvedTitle = computed(() => props.title || 'Termék kereső');
const resolvedSubtitle = computed(
  () =>
    props.subtitle ||
    'Keress cikkszám vagy megnevezés alapján a gyártási adatok betöltéséhez.',
);
</script>

<template>
  <div class="min-h-screen bg-slate-50 px-4 py-10 md:py-16">
    <!-- Fullscreen loading overlay -->
    <div
      v-if="selecting"
      class="fixed inset-0 z-[9999] bg-white/80 backdrop-blur-sm flex items-center justify-center"
    >
      <div
        class="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-7 shadow-xl border border-slate-200"
      >
        <UIcon
          class="animate-spin text-4xl text-orange-500"
          name="i-lucide-loader-pinwheel"
        />
        <div class="text-center">
          <div class="text-lg font-semibold text-slate-900">
            Gyártási adatok betöltése...
          </div>
          <div class="text-sm text-slate-500 mt-1">
            Kérlek várj egy pillanatot
          </div>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-3xl">
      <div
        class="rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 overflow-visible"
      >
        <div class="px-6 py-8 md:px-10 md:py-10">
          <!-- Logo -->
          <div class="flex justify-center mb-6">
            <div class="h-20 flex items-center justify-center">
              <img
                v-if="logoSrc"
                :src="logoSrc"
                alt="Logo"
                class="max-h-20 w-auto object-contain"
              />
              <div
                v-else
                class="h-20 w-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400"
              >
                <UIcon name="i-lucide-box" class="text-3xl" />
              </div>
            </div>
          </div>

          <!-- Title -->
          <div class="text-center mb-8">
            <h1
              class="text-3xl md:text-4xl font-bold tracking-tight text-slate-900"
            >
              {{ resolvedTitle }}
            </h1>
            <p
              class="mt-3 text-sm md:text-base text-slate-500 max-w-2xl mx-auto"
            >
              {{ resolvedSubtitle }}
            </p>
          </div>

          <!-- Search block -->
          <div class="relative w-full flex flex-col">
            <label class="mb-2 text-sm font-medium text-slate-700">
              Termék keresése
            </label>

            <div class="relative">
              <UIcon
                name="i-lucide-search"
                class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none"
              />

              <input
                v-model="searchTerm"
                type="text"
                class="w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-4 py-4 text-base md:text-lg text-slate-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:bg-slate-100"
                placeholder="Adj meg legalább 3 karaktert..."
                :disabled="selecting"
                @focus="if (!suppressOpen) isOpen = true;"
              />
            </div>

            <div class="mt-2 min-h-[24px]">
              <p v-if="error" class="text-sm text-red-500">
                {{ error }}
              </p>
              <p v-else class="text-xs text-slate-400">
                Példa: cikkszám, terméknév, részleges keresés
              </p>
            </div>

            <!-- Dropdown -->
            <div
              v-if="isOpen"
              tabindex="0"
              class="absolute top-full left-0 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 max-h-96 overflow-auto"
            >
              <!-- Loading -->
              <div
                v-if="loading"
                class="p-4 text-slate-500 flex items-center gap-3"
              >
                <UIcon class="animate-spin" name="i-lucide-loader-pinwheel" />
                Betöltés...
              </div>

              <!-- No results -->
              <div
                v-else-if="searchTerm.length < 3"
                class="p-4 text-slate-400 text-sm"
              >
                Kezdj el gépelni legalább 3 karaktert.
              </div>

              <div
                v-else-if="formattedItems.length === 0"
                class="p-4 text-slate-400 text-sm"
              >
                Nincs találat.
              </div>

              <!-- Results -->
              <div class="py-2">
                <div
                  v-for="(item, index) in formattedItems"
                  :key="item.id"
                  :data-item-index="index"
                  class="mx-2 rounded-xl px-4 py-3 transition"
                  :class="[
                    item.class,
                    index === highlightedIndex
                      ? 'bg-orange-500/10'
                      : 'hover:bg-slate-50',
                    item.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer',
                  ]"
                  @click="!item.disabled && selectItem(item)"
                  @mouseenter="highlightedIndex = index"
                >
                  <div class="font-semibold text-slate-900">
                    {{ item.PartNumber }}
                  </div>
                  <div class="text-sm text-slate-500">
                    {{ item.ProductDescription }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom helper -->
          <div
            class="mt-8 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4"
          >
            <div class="flex items-start gap-3">
              <UIcon
                name="i-lucide-info"
                class="text-slate-400 text-lg mt-0.5"
              />
              <div>
                <div class="text-sm font-medium text-slate-700">
                  Mit történik kiválasztás után?
                </div>
                <div class="text-sm text-slate-500 mt-1">
                  A rendszer betölti a PTR és FM termékfát, majd megnyitja az
                  információs oldalt.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Click outside backdrop helper -->
    <div v-if="isOpen" class="fixed inset-0 z-40" @click="isOpen = false" />
  </div>
</template>
