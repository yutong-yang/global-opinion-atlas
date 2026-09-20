'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {MediaOutlets,MediaOutlet,RepostEdge,RepostNetwork,PlatformColors,compact,fmt,hourLabel} from '../lib/data';
import PlatformLegend from './PlatformLegend';

type Tip={x:number;y:number;html:string};
type Placed={x:number;y:number;r:number;o:MediaOutlet};
type LinkRef={e:RepostEdge;ia:number;ib:number;cum:Float64Array};

const GA=2.399963229728653,MAX_R=100,GAP=6,EY=0.65,MARGIN=26;
const TH_OPTIONS=[4,6,10,20];
const FILL='#a9c0dc';
const EDGE_COLOR='#6b7a90',HL_COLOR='#142033';
const MIN_PX=1.4;

export default function MediaCircles({data,repost,platforms,source,hours,onSelectSource}:{
  data:MediaOutlets;repost:RepostNetwork;platforms:PlatformColors|null;source:string|null;hours:[number,number];
  onSelectSource:(domain:string)=>void;
}){
  const ref=useRef<HTMLDivElement>(null);
  const[dim,setDim]=useState({w:840,h:380});
  const[tip,setTip]=useState<Tip|null>(null);
  const[th,setTh]=useState(4);
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const measure=()=>setDim({w:Math.max(240,e.clientWidth||840),h:Math.max(180,e.clientHeight||380)});
    measure();
    const o=new ResizeObserver(measure);o.observe(e);
    return()=>o.disconnect();
  },[]);

  const shown=useMemo(()=>data.outlets.filter(o=>o.articles>=th),[data,th]);

  const layout=useMemo(()=>{
    if(!shown.length)return null;
    const maxA=Math.max(1,shown[0].articles);
    const out:Placed[]=[];
    for(const o of shown){
      const r=MAX_R*Math.sqrt(Math.max(1,o.articles)/maxA);
      const step=Math.max(4,r*0.5);
      let placed=false;
      for(let i=0;i<20000;i++){
        const t=i*GA,rad=step*Math.sqrt(i);
        if(rad>MAX_R*8)break;
        const x=rad*Math.cos(t),y=rad*Math.sin(t)*EY;
        let hit=false;
        for(const p of out){
          const dx=p.x-x,dy=p.y-y,rr=p.r+r+GAP;
          if(dx*dx+dy*dy<rr*rr){hit=true;break}
        }
        if(!hit){out.push({x,y,r,o});placed=true;break}
      }
      if(!placed)out.push({x:0,y:0,r,o});
    }
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const p of out){
      x0=Math.min(x0,p.x-p.r-MARGIN);y0=Math.min(y0,p.y-p.r-MARGIN);
      x1=Math.max(x1,p.x+p.r+MARGIN);y1=Math.max(y1,p.y+p.r+MARGIN);
    }
    return{out,x0,y0,x1,y1};
  },[shown]);

  const cumByHour=useMemo(()=>{
    const m=new Map<string,Float64Array>();
    for(const o of data.outlets){
      const c=new Float64Array(25);
      for(let h=0;h<24;h++)c[h+1]=c[h]+o.hours[h];
      m.set(o.domain,c);
    }
    return m;
  },[data]);

  const domainIdx=useMemo(()=>{
    const m=new Map<string,number>();
    shown.forEach((o,i)=>m.set(o.domain,i));
    return m;
  },[shown]);

  const links=useMemo(()=>{
    const arr:LinkRef[]=[];
    for(const e of repost.edges){
      const ia=domainIdx.get(e.source),ib=domainIdx.get(e.target);
      if(ia===undefined||ib===undefined)continue;
      const c=new Float64Array(25);
      for(let h=0;h<24;h++)c[h+1]=c[h]+e.hours[h];
      arr.push({e,ia,ib,cum:c});
    }
    return arr;
  },[repost,domainIdx]);

  const shownArticles=useMemo(()=>shown.reduce((s,o)=>s+o.articles,0),[shown]);
  const omittedCount=data.outlets.length-shown.length;
  const omittedArticles=data.total-shownArticles;

  const{w,h}=dim;
  const k=layout?Math.min(w/Math.max(1,layout.x1-layout.x0),h/Math.max(1,layout.y1-layout.y0))*0.94:1;
  const tx=layout?w/2-k*(layout.x0+layout.x1)/2:0,ty=layout?h/2-k*(layout.y0+layout.y1)/2:0;

  const H=Math.min(23,Math.max(0,hours[1]));
  const hh=String(H).padStart(2,'0');
  const inWin=(arr:number[]):boolean=>{
    for(let h=hours[0];h<=hours[1];h++)if(arr[h]>0)return true;
    return false;
  };

  const growth=useMemo(()=>{
    if(!layout)return null;
    const rs:number[]=[],vis:boolean[]=[],cums:number[]=[];
    for(const p of layout.out){
      const c=cumByHour.get(p.o.domain);
      const cu=c?c[H+1]:0;
      const r=cu>0?p.r*Math.sqrt(cu/p.o.articles):0;
      cums.push(cu);rs.push(r);vis.push(r*k>=MIN_PX);
    }
    return{rs,vis,cums};
  },[layout,cumByHour,H,k]);

  const grownCount=growth?growth.vis.reduce((s,v)=>s+(v?1:0),0):0;
  const cumTotal=growth?growth.cums.reduce((s,v)=>s+v,0):0;

  const edgeViews=useMemo(()=>{
    if(!layout||!growth)return[];
    const out:{key:string;x1:number;y1:number;x2:number;y2:number;c:number;count:number;op:number;sw:number;hl:boolean;src:string;tgt:string}[]=[];
    for(const l of links){
      const c=l.cum[H+1];
      if(c<=0)continue;
      const ia=l.ia,ib=l.ib;
      if(!growth.vis[ia]||!growth.vis[ib])continue;
      const pa=layout.out[ia],pb=layout.out[ib];
      const ra=growth.rs[ia],rb=growth.rs[ib];
      const dx=pb.x-pa.x,dy=pb.y-pa.y;
      const d=Math.sqrt(dx*dx+dy*dy)||1;
      const ux=dx/d,uy=dy/d;
      const pad=0.9/k;
      if(d-ra-rb-2*pad<=0.6)continue;
      const x1=pa.x+ux*(ra+pad),y1=pa.y+uy*(ra+pad);
      const x2=pb.x-ux*(rb+pad),y2=pb.y-uy*(rb+pad);
      const hl=!!source&&(l.e.source===source||l.e.target===source);
      let op=Math.min(0.72,0.10+0.11*Math.log2(1+c));
      if(!inWin(l.e.hours))op*=0.4;
      if(source)op*=hl?1.5:0.12;
      op=Math.min(0.9,op);
      const sw=Math.max(0.6,0.55+0.4*Math.log2(1+c))/k;
      out.push({key:l.e.source+'\u0000'+l.e.target,x1,y1,x2,y2,c,count:l.e.count,op,sw,hl,src:l.e.source,tgt:l.e.target});
    }
    return out;
  },[layout,growth,links,H,k,source,hours]);

  const circOp=(p:Placed):number=>{
    let f=inWin(p.o.hours)?1:0.30;
    if(source)f*=p.o.domain===source?1:0.16;
    return Math.max(0.06,f);
  };
  const move=(e:React.MouseEvent,html:string)=>{
    const r=ref.current!.getBoundingClientRect();
    setTip({x:e.clientX-r.left+12,y:e.clientY-r.top+12,html});
  };
  const activeSpan=(hs:number[]):string=>{
    let a=-1,b=-1;
    for(let h=0;h<24;h++)if(hs[h]>0){if(a<0)a=h;b=h}
    return a<0?'—':a===b?hourLabel(a):`${hourLabel(a)}–${hourLabel(b)}`;
  };

  return <div className="cir-body">
    <div className="net-bar">
      <span className="cir-hint">圈=媒体（面积∝00:00 起累计发文）· 连线=转载关系（箭头指向转载方）· 悬停查看 · 点击筛选</span>
      <div className="segment" role="group" aria-label="媒体最少文章数">
        {TH_OPTIONS.map(v=><button key={v} aria-pressed={th===v} title={`只显示发文 ≥${v} 篇的媒体`} onClick={()=>setTh(v)}>≥{v}</button>)}
      </div>
      <span className="net-counts" title="媒体=语料中全部发稿媒体 · 触达为媒体级受众规模逐篇累加（会重复计数）">媒体 {fmt.format(data.domainCount)} 家 · 文章 {fmt.format(data.total)} 篇 · 触达 {compact.format(data.totalReach)}</span>
    </div>
    <div ref={ref} className="cir-wrap" onMouseLeave={()=>setTip(null)}>
      {!layout
        ?<p className="empty">当前筛选下没有发文 ≥{th} 篇的媒体（可降低最少文章数）</p>
        :growth&&grownCount===0
          ?<p className="empty">00:00–{hh}:59 内还没有媒体发文（可拖选时间或播放）</p>
          :<svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
            <defs>
              <marker id="cir-arrow" viewBox="0 0 8 8" refX="7.4" refY="4" markerWidth="4.2" markerHeight="4.2" orient="auto">
                <path d="M0.5,0.8 L7.6,4 L0.5,7.2 Z" fill={EDGE_COLOR}/>
              </marker>
            </defs>
            <g transform={`translate(${tx} ${ty}) scale(${k})`}>
              {edgeViews.map(l=><g key={l.key}>
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={l.hl?HL_COLOR:EDGE_COLOR} strokeWidth={l.sw} opacity={l.op} markerEnd="url(#cir-arrow)" strokeLinecap="round"/>
                <line x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="transparent" strokeWidth={7/k} pointerEvents="stroke"
                  onMouseMove={e=>move(e,`<b>${l.src} → ${l.tgt}</b><br>${l.c<l.count?`转载 ${fmt.format(l.c)} 次（累计 00:00–${hh}:59）<br>全天 ${fmt.format(l.count)} 次`:`转载 ${fmt.format(l.count)} 次`}<br><span class="tip-sub">同题转载方向计数</span>`)}
                  onMouseLeave={()=>setTip(null)}/>
              </g>)}
              {layout.out.map((p,i)=>{
                if(!growth||!growth.vis[i])return null;
                const sel=source===p.o.domain;
                const r=growth.rs[i],rs=r*k,cu=growth.cums[i];
                const fs=Math.min(13,6.25*rs/p.o.domain.length);
                const showLabel=fs>=9;
                const showCount=showLabel&&rs>=30;
                return <g key={p.o.domain} opacity={circOp(p)} className="cir-g">
                  <circle cx={p.x} cy={p.y} r={r} fill={platforms?platforms.colorOf(p.o.domain):FILL}
                    stroke={sel?HL_COLOR:'#fff'} strokeWidth={(sel?1.6:0.9)/k} className="cir-bubble"
                    onMouseMove={e=>move(e,`<b>${p.o.domain}</b><br>${p.o.name&&p.o.name!==p.o.domain?`${p.o.name}<br>`:''}${cu<p.o.articles?`${fmt.format(cu)} 篇（累计 00:00–${hh}:59）<br>全天 ${fmt.format(p.o.articles)} 篇 · 触达 ${compact.format(p.o.reach)}`:`${fmt.format(p.o.articles)} 篇 · 触达 ${compact.format(p.o.reach)}`}<br>发文时段 ${activeSpan(p.o.hours)}<br><span class="tip-sub">点击筛选该媒体</span>`)}
                    onMouseLeave={()=>setTip(null)}
                    onClick={()=>onSelectSource(p.o.domain)}/>
                  {showLabel&&<text x={p.x} y={p.y-(showCount?6/k:0)} textAnchor="middle" dominantBaseline="middle" className="cir-label" style={{fontSize:fs/k}}>{p.o.domain}</text>}
                  {showCount&&<text x={p.x} y={p.y+7.5/k} textAnchor="middle" dominantBaseline="middle" className="cir-count" style={{fontSize:Math.min(11,fs*0.82)/k}}>{fmt.format(cu)} 篇</text>}
                </g>;
              })}
            </g>
          </svg>}
      {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
    </div>
    {platforms&&<PlatformLegend platforms={platforms} selected={source} onSelect={onSelectSource}/>}
    <div className="net-legend cir-legend">
      <span>图中 {fmt.format(shown.length)} 家 · 连线 {fmt.format(edgeViews.length)} 条</span>
      <span className="sep"/>
      <span>{hours[0]===0&&hours[1]>=23?'全天':'00:00–'+hh+':59'} 已出现 {fmt.format(grownCount)} 家 · 累计 {fmt.format(cumTotal)} 篇</span>
      <span className="sep"/>
      <span>未入图 {fmt.format(omittedCount)} 家 · {fmt.format(omittedArticles)} 篇</span>
      <span className="sep"/>
      <span>位置固定全天 · 变暗=所选时段无发文 · 色=平台</span>
    </div>
  </div>;
}
