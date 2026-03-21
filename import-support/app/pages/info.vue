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
  <div class="h-screen">
    <div class="flex items-center justify-center h-full p-6">
      <div class="w-full flex flex-col h-full gap-6">
        <h1 class="text-3xl font-bold">PTR állapot</h1>
        <TechnologyTreeTablePtr :rows="ptrProductTree" />
      </div>
      <div class="w-full flex flex-col h-full gap-6">
        <h1 class="text-3xl font-bold">FACTORY állapot</h1>
        <div class="w-full bg-gray-100 h-full rounded-lg p-4 overflow-auto">
          <TechnologyTreeTable :rows="fmProductTree" />
        </div>
      </div>
    </div>
  </div>
</template>
