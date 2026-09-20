import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import BumpChart from './BumpChart';

class ResizeObserverStub {
  observe() {}
  disconnect() {}
}

const ranks=(first:number,last:number)=>([first,last,...Array(22).fill(null)] as (number|null)[]);
const counts=(total:number)=>[total,...Array(23).fill(0)] as number[];

const rows=[
  {country:'美国',color:'#3765d5',ranks:ranks(1,2),counts:counts(17)},
  {country:'中国',color:'#d34f7c',ranks:ranks(2,1),counts:counts(11)},
  {country:'英国',color:'#e8863a',ranks:ranks(3,3),counts:counts(6)},
];

afterEach(cleanup);

beforeEach(()=>{
  Object.defineProperty(globalThis,'ResizeObserver',{configurable:true,value:ResizeObserverStub});
});

describe('BumpChart',()=>{
  it('renders country labels at shared chart path ends and selects on label click',()=>{
    const onSelect=vi.fn();
    const {container}=render(<BumpChart rows={rows} selected={null} onSelect={onSelect}/>);

    expect(container.querySelectorAll('svg')).toHaveLength(1);
    expect(container.querySelectorAll('.bump-label')).toHaveLength(3);
    const usa=screen.getByText('美国');
    expect(usa).toHaveClass('bump-label');

    fireEvent.click(usa);
    expect(onSelect).toHaveBeenCalledWith('美国');
  });
});
