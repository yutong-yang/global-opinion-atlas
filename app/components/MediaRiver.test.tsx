import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import MediaRiver from './MediaRiver';
import {PlatformColors, RiverBand, RiverDot} from '../lib/data';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

const platforms:PlatformColors={
  top:['alpha.com','beta.net'],
  colorOf:d=>d==='alpha.com'?'#c33c54':d==='beta.net'?'#0f6e8c':'#94a3b8',
  participation:new Map([['alpha.com',4],['beta.net',3]]),
};

const hours24=(fill:(h:number)=>number):number[]=>Array.from({length:24},(_,h)=>fill(h));
const bands:RiverBand[]=[
  {domain:'alpha.com',name:'Alpha',articles:30,reach:300,hours:hours24(h=>h<=10?3:0)},
  {domain:'beta.net',name:'Beta',articles:4,reach:40,hours:hours24(h=>h>=7&&h<=10?1:0)},
];
const dots:RiverDot[]=[
  {key:'story-x',title:'Wire story',domain:'alpha.com',minute:100,hour:1,reach:40,country:'US'},
  {key:'story-x',title:'Wire story',domain:'beta.net',minute:500,hour:8,reach:30,country:'UK'},
  {key:'story-y',title:'Other story',domain:'alpha.com',minute:600,hour:10,reach:20,country:'US'},
];

afterEach(cleanup);

beforeEach(()=>{
  Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:ResizeObserverStub});
});

const renderRiver=(over:Partial<Parameters<typeof MediaRiver>[0]>={})=>render(<MediaRiver
  bands={bands} dots={dots} platforms={platforms} story={null} source={null} country={null}
  hours={[0,23]} basis={40} onSelectStory={vi.fn()} onSelectSource={vi.fn()} {...over}/>);

describe('MediaRiver',()=>{
  it('renders media bands with platform colors',()=>{
    const {container}=renderRiver();
    const paths=container.querySelectorAll('.river-band');
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute('fill')).toBe('#c33c54');
    expect(paths[1].getAttribute('fill')).toBe('#0f6e8c');
    expect([...container.querySelectorAll('.axis-label')].map(t=>t.textContent)).toContain('12');
  });

  it('uses platform colors for dots and applies single-priority filter opacity',()=>{
    const {container}=renderRiver();
    const dotsAll=container.querySelectorAll('.river-dot');
    expect(dotsAll).toHaveLength(3);
    expect(dotsAll[0].getAttribute('fill')).toBe('#c33c54');
    expect(dotsAll[1].getAttribute('fill')).toBe('#0f6e8c');
    expect(dotsAll[2].getAttribute('fill')).toBe('#c33c54');
    expect(dotsAll[0].getAttribute('opacity')).toBe('0.75');
    expect(container.querySelectorAll('.river-line')).toHaveLength(1);

    const {container:src}=renderRiver({source:'alpha.com'});
    const srcDots=src.querySelectorAll('.river-dot');
    expect(srcDots[0].getAttribute('opacity')).toBe('0.85');
    expect(Number(srcDots[1].getAttribute('opacity'))).toBeLessThan(0.1);
    expect(src.querySelectorAll('.river-line')).toHaveLength(1);
  });

  it('highlights dots matching country filter and dims others',()=>{
    const {container}=renderRiver({country:'US'});
    const dotsAll=container.querySelectorAll('.river-dot');
    expect(dotsAll[0].getAttribute('opacity')).toBe('0.85');
    expect(Number(dotsAll[1].getAttribute('opacity'))).toBeLessThan(0.1);
    expect(dotsAll[2].getAttribute('opacity')).toBe('0.85');
  });

  it('selects the story when clicking a dot or a propagation line',()=>{
    const onSelectStory=vi.fn();
    const {container}=renderRiver({onSelectStory});
    fireEvent.click(container.querySelectorAll('.river-dot')[0]);
    expect(onSelectStory).toHaveBeenCalledWith('story-x','Wire story');
    fireEvent.click(container.querySelector('.river-line-hit')!);
    expect(onSelectStory).toHaveBeenCalledTimes(2);
  });

  it('selects the source when clicking a band',()=>{
    const onSelectSource=vi.fn();
    const {container}=renderRiver({onSelectSource});
    fireEvent.click(container.querySelectorAll('.river-band')[1]);
    expect(onSelectSource).toHaveBeenCalledWith('beta.net');
  });

  it('dims other clusters when a story is selected',()=>{
    const {container}=renderRiver({story:'story-y'});
    const all=container.querySelectorAll('.river-dot');
    expect(Number(all[0].getAttribute('opacity'))).toBeLessThan(0.1);
    expect(all[2].getAttribute('opacity')).toBe('1');
  });

  it('dims bands without articles in the current window',()=>{
    const {container}=renderRiver({hours:[12,15]});
    const paths=container.querySelectorAll('.river-band');
    expect(Number(paths[0].getAttribute('opacity'))).toBeLessThan(1);
    expect(Number(paths[1].getAttribute('opacity'))).toBeLessThan(1);
    const {container:active}=renderRiver({hours:[8,9]});
    expect(active.querySelectorAll('.river-band')[0].getAttribute('opacity')).toBe('1');
  });

  it('dims non-selected bands when source filter is active',()=>{
    const {container}=renderRiver({source:'alpha.com'});
    const paths=container.querySelectorAll('.river-band');
    expect(paths[0].getAttribute('opacity')).toBe('1');
    expect(Number(paths[1].getAttribute('opacity'))).toBeLessThan(0.1);
  });

  it('keeps only story-touched bands visible when story is selected',()=>{
    const {container}=renderRiver({story:'story-x'});
    const paths=container.querySelectorAll('.river-band');
    expect(paths[0].getAttribute('opacity')).toBe('1');
    expect(paths[1].getAttribute('opacity')).toBe('1');
    const {container:narrow}=renderRiver({story:'story-y'});
    const narrowPaths=narrow.querySelectorAll('.river-band');
    expect(narrowPaths[0].getAttribute('opacity')).toBe('1');
    expect(Number(narrowPaths[1].getAttribute('opacity'))).toBeLessThan(0.1);
  });

  it('shows an empty state when there are no bands',()=>{
    const {container}=renderRiver({bands:[],dots:[]});
    expect(container.querySelector('.river-band')).toBeNull();
    expect(container.querySelector('.empty')?.textContent).toContain('媒体报道');
  });
});
