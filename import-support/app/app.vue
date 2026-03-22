<script setup>
useHead({
  meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
  link: [{ rel: 'icon', href: '/favicon.ico' }],
  htmlAttrs: {
    lang: 'en',
  },
});

const title = 'Poliol gyártás támogatás';
const description = 'A Poliol gyártás támogatásához készült alkalmazás.';

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage: 'https://www.poliol.hu/poliol_logo.webp',
  twitterImage: 'https://www.poliol.hu/poliol_logo.webp',
  twitterCard: 'summary_large_image',
});
</script>

<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
