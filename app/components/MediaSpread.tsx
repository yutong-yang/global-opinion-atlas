'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {SpreadRow,compact,hourLabel} from '../lib/data';

type Tip={x:number;y:number;html:string};
const TRACK=14,AXIS=12,PAD=6,RMAX=4.0,RPAD=4;

export default function MediaSpread({rows,story,source,hours,basis,onSelectStory,onSelectSource}:{
  rows:SpreadRow[];story:string|null;source:string|null;hours:[number,number];basis:number;
  onSelectStory:(key:string,title:string)=>void;onSelectSource:(domain:string)=>void;
}){
  const ref=useRef<HTMLDivElement>(null);
  const[box,setBox]=useState({w:190,h:210});
  const[tip,setTip]=useState<Tip|null>(null);
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const o=new ResizeObserver(()=>setBox({w:e.clientWidth||190,h:e.clientHeight||210}));
    o.observe(e);
    return()=>o.disconnect();
  },[]);
  useLayoutEffect(()=>{
    const e=ref.current;if(!e)return;
    const w=e.clientWidth||190,h=e.clientHeight||210;
    setBox(b=>b.w===w&&b.h===h?b:{w,h});
  });
  const innerW=Math.max(60,box.w-2*RPAD);
  const x=(h:number)=>PAD+(h/23)*(innerW-2*PAD);
  const cell=(innerW-2*PAD)/23;
  const rowMax=useMemo(()=>Math.max(1,...rows.map(r=>r.reach)),[rows]);
  const cum=useMemo(()=>rows.map(r=>r.dots.reduce((s,d)=>s+(d.hour<=hours[1]?d.reach:0),0)),[rows,hours]);
  const x0=Math.max(0,x(hours[0])-cell/2),x1=Math.min(innerW,x(hours[1])+cell/2);
  const hover=(e:React.MouseEvent,d:SpreadRow['dots'][number],title:string)=>{
    const b=ref.current!.getBoundingClientRect();
    setTip({x:e.clientX-b.left+10,y:e.clientY-b.top+10,html:`<b>${d.domain}</b><br>${hourLabel(d.hour)} · 触达 ${compact.format(d.reach)} · ${d.language}<br><span class="tip-sub">${title.length>52?title.slice(0,52)+'…':title}</span>`});
  };
  return <div className="spread-body">
    <div ref={ref} className="spread-wrap">
      {!rows.length?<p className="empty">当前筛选下没有同题转载</p>:rows.map((row,i)=>{
        const dimmed=!!story&&story!==row.key;
        return <div key={row.key} className={(dimmed?'spread-row dim':'spread-row')+(story===row.key?' sel':'')}
          onClick={()=>onSelectStory(row.key,row.title)}>
          <div className="spread-head" title={`${row.title}\n首发 ${row.firstDomain} ${row.firstTime} · ${row.count} 篇 · ${row.domains} 家媒体`}>
            <span className="spread-title">{row.title}</span><b>{row.domains} 家</b>
          </div>
          <svg width={innerW} height={TRACK}>
            <rect className="spread-window" x={x0} y={0.5} width={Math.max(0,x1-x0)} height={TRACK-2} rx={2.5}/>
            <rect className="spread-meter" x={PAD} y={TRACK-2.2} width={Math.max(0,(innerW-2*PAD)*cum[i]/rowMax)} height={1.9} rx={1}/>
            {row.dots.map((d,j)=>{
              const inWin=d.hour>=hours[0]&&d.hour<=hours[1];
              let op=inWin?1:.16;
              if(source&&d.domain!==source)op*=.3;
              return <circle key={j} cx={x(d.hour)} cy={5.8} r={1.6+RMAX*Math.sqrt(d.reach/Math.max(1,basis))}
                fill={d.domain===source?'#142033':'#3765d5'} stroke={j===0?'#142033':'#fff'} strokeWidth={j===0?1.2:.6} opacity={op}
                onMouseMove={e=>hover(e,d,row.title)} onMouseLeave={()=>setTip(null)}
                onClick={e=>{e.stopPropagation();onSelectSource(d.domain)}}/>;
            })}
          </svg>
        </div>;
      })}
    </div>
    {!!rows.length&&<svg className="spread-axis" width={box.w} height={AXIS}>
      <g transform={`translate(${RPAD},0)`}>
        {[0,6,12,18,23].map(h=><text key={h} x={x(h)} y={9} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>)}
      </g>
    </svg>}
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
