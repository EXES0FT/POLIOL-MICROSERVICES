<script setup lang="ts">
import type { Product } from '../../types/product.types';

const ptrProductTree = useState<Product | null>('ptrProductTree', () => null);
const fmProductTree = useState<Product | null>('fmProductTree', () => null);
const data = ref([
  {
    root_part_no: '040000',
    parent_part_no: null,
    part_no: '040000',
    lvl: 0,
    path: '|040000|',
    parent_part_description: null,
    component_part_description: 'Contec Food 1000 ml PE6 szerszám ÖÁ',
    qty_required_per_parent: null,
    cumulative_qty: 1,
    OperationNo: '10',
    resource: 'CUT01',
    setup_norm: '00:30:00',
    unit_op_norm: 0.25,
  },
  {
    root_part_no: '040000',
    parent_part_no: null,
    part_no: '040000',
    lvl: 0,
    path: '|040000|',
    parent_part_description: null,
    component_part_description: 'Contec Food 1000 ml PE6 szerszám ÖÁ',
    qty_required_per_parent: null,
    cumulative_qty: 1,
    OperationNo: '20',
    resource: 'CUT02',
    setup_norm: '00:30:00',
    unit_op_norm: 0.25,
  },
  {
    root_part_no: '040000',
    parent_part_no: '040000',
    part_no: '12492',
    lvl: 1,
    path: '|040000|12492|',
    parent_part_description: 'Contec Food 1000 ml PE6 szerszám ÖÁ',
    component_part_description: 'PE6-Uni zár 3xfenékfelfogó lap (74tõl)',
    qty_required_per_parent: 2,
    cumulative_qty: 2,
    OperationNo: '20',
    resource: 'WELD01',
    setup_norm: '00:10:00',
    unit_op_norm: 1.5,
  },
  {
    root_part_no: '040000',
    parent_part_no: '040000',
    part_no: '12493',
    lvl: 1,
    path: '|040000|12493|',
    parent_part_description: 'Contec Food 1000 ml PE6 szerszám ÖÁ',
    component_part_description: 'PE6-Uni zár 3xfenékfelfogó lap (74tõl)',
    qty_required_per_parent: 4,
    cumulative_qty: 4,
    OperationNo: '30',
    resource: 'WELD02',
    setup_norm: '00:20:00',
    unit_op_norm: 2.0,
  },
  {
    root_part_no: '040000',
    parent_part_no: '12493',
    part_no: '12494',
    lvl: 2,
    path: '|040000|12493|12494|',
    parent_part_description: 'Contec Food 1000 ml PE6 szerszám ÖÁ',
    component_part_description: 'PE6-Uni zár 3xfenékfelfogó lap (74tõl)',
    qty_required_per_parent: 2,
    cumulative_qty: 2,
    OperationNo: '30',
    resource: 'WELD02',
    setup_norm: '00:20:00',
    unit_op_norm: 2.0,
  },
]);
</script>
<template>
  <div class="h-screen w-screen flex">
    <div class="flex w-full items-center justify-center h-full p-6">
      <div class="flex flex-col overflow-auto h-full gap-6 w-1/2 min-w-0 pr-6">
        <h1 class="text-3xl font-bold">PTR állapot</h1>
        <div class="flex flex-col overflow-auto h-full gap-6 min-w-0">
          <TechnologyTreeTablePtr :rows="ptrProductTree" />
        </div>
      </div>

      <div
        class="flex flex-col h-full gap-6 w-1/2 min-w-0 border-l-2 border-default pl-6"
      >
        <h1 class="text-3xl font-bold">FACTORY állapot</h1>
        <div class="flex flex-col overflow-auto h-full gap-6 min-w-0">
          <TechnologyTreeTable :rows="fmProductTree" />
        </div>
      </div>
    </div>
  </div>
</template>
