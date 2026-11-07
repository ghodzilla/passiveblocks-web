import { downloadPrices } from './run-replay';

downloadPrices().catch((error) => {
  console.error(error instanceof Error ? error.message : 'price download failed');
  process.exit(1);
});
