'use client';
import {useEffect,useRef,useState} from 'react';
import {fmt} from '../lib/data';

export default function TimeBrush({counts,range,onChange,onInterrupt,playing}:{counts:number[];range:[number,number];onChange:(r:[number,number])=>void;onInterrupt?:()=>void;playing:boolean}){
  const ref=useRef<HTMLDivElement>(null);
  const[width,setWidth]=useState(860);
  const drag=useRef<{anchor:number;cur:number}|null>(null);
  const[live,setLive]=useState<[number,number]|null>(null);
  const shown=live??range;
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    setWidth(e.clientWidth||860);
    const o=new ResizeObserver(()=>setWidth(e.clientWidth||860));o.observe(e);
    return()=>o.disconnect();
  },[]);
  const H=46,PAD=4,max=Math.max(...counts,1);
  const bw=(width-2*PAD)/24;
  const x=(h:number)=>PAD+(h/23)*(width-2*PAD);
  const hourAt=(clientX:number)=>{
    const r=ref.current!.getBoundingClientRect();
    return Math.min(23,Math.max(0,Math.round(((clientX-r.left-PAD)/(width-2*PAD))*23)));
  };
  const down=(e:React.PointerEvent<HTMLDivElement>)=>{
    e.preventDefault();
    if(drag.current)return;
    onInterrupt?.();
    const anchor=hourAt(e.clientX);
    drag.current={anchor,cur:anchor};
    setLive([anchor,anchor]);
    const moveE=(ev:PointerEvent)=>{
      if(!drag.current)return;
      const h=hourAt(ev.clientX);
      drag.current.cur=h;
      setLive([Math.min(anchor,h),Math.max(anchor,h)]);
    };
    const upE=()=>{
      if(!drag.current)return;
      const cur=drag.current.cur;
      drag.current=null;
      window.removeEventListener('pointermove',moveE);
      window.removeEventListener('pointerup',upE);
      setLive(null);
      const[a,b]=[Math.min(anchor,cur),Math.max(anchor,cur)];
      if(a===range[0]&&b===range[1])onChange([0,23]);
      else onChange([a,b]);
    };
    window.addEventListener('pointermove',moveE);
    window.addEventListener('pointerup',upE);
  };
  const inR=(h:number)=>h>=shown[0]&&h<=shown[1];
  const cur=shown[1];
  const hh=String(cur).padStart(2,'0');
  return <div ref={ref} className="brush-wrap" onPointerDown={down} role="slider" aria-label="时间刷选">
    <svg width={width} height={H}>
      {playing
        ?<rect x={PAD} y={0} width={Math.max(0,x(cur)+bw/2-PAD)} height={H-14} className="brush-progress"/>
        :<rect x={x(shown[0])-bw/2} y={0} width={x(shown[1])-x(shown[0])+bw} height={H-14} className="brush-range"/>}
      {counts.map((c,h)=><rect key={h} x={x(h)-bw*.38} y={H-14-(c/max)*(H-24)} width={bw*.76} height={(c/max)*(H-24)}
        className={playing?(h>cur?'brush-bar out':h===cur?'brush-bar brush-current':'brush-bar'):(inR(h)?'brush-bar':'brush-bar out')}>
        <title>{`${String(h).padStart(2,'0')}:00 · ${fmt.format(c)} 篇`}</title>
      </rect>)}
      {playing&&<>
        <line x1={x(cur)} x2={x(cur)} y1={7} y2={H-13} className="brush-playhead"/>
        <circle cx={x(cur)} cy={7} r={4.2} className="brush-knob"/>
      </>}
      {[0,6,12,18,23].map(h=><text key={h} x={x(h)} y={H-2} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>)}
    </svg>
    <span className="brush-label">{playing?`播放中 ${hh}:00 · 视图累计 00:00–${hh}:59`:`${String(shown[0]).padStart(2,'0')}:00 – ${String(shown[1]).padStart(2,'0')}:59`}</span>
  </div>;
}
