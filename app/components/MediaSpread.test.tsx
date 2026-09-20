import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import MediaSpread from './MediaSpread';
import {PlatformColors, SpreadRow} from '../lib/data';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

const platforms:PlatformColors={
  top:['alpha.com','beta.net'],
  colorOf:d=>d==='alpha.com'?'#c33c54':d==='beta.net'?'#0f6e8c':'#94a3b8',
  participation:new Map([['alpha.com',4],['beta.net',3]]),
};

const rows:SpreadRow[]=[{
  key:'story-x',title:'Example wire story',firstHour:6,firstDomain:'alpha.com',firstTime:'06:10',
  count:3,domains:3,reach:90,
  dots:[
    {hour:6,minute:370,domain:'alpha.com',reach:40,language:'英语'},
    {hour:8,minute:480,domain:'beta.net',reach:30,language:'法语'},
    {hour:9,minute:545,domain:'gamma.org',reach:20,language:'德语'},
  ],
}];

afterEach(cleanup);

beforeEach(()=>{
  Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:ResizeObserverStub});
});

describe('MediaSpread',()=>{
  it('renders platform legend chips and toggles platform on chip click',()=>{
    const onSelectSource=vi.fn();
    const {container}=render(<MediaSpread rows={rows} platforms={platforms} story={null} source={null}
      hours={[0,23]} basis={90} onSelectStory={vi.fn()} onSelectSource={onSelectSource}/>);

    const chips=container.querySelectorAll('.plat-legend button');
    expect(chips).toHaveLength(2);
    expect(chips[0].textContent).toContain('alpha.com');
    expect(chips[0].querySelector('i')).toHaveStyle({background:'#c33c54'});

    fireEvent.click(chips[1]);
    expect(onSelectSource).toHaveBeenCalledWith('beta.net');
  });

  it('colors repost dots by topic with gray for null topic',()=>{
    const {container}=render(<MediaSpread rows={rows} platforms={platforms} story={null} source={null}
      hours={[0,23]} basis={90} onSelectStory={vi.fn()} onSelectSource={vi.fn()}/>);

    const dots=container.querySelectorAll('.spread-row circle');
    expect(dots).toHaveLength(3);
    expect(dots[0].getAttribute('fill')).toBe('#c33c54');
    expect(dots[1].getAttribute('fill')).toBe('#0f6e8c');
    expect(dots[2].getAttribute('fill')).toBe('#94a3b8');
  });

  it('shows a propagation path for the selected story and selects platform on station click',()=>{
    const onSelectSource=vi.fn();
    const {container}=render(<MediaSpread rows={rows} platforms={platforms} story="story-x" source={null}
      hours={[0,23]} basis={90} onSelectStory={vi.fn()} onSelectSource={onSelectSource}/>);

    const scroll=container.querySelector('.spread-path-scroll');
    expect(scroll).not.toBeNull();
    const stations=container.querySelectorAll('.spread-path circle');
    expect(stations).toHaveLength(3);
    expect(container.querySelectorAll('.spread-path line')).toHaveLength(2);
    expect(stations[0].getAttribute('fill')).toBe('#c33c54');
    expect(container.querySelector('.spread-path .path-first')?.textContent).toContain('首发 alpha.com');

    fireEvent.click(stations[2]);
    expect(onSelectSource).toHaveBeenCalledWith('gamma.org');
  });

  it('hides the path bar when no story is selected',()=>{
    const {container}=render(<MediaSpread rows={rows} platforms={platforms} story={null} source={null}
      hours={[0,23]} basis={90} onSelectStory={vi.fn()} onSelectSource={vi.fn()}/>);

    expect(container.querySelector('.spread-path-scroll')).toBeNull();
  });

  it('dims non-matching platform dots when a platform is highlighted',()=>{
    const {container}=render(<MediaSpread rows={rows} platforms={platforms} story={null} source="alpha.com"
      hours={[0,23]} basis={90} onSelectStory={vi.fn()} onSelectSource={vi.fn()}/>);

    const dots=container.querySelectorAll('.spread-row circle');
    expect(dots[0].getAttribute('opacity')).toBe('1');
    expect(Number(dots[1].getAttribute('opacity'))).toBeLessThan(0.5);
    const chips=container.querySelectorAll('.plat-legend button');
    expect(chips[0]).toHaveAttribute('aria-pressed','true');
  });
});
