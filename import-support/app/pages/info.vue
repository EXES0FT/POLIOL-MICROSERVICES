<script setup>
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
      <div class="w-full flex flex-col">
        <h1 class="text-3xl font-bold">PTR állapot</h1>
        <TechnologyTreeTable :rows="data" />
      </div>
      <div class="w-full bg-green-500 h-full">JOBB OLDAL</div>
    </div>
  </div>
</template>
