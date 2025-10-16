import adapter from '@sveltejs/adapter-auto';

const config = {
  kit: {
    adapter,
    alias: {
      $components: 'src/lib/components'
    }
  }
};

export default config;
