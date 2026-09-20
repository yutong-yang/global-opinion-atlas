import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {streamChat} from './lib/llm';
import type {Article} from './lib/data';
import Dashboard from './Dashboard';

vi.mock('./lib/llm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/llm')>();
  return {...actual, streamChat: vi.fn()};
});

const streamChatMock = vi.mocked(streamChat);

const art = (p: Partial<Article> & {country: string}): Article => ({
  rowNumber: 0, articleId: p.country, url: null, title: `报道 ${p.country}`, lead: null,
  matchedSentence: null, keywordSentence: null, iso3: null, region: null,
  state: null, city: null, language: 'English', sentiment: 'neutral', sourceName: null,
  sourceDomain: null, reach: null, engagement: null, publishTime: '10:00', queryKeywords: null,
  ...p,
});

const articles: Article[] = [
  art({rowNumber: 1, country: 'United States', iso3: 'USA', sentiment: 'positive', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 1000, publishTime: '10:15', queryKeywords: 'TikTok'}),
  art({rowNumber: 2, country: 'United States', iso3: 'USA', sentiment: 'neutral', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 2000, publishTime: '10:20', queryKeywords: 'TikTok'}),
  art({rowNumber: 3, country: 'United States', iso3: 'USA', sentiment: 'negative', sourceDomain: 'nypost.com', sourceName: 'New York Post', reach: 500, publishTime: '11:00', queryKeywords: 'TikTok'}),
  art({rowNumber: 4, country: 'United States', iso3: 'USA', sentiment: 'neutral', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 800, publishTime: '11:30', queryKeywords: 'Xiaohongshu'}),
  art({rowNumber: 5, country: 'United States', iso3: 'USA', sentiment: 'positive', sourceDomain: 'nypost.com', sourceName: 'New York Post', reach: 700, publishTime: '12:00', queryKeywords: 'TikTok'}),
  art({rowNumber: 6, country: 'United States', iso3: 'USA', sentiment: 'neutral', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 900, publishTime: '12:30', queryKeywords: 'Xiaohongshu'}),
  art({rowNumber: 7, country: 'India', iso3: 'IND', sentiment: 'neutral', sourceDomain: 'nypost.com', sourceName: 'New York Post', reach: 600, publishTime: '09:00', queryKeywords: 'TikTok'}),
  art({rowNumber: 8, country: 'India', iso3: 'IND', sentiment: 'positive', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 400, publishTime: '09:30', queryKeywords: 'TikTok'}),
  art({rowNumber: 9, country: 'India', iso3: 'IND', sentiment: 'neutral', sourceDomain: 'nypost.com', sourceName: 'New York Post', reach: 300, publishTime: '13:00', queryKeywords: 'Xiaohongshu'}),
  art({rowNumber: 10, country: 'India', iso3: 'IND', sentiment: 'unknown', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 200, publishTime: '13:30', queryKeywords: 'TikTok'}),
  art({rowNumber: 11, country: 'Indonesia', iso3: 'IDN', sentiment: 'neutral', sourceDomain: 'msn.com', sourceName: 'MSN', reach: 100, publishTime: '14:00', queryKeywords: 'TikTok'}),
  art({rowNumber: 12, country: 'Indonesia', iso3: 'IDN', sentiment: 'neutral', sourceDomain: 'nypost.com', sourceName: 'New York Post', reach: 150, publishTime: '14:30', queryKeywords: 'refugees'}),
];

beforeEach(() => {
  localStorage.clear();
  streamChatMock.mockReset();
  vi.stubGlobal('ResizeObserver', class {observe() {} unobserve() {} disconnect() {}});
  vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
    const u = String(url);
    const payload = u.includes('metadata') ? {articleCount: articles.length, countryCount: 3} : articles;
    return {json: async () => payload};
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Dashboard agent linkage', () => {
  it('grounds the prompt in real aggregates and applies the first marker as a filter', async () => {
    streamChatMock.mockResolvedValue('报道最多的是美国，其次是印度。【定位:国家:美国】');
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByText(/正在准备/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', {name: '打开 AI 助手'}));
    fireEvent.change(screen.getByLabelText('API Key'), {target: {value: 'sk-abc'}});
    fireEvent.change(screen.getByLabelText('输入消息'), {target: {value: '哪些国家报道最多？'}});
    fireEvent.keyDown(screen.getByLabelText('输入消息'), {key: 'Enter'});

    await waitFor(() => expect(streamChatMock).toHaveBeenCalledTimes(1));
    const prompt = streamChatMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('国家 Top10：美国 6 · 印度 4 · 印度尼西亚 2（按报道量）');
    expect(prompt).toContain('【定位:国家:美国】');

    const bubble = await waitFor(() => {
      const el = document.querySelector('.agent-msg.assistant');
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(bubble.textContent).toBe('报道最多的是美国，其次是印度。');

    await waitFor(() => expect(screen.getByLabelText('移除 美国')).toBeInTheDocument());
    expect(screen.queryByLabelText('移除 印度')).not.toBeInTheDocument();
    expect(screen.queryByText(/当前筛选组合无命中报道/)).not.toBeInTheDocument();

    const chip = Array.from(bubble.querySelectorAll('button')).find((b) => b.textContent === '印度');
    expect(chip).toBeTruthy();
    fireEvent.click(chip as HTMLElement);
    await waitFor(() => expect(screen.getByLabelText('移除 印度')).toBeInTheDocument());
    expect(screen.queryByLabelText('移除 美国')).not.toBeInTheDocument();
  });

  it('把热榜与口径规则注入 prompt', async () => {
    streamChatMock.mockResolvedValue('最热的是美国相关报道。');
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByText(/正在准备/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', {name: '打开 AI 助手'}));
    fireEvent.change(screen.getByLabelText('API Key'), {target: {value: 'sk-abc'}});
    fireEvent.change(screen.getByLabelText('输入消息'), {target: {value: '哪个题目最热？'}});
    fireEvent.keyDown(screen.getByLabelText('输入消息'), {key: 'Enter'});

    await waitFor(() => expect(streamChatMock).toHaveBeenCalledTimes(1));
    const prompt = streamChatMock.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('【热榜 Top10】（按跨媒体转载广度排序）');
    expect(prompt).toContain('1. 报道 United States · 2 家媒体 6 篇 · 峰值 10:00');
    expect(prompt).toContain('热度=报道媒体数（跨媒体转载广度），不是单帖点赞数');
  });

  it('点击热榜行应用通稿筛选并切回证据列表', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.queryByText(/正在准备/)).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', {name: /热榜/}));
    const rows = document.querySelectorAll('.hot-row');
    expect(rows).toHaveLength(3);
    fireEvent.click(rows[0]);

    await waitFor(() => expect(screen.getByLabelText('移除 通稿·报道 United States')).toBeInTheDocument());
    expect(screen.getByRole('tab', {name: /文章证据/})).toHaveAttribute('aria-selected', 'true');
  });
});
