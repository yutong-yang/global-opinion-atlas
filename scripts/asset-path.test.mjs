import assert from 'node:assert/strict';
import test from 'node:test';

import { withBasePath } from '../app/lib/asset-path.mjs';

test('prefixes data assets with the GitHub Pages repository path', () => {
  assert.equal(
    withBasePath('/data/articles.json', '/global-opinion-atlas/'),
    '/global-opinion-atlas/data/articles.json',
  );
});

test('keeps root deployments at the origin root', () => {
  assert.equal(withBasePath('/data/metadata.json', '/'), '/data/metadata.json');
});
