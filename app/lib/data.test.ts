import '@testing-library/jest-dom/vitest';
import {describe, expect, it} from 'vitest';

import {Article, PLATFORM_OTHER, PLATFORM_PALETTE, buildMediaRiver, buildPlatformColors, hotStories, mediaInfluence, topEntities} from './data';

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

describe('buildPlatformColors', () => {
  it('ranks platforms by cross-platform cluster participation, not raw article count', () => {
    const articles = [
      // hub.com 参与 3 个跨平台簇（每簇只有 2 篇）
      mk({title: 'Story A', sourceDomain: 'hub.com', publishTime: '00:10'}),
      mk({title: 'Story A', sourceDomain: 'a.com', publishTime: '00:20'}),
      mk({title: 'Story B', sourceDomain: 'hub.com', publishTime: '01:10'}),
      mk({title: 'Story B', sourceDomain: 'b.com', publishTime: '01:20'}),
      mk({title: 'Story C', sourceDomain: 'hub.com', publishTime: '02:10'}),
      mk({title: 'Story C', sourceDomain: 'c.com', publishTime: '02:20'}),
      // solo.com 有 5 篇但都在单一平台簇
      ...Array.from({length: 5}, (_, i) => mk({title: `Solo ${i}`, sourceDomain: 'solo.com'})),
    ];
    const pc = buildPlatformColors(articles);
    expect(pc.top[0]).toBe('hub.com');
    expect(pc.top).not.toContain('solo.com');
    expect(pc.participation.get('hub.com')).toBe(3);
    expect(pc.participation.get('solo.com')).toBeUndefined();
  });

  it('maps colors consistently: top platforms get palette colors, long tail gets gray', () => {
    const articles = [
      mk({title: 'S1', sourceDomain: 'p1.com'}),
      mk({title: 'S1', sourceDomain: 'p2.com'}),
      mk({title: 'S2', sourceDomain: 'p1.com'}),
      mk({title: 'S2', sourceDomain: 'p2.com'}),
      // ztail.com 参与 1 个簇，排在 10 个并列平台之后被挤出
      mk({title: 'S3', sourceDomain: 'p1.com'}),
      mk({title: 'S3', sourceDomain: 'ztail.com'}),
      ...Array.from({length: 9}, (_, i) => {
        const t = `Filler ${i}`;
        return [mk({title: t, sourceDomain: `f${i}.com`}), mk({title: t, sourceDomain: 'p1.com'})];
      }).flat(),
    ];
    const pc = buildPlatformColors(articles);
    expect(pc.top[0]).toBe('p1.com');
    expect(pc.colorOf('p1.com')).toBe(PLATFORM_PALETTE[0]);
    expect(pc.top).not.toContain('ztail.com');
    expect(pc.colorOf('ztail.com')).toBe(PLATFORM_OTHER);
    expect(pc.colorOf('unknown.net')).toBe(PLATFORM_OTHER);
    // 同一平台返回同一颜色（全局一致）
    expect(pc.colorOf('p1.com')).toBe(pc.colorOf('p1.com'));
  });

  it('breaks participation ties alphabetically for determinism', () => {
    const articles = [
      mk({title: 'S', sourceDomain: 'beta.com'}),
      mk({title: 'S', sourceDomain: 'alpha.com'}),
    ];
    const pc = buildPlatformColors(articles);
    expect(pc.top).toEqual(['alpha.com', 'beta.com']);
    expect(pc.colorOf('alpha.com')).toBe(PLATFORM_PALETTE[0]);
  });

  it('caps the top list at the palette size', () => {
    const articles: Article[] = [];
    for (let i = 0; i < 15; i++) {
      articles.push(mk({title: `Story ${i}`, sourceDomain: `x${i}.com`}));
      articles.push(mk({title: `Story ${i}`, sourceDomain: 'common.com'}));
    }
    const pc = buildPlatformColors(articles);
    expect(pc.top).toHaveLength(PLATFORM_PALETTE.length);
    expect(pc.top[0]).toBe('common.com');
    // 并列 1 簇的 15 个平台按字典序竞争剩余 9 席，x4–x9 被挤出
    expect(pc.top).not.toContain('x9.com');
  });

  it('ignores articles without title or domain', () => {
    const articles = [
      mk({title: null, sourceDomain: 'a.com'}),
      mk({title: 'S', sourceDomain: null}),
    ];
    const pc = buildPlatformColors(articles);
    expect(pc.top).toEqual([]);
    expect(pc.colorOf('a.com')).toBe(PLATFORM_OTHER);
  });
});

describe('hotStories', () => {
  it('ranks by distinct outlet count first, then article count', () => {
    const articles = [
      mk({title: 'Viral', sourceDomain: 'a.com'}),
      mk({title: 'Viral', sourceDomain: 'b.com'}),
      mk({title: 'Viral', sourceDomain: 'c.com'}),
      mk({title: 'Solo Spam', sourceDomain: 'solo.com'}),
      mk({title: 'Solo Spam', sourceDomain: 'solo.com'}),
      mk({title: 'Solo Spam', sourceDomain: 'solo.com'}),
      mk({title: 'Solo Spam', sourceDomain: 'solo.com'}),
    ];
    const hot = hotStories(articles, 10);
    expect(hot[0].key).toBe('viral');
    expect(hot[0].outlets).toBe(3);
    expect(hot[0].articles).toBe(3);
    expect(hot[1].key).toBe('solo spam');
    expect(hot[1].articles).toBe(4);
  });

  it('aggregates countries, sentiment split, engagement sum and peak hour', () => {
    const articles = [
      mk({title: 'T', sourceDomain: 'a.com', country: 'United States', sentiment: 'positive', engagement: 5, publishTime: '09:10'}),
      mk({title: 'T', sourceDomain: 'b.com', country: 'India', sentiment: 'negative', engagement: null, publishTime: '09:40'}),
      mk({title: 'T', sourceDomain: 'c.com', country: 'India', sentiment: 'neutral', engagement: 7, publishTime: '12:00'}),
    ];
    const [s] = hotStories(articles, 5);
    expect(s.title).toBe('T');
    expect(s.countries).toBe(2);
    expect(s.positive).toBe(1);
    expect(s.negative).toBe(1);
    expect(s.neutral).toBe(1);
    expect(s.engagement).toBe(12);
    expect(s.peakHour).toBe(9);
  });

  it('breaks ties deterministically by key and skips title-less articles', () => {
    const articles = [
      mk({title: 'Beta', sourceDomain: 'a.com'}),
      mk({title: 'Alpha', sourceDomain: 'b.com'}),
      mk({title: null, sourceDomain: 'ghost.com'}),
    ];
    const hot = hotStories(articles, 10);
    expect(hot.map(h => h.key)).toEqual(['alpha', 'beta']);
  });
});

describe('topEntities', () => {
  it('counts articles per entity, not raw mentions', () => {
    const articles = [
      mk({keywordSentence: 'biden;american netizens;biden'}),
      mk({keywordSentence: 'biden'}),
    ];
    const top = topEntities(articles, 10);
    expect(top[0]).toEqual({entity: 'biden', articles: 2});
    expect(top).toContainEqual({entity: 'american netizens', articles: 1});
  });

  it('normalizes whitespace and case, and skips empty segments', () => {
    const articles = [
      mk({keywordSentence: '  Biden Administration ; ;White House  '}),
    ];
    const top = topEntities(articles, 10);
    expect(top).toEqual([{entity: 'biden administration', articles: 1}, {entity: 'white house', articles: 1}]);
  });

  it('sorts by article count and caps at n', () => {
    const articles = [
      mk({keywordSentence: 'x'}),
      mk({keywordSentence: 'y'}),
      mk({keywordSentence: 'y'}),
      mk({keywordSentence: 'z'}),
    ];
    const top = topEntities(articles, 2);
    expect(top.map(t => t.entity)).toEqual(['y', 'x']);
  });
});

describe('mediaInfluence', () => {
  it('deduplicates copied reach by taking the max per outlet, not the sum', () => {
    const articles = [
      mk({sourceDomain: 'big.com', sourceName: 'Big', reach: 1_000_000}),
      mk({sourceDomain: 'big.com', sourceName: 'Big', reach: 1_000_000}),
      mk({sourceDomain: 'small.com', sourceName: 'Small', reach: 900_000}),
    ];
    const top = mediaInfluence(articles, 10);
    expect(top[0]).toMatchObject({domain: 'big.com', reach: 1_000_000, articles: 2});
  });

  it('counts distinct countries and skips articles without a domain', () => {
    const articles = [
      mk({sourceDomain: 'm.com', country: 'United States'}),
      mk({sourceDomain: 'm.com', country: 'India'}),
      mk({sourceDomain: null, country: 'India', reach: 999_999_999}),
    ];
    const top = mediaInfluence(articles, 10);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({domain: 'm.com', countries: 2});
  });

  it('breaks reach ties by domain for determinism', () => {
    const articles = [
      mk({sourceDomain: 'b.com', reach: 100}),
      mk({sourceDomain: 'a.com', reach: 100}),
    ];
    const top = mediaInfluence(articles, 10);
    expect(top.map(t => t.domain)).toEqual(['a.com', 'b.com']);
  });

  it('upgrades the display name from domain fallback to sourceName seen later', () => {
    const articles = [
      mk({sourceDomain: 'late.com', sourceName: null, reach: 100}),
      mk({sourceDomain: 'late.com', sourceName: 'Late Post', reach: 200}),
    ];
    const top = mediaInfluence(articles, 10);
    expect(top[0]).toMatchObject({domain: 'late.com', name: 'Late Post'});
  });
});

describe('buildMediaRiver', () => {
  it('builds bands from all-day article counts (solo articles included) with hourly histogram', () => {
    const articles = [
      mk({title: 'Wire A', sourceDomain: 'big.com', publishTime: '09:10'}),
      mk({title: 'Wire A', sourceDomain: 'small.net', publishTime: '09:40'}),
      mk({title: 'Solo', sourceDomain: 'big.com', publishTime: '10:05'}),
    ];
    const {bands, dots} = buildMediaRiver(articles, 2);
    expect(bands.map(b => b.domain)).toEqual(['big.com', 'small.net']);
    expect(bands[0].articles).toBe(2);
    expect(bands[0].hours[9]).toBe(1);
    expect(bands[0].hours[10]).toBe(1);
    // dots：只有跨平台簇里的文章成为点
    expect(dots).toHaveLength(2);
  });

  it('keeps band rank fixed regardless of cluster membership and caps at topN', () => {
    const articles = [
      // busy.com 只发单平台稿（4 篇），wire.net 只 1 篇但在簇里
      ...Array.from({length: 4}, (_, i) => mk({title: `Solo ${i}`, sourceDomain: 'busy.com'})),
      mk({title: 'Wire', sourceDomain: 'wire.net', publishTime: '00:30'}),
      mk({title: 'Wire', sourceDomain: 'other.org', publishTime: '00:50'}),
    ];
    const {bands} = buildMediaRiver(articles, 1);
    expect(bands.map(b => b.domain)).toEqual(['busy.com']);
  });

  it('emits minute-precision dots with first topic and null for no-topic articles', () => {
    const articles = [
      mk({title: 'T', sourceDomain: 'a.com', publishTime: '09:10', reach: 50, queryKeywords: 'TikTok;refugees'}),
      mk({title: 'T', sourceDomain: 'b.com', publishTime: '09:35', reach: 30, queryKeywords: null}),
    ];
    const {dots} = buildMediaRiver(articles, 2);
    const [d0, d1] = dots;
    expect(d0).toMatchObject({domain: 'a.com', minute: 550, hour: 9, reach: 50});
    expect(d1).toMatchObject({domain: 'b.com', minute: 575});
    expect(d0.key).toBe(d1.key);
  });

  it('drops dots on non-band media but keeps their cluster counted for lines', () => {
    const articles = [
      mk({title: 'T', sourceDomain: 'a.com', publishTime: '01:00'}),
      mk({title: 'T', sourceDomain: 'b.com', publishTime: '01:20'}),
      mk({title: 'T', sourceDomain: 'c.com', publishTime: '01:40'}),
    ];
    const {dots} = buildMediaRiver(articles, 2);
    expect(dots.map(d => d.domain).sort()).toEqual(['a.com', 'b.com']);
  });

  it('skips single-domain title groups and articles without domain or title', () => {
    const articles = [
      mk({title: 'Lone', sourceDomain: 'a.com'}),
      mk({title: 'Lone', sourceDomain: 'a.com'}),
      mk({title: null, sourceDomain: 'a.com'}),
      mk({title: 'X', sourceDomain: null}),
    ];
    const {bands, dots} = buildMediaRiver(articles, 3);
    expect(bands.map(b => b.domain)).toEqual(['a.com']);
    expect(dots).toHaveLength(0);
  });
});
