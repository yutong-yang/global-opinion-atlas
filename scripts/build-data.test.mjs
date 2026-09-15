import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDataset } from './build-data.mjs';

const workbookPath = '../TikTok难民涌入小红书 2025.01.15外媒数据.xlsx';

test('preserves every source row, country, and duplicate source columns', async () => {
  const result = await buildDataset(workbookPath);
  assert.equal(result.articles.length, 5543);
  assert.equal(result.metadata.countryCount, 114);
  assert.deepEqual(result.metadata.duplicateHeaders['来源类别'], [6, 7]);
  assert.ok(result.articles.every((row) => 'sourceCategory1' in row && 'sourceCategory2' in row));
});

test('country totals reconcile and missing metrics remain null', async () => {
  const result = await buildDataset(workbookPath);
  assert.equal(result.countries.reduce((sum, row) => sum + row.mentions, 0), 5543);
  assert.ok(result.articles.some((row) => row.engagement === null));
  assert.ok(result.articles.some((row) => row.reach === 0));
});
