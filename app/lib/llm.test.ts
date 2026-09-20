// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';

import {DEFAULT_PROVIDER, PROVIDERS, buildSystemPrompt, providerById, streamChat} from './llm';

const encoder = new TextEncoder();

function sseStream(parts: (string | Uint8Array)[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(typeof part === 'string' ? encoder.encode(part) : part);
      controller.close();
    },
  });
}

function sseResponse(parts: (string | Uint8Array)[], status = 200, errorMessage = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: status === 200 ? sseStream(parts) : null,
    json: async () => ({error: {message: errorMessage}}),
  } as unknown as Response;
}

const baseContext = {
  country: null, sentiment: null, language: null,
  source: null, story: null, query: '', hours: [0, 23] as [number, number],
  articleCount: 0, reach: 0, countryCount: 0, totalCount: 5543,
  topCountries: [], topSources: [],
  sentimentTotals: {positive: 0, neutral: 0, negative: 0, unknown: 0},
  peak: null,
  hotStories: [], topEntities: [], mediaInfluence: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('providers', () => {
  it('defaults to qwen with dashscope compatible endpoint', () => {
    expect(DEFAULT_PROVIDER).toBe('qwen');
    expect(PROVIDERS[0].id).toBe('qwen');
    const qwen = providerById('qwen');
    expect(qwen.baseUrl).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1');
    expect(qwen.models.map((m) => m.id)).toContain('qwen-plus');
    expect(qwen.defaultModel).toBe('qwen-plus');
  });

  it('covers deepseek, openai and a custom endpoint', () => {
    expect(providerById('deepseek').baseUrl).toBe('https://api.deepseek.com/v1');
    expect(providerById('openai').baseUrl).toBe('https://api.openai.com/v1');
    expect(providerById('deepseek').models.map((m) => m.id)).toContain('deepseek-chat');
    const custom = providerById('custom');
    expect(custom.baseUrl).toBe('');
    expect(custom.models).toEqual([]);
  });
});

describe('buildSystemPrompt', () => {
  it('lists active filters with zh labels and the time window', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      country: 'US', sentiment: 'positive',
      language: 'en', source: 'BBC', story: '通稿标题', query: 'ban',
      hours: [9, 12], articleCount: 1200, reach: 3400000, countryCount: 20,
    });
    expect(prompt).toContain('正面');
    expect(prompt).toContain('BBC');
    expect(prompt).toContain('通稿标题');
    expect(prompt).toContain('ban');
    expect(prompt).toContain('09:00–12:59');
    expect(prompt).toContain('1,200');
    expect(prompt).toContain('20');
    expect(prompt).toContain('不要编造');
  });

  it('falls back to a whole-day note when nothing is filtered', () => {
    const prompt = buildSystemPrompt({...baseContext, articleCount: 5543, reach: 81000000, countryCount: 87});
    expect(prompt).toContain('未设置筛选');
    expect(prompt).toContain('00:00–23:59');
    expect(prompt).toContain('5,543');
  });

  it('summarizes the view overview so ranking questions are answerable', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      topCountries: [
        {country: '美国', mentions: 412, reach: 1200000},
        {country: '印度', mentions: 208, reach: 600000},
      ],
      topSources: [
        {source: 'nypost.com', mentions: 87},
        {source: 'reuters.com', mentions: 52},
      ],
      sentimentTotals: {positive: 1890, neutral: 2010, negative: 1201, unknown: 442},
      peak: {hour: 15, count: 216},
    });
    expect(prompt).toContain('【视图概览】');
    expect(prompt).toContain('国家 Top10：美国 412');
    expect(prompt).toContain('媒体 Top8：nypost.com 87');
    expect(prompt).toContain('情感分布：');
    expect(prompt).toContain('正面 1,890');
    expect(prompt).toContain('负面 1,201');
    expect(prompt).toContain('峰值小时：15:00–15:59（216 篇）');
    expect(prompt).toContain('直接基于【视图概览】');
    expect(prompt).toContain('【定位:国家:美国】');
    expect(prompt).toContain('【定位:小时:15】');
    expect(prompt).toContain('提到【视图概览】中的国家、媒体、情感时，在实体后插入对应定位标记');
    expect(prompt).not.toContain('一条回答最多 1 个定位标记');
  });

  it('falls back to a note when the current selection has nothing to summarize', () => {
    const prompt = buildSystemPrompt({...baseContext});
    expect(prompt).toContain('当前筛选下暂无可汇总数据');
    expect(prompt).not.toContain('国家 Top10：');
    expect(prompt).toContain('【热榜】当前筛选下无数据');
    expect(prompt).toContain('【高频实体】当前筛选下无数据');
    expect(prompt).toContain('【媒体影响力】当前筛选下无数据');
  });

  it('renders the hot ranking so heat questions are answerable with the right caliber', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      hotStories: [
        {key: 'k1', title: 'TikTok Refugees Say They Have No Home', outlets: 42, articles: 60, peakHour: 15},
        {key: 'k2', title: 'RedNote Downloads Spike', outlets: 9, articles: 11, peakHour: 10},
      ],
    });
    expect(prompt).toContain('【热榜 Top10】');
    expect(prompt).toContain('1. TikTok Refugees Say They Have No Home · 42 家媒体 60 篇');
    expect(prompt).toContain('2. RedNote Downloads Spike · 9 家媒体 11 篇');
    expect(prompt).toContain('峰值 15:00');
    expect(prompt).toContain('热度=报道媒体数（跨媒体转载广度），不是单帖点赞数');
  });

  it('renders top entities and deduplicated media influence blocks', () => {
    const prompt = buildSystemPrompt({
      ...baseContext,
      topEntities: [
        {entity: 'biden administration', articles: 320},
        {entity: 'american netizens', articles: 210},
      ],
      mediaInfluence: [
        {domain: 'msn.com', name: 'MSN', reach: 146295232, articles: 812},
      ],
    });
    expect(prompt).toContain('【高频实体 Top20】');
    expect(prompt).toContain('biden administration 320');
    expect(prompt).toContain('【媒体影响力 Top10】');
    expect(prompt).toContain('msn.com 触达约 1.5亿');
    expect(prompt).toContain('reach 已按媒体去重');
  });
});

describe('streamChat', () => {
  it('streams deltas, calls onDelta per piece and returns the full text', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"role":"assistant"},"index":0}]}\n\nevent: message\n\n: ping\n\n',
      'data: {"choices":[{"delta":{"content":"你好"},"index":0}]}\n\n',
      'data: {"choices":[{"delta":{"content":"世界"},"index":0}]}\n\n',
      'data: [DONE]\n\n',
    ];
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(chunks));
    vi.stubGlobal('fetch', fetchMock);

    const deltas: string[] = [];
    const text = await streamChat({
      provider: providerById('qwen'), apiKey: 'sk-test', model: 'qwen-plus',
      messages: [{role: 'system', content: 's'}, {role: 'user', content: 'u'}],
      onDelta: (piece) => deltas.push(piece),
    });

    expect(text).toBe('你好世界');
    expect(deltas).toEqual(['你好', '世界']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({model: 'qwen-plus', stream: true});
    expect(body.messages).toEqual([{role: 'system', content: 's'}, {role: 'user', content: 'u'}]);
  });

  it('handles multibyte characters split across stream chunks', async () => {
    const head = 'data: {"choices":[{"delta":{"content":"';
    const all = head + '中文' + '"},"index":0}]}\n\ndata: [DONE]\n\n';
    const bytes = encoder.encode(all);
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([bytes.slice(0, head.length + 1), bytes.slice(head.length + 1)]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const text = await streamChat({
      provider: providerById('qwen'), apiKey: 'k', model: 'qwen-plus',
      messages: [{role: 'user', content: 'u'}],
    });
    expect(text).toBe('中文');
  });

  it('rejects with the provider error message on HTTP failure', async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse([], 401, 'Invalid API-key'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      streamChat({
        provider: providerById('qwen'), apiKey: 'bad', model: 'qwen-plus',
        messages: [{role: 'user', content: 'u'}],
      }),
    ).rejects.toThrow('Invalid API-key');
  });
});
