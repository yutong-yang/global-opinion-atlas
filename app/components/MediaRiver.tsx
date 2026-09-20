'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {RiverBand,RiverDot,PlatformColors,compact} from '../lib/data';
import PlatformLegend from './PlatformLegend';

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
  type KwInfo={word:string;domain:string;minute:number};
  const keywords=useMemo(()=>{
    const stopWords=new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','must','can','this','that','these','those','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','what','which','who','whom','whose','when','where','why','how','not','no','nor','as','if','then','than','too','very','just','about','above','after','again','all','also','am','any','around','away','back','because','before','between','both','come','down','even','every','get','go','here','into','know','like','long','look','make','many','more','most','much','new','now','number','off','old','one','only','other','over','part','people','place','point','right','same','say','see','show','side','small','so','some','still','such','take','tell','think','time','turn','under','up','upon','use','want','way','well','went','while','who','with','word','work','world','year','的','了','在','是','我','有','和','就','不','人','都','一','一个','上','也','很','到','说','要','去','你','会','着','没有','看','好','自己','这','他','她','它','们','那','些','什么','怎么','为什么','哪','哪里','哪儿','谁','多少','几','怎样','如何','吗','呢','吧','啊','呀','哦','嗯','哈','哎','唉','喂','嘿','嘘','哇','tiktok','rednote','red','note','app','apps','users','user','chinese','china','ban','banned','video','videos']);
    const wordMap=new Map<string,{count:number;byDomain:Map<string,number>;byMinute:Map<number,number>}>();
    const isCjk=(c:string)=>c>='\u4e00'&&c<='\u9fa5';
    const splitMixed=(s:string):string[]=>{
      const parts:string[]=[];let cur='';let lastType=0;
      for(const c of s){
        const t=isCjk(c)?2:/[a-z]/.test(c)?1:0;
        if(cur&&t!==lastType&&lastType!==0){parts.push(cur);cur='';}
        cur+=c;lastType=t;
      }
      if(cur)parts.push(cur);
      return parts;
    };
    for(const d of dots){
      if(d.minute>winEnd)continue;
      const rawWords=d.title.toLowerCase().split(/[\s,，。、；：""''（）\(\)\[\]【】\.!\?\"']+|[^a-zA-Z\u4e00-\u9fa5]+/);
      for(const raw of rawWords){
        if(!raw)continue;
        for(const w of splitMixed(raw)){
          if(w.length<3||w.length>15||stopWords.has(w))continue;
          let entry=wordMap.get(w);
          if(!entry){entry={count:0,byDomain:new Map(),byMinute:new Map()};wordMap.set(w,entry);}
          entry.count++;
          entry.byDomain.set(d.domain,(entry.byDomain.get(d.domain)||0)+1);
          entry.byMinute.set(d.minute,(entry.byMinute.get(d.minute)||0)+1);
        }
      }
    }
    const sorted=[...wordMap.entries()].sort((a,b)=>b[1].count-a[1].count).slice(0,8);
    return sorted.map(([word,e]):KwInfo=>{
      let topDomain='',topDCount=0;
      for(const[dom,c]of e.byDomain)if(c>topDCount){topDCount=c;topDomain=dom;}
      let peakMin=0,peakCount=0;
      for(const[m,c]of e.byMinute)if(c>peakCount){peakCount=c;peakMin=m;}
      return{word,domain:topDomain,minute:peakMin};
    });
  },[dots,winEnd]);
  const kwLabels=useMemo(()=>{
    const GAP_H=14,GAP_X=4;
    const estW=(w:string)=>w.length*6.5+4;
    const placed:{x:number;y:number;w:number}[]=[];
    const result=keywords.map(kw=>{
      const t=bandIdx.get(kw.domain);
      if(t===undefined)return null;
      const h=Math.floor(kw.minute/60);
      const baseY=midY(t,h)-4;
      const kx=geo.xm(kw.minute);
      const ew=estW(kw.word);
      let bestY=baseY;
      let found=false;
      for(let offset=0;offset<=60&&!found;offset+=GAP_H){
        for(const dir of offset===0?[0]:[1,-1]){
          const ky=baseY+offset*dir;
          const collision=placed.find(p=>Math.abs(kx-p.x)<(ew+p.w)/2+GAP_X&&Math.abs(ky-p.y)<GAP_H);
          if(!collision){
            bestY=ky;
            found=true;
            break;
          }
        }
      }
      placed.push({x:kx,y:bestY,w:ew});
      return{word:kw.word,x:kx,y:bestY};
    }).filter((v):v is{word:string;x:number;y:number}=>v!==null);
    return result;
  },[keywords,bandIdx,midY,geo]);
  return <div className="river-wrap media" ref={bodyRef}>
    {platforms&&<div className="river-head">
      <PlatformLegend platforms={platforms} selected={source} onSelect={onSelectSource}/>
    </div>}
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
        {(()=>{
          const span=hours[1];
          const step=span<=6?1:span<=12?2:span<=18?3:6;
          const ticks:number[]=[];
          for(let h=0;h<=hours[1];h+=step)ticks.push(h);
          if(!ticks.length||ticks[ticks.length-1]!==hours[1])ticks.push(hours[1]);
          return ticks.map(h=><text key={h} x={x(h)} y={H-1} textAnchor="middle" className="axis-label">{String(h).padStart(2,'0')}</text>);
        })()}
        {kwLabels.map((kw,i)=><text key={i} x={kw.x} y={kw.y} textAnchor="middle" className="river-kw-text">{kw.word}</text>)}
      </svg>}
    </div>
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
