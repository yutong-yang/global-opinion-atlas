'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {geoNaturalEarth1,geoPath} from 'd3-geo';
import {feature} from 'topojson-client';
import {Countries110m} from '@d3-maps/atlas';
import {CountryStat,Metric,toneOf,fmt,compact,name} from '../lib/data';

type Tip={x:number;y:number;html:string};
type View={k:number;x:number;y:number};

export default function MapView({countries,cumulative,windowEnd,selected,onSelect,domain}:{countries:CountryStat[];cumulative:CountryStat[];windowEnd:number;selected:string|null;onSelect:(c:string)=>void;domain:{maxMentions:number;maxReach:number}}){
  const[metric,setMetric]=useState<Metric>('mentions');
  const ref=useRef<HTMLDivElement>(null);
  const[dim,setDim]=useState({w:860,h:420});
  const[fit,setFit]=useState({w:860,h:420});
  const[view,setView]=useState<View>({k:1,x:0,y:0});
  const[tip,setTip]=useState<Tip|null>(null);
  const[dragging,setDragging]=useState(false);
  const suppress=useRef(false);
  const viewRef=useRef(view);viewRef.current=view;
  const dimRef=useRef(dim);dimRef.current=dim;
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const measure=()=>{const d={w:Math.max(240,e.clientWidth||860),h:Math.max(180,e.clientHeight||420)};setDim(d);return d};
    setFit(measure());
    const o=new ResizeObserver(()=>measure());o.observe(e);
    const onWin=()=>setFit(measure());
    window.addEventListener('resize',onWin);
    return()=>{o.disconnect();window.removeEventListener('resize',onWin)};
  },[]);
  // 投影基准 fit 与容器实测 dim 解耦：容器尺寸变化只裁剪地图，不重新拟合；仅挂载、窗口 resize、重置视图时重拟合
  const resetView=()=>{setFit({w:dimRef.current.w,h:dimRef.current.h});setView({k:1,x:0,y:0})};
  const clamped=(v:View):View=>{
    const{w,h}=dimRef.current;
    const k=Math.min(7,Math.max(1,v.k));
    return{k,x:Math.min(0,Math.max(w*(1-k),v.x)),y:Math.min(0,Math.max(h*(1-k),v.y))};
  };
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const onWheel=(ev:WheelEvent)=>{
      ev.preventDefault();
      const r=e.getBoundingClientRect();
      const mx=ev.clientX-r.left,my=ev.clientY-r.top;
      setView(v=>{
        const k2=Math.min(7,Math.max(1,v.k*Math.exp(-ev.deltaY*0.0016)));
        if(k2===v.k)return v;
        return clamped({k:k2,x:mx-(mx-v.x)*k2/v.k,y:my-(my-v.y)*k2/v.k});
      });
    };
    e.addEventListener('wheel',onWheel,{passive:false});
    return()=>e.removeEventListener('wheel',onWheel);
  },[]);
  const down=(e:React.PointerEvent<HTMLDivElement>)=>{
    if(e.button!==0)return;
    const sx=e.clientX,sy=e.clientY,v0=viewRef.current;
    let moved=false;
    const mv=(ev:PointerEvent)=>{
      const dx=ev.clientX-sx,dy=ev.clientY-sy;
      if(!moved&&Math.abs(dx)+Math.abs(dy)>4){moved=true;setDragging(true)}
      if(moved)setView(clamped({k:v0.k,x:v0.x+dx,y:v0.y+dy}));
    };
    const up=()=>{
      window.removeEventListener('pointermove',mv);
      window.removeEventListener('pointerup',up);
      setDragging(false);
      if(moved)suppress.current=true;
    };
    window.addEventListener('pointermove',mv);
    window.addEventListener('pointerup',up);
  };
  const pick=(c:string)=>{
    if(suppress.current){suppress.current=false;return}
    onSelect(c===selected?'':c);
  };
  const w=dim.w,h=dim.h;
  const shapes=useMemo(()=>(feature(Countries110m as never,(Countries110m as any).objects.features) as any).features,[]);
  const projection=useMemo(()=>geoNaturalEarth1().fitExtent([[6,6],[fit.w-6,fit.h-6]],{type:'FeatureCollection',features:shapes} as never),[shapes,fit.w,fit.h]);
  const path=useMemo(()=>geoPath(projection),[projection]);
  const byIso=new Map(countries.map(d=>[d.iso3,d]));
  const fill=(d?:CountryStat)=>{
    if(!d)return'#e8edf3';
    if(metric==='tone'){const t=toneOf(d);return t>5?'#31a37e':t<-5?'#d36262':'#c7d0da'}
    const base=Math.max(1,metric==='mentions'?domain.maxMentions:domain.maxReach);
    const p=Math.log1p(d[metric])/Math.log1p(base);
    return`color-mix(in srgb,#3765d5 ${18+p*82}%,#e8edf3)`;
  };
  const move=(e:React.MouseEvent,html:string)=>{
    const r=ref.current!.getBoundingClientRect();
    setTip({x:e.clientX-r.left+12,y:e.clientY-r.top+12,html});
  };
  const bubbles=cumulative.filter(d=>d.reach>0&&d.iso3).map(d=>{
    const f=shapes.find((s:any)=>s.properties.id===d.iso3) as any;
    if(!f)return null;
    const c=path.centroid(f) as[number,number];
    if(!c||!Number.isFinite(c[0]))return null;
    return{x:c[0],y:c[1],d};
  }).filter(Boolean) as{x:number;y:number;d:CountryStat}[];
  const zoomed=view.k!==1||view.x!==0||view.y!==0;
  return <div ref={ref} className={dragging?'map-wrap dragging':'map-wrap'} role="img" aria-label="全球媒体舆情国家分布地图" onPointerDown={down} onDoubleClick={resetView}>
    <div className="map-controls">
      <div className="segment" role="group" aria-label="地图指标">
        {(['mentions','reach','tone'] as Metric[]).map(m=><button key={m} aria-pressed={metric===m} onClick={()=>setMetric(m)}>{m==='mentions'?'报道量':m==='reach'?'触达量':'情感偏向'}</button>)}
      </div>
    </div>
    <svg width={w} height={h}>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
        {shapes.map((s:any)=>{
          const d=byIso.get(s.properties.id);
          return <path key={s.properties.id} d={path(s)||''} fill={fill(d)}
            className={selected&&d&&selected===d.country?'map-country selected':'map-country'}
            onClick={()=>d&&pick(d.country)}
            onMouseMove={e=>d?move(e,`<b>${name(d.country)}</b><br>报道 ${fmt.format(d.mentions)} 篇<br>触达 ${compact.format(d.reach)}<br>情感 ${d.positive}/${d.neutral}/${d.negative}`):move(e,'无数据')}
            onMouseLeave={()=>setTip(null)}/>;
        })}
        {bubbles.map(b=><circle key={b.d.iso3} cx={b.x} cy={b.y} r={(3+Math.sqrt(b.d.reach/Math.max(1,domain.maxReach))*20)/view.k} style={{strokeWidth:1/view.k}} className="reach-bubble"
          onClick={()=>pick(b.d.country)}
          onMouseMove={e=>move(e,`<b>${name(b.d.country)}</b><br>累计触达 ${compact.format(b.d.reach)}<br><span class="tip-sub">00:00–${String(Math.min(23,windowEnd)).padStart(2,'0')}:59</span>`)}
          onMouseLeave={()=>setTip(null)}/>)}
      </g>
    </svg>
    <p className="map-legend">{metric==='tone'?'色阶：绿=偏正（＞+5）· 灰=中性 · 红=偏负（＜−5）':'色阶：'+(metric==='mentions'?'报道量':'触达量')+'（对数 · 全天固定基准）'} · 气泡面积 ∝ 累计触达（00:00 起累积） · 拖拽平移 · 滚轮缩放 · 双击复位</p>
    {zoomed&&<button className="map-reset" onClick={resetView}>重置视图</button>}
    {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
  </div>;
}
