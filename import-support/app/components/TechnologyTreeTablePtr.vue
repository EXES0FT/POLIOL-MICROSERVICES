<script setup lang="ts">
import { computed, h, ref, resolveComponent } from 'vue';
import type { ExpandedState } from '@tanstack/vue-table';
import type { TableColumn } from '@nuxt/ui';

type TechnologyRow = {
  root_product_id: number | string;
  parent_product_id: number | string | null;
  product_id: number | string;
  product_qtt: number | null;
  product_name: string | null;
  lvl: number;
  path: string;
  manufactured: number | null;
  resource: string | null;
  process_group: string | null;
  raw_materials?: RawMaterial[] | string | null;
  process: string | null;
  unit_norm: number | string | null;
  sorrend: number | string | null;
};

type TreeNode = {
  id: string;
  root_product_id: string;
  parent_product_id: string | null;
  product_qtt?: number | null;
  product_id: string;
  raw_materials: RawMaterial[];
  product_name: string | null;
  lvl: number;
  path: string;
  manufactured: string | null;
  operations: Array<{
    resource: string | null;
    processGroup: string | null;
    process: string | null;
    unitNorm: number | null;
    sorrend: number | null;
  }>;
  children: TreeNode[];
  expandable: boolean;
};

type RawMaterial = {
  Anyag: string | null;
  Vagas: number | string | null;
  Darab: number | string | null;
  megjegyzes: string | null;
};

const props = defineProps<{
  rows: TechnologyRow[];
  loading?: boolean;
}>();

const UButton = resolveComponent('UButton');
const UBadge = resolveComponent('UBadge');
const UIcon = resolveComponent('UIcon');

const expanded = ref<ExpandedState>({});

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toId(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

const treeData = computed<TreeNode[]>(() => {
  const input = props.rows || [];

  const nodeMap = new Map<string, TreeNode>();
  const parentMap = new Map<string, string | null>();

  for (const row of input) {
    const key = String(row.product_id);

    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key,
        root_product_id: String(row.root_product_id),
        parent_product_id: toId(row.parent_product_id),
        product_name: row.product_name ?? null,
        product_id: String(row.product_id),
        product_qtt: row.product_qtt,
        raw_materials: parseRawMaterials(row.raw_materials),
        manufactured: row.manufactured === 1 ? 'MA' : 'BI',
        lvl: Number(row.lvl ?? 0),
        path: row.path,
        operations: [],
        children: [],
        expandable: true,
      });
    }

    const node = nodeMap.get(key)!;

    if (
      row.resource !== null ||
      row.process_group !== null ||
      row.process !== null ||
      row.unit_norm !== null ||
      row.sorrend !== null
    ) {
      const normalizedOperation = {
        resource: row.resource ?? null,
        processGroup: row.process_group ?? null,
        process: row.process ?? null,
        unitNorm: safeNumber(row.unit_norm),
        sorrend: safeNumber(row.sorrend),
      };

      const exists = node.operations.some(
        (op) =>
          String(op.resource ?? '') ===
            String(normalizedOperation.resource ?? '') &&
          String(op.processGroup ?? '') ===
            String(normalizedOperation.processGroup ?? '') &&
          String(op.process ?? '') ===
            String(normalizedOperation.process ?? '') &&
          Number(op.unitNorm ?? -1) ===
            Number(normalizedOperation.unitNorm ?? -1) &&
          Number(op.sorrend ?? -1) ===
            Number(normalizedOperation.sorrend ?? -1),
      );

      if (!exists) {
        node.operations.push(normalizedOperation);
      }
    }

    parentMap.set(key, toId(row.parent_product_id));
  }

  const roots: TreeNode[] = [];

  for (const [, node] of nodeMap) {
    const parentKey = parentMap.get(node.product_id);

    if (parentKey && nodeMap.has(parentKey)) {
      nodeMap.get(parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortRecursive = (nodes: TreeNode[]) => {
    nodes.sort((a, b) =>
      a.path.localeCompare(b.path, undefined, { numeric: true }),
    );

    for (const node of nodes) {
      node.operations.sort((a, b) => {
        const aOrder = a.sorrend ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.sorrend ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });

      sortRecursive(node.children);
    }
  };

  sortRecursive(roots);

  return roots;
});

function formatHoursToTime(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';

  const totalSeconds = Math.round(value * 3600);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, '0'))
    .join(':');
}

function getIndentPx(level: number) {
  return `${Math.max(0, level) * 20}px`;
}

function parseRawMaterials(value: unknown): RawMaterial[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => ({
      Anyag: item?.Anyag ?? null,
      Vagas: item?.Vagas ?? null,
      Darab: item?.Darab ?? null,
      megjegyzes: item?.megjegyzes ?? null,
    }));
  }

  if (typeof value !== 'string') return [];

  return value
    .split('##')
    .filter(Boolean)
    .map((row) => {
      const [Anyag, Vagas, Darab, megjegyzes] = row.split('||');

      return {
        Anyag: Anyag || null,
        Vagas: Vagas || null,
        Darab: Darab || null,
        megjegyzes: megjegyzes || null,
      };
    });
}

const columns: TableColumn<TreeNode>[] = [
  {
    id: 'product',
    header: 'Termék',
    cell: ({ row }) => {
      const original = row.original;
      const isExpanded = !!row.getIsExpanded?.();
      const indent = getIndentPx(original.lvl);

      return h(
        'div',
        {
          class: 'flex items-start min-w-0',
          style: { paddingLeft: indent },
        },
        [
          h(
            UButton,
            {
              color: 'black',
              variant: 'solid',
              size: 'xs',
              class: 'bg-stone-200 mr-3! mt-0.5 mr-1 shrink-0',
              icon: isExpanded ? 'i-lucide-minus' : 'i-lucide-plus',
              onClick: () => row.toggleExpanded?.(),
            },
            () => '',
          ),
          h('div', { class: 'min-w-0' }, [
            h(
              'div',
              { class: 'text-xl text-highlighted flex items-center gap-2' },
              [
                h('span', null, `${original.product_id}`),
                h(
                  UBadge,
                  {
                    class: [
                      original.manufactured === 'BI'
                        ? 'bg-yellow-400'
                        : 'bg-rose-400',
                      'text-black font-semibold',
                    ],
                    variant: 'solid',
                    size: 'xl',
                    label: original.manufactured,
                  },
                  () => original.manufactured,
                ),
              ],
            ),
            h(
              'div',
              { class: 'text-lg text-muted truncate max-w-[28rem]' },
              `${original.product_name ?? 'Nincs megnevezés'}`,
            ),
          ]),
        ],
      );
    },
  },
  {
    accessorKey: 'product_qtt',
    header: 'Mennyiség',
    meta: {
      class: {
        th: 'w-32 text-right',
        td: 'w-32 text-right font-medium',
      },
    },
    cell: ({ row }) => {
      const qtt = row.original.product_qtt;
      return qtt !== null && qtt !== undefined ? String(qtt) : '—';
    },
  },
  {
    accessorKey: 'lvl',
    header: 'Szint',
    meta: {
      class: {
        th: 'w-20',
        td: 'w-20',
      },
    },
    cell: ({ row }) =>
      h(UBadge, { color: 'neutral', variant: 'subtle' }, () =>
        String(row.original.lvl),
      ),
  },
  {
    id: 'operationsCount',
    header: 'Műveletek',
    meta: {
      class: {
        th: 'text-right w-28',
        td: 'text-right w-28 font-medium',
      },
    },
    cell: ({ row }) => String(row.original.operations.length),
  },
];
</script>

<template>
  <div class="space-y-4">
    <UTable
      :data="treeData"
      :columns="columns"
      :loading="loading"
      :get-row-id="(row: TreeNode) => row.id"
      :get-sub-rows="(row: TreeNode) => row.children"
      :state="{ expanded }"
      @update:state="(state) => (expanded = state.expanded ?? {})"
      sticky="header"
      class="flex-1"
      :ui="{
        td: 'align-top',
        th: 'whitespace-nowrap',
        tr: 'border-b border-default',
      }"
    >
      <template #expanded="{ row }">
        <div class="px-4 bg-elevated/40">
          <div class="gap-4">
            <div class="space-y-2">
              <div class="text-xs uppercase tracking-wide text-muted">
                műveletek
              </div>

              <div
                v-if="row.original.operations.length"
                class="rounded-lg border border-default overflow-hidden"
              >
                <table class="w-full text-sm">
                  <thead class="bg-elevated/60">
                    <tr>
                      <th class="text-left px-3 py-2">Sorrend</th>
                      <th class="text-left px-3 py-2">Műveletcsoport</th>
                      <th class="text-left px-3 py-2">Művelet</th>
                      <th class="text-left px-3 py-2">Erőforrás</th>
                      <th class="text-right px-3 py-2">Egység norma</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(op, index) in row.original.operations"
                      :key="`${row.original.id}-${index}-${op.sorrend}`"
                      class="border-t border-default"
                    >
                      <td class="px-3 py-2">{{ op.sorrend ?? '—' }}</td>
                      <td class="px-3 py-2">{{ op.processGroup ?? '—' }}</td>
                      <td class="px-3 py-2">{{ op.process ?? '—' }}</td>
                      <td class="px-3 py-2">{{ op.resource ?? '—' }}</td>
                      <td class="px-3 py-2 text-right">
                        {{ formatHoursToTime(op.unitNorm) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-else class="rounded-lg border border-default p-3 text-sm">
                <div class="font-medium mb-1">
                  Nincsenek műveletek ezen a terméken
                </div>
              </div>
            </div>
          </div>
          <div v-if="row.original.raw_materials.length" class="space-y-2 mt-4">
            <div class="text-xs uppercase tracking-wide text-muted">
              szokásos alapanyagok
            </div>

            <div class="rounded-lg border border-default overflow-hidden">
              <table class="w-full text-sm">
                <thead class="bg-elevated/60">
                  <tr>
                    <th class="text-left px-3 py-2">Anyag</th>
                    <th class="text-right px-3 py-2">Vágás</th>
                    <th class="text-right px-3 py-2">Darab</th>
                    <th class="text-left px-3 py-2">Megjegyzés</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(material, index) in row.original.raw_materials"
                    :key="`${row.original.id}-rm-${index}`"
                    class="border-t border-default"
                  >
                    <td class="px-3 py-2">{{ material.Anyag ?? '—' }}</td>
                    <td class="px-3 py-2 text-right">
                      {{ material.Vagas ?? '—' }}
                    </td>
                    <td class="px-3 py-2 text-right">
                      {{ material.Darab ?? '—' }}
                    </td>
                    <td class="px-3 py-2">{{ material.megjegyzes ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </template>
    </UTable>
  </div>
</template>
