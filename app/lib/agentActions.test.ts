// @vitest-environment node
import {describe, expect, it} from 'vitest';

import {matchEntities, parseMarkers} from './agentActions';
import type {AgentEntity} from './agentActions';

const entities: AgentEntity[] = [
  {type: 'country', label: '美国', value: 'United States'},
  {type: 'country', label: '印度尼西亚', value: 'Indonesia'},
  {type: 'country', label: '印度', value: 'India'},
  {type: 'source', label: 'msn.com', value: 'msn.com'},
  {type: 'source', label: 'MSN', value: 'msn.com'},
  {type: 'sentiment', label: '负面', value: 'negative'},
];

describe('parseMarkers', () => {
  it('parses a valid marker into an action and strips it from the text', () => {
    const {text, actions} = parseMarkers('报道最多的是美国【定位:国家:美国】。', entities);
    expect(text).toBe('报道最多的是美国。');
    expect(actions).toEqual([{type: 'country', label: '美国', value: 'United States'}]);
  });

  it('parses multiple markers in order and strips all of them', () => {
    const {text, actions} = parseMarkers(
      '【定位:国家:美国】其次【定位:媒体:msn.com】',
      entities,
    );
    expect(text).toBe('其次');
    expect(actions).toEqual([
      {type: 'country', label: '美国', value: 'United States'},
      {type: 'source', label: 'msn.com', value: 'msn.com'},
    ]);
  });

  it('strips markers whose label is not in the dictionary without producing an action', () => {
    const {text, actions} = parseMarkers('法国【定位:国家:法国】', entities);
    expect(text).toBe('法国');
    expect(actions).toEqual([]);
  });

  it('strips markers with unknown types without producing an action', () => {
    const {text, actions} = parseMarkers('巴黎【定位:城市:巴黎】', entities);
    expect(text).toBe('巴黎');
    expect(actions).toEqual([]);
  });

  it('parses hour markers and rejects out-of-range or non-numeric hours', () => {
    expect(parseMarkers('【定位:小时:15】', entities).actions).toEqual([
      {type: 'hour', label: '15', value: 15},
    ]);
    expect(parseMarkers('【定位:小时:25】', entities).actions).toEqual([]);
    expect(parseMarkers('【定位:小时:abc】', entities).actions).toEqual([]);
  });

  it('accepts source markers by domain or by media name alias', () => {
    expect(parseMarkers('【定位:媒体:msn.com】', entities).actions).toEqual([
      {type: 'source', label: 'msn.com', value: 'msn.com'},
    ]);
    expect(parseMarkers('【定位:媒体:MSN】', entities).actions).toEqual([
      {type: 'source', label: 'MSN', value: 'msn.com'},
    ]);
  });

  it('returns the text unchanged when there are no markers', () => {
    const {text, actions} = parseMarkers('没有任何标记。', entities);
    expect(text).toBe('没有任何标记。');
    expect(actions).toEqual([]);
  });
});

describe('matchEntities', () => {
  it('splits text into text and reference segments for known labels', () => {
    const segments = matchEntities('美国和印度报道最多', entities);
    expect(segments).toEqual([
      {kind: 'ref', entity: {type: 'country', label: '美国', value: 'United States'}},
      {kind: 'text', text: '和'},
      {kind: 'ref', entity: {type: 'country', label: '印度', value: 'India'}},
      {kind: 'text', text: '报道最多'},
    ]);
  });

  it('prefers the longest label when labels overlap', () => {
    const segments = matchEntities('印度尼西亚有 179 篇', entities);
    expect(segments.filter((s) => s.kind === 'ref')).toEqual([
      {kind: 'ref', entity: {type: 'country', label: '印度尼西亚', value: 'Indonesia'}},
    ]);
  });

  it('returns a single text segment when nothing matches', () => {
    expect(matchEntities('你好世界', entities)).toEqual([
      {kind: 'text', text: '你好世界'},
    ]);
  });

  it('returns no segments for empty text', () => {
    expect(matchEntities('', entities)).toEqual([]);
  });
});
