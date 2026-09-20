import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';

import type {Article} from '../lib/data';
import EvidencePanel from './EvidencePanel';

let seq = 0;
const mk = (over: Partial<Article>): Article => ({
  rowNumber: ++seq,
  articleId: String(seq),
  url: null,
  title: null,
  lead: null,
  matchedSentence: null,
  keywordSentence: null,
  country: 'United States',
  iso3: 'USA',
  region: null,
  state: null,
  city: null,
  language: 'English',
  sentiment: 'neutral',
  sourceName: null,
  sourceDomain: null,
  reach: 10,
  engagement: null,
  publishTime: '12:00',
  queryKeywords: null,
  ...over,
});

afterEach(cleanup);

describe('EvidencePanel', () => {
  it('shows the evidence list with articles', () => {
    render(
      <EvidencePanel
        articles={[mk({title: 'Evidence A'})]}
        platforms={null}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText('Evidence A')).toBeInTheDocument();
    expect(screen.getByText(/文章证据/)).toBeInTheDocument();
  });

  it('shows an empty note when there are no articles', () => {
    render(
      <EvidencePanel
        articles={[]}
        platforms={null}
        onOpen={() => undefined}
      />,
    );
    expect(screen.getByText('当前筛选条件下没有匹配报道')).toBeInTheDocument();
  });
});
