<script setup lang="ts">
import { computed, h, ref, resolveComponent } from 'vue';
import type { ExpandedState } from '@tanstack/vue-table';
import type { TableColumn } from '@nuxt/ui';

type RawMaterial = {
  component_part_no: string | null;
  component_part_description: string | null;
  dimension_1: string | null;
  dimension_2: string | null;
  dimension_3: string | null;
  raw_material_qty: string | null;
  qty_required_per_parent: number | string | null;
  material_condition: string | null;
  component_notes_1: string | null;
  component_notes_2: string | null;
  component_notes_3: string | null;
};

type TechnologyRow = {
  root_product_id: number | string;
  parent_product_id: number | string | null;
  product_id: number | string;
  product_qtt: number | null;
  product_name: string | null;
  lvl: number;
  path: string;
  manufactured: string | null;
  resource: string | null;
  process_group?: string | null;
  process?: string | null;
  process_no?: number | string | null;
  setup_norm?: number | string | null;
  unit_op_norm?: number | string | null;
  raw_materials_json?: RawMaterial[] | string | null;

  rm_form?: string | null;
  rm_specification?: string | null;
  rm_dimension_1?: string | null;
  rm_dimension_2?: string | null;
  rm_dimension_3?: string | null;

  stock_uom?: string | null;
  default_workshop?: string | null;
  default_receipt_location?: string | null;
  default_issue_location?: string | null;
  minimum_ebq?: number | string | null;
  man_lead_time?: number | string | null;
  product_group?: string | null;
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

  rm_form?: string | null;
  rm_specification?: string | null;
  rm_dimension_1?: string | null;
  rm_dimension_2?: string | null;
  rm_dimension_3?: string | null;

  stock_uom?: string | null;
  default_workshop?: string | null;
  default_receipt_location?: string | null;
  default_issue_location?: string | null;
  minimum_ebq?: number | null;
  man_lead_time?: number | null;
  product_group?: string | null;

  operations: Array<{
    processNo: number | null;
    resource: string | null;
    processGroup: string | null;
    process: string | null;
    setupNorm: number | null;
    unitNorm: number | null;
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

function parseRawMaterials(value: unknown): RawMaterial[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => ({
      component_part_no: item?.component_part_no ?? null,
      component_part_description: item?.component_part_description ?? null,
      dimension_1: item?.dimension_1 ?? null,
      dimension_2: item?.dimension_2 ?? null,
      dimension_3: item?.dimension_3 ?? null,
      raw_material_qty: item?.raw_material_qty ?? null,
      qty_required_per_parent: item?.qty_required_per_parent ?? null,
      material_condition: item?.material_condition ?? null,
      component_notes_1: item?.component_notes_1 ?? null,
      component_notes_2: item?.component_notes_2 ?? null,
      component_notes_3: item?.component_notes_3 ?? null,
    }));
  }

  if (typeof value !== 'string') return [];

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => ({
      component_part_no: item?.component_part_no ?? null,
      component_part_description: item?.component_part_description ?? null,
      dimension_1: item?.dimension_1 ?? null,
      dimension_2: item?.dimension_2 ?? null,
      dimension_3: item?.dimension_3 ?? null,
      raw_material_qty: item?.raw_material_qty ?? null,
      qty_required_per_parent: item?.qty_required_per_parent ?? null,
      material_condition: item?.material_condition ?? null,
      component_notes_1: item?.component_notes_1 ?? null,
      component_notes_2: item?.component_notes_2 ?? null,
      component_notes_3: item?.component_notes_3 ?? null,
    }));
  } catch {
    return [];
  }
}

function getRmDisplayName(node: TreeNode): string {
  const parts: string[] = [];

  if (node.rm_form) parts.push(node.rm_form);
  if (node.rm_specification) parts.push(node.rm_specification);

  const dimensions = [
    node.rm_dimension_1,
    node.rm_dimension_2,
    node.rm_dimension_3,
  ].filter(Boolean);

  if (dimensions.length) {
    parts.push(dimensions.join(' × '));
  }

  return parts.join(' · ') || 'Raw material';
}

function hasStockInfo(node: TreeNode) {
  return !!(
    node.stock_uom ||
    node.default_workshop ||
    node.default_receipt_location ||
    node.default_issue_location ||
    node.minimum_ebq !== null ||
    node.man_lead_time !== null ||
    node.product_group
  );
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
        raw_materials: parseRawMaterials(row.raw_materials_json),
        manufactured:
          row.manufactured === 'Manufactured'
            ? 'MA'
            : row.manufactured === 'Bought In'
              ? 'BI'
              : row.manufactured,
        lvl: Number(row.lvl ?? 0),
        path: row.path,

        rm_form: row.rm_form ?? null,
        rm_specification: row.rm_specification ?? null,
        rm_dimension_1: row.rm_dimension_1 ?? null,
        rm_dimension_2: row.rm_dimension_2 ?? null,
        rm_dimension_3: row.rm_dimension_3 ?? null,

        stock_uom: row.stock_uom ?? null,
        default_workshop: row.default_workshop ?? null,
        default_receipt_location: row.default_receipt_location ?? null,
        default_issue_location: row.default_issue_location ?? null,
        minimum_ebq: safeNumber(row.minimum_ebq),
        man_lead_time: safeNumber(row.man_lead_time),
        product_group: row.product_group ?? null,

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
      row.unit_op_norm !== null ||
      row.process_no !== null ||
      row.setup_norm !== null
    ) {
      const normalizedOperation = {
        processNo: safeNumber(row.process_no),
        resource: row.resource ?? null,
        processGroup: row.process_group ?? null,
        process: row.process ?? null,
        setupNorm: safeNumber(row.setup_norm),
        unitNorm: safeNumber(row.unit_op_norm),
      };

      const exists = node.operations.some(
        (op) =>
          Number(op.processNo ?? -1) ===
            Number(normalizedOperation.processNo ?? -1) &&
          String(op.resource ?? '') ===
            String(normalizedOperation.resource ?? '') &&
          String(op.processGroup ?? '') ===
            String(normalizedOperation.processGroup ?? '') &&
          String(op.process ?? '') ===
            String(normalizedOperation.process ?? '') &&
          Number(op.setupNorm ?? -1) ===
            Number(normalizedOperation.setupNorm ?? -1) &&
          Number(op.unitNorm ?? -1) ===
            Number(normalizedOperation.unitNorm ?? -1),
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
        const aOrder = a.processNo ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.processNo ?? Number.MAX_SAFE_INTEGER;
        return aOrder - bOrder;
      });

      sortRecursive(node.children);
    }
  };

  sortRecursive(roots);

  return roots;
});

const flatRows = computed<TreeNode[]>(() => {
  const result: TreeNode[] = [];

  const walk = (nodes: TreeNode[]) => {
    for (const node of nodes) {
      result.push(node);
      if (node.children?.length) {
        walk(node.children);
      }
    }
  };

  walk(treeData.value);

  return result;
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

const columns: TableColumn<TreeNode>[] = [
  {
    id: 'product',
    header: 'Termék',
    cell: ({ row }) => {
      const original = row.original;
      const isExpanded = !!row.getIsExpanded?.();
      const indent = getIndentPx(original.lvl);
      const secondaryLine =
        original.manufactured === 'RM'
          ? getRmDisplayName(original)
          : (original.product_name ?? 'Nincs megnevezés');

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
              {
                class:
                  'text-xl text-highlighted flex items-center gap-2 min-w-0',
              },
              [
                h(
                  'span',
                  { class: 'truncate min-w-0' },
                  `${original.product_id}`,
                ),
                h(
                  UBadge,
                  {
                    class: [
                      original.manufactured === 'BI'
                        ? 'bg-yellow-400'
                        : original.manufactured === 'MA'
                          ? 'bg-rose-400'
                          : 'bg-purple-400',
                      'text-black font-semibold shrink-0',
                    ],
                    variant: 'solid',
                    size: 'xl',
                    label: original.manufactured,
                  },
                  () => original.manufactured ?? '—',
                ),
              ],
            ),
            h(
              'div',
              { class: 'text-lg text-muted break-words max-w-[28rem]' },
              secondaryLine,
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
  <div class="space-y-4 min-w-0">
    <UTable
      :data="flatRows"
      :columns="columns"
      :loading="loading"
      :get-row-id="(row: TreeNode) => row.id"
      :state="{ expanded }"
      @update:state="(state) => (expanded = state.expanded ?? {})"
      sticky="header"
      class="flex-1 min-w-0"
      :ui="{
        td: 'align-top',
        th: 'whitespace-normal',
        tr: 'border-b border-default',
      }"
    >
      <template #expanded="{ row }">
        <div class="px-4 py-4 bg-elevated/40 min-w-0">
          <div class="space-y-4 min-w-0">
            <div
              v-if="
                !row.original.manufactured || row.original.manufactured !== 'RM'
              "
              class="space-y-2 min-w-0"
            >
              <div class="text-xs uppercase tracking-wide text-muted">
                Törzsadatok
              </div>

              <div
                class="rounded-lg border border-default divide-y divide-default min-w-0"
              >
                <div
                  class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 px-3 py-3 text-sm min-w-0"
                >
                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">M.E.</div>
                    <div class="break-words">
                      {{ row.original.stock_uom ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">Műhely</div>
                    <div class="break-words">
                      {{ row.original.default_workshop ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">Bevételi tárhely</div>
                    <div class="break-words">
                      {{ row.original.default_receipt_location ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">Kiadási tárhely</div>
                    <div class="break-words">
                      {{ row.original.default_issue_location ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">Minimum EBQ</div>
                    <div class="break-words">
                      {{ row.original.minimum_ebq ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">M.A. átfutási idő</div>
                    <div class="break-words">
                      {{ row.original.man_lead_time ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted mb-1">Termékcsoport</div>
                    <div class="break-words">
                      {{ row.original.product_group ?? '—' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-2 min-w-0">
              <div class="text-xs uppercase tracking-wide text-muted">
                Műveletek
              </div>

              <div
                v-if="row.original.operations.length"
                class="rounded-lg border border-default divide-y divide-default min-w-0"
              >
                <div
                  class="hidden md:grid grid-cols-4 gap-3 px-3 py-2 bg-elevated/60 text-sm font-medium"
                >
                  <div class="min-w-0">Műveletszám</div>
                  <div class="min-w-0">Erőforrás</div>
                  <div class="min-w-0 text-right">Beállási norma</div>
                  <div class="min-w-0 text-right">Egység norma</div>
                </div>

                <div
                  v-for="(op, index) in row.original.operations"
                  :key="`${row.original.id}-${index}-${op.processNo}`"
                  class="grid grid-cols-1 md:grid-cols-4 gap-3 px-3 py-3 text-sm min-w-0"
                >
                  <div class="min-w-0">
                    <div class="text-xs text-muted md:hidden mb-1">
                      Műveletszám
                    </div>
                    <div class="break-words">
                      {{ op.processNo ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0">
                    <div class="text-xs text-muted md:hidden mb-1">
                      Erőforrás
                    </div>
                    <div class="break-words">
                      {{ op.resource ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0 md:text-right">
                    <div class="text-xs text-muted md:hidden mb-1">
                      Beállási norma
                    </div>
                    <div class="break-words">
                      {{ op.setupNorm ?? '—' }}
                    </div>
                  </div>

                  <div class="min-w-0 md:text-right">
                    <div class="text-xs text-muted md:hidden mb-1">
                      Egység norma
                    </div>
                    <div class="break-words">
                      {{ formatHoursToTime(op.unitNorm) }}
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="rounded-lg border border-default p-3 text-sm">
                <div class="font-medium mb-1">
                  Nincsenek műveletek ezen a terméken
                </div>
              </div>
            </div>

            <div
              v-if="row.original.raw_materials.length"
              class="space-y-2 min-w-0"
            >
              <div class="text-xs uppercase tracking-wide text-muted">
                Alapanyagok
              </div>

              <div
                class="rounded-lg border border-default divide-y divide-default min-w-0"
              >
                <div
                  v-for="(material, index) in row.original.raw_materials"
                  :key="`${row.original.id}-rm-${index}`"
                  class="p-3 min-w-0"
                >
                  <div
                    class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-3 text-sm min-w-0"
                  >
                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Anyagkód</div>
                      <div class="break-all">
                        {{ material.component_part_no ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Megnevezés</div>
                      <div class="break-words">
                        {{ material.component_part_description ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Állapot</div>
                      <div class="break-words">
                        {{ material.material_condition ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Méret 1</div>
                      <div class="break-words">
                        {{ material.dimension_1 ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Méret 2</div>
                      <div class="break-words">
                        {{ material.dimension_2 ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Méret 3</div>
                      <div class="break-words">
                        {{ material.dimension_3 ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">RM menny.</div>
                      <div class="break-words">
                        {{ material.raw_material_qty ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Szüks. menny.</div>
                      <div class="break-words">
                        {{ material.qty_required_per_parent ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Megjegyzés 1</div>
                      <div class="break-words">
                        {{ material.component_notes_1 ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Megjegyzés 2</div>
                      <div class="break-words">
                        {{ material.component_notes_2 ?? '—' }}
                      </div>
                    </div>

                    <div class="min-w-0">
                      <div class="text-xs text-muted mb-1">Megjegyzés 3</div>
                      <div class="break-words">
                        {{ material.component_notes_3 ?? '—' }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UTable>
  </div>
</template>
