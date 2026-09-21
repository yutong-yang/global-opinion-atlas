'use client';
import {PlatformColors} from '../lib/data';

export default function PlatformLegend({platforms,selected,onSelect}:{platforms:PlatformColors|null;selected:string|null;onSelect:(d:string)=>void}){
  if(!platforms||!platforms.top.length)return null;
  const visible=platforms.top.filter(d=>(platforms.participation.get(d)??0)>0);
  const hasOther=[...platforms.participation.entries()].some(([d,c])=>c>0&&!platforms.top.includes(d));
  if(!visible.length)return null;
  return <div className="plat-legend" role="group" aria-label="平台颜色图例">
    {visible.map(d=><button key={d} aria-pressed={selected===d} title={`${d} · 参与 ${platforms.participation.get(d)} 个同题转载簇`} onClick={()=>onSelect(d)}>
      <i style={{background:platforms.colorOf(d)}}/>{d}<b>{platforms.participation.get(d)}</b>
    </button>)}
    {hasOther&&<span className="plat-other" title="长尾平台：颜色统一为灰色"><i/>其他</span>}
  </div>;
}
