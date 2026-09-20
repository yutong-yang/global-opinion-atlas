'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {SpreadRow,PlatformColors,compact,hourLabel} from '../lib/data';
import PlatformLegend from './PlatformLegend';

type Tip={x:number;y:number;html:string};
const TRACK=14,AXIS=12,PAD=6,RMAX=4.0,RPAD=4;
const LANES=4,LANE_H=10,PATH_PAD=8,PATH_TOP=12,PATH_AXIS=11,MIN_GAP=9,PATH_RMAX=3.2;
const mm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

export default function MediaSpread({rows,platforms,story,source,hours,basis,onSelectStory,onSelectSource}:{
  rows:SpreadRow[];platforms:PlatformColors|null;story:string|null;source:string|null;hours:[number,number];basis:number;
  onSelectStory:(key:string,title:string)=>void;onSelectSource:(domain:string)=>void;
}){
  const colorOf=platforms?platforms.colorOf:()=>'#3765d5';
  const ref=useRef<HTMLDivElement>(null);
  const bodyRef=useRef<HTMLDivElement>(null);
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
  const x=(h:number)=>PAD+(h/(hours[1]||1))*(innerW-2*PAD);
  const cell=(innerW-2*PAD)/(hours[1]||1);
  const rowMax=useMemo(()=>Math.max(1,...rows.map(r=>r.reach)),[rows]);
  const cum=useMemo(()=>rows.map(r=>r.dots.reduce((s,d)=>s+(d.hour<=hours[1]?d.reach:0),0)),[rows,hours]);
  const x0=0,x1=innerW;
  const path=useMemo(()=>{
    if(!story)return null;
    const row=rows.find(r=>r.key===story);
    if(!row||row.dots.length<2)return null;
    const dots=row.dots;
    const t0=dots[0].minute,t1=Math.max(dots[dots.length-1].minute,t0+1);
    const span=t1-t0;
    const px=Math.min(8,Math.max(.25,dots.length*MIN_GAP/(LANES-.5)/span));
    const w=Math.max(innerW,Math.ceil(span*px)+2*PATH_PAD);
    const laneEnds:number[]=[];
    const st=dots.map(d=>{
      const px0=PATH_PAD+(d.minute-t0)/(t1-t0)*(w-2*PATH_PAD);
      const r=1.6+PATH_RMAX*Math.sqrt(d.reach/Math.max(1,basis));
      let lane=laneEnds.findIndex(e=>px0-e>=MIN_GAP);
      if(lane<0){lane=laneEnds.length;laneEnds.push(px0)}else laneEnds[lane]=px0;
      return{d,x:px0,r,lane:lane%LANES};
    });
    return{st,w,H:PATH_TOP+LANES*LANE_H+PATH_AXIS,t0,span};
  },[story,rows,innerW,basis]);
  const cy=(lane:number)=>PATH_TOP+lane*LANE_H+LANE_H/2;
  const tipAt=(e:React.MouseEvent,html:string)=>{
    const b=bodyRef.current!.getBoundingClientRect();
    setTip({x:e.clientX-b.left+10,y:e.clientY-b.top+10,html});
  };
  const hoverRow=(e:React.MouseEvent,d:SpreadRow['dots'][number],title:string)=>{
    tipAt(e,`<b>${d.domain}</b><br>${hourLabel(d.hour)} · 触达 ${compact.format(d.reach)} · ${d.language}<br><span class="tip-sub">${title.length>52?title.slice(0,52)+'…':title}</span>`);
  };
  const hoverPath=(e:React.MouseEvent,d:SpreadRow['dots'][number])=>{
    tipAt(e,`<b>${d.domain}</b><br>${mm(d.minute)} · 触达 ${compact.format(d.reach)} · ${d.language}`);
  };
  return <div className="spread-body" ref={bodyRef}>
    {platforms&&<PlatformLegend platforms={platforms} selected={source} onSelect={onSelectSource}/>}
    {path&&<div className="spread-path-scroll">
      <svg className="spread-path" width={path.w} height={path.H}>
        <defs><marker id="spread-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8z" fill="#8aa0bf"/></marker></defs>
        {path.st.map((s,i)=>{
          if(!i)return null;
          const p=path.st[i-1];
          const y0=cy(p.lane),y1=cy(s.lane);
          const dx=s.x-p.x,dy=y1-y0,len=Math.hypot(dx,dy);
          if(len<p.r+s.r)return null;
          const ux=dx/len,uy=dy/len,arrow=len>=16;
          const bx=s.x-ux*(s.r+(arrow?4:2)),by=y1-uy*(s.r+(arrow?4:2));
          return <line key={`l${i}`} x1={p.x+ux*(p.r+2)} y1={y0+uy*(p.r+2)} x2={bx} y2={by}
            stroke="#8aa0bf" strokeWidth={1} markerEnd={arrow?'url(#spread-arrow)':undefined}/>;
        })}
        {path.st.map((s,i)=><circle key={`d${i}`} cx={s.x} cy={cy(s.lane)} r={s.r}
          fill={colorOf(s.d.domain)} stroke={i===0?'#142033':'#fff'} strokeWidth={i===0?1.2:.6}
          opacity={source&&s.d.domain!==source?.35:1}
          onMouseMove={e=>hoverPath(e,s.d)} onMouseLeave={()=>setTip(null)}
          onClick={e=>{e.stopPropagation();onSelectSource(s.d.domain)}}/>)}
        <text x={PATH_PAD} y={9} className="path-first">首发 {path.st[0].d.domain} {mm(path.t0)}</text>
        {[0,.5,1].map(f=><text key={f} x={PATH_PAD+f*(path.w-2*PATH_PAD)} y={path.H-2}
          textAnchor={f===0?'start':f===1?'end':'middle'} className="axis-label">{mm(Math.round(path.t0+f*path.span))}</text>)}
      </svg>
    </div>}
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
              const isStory=story===row.key;
              const sel=isStory||(d.domain===source)||j===0;
              return <circle key={j} cx={x(d.hour)} cy={5.8} r={1.2+2.5*Math.sqrt(d.reach/Math.max(1,basis))}
                fill={colorOf(d.domain)} stroke={sel?'#142033':'#fff'} strokeWidth={sel?1:.5} opacity={op}
                onMouseMove={e=>hoverRow(e,d,row.title)} onMouseLeave={()=>setTip(null)}
                onClick={e=>{e.stopPropagation();onSelectSource(d.domain)}}/>;
            })}
          </svg>
        </div>;
      })}
    </div>
    {!!rows.length&&<svg className="spread-axis" width={box.w} height={AXIS}>
      <g transform={`translate(${RPAD},0)`}>
        {(()=>{
          const span=hours[1];
          const step=span<=6?1:span<=12?2:span<=18?3:6;
          const ticks:number[]=[];
          for(let h=0;h<=hours[1];h+=step)ticks.push(h);
          if(!ticks.length||ticks[ticks.length-1]!==hours[1])ticks.push(hours[1]);
          return ticks.map(h=><text key={h} x={x(h)} y={9} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>);
        })()}
      </g>
    </svg>}
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
