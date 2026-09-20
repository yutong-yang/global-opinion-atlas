import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';

import type {Article, HotStory} from '../lib/data';
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

const hot: HotStory[] = [
  {key: 'viral', title: 'TikTok Refugees Say They Have No Home', articles: 3, outlets: 3, countries: 2, positive: 1, neutral: 2, negative: 0, unknown: 0, engagement: 10, peakHour: 15},
  {key: 'calm', title: 'A Quieter Story', articles: 2, outlets: 2, countries: 1, positive: 0, neutral: 2, negative: 0, unknown: 0, engagement: 0, peakHour: 9},
];

afterEach(cleanup);

describe('EvidencePanel hot ranking tab', () => {
  it('defaults to the evidence list and switches to the hot ranking on tab click', () => {
    render(
      <EvidencePanel
        articles={[mk({title: 'Evidence A'})]}
        platforms={null}
        hot={hot}
        onOpen={() => undefined}
        onSelectStory={() => undefined}
      />,
    );
    expect(screen.getByText('Evidence A')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', {name: /热榜/}));
    expect(screen.getByText('TikTok Refugees Say They Have No Home')).toBeInTheDocument();
    expect(screen.getByText(/3 家媒体 · 3 篇 · 峰值 15:00/)).toBeInTheDocument();
    expect(screen.queryByText('Evidence A')).not.toBeInTheDocument();
  });

  it('applies the story filter and returns to the evidence tab when a hot row is clicked', () => {
    const onSelectStory = vi.fn();
    render(
      <EvidencePanel
        articles={[mk({title: 'Evidence A'})]}
        platforms={null}
        hot={hot}
        onOpen={() => undefined}
        onSelectStory={onSelectStory}
      />,
    );
    fireEvent.click(screen.getByRole('tab', {name: /热榜/}));
    fireEvent.click(screen.getByText('A Quieter Story'));
    expect(onSelectStory).toHaveBeenCalledWith('calm', 'A Quieter Story');
    expect(screen.getByRole('tab', {name: /文章证据/})).toHaveAttribute('aria-selected', 'true');
  });

  it('shows an empty note when the current selection has nothing to rank', () => {
    render(
      <EvidencePanel
        articles={[mk({title: 'Evidence A'})]}
        platforms={null}
        hot={[]}
        onOpen={() => undefined}
        onSelectStory={() => undefined}
      />,
    );
    fireEvent.click(screen.getByRole('tab', {name: /热榜/}));
    expect(screen.getByText('当前筛选下没有可排名的同题报道')).toBeInTheDocument();
  });
});
