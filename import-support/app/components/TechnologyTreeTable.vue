<script setup lang="ts">
import { computed, h, ref, resolveComponent } from 'vue';
import type { ExpandedState } from '@tanstack/vue-table';
import type { TableColumn } from '@nuxt/ui';

type TechnologyRow = {
  root_part_no: string;
  parent_part_no: string | null;
  part_no: string;
  lvl: number;
  path: string;
  parent_part_description: string | null;
  component_part_description: string | null;
  qty_required_per_parent: number | null;
  cumulative_qty: number | null;
  OperationNo: string | number | null;
  resource: string | null;
  setup_norm: string | number | null;
  unit_op_norm: number | null;
};

type TreeNode = {
  id: string;
  root_part_no: string;
  parent_part_no: string | null;
  part_no: string;
  lvl: number;
  path: string;
  parent_part_description: string | null;
  component_part_description: string | null;
  qty_required_per_parent: number | null;
  cumulative_qty: number | null;
  operations: Array<{
    operationNo: string | number | null;
    resource: string | null;
    setupNorm: string | number | null;
    unitOpNorm: number | null;
  }>;
  children: TreeNode[];
  expandable: boolean;
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

function normalizeOperationNo(row: Record<string, any>) {
  return row.OperationNo ?? row['Operation No'] ?? null;
}

function normalizeRows(rows: TechnologyRow[]) {
  return rows.map((row: any) => ({
    ...row,
    OperationNo: normalizeOperationNo(row),
  }));
}

const treeData = computed<TreeNode[]>(() => {
  const input = normalizeRows(props.rows || []);

  const nodeMap = new Map<string, TreeNode>();
  const parentMap = new Map<string, string | null>();

  for (const row of input) {
    const key = String(row.part_no);

    if (!nodeMap.has(key)) {
      nodeMap.set(key, {
        id: key,
        root_part_no: row.root_part_no,
        parent_part_no: row.parent_part_no ?? null,
        part_no: row.part_no,
        lvl: row.lvl,
        path: row.path,
        parent_part_description: row.parent_part_description ?? null,
        component_part_description: row.component_part_description ?? null,
        qty_required_per_parent: safeNumber(row.qty_required_per_parent),
        cumulative_qty: safeNumber(row.cumulative_qty),
        operations: [],
        children: [],
        expandable: true,
      });
    }

    const node = nodeMap.get(key)!;

    if (
      row.OperationNo !== null ||
      row.resource ||
      row.setup_norm ||
      row.unit_op_norm !== null
    ) {
      const exists = node.operations.some(
        (op) =>
          String(op.operationNo ?? '') === String(row.OperationNo ?? '') &&
          String(op.resource ?? '') === String(row.resource ?? '') &&
          Number(op.unitOpNorm ?? -1) === Number(row.unit_op_norm ?? -1),
      );

      if (!exists) {
        node.operations.push({
          operationNo: row.OperationNo,
          resource: row.resource ?? null,
          setupNorm: row.setup_norm ?? null,
          unitOpNorm: safeNumber(row.unit_op_norm),
        });
      }
    }

    parentMap.set(key, row.parent_part_no ?? null);
  }

  const roots: TreeNode[] = [];

  for (const [, node] of nodeMap) {
    const parentKey = parentMap.get(node.part_no);

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
      sortRecursive(node.children);
      node.operations.sort((a, b) =>
        String(a.operationNo ?? '').localeCompare(
          String(b.operationNo ?? ''),
          undefined,
          { numeric: true },
        ),
      );
    }
  };

  sortRecursive(roots);

  return roots;
});

function formatNumber(value: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function getIndentPx(level: number) {
  return `${Math.max(0, level) * 20}px`;
}

const columns: TableColumn<TreeNode>[] = [
  {
    id: 'part',
    header: 'Part',
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
              color: 'neutral',
              variant: 'ghost',
              size: 'xs',
              class: 'mt-0.5 mr-1 shrink-0',
              icon: isExpanded
                ? 'i-lucide-chevron-down'
                : 'i-lucide-chevron-right',
              onClick: () => row.toggleExpanded?.(),
            },
            () => '',
          ),
          h('div', { class: 'min-w-0' }, [
            h(
              'div',
              { class: 'font-medium text-highlighted flex items-center gap-2' },
              [
                original.lvl > 0
                  ? h(UIcon, {
                      name: 'i-lucide-corner-down-right',
                      class: 'size-4 text-muted shrink-0',
                    })
                  : null,
                h('span', null, original.part_no),
              ],
            ),
            h(
              'div',
              { class: 'text-xs text-muted truncate max-w-[28rem]' },
              original.component_part_description ||
                original.parent_part_description ||
                'No description',
            ),
          ]),
        ],
      );
    },
  },
  {
    accessorKey: 'lvl',
    header: 'Level',
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
    accessorKey: 'qty_required_per_parent',
    header: 'Qty / Parent',
    meta: {
      class: {
        th: 'text-right w-32',
        td: 'text-right w-32',
      },
    },
    cell: ({ row }) => formatNumber(row.original.qty_required_per_parent, 4),
  },
  {
    accessorKey: 'cumulative_qty',
    header: 'Cumulative Qty',
    meta: {
      class: {
        th: 'text-right w-32',
        td: 'text-right w-32 font-medium',
      },
    },
    cell: ({ row }) => formatNumber(row.original.cumulative_qty, 4),
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
        <div class="p-4 bg-elevated/40 border-t border-default">
          <div class="grid gap-4 lg:grid-cols-2">
            <div class="space-y-2">
              <div class="text-xs uppercase tracking-wide text-muted">
                termék adatok
              </div>
              <div
                class="rounded-lg border border-default p-3 space-y-1 text-sm"
              >
                <div>
                  <span class="text-muted">Cikkszám:</span>
                  {{ row.original.part_no }}
                </div>
                <div>
                  <span class="text-muted">Szülő termék:</span>
                  {{ row.original.parent_part_no || '—' }}
                </div>
                <div>
                  <span class="text-muted">Útvonal:</span>
                  {{ row.original.path }}
                </div>
                <div>
                  <span class="text-muted">Leírás:</span>
                  {{
                    row.original.component_part_description ||
                    row.original.parent_part_description ||
                    '—'
                  }}
                </div>
                <div>
                  <span class="text-muted">Qty / Parent:</span>
                  {{ formatNumber(row.original.qty_required_per_parent, 4) }}
                </div>
                <div>
                  <span class="text-muted">Cumulative Qty:</span>
                  {{ formatNumber(row.original.cumulative_qty, 4) }}
                </div>
                <div>
                  <span class="text-muted">Level:</span> {{ row.original.lvl }}
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="text-xs uppercase tracking-wide text-muted">
                Operations
              </div>

              <div
                v-if="row.original.operations.length"
                class="rounded-lg border border-default overflow-hidden"
              >
                <table class="w-full text-sm">
                  <thead class="bg-elevated/60">
                    <tr>
                      <th class="text-left px-3 py-2">Op No</th>
                      <th class="text-left px-3 py-2">Resource</th>
                      <th class="text-left px-3 py-2">Setup</th>
                      <th class="text-right px-3 py-2">Unit Norm</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(op, index) in row.original.operations"
                      :key="`${row.original.id}-${index}-${op.operationNo}`"
                      class="border-t border-default"
                    >
                      <td class="px-3 py-2">{{ op.operationNo ?? '—' }}</td>
                      <td class="px-3 py-2">{{ op.resource ?? '—' }}</td>
                      <td class="px-3 py-2">{{ op.setupNorm ?? '—' }}</td>
                      <td class="px-3 py-2 text-right">
                        {{ formatNumber(op.unitOpNorm, 4) }}
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
        </div>
      </template>
    </UTable>
  </div>
</template>
