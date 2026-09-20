'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {RiverBand,RiverDot,PlatformColors,compact} from '../lib/data';

type Tip={x:number;y:number;html:string};

const f1=(v:number)=>v.toFixed(1);
const mm=(m:number)=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
function curveCmds(pts:[number,number][]):string{
  let d='';
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)],p1=pts[i],p2=pts[i+1],p3=pts[Math.min(pts.length-1,i+2)];
    const c1x=p1[0]+(p2[0]-p0[0])/6,c1y=p1[1]+(p2[1]-p0[1])/6;
    const c2x=p2[0]-(p3[0]-p1[0])/6,c2y=p2[1]-(p3[1]-p1[1])/6;
    d+=`C${f1(c1x)},${f1(c1y)} ${f1(c2x)},${f1(c2y)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
}
function bandPath(upper:[number,number][],lower:[number,number][]):string{
  const lo=[...lower].reverse();
  return`M${f1(upper[0][0])},${f1(upper[0][1])}${curveCmds(upper)}L${f1(lo[0][0])},${f1(lo[0][1])}${curveCmds(lo)}Z`;
}

export default function MediaRiver({bands,dots,platforms,story,source,country,hours,basis,onSelectStory,onSelectSource}:{
  bands:RiverBand[];dots:RiverDot[];platforms:PlatformColors|null;story:string|null;source:string|null;country:string|null;hours:[number,number];basis:number;
  onSelectStory:(key:string,title:string)=>void;onSelectSource:(domain:string)=>void;
}){
  const colorOf=platforms?platforms.colorOf:()=>'#3765d5';
  const bodyRef=useRef<HTMLDivElement>(null);
  const ref=useRef<HTMLDivElement>(null);
  const[box,setBox]=useState({w:860,h:184});
  const[tip,setTip]=useState<Tip|null>(null);
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const o=new ResizeObserver(()=>setBox({w:e.clientWidth||860,h:e.clientHeight||184}));
    o.observe(e);
    return()=>o.disconnect();
  },[]);
  useLayoutEffect(()=>{
    const e=ref.current;if(!e)return;
    const w=e.clientWidth||860,h=e.clientHeight||184;
    setBox(b=>b.w===w&&b.h===h?b:{w,h});
  });
  const{PAD}=useMemo(()=>({PAD:6}),[]);
  const W=Math.max(120,box.w),H=Math.max(80,box.h);
  const{x,bots,tops,maxT,geo}=useMemo(()=>{
    const fullTotals=Array(24).fill(0) as number[];
    for(const b of bands)for(let h=0;h<24;h++)fullTotals[h]+=b.hours[h];
    const maxT=Math.max(1,...fullTotals);
    const bots=bands.map(()=>Array(24).fill(0) as number[]);
    const tops=bands.map(()=>Array(24).fill(0) as number[]);
    for(let h=0;h<24;h++){
      const visible=h<=hours[1];
      const total=visible?fullTotals[h]:0;
      let base=(maxT-total)/2;
      bands.forEach((b,t)=>{const v=visible?b.hours[h]:0;bots[t][h]=base;tops[t][h]=base+v;base=tops[t][h]});
    }
    const x=(h:number)=>PAD+(h/(hours[1]||1))*(W-2*PAD);
    const xm=(m:number)=>PAD+(m/((hours[1]||1)*60))*(W-2*PAD);
    const y=(v:number)=>H-PAD-(v/maxT)*(H-2*PAD);
    return{x,bots,tops,maxT,geo:{xm,y}};
  },[bands,W,H,PAD,hours]);
  const midY=(t:number,h:number)=>geo.y((bots[t][h]+tops[t][h])/2);
  const winEnd=hours[1]*60+59;
  const inWin=(d:RiverDot)=>d.minute<=winEnd;
  const layers=bands.map((b,t)=>{
    const upper:[number,number][]=[],lower:[number,number][]=[];
    let hmax=0;
    for(let h=0;h<24;h++){
      const cx=x(h);
      upper.push([cx,geo.y(tops[t][h])]);lower.push([cx,geo.y(bots[t][h])]);
      if(b.hours[h]>b.hours[hmax])hmax=h;
    }
    const thickPx=(b.hours[hmax]/maxT)*(H-2*PAD);
    const px=x(hmax);
    return{b,t,d:bandPath(upper,lower),hmax,thickPx,px,
      label:thickPx>=10?{x:px+(px>W-70?-3:px<70?3:0),y:midY(t,hmax),anchor:px>W-70?'end':px<70?'start':'middle' as 'start'|'middle'|'end'}:null,
      active:b.hours.some((n,h)=>h>=hours[0]&&h<=hours[1]&&n>0)};
  });
  const byKey=new Map<string,RiverDot[]>();
  for(const d of dots){
    const arr=byKey.get(d.key);
    if(arr)arr.push(d);else byKey.set(d.key,[d]);
  }
  const countryDoms=new Set<string>();
  if(country)for(const d of dots)if(d.country===country)countryDoms.add(d.domain);
  const storyDoms=new Set<string>();
  if(story)for(const d of dots)if(d.key===story)storyDoms.add(d.domain);
  const paths=[...byKey.values()].map(ds=>{
    const sorted=[...ds].sort((a,b)=>a.minute-b.minute);
    const segs:{a:RiverDot;b:RiverDot}[]=[];
    for(let i=1;i<sorted.length;i++)if(inWin(sorted[i-1])&&inWin(sorted[i]))segs.push({a:sorted[i-1],b:sorted[i]});
    return{key:sorted[0].key,title:sorted[0].title,sorted,segs};
  }).filter(p=>p.sorted.length>1);
  const domOf=(t:number)=>bands[t].domain;
  const bandIdx=new Map(bands.map((b,t)=>[b.domain,t]));
  const tipAt=(e:React.MouseEvent,html:string)=>{
    const r=bodyRef.current!.getBoundingClientRect();
    setTip({x:e.clientX-r.left+10,y:e.clientY-r.top+10,html});
  };
  return <div className="river-wrap media" ref={bodyRef}>
    <div ref={ref} className="river-box">
      {!bands.length?<p className="empty">当前筛选下没有媒体报道</p>:<svg width={W} height={H}>
        {layers.map(l=><path key={l.b.domain} className="river-band" d={l.d} fill={colorOf(l.b.domain)}
          opacity={story?storyDoms.has(l.b.domain)?1:.08:source?l.b.domain===source?1:.08:country?countryDoms.has(l.b.domain)?1:.08:l.active?1:.12}
          onMouseMove={e=>tipAt(e,`<b>${l.b.name}</b> · ${l.b.domain}<br>全天 ${l.b.articles} 篇 · 触达 ${compact.format(l.b.reach)}`)}
          onMouseLeave={()=>setTip(null)}
          onClick={e=>{e.stopPropagation();onSelectSource(l.b.domain)}}/>)}
        {paths.map(p=>{
          const stroke='#94a3b8';
          const srcMatch=!source||p.sorted.some(d=>d.domain===source);
          const cMatch=!country||p.sorted.some(d=>d.country===country);
          let op:number;
          if(story)op=p.key===story?.7:0;
          else if(source)op=srcMatch?.4:0;
          else if(country)op=cMatch?.4:0;
          else op=.2;
          if(!p.segs.length||op===0)return null;
          return <g key={p.key}>
            {p.segs.map((s,i)=><line key={i} className="river-line" x1={geo.xm(s.a.minute)} y1={midY(bandIdx.get(s.a.domain)??0,s.a.hour)}
              x2={geo.xm(s.b.minute)} y2={midY(bandIdx.get(s.b.domain)??0,s.b.hour)}
              stroke={stroke} strokeWidth={story===p.key?1.8:1.1} opacity={op}/>)}
            {p.segs.map((s,i)=><line key={`h${i}`} className="river-line-hit" x1={geo.xm(s.a.minute)} y1={midY(bandIdx.get(s.a.domain)??0,s.a.hour)}
              x2={geo.xm(s.b.minute)} y2={midY(bandIdx.get(s.b.domain)??0,s.b.hour)}
              stroke="transparent" strokeWidth={7}
              onMouseMove={e=>tipAt(e,`<b>${p.title}</b><br>${p.sorted.length} 篇同题 · ${p.sorted.length} 家媒体`)}
              onMouseLeave={()=>setTip(null)}
              onClick={e=>{e.stopPropagation();onSelectStory(p.key,p.title)}}/>)}
          </g>;
        })}
        {dots.map((d,i)=>{
          if(d.minute>winEnd)return null;
          const t=bandIdx.get(d.domain)??0;
          let op:number;
          if(story)op=d.key===story?1:.04;
          else if(source)op=d.domain===source?.85:.04;
          else if(country)op=d.country===country?.85:.04;
          else op=.75;
          return <circle key={i} className="river-dot" cx={geo.xm(d.minute)} cy={midY(t,d.hour)}
            r={1.2+2.5*Math.sqrt(d.reach/Math.max(1,basis))}
            fill={colorOf(d.domain)} stroke={story===d.key?'#142033':'#fff'} strokeWidth={story===d.key?1:.5}
            opacity={op}
            onMouseMove={e=>tipAt(e,`<b>${d.domain}</b> · ${mm(d.minute)} · 触达 ${compact.format(d.reach)}<br><span class="tip-sub">${d.title}</span>`)}
            onMouseLeave={()=>setTip(null)}
            onClick={e=>{e.stopPropagation();onSelectStory(d.key,d.title)}}/>;
        })}
        {layers.map(l=>l.label&&<text key={l.b.domain} className="river-label" x={l.label.x} y={l.label.y}
          textAnchor={l.label.anchor} dominantBaseline="middle">{l.b.name}</text>)}
        {(()=>{
          const span=hours[1];
          const step=span<=6?1:span<=12?2:span<=18?3:6;
          const ticks:number[]=[];
          for(let h=0;h<=hours[1];h+=step)ticks.push(h);
          if(!ticks.length||ticks[ticks.length-1]!==hours[1])ticks.push(hours[1]);
          return ticks.map(h=><text key={h} x={x(h)} y={H-1} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>);
        })()}
      </svg>}
    </div>
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
