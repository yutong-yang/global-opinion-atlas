'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {RepostNetwork,RepostOutlet,RepostStory,RepostEdge,PlatformColors,PLATFORM_OTHER,compact,fmt,hourLabel,minuteLabel} from '../lib/data';
import PlatformLegend from './PlatformLegend';

type Tip={x:number;y:number;html:string};
type View={k:number;x:number;y:number};
type Mode='all'|'repost'|'pair';
type GNode={id:string;kind:'outlet'|'story';ref:RepostOutlet|RepostStory;label:string;color:string;x:number;y:number;vx:number;vy:number;r:number};

const OUTLET_CAP=360,HUB_CAP=170,ITERS=160,NOM_W=840,NOM_H=400;
const TH_OPTIONS=[3,5,8,12];
const MODES:[Mode,string][]=[['all','全部'],['repost','转载关系'],['pair','媒体–通稿']];
const EDGE_COLOR='#6b7a90',HL_COLOR='#142033',PAIR_COLOR='#d8c3a3',HUB_COLOR='#e8863a',PAIR_HL='#e8863a';

export default function MediaNetwork({network,platforms,story,source,hours,onSelectSource,onSelectStory}:{
  network:RepostNetwork;platforms:PlatformColors|null;story:string|null;source:string|null;hours:[number,number];
  onSelectSource:(domain:string)=>void;onSelectStory:(key:string,title:string)=>void;
}){
  const ref=useRef<HTMLDivElement>(null);
  const[dim,setDim]=useState({w:840,h:380});
  const[view,setView]=useState<View>({k:1,x:0,y:0});
  const[tip,setTip]=useState<Tip|null>(null);
  const[dragging,setDragging]=useState(false);
  const[mode,setMode]=useState<Mode>('all');
  const[th,setTh]=useState(5);
  const[hoverNode,setHoverNode]=useState<string|null>(null);
  const suppress=useRef(false);
  const viewRef=useRef(view);viewRef.current=view;
  const dimRef=useRef(dim);dimRef.current=dim;
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const measure=()=>setDim({w:Math.max(240,e.clientWidth||840),h:Math.max(180,e.clientHeight||380)});
    measure();
    const o=new ResizeObserver(measure);o.observe(e);
    return()=>o.disconnect();
  },[]);

  const graph=useMemo(()=>{
    const keptOutlets=network.outlets.filter(o=>o.articles>=th).slice(0,OUTLET_CAP);
    const keptO=new Set(keptOutlets.map(o=>o.domain));
    const hubsAll=network.stories.map(s=>({...s,members:s.members.filter(m=>keptO.has(m))})).filter(s=>s.members.length>=2);
    const hubs=hubsAll.slice(0,HUB_CAP);
    const nodes:GNode[]=[];
    for(const o of keptOutlets)nodes.push({id:o.domain,kind:'outlet',ref:o,label:o.domain,color:platforms?platforms.colorOf(o.domain):PLATFORM_OTHER,x:0,y:0,vx:0,vy:0,r:2.4+2.6*Math.log10(1+o.articles)});
    const no=nodes.length;
    for(const h of hubs)nodes.push({id:'story\u0000'+h.key,kind:'story',ref:h,label:h.title,color:HUB_COLOR,x:0,y:0,vx:0,vy:0,r:2.2+1.7*Math.log10(1+h.members.length)});
    const idx=new Map<string,number>();nodes.forEach((nd,i)=>idx.set(nd.id,i));
    const links:{a:number;b:number;rest:number;k:number}[]=[];
    const repAll:{e:RepostEdge;ia:number;ib:number}[]=[];
    for(const e of network.edges){
      const ia=idx.get(e.source),ib=idx.get(e.target);
      if(ia===undefined||ib===undefined)continue;
      repAll.push({e,ia,ib});
      links.push({a:ia,b:ib,rest:64,k:0.045});
    }
    hubs.forEach((h,hi)=>{
      const b=no+hi;
      for(const m of h.members){const ia=idx.get(m);if(ia!==undefined)links.push({a:ia,b,rest:40,k:0.05})}
    });
    const n=nodes.length;
    if(n>0){
      const K=Math.max(30,Math.sqrt((NOM_W*NOM_H)/Math.max(1,n))*1.3);
      const CUT=K*2.8,GA=2.399963229728653;
      for(let i=0;i<n;i++){
        const nd=nodes[i];
        const t=i*GA,rad=K*0.95*Math.sqrt(i+0.6);
        nd.x=rad*Math.cos(t);nd.y=rad*Math.sin(t);
      }
      for(let it=0;it<ITERS;it++){
        for(let i=0;i<n;i++){
          const a=nodes[i],xa=a.x,ya=a.y;
          for(let j=i+1;j<n;j++){
            const b=nodes[j];
            let dx=b.x-xa,dy=b.y-ya;
            const d2=dx*dx+dy*dy;
            if(d2>CUT*CUT)continue;
            const d=Math.sqrt(d2)||0.01;
            const f=K*K/d;
            dx=dx/d*f;dy=dy/d*f;
            a.vx-=dx;a.vy-=dy;b.vx+=dx;b.vy+=dy;
          }
        }
        for(const l of links){
          const a=nodes[l.a],b=nodes[l.b];
          let dx=b.x-a.x,dy=b.y-a.y;
          const d=Math.sqrt(dx*dx+dy*dy)||0.01;
          const f=(d-l.rest)*l.k;
          dx=dx/d*f;dy=dy/d*f;
          a.vx+=dx;a.vy+=dy;b.vx-=dx;b.vy-=dy;
        }
        for(let i=0;i<n;i++){
          const p=nodes[i];
          p.vx-=p.x*0.012;p.vy-=p.y*0.012;
          p.vx*=0.82;p.vy*=0.82;
          const sp=Math.sqrt(p.vx*p.vx+p.vy*p.vy);
          if(sp>30){p.vx*=30/sp;p.vy*=30/sp}
          p.x+=p.vx;p.y+=p.vy;
        }
      }
      let cx=0,cy=0;
      for(const nd of nodes){cx+=nd.x;cy+=nd.y}
      cx/=n;cy/=n;
      for(const nd of nodes){nd.x-=cx;nd.y-=cy}
    }
    const repEdges:{e:RepostEdge;x1:number;y1:number;x2:number;y2:number}[]=[];
    for(const r of repAll){
      const A=nodes[r.ia],B=nodes[r.ib];
      let dx=B.x-A.x,dy=B.y-A.y;
      const d=Math.sqrt(dx*dx+dy*dy)||0.01;
      if(d<A.r+B.r+2)continue;
      const ux=dx/d,uy=dy/d;
      repEdges.push({e:r.e,x1:A.x+ux*A.r,y1:A.y+uy*A.r,x2:B.x-ux*(B.r+3),y2:B.y-uy*(B.r+3)});
    }
    const pairEdges:{hub:string;domain:string;x1:number;y1:number;x2:number;y2:number}[]=[];
    hubs.forEach((h,hi)=>{
      const B=nodes[no+hi];
      for(const m of h.members){
        const ia=idx.get(m);if(ia===undefined)continue;
        const A=nodes[ia];
        let dx=B.x-A.x,dy=B.y-A.y;
        const d=Math.sqrt(dx*dx+dy*dy)||0.01;
        const ux=dx/d,uy=dy/d;
        pairEdges.push({hub:h.key,domain:m,x1:A.x+ux*A.r,y1:A.y+uy*A.r,x2:B.x-ux*B.r,y2:B.y-uy*B.r});
      }
    });
    const topLabels=new Set(keptOutlets.slice(0,10).map(o=>o.domain));
    return{nodes,outletNodes:keptOutlets.map((o,i)=>({o,node:nodes[i]})),hubNodes:hubs.map((h,i)=>({h,node:nodes[no+i]})),repEdges,pairEdges,topLabels,
      outletCapped:network.outlets.filter(o=>o.articles>=th).length>OUTLET_CAP,hubCapped:hubsAll.length>HUB_CAP};
  },[network,th,platforms]);

  const fitView=useMemo(()=>{
    const{w,h}=dim;
    const nodes=graph.nodes;
    if(!nodes.length)return{k:1,x:w/2,y:h/2};
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const nd of nodes){
      x0=Math.min(x0,nd.x-nd.r-12);y0=Math.min(y0,nd.y-nd.r-12);
      x1=Math.max(x1,nd.x+nd.r+12);y1=Math.max(y1,nd.y+nd.r+12);
    }
    const bw=Math.max(1,x1-x0),bh=Math.max(1,y1-y0);
    const k=Math.min(3,Math.max(0.1,Math.min(w/bw,h/bh)));
    return{k,x:w/2-k*(x0+x1)/2,y:h/2-k*(y0+y1)/2};
  },[graph,dim]);
  useEffect(()=>{setView(v=>fitView.k===v.k&&fitView.x===v.x&&fitView.y===v.y?v:fitView)},[fitView]);

  const clamped=(v:View):View=>{
    const{w,h}=dimRef.current;
    const k=Math.min(8,Math.max(0.08,v.k));
    return{k,x:Math.min(w/2+w*0.9,Math.max(w/2-w*0.9,v.x)),y:Math.min(h/2+h*0.9,Math.max(h/2-h*0.9,v.y))};
  };
  useEffect(()=>{
    const e=ref.current;if(!e)return;
    const onWheel=(ev:WheelEvent)=>{
      ev.preventDefault();
      const r=e.getBoundingClientRect();
      const mx=ev.clientX-r.left,my=ev.clientY-r.top;
      setView(v=>{
        const k2=Math.min(8,Math.max(0.08,v.k*Math.exp(-ev.deltaY*0.0016)));
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
  const pickSource=(d:string)=>{
    if(suppress.current){suppress.current=false;return}
    onSelectSource(d);
  };
  const pickStory=(key:string,title:string)=>{
    if(suppress.current){suppress.current=false;return}
    onSelectStory(key,title);
  };
  const move=(e:React.MouseEvent,html:string)=>{
    const r=ref.current!.getBoundingClientRect();
    setTip({x:e.clientX-r.left+12,y:e.clientY-r.top+12,html});
  };

  const selSource=source&&graph.outletNodes.some(x=>x.o.domain===source)?source:null;
  const selStory=story&&graph.hubNodes.some(x=>x.h.key===story)?story:null;
  const srcPartners=useMemo(()=>{
    const s=new Set<string>();
    if(!selSource)return s;
    for(const r of graph.repEdges){
      if(r.e.source===selSource)s.add(r.e.target);
      if(r.e.target===selSource)s.add(r.e.source);
    }
    return s;
  },[graph,selSource]);
  const srcHubs=useMemo(()=>new Set(graph.hubNodes.filter(x=>x.h.members.includes(selSource!)).map(x=>x.h.key)),[graph,selSource]);
  const storyMembers=useMemo(()=>{
    const m=new Set<string>();
    if(!selStory)return m;
    const hub=graph.hubNodes.find(x=>x.h.key===selStory);
    if(hub)for(const d of hub.h.members)m.add(d);
    return m;
  },[graph,selStory]);

  const inWin=(arr:number[]):boolean=>{
    for(let h=hours[0];h<=hours[1];h++)if(arr[h]>0)return true;
    return false;
  };
  const outletOp=(o:RepostOutlet,lit:boolean):number=>{
    let f=lit?1:0.3;
    if(selSource)f*=o.domain===selSource?1:srcPartners.has(o.domain)?0.85:0.2;
    else if(selStory)f*=storyMembers.has(o.domain)?1:0.16;
    return Math.min(1,Math.max(0.06,f));
  };
  const hubOp=(h:RepostStory,lit:boolean):number=>{
    let f=lit?1:0.3;
    if(selStory)f*=h.key===selStory?1:0.18;
    else if(selSource)f*=srcHubs.has(h.key)?0.85:0.16;
    return Math.min(1,Math.max(0.06,f));
  };
  const repOp=(e:RepostEdge,lit:boolean):number=>{
    let f=lit?1:0.14;
    if(selSource)f*=(e.source===selSource||e.target===selSource)?1:0.12;
    else if(selStory){
      f*=e.source!==selSource&&e.target!==selSource&&storyMembers.has(e.source)&&storyMembers.has(e.target)?1:0.08;
    }
    const base=Math.min(0.95,0.3+0.12*Math.log2(e.count));
    return base*f;
  };
  const pairOp=(hub:string,domain:string,lit:boolean):number=>{
    let f=lit?1:0.3;
    if(selStory)f*=hub===selStory?1:0.12;
    else if(selSource)f*=domain===selSource&&srcHubs.has(hub)?1:0.12;
    return Math.min(1,0.5*f+0.12);
  };

  const w=dim.w,h=dim.h;
  const zoomed=Math.abs(view.k-fitView.k)>1e-6||Math.abs(view.x-fitView.x)>0.5||Math.abs(view.y-fitView.y)>0.5;
  const showRep=mode!=='pair',showPair=mode!=='repost',showHubs=mode!=='repost';
  const k=view.k;
  const labelIds=new Set(graph.topLabels);
  if(selSource)labelIds.add(selSource);
  if(hoverNode)labelIds.add(hoverNode);
  const hubLabelIds=new Set<string>();
  if(selStory)hubLabelIds.add('story\u0000'+selStory);
  if(hoverNode&&hoverNode.startsWith('story\u0000'))hubLabelIds.add(hoverNode);

  return <div className="net-body">
    <div className="net-bar">
      <div className="segment" role="group" aria-label="网络视图">
        {MODES.map(([m,label])=><button key={m} aria-pressed={mode===m} onClick={()=>setMode(m)}>{label}</button>)}
      </div>
      <div className="segment" role="group" aria-label="媒体活跃度阈值">
        {TH_OPTIONS.map(v=><button key={v} aria-pressed={th===v} title={`至少参与 ${v} 篇同题转载的媒体`} onClick={()=>setTh(v)}>≥{v}</button>)}
      </div>
      <span className="net-counts" title="媒体=参与同题转载的媒体数 · 通稿=同题转载簇 · 转载=媒体间有向转载关系数">
        媒体 {graph.outletNodes.length}{graph.outletCapped?'+':''} · 通稿 {graph.hubNodes.length}{graph.hubCapped?'+':''} · 转载 {graph.repEdges.length}
      </span>
    </div>
    <div ref={ref} className={dragging?'net-wrap dragging':'net-wrap'} role="img" aria-label="媒体转载网络" onPointerDown={down} onDoubleClick={()=>setView(fitView)}>
      {graph.nodes.length<2
        ?<p className="empty">当前筛选下没有可成网的转载关系（可尝试降低活跃度阈值）</p>
        :<>
        <svg width={w} height={h}>
          <defs>
            <marker id="net-arrow" viewBox="0 0 8 8" refX="7.4" refY="4" markerWidth="4.6" markerHeight="4.6" orient="auto">
              <path d="M0.5,0.8 L7.6,4 L0.5,7.2 Z" fill={EDGE_COLOR}/>
            </marker>
          </defs>
          <g transform={`translate(${view.x} ${view.y}) scale(${k})`}>
            {showRep&&graph.repEdges.map((r,i)=>{
              const lit=inWin(r.e.hours);
              const hl=selSource&&(r.e.source===selSource||r.e.target===selSource);
              return <g key={i}>
                <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={hl?HL_COLOR:EDGE_COLOR} strokeWidth={0.7+0.45*Math.log2(r.e.count)} opacity={repOp(r.e,lit)} markerEnd="url(#net-arrow)" strokeLinecap="round"/>
                <line x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke="transparent" strokeWidth={7/k} style={{pointerEvents:'stroke'}}
                  onMouseMove={e=>move(e,`<b>${r.e.source} → ${r.e.target}</b><br>转载 ${fmt.format(r.e.count)} 次 · 首次 ${minuteLabel(r.e.firstMinute)}`)}
                  onMouseLeave={()=>setTip(null)}/>
              </g>;
            })}
            {showPair&&graph.pairEdges.map((p,i)=>{
              const hub=graph.hubNodes.find(x=>x.h.key===p.hub)!;
              const lit=inWin((hub.node.ref as RepostStory).hours);
              const hl=selStory&&p.hub===selStory;
              return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} stroke={hl?PAIR_HL:PAIR_COLOR} strokeWidth={0.7} opacity={pairOp(p.hub,p.domain,lit)} strokeLinecap="round"/>;
            })}
            <g>
              {showHubs&&graph.hubNodes.map(({h,node})=>{
                const lit=inWin(h.hours);
                return <path key={h.key} d={`M ${node.x},${node.y-node.r} L ${node.x+node.r},${node.y} L ${node.x},${node.y+node.r} L ${node.x-node.r},${node.y} Z`}
                  fill={HUB_COLOR} stroke={selStory===h.key?HL_COLOR:'#fff'} strokeWidth={(selStory===h.key?1.5:0.6)/k}
                  className="net-node" opacity={hubOp(h,lit)}
                  onMouseMove={e=>{setHoverNode('story\u0000'+h.key);move(e,`<b>${h.title.length>44?h.title.slice(0,44)+'…':h.title}</b><br>${fmt.format(h.members.length)} 家媒体 · ${fmt.format(h.count)} 篇 · 首发 ${h.firstDomain} ${hourLabel(h.firstHour)}<br><span class="tip-sub">点击聚焦该通稿</span>`)}}
                  onMouseLeave={()=>{setHoverNode(null);setTip(null)}}
                  onClick={e=>{e.stopPropagation();pickStory(h.key,h.title)}}/>;
              })}
            </g>
            <g>
              {graph.outletNodes.map(({o,node})=>{
                const lit=inWin(o.hours);
                return <circle key={o.domain} cx={node.x} cy={node.y} r={node.r}
                  fill={node.color} stroke={selSource===o.domain?HL_COLOR:'#fff'} strokeWidth={(selSource===o.domain?1.6:0.55)/k}
                  className="net-node" opacity={outletOp(o,lit)}
                  onMouseMove={e=>{setHoverNode(o.domain);move(e,`<b>${o.domain}</b><br>参与 ${fmt.format(o.articles)} 篇同题转载 · 触达 ${compact.format(o.reach)}<br>首发 ${fmt.format(o.firsts)} 次 · 转出 ${fmt.format(o.out)} · 转入 ${fmt.format(o.incoming)}<br><span class="tip-sub">${o.lang} · 点击筛选该媒体</span>`)}}
                  onMouseLeave={()=>{setHoverNode(null);setTip(null)}}
                  onClick={e=>{e.stopPropagation();pickSource(o.domain)}}/>;
              })}
            </g>
            <g>
              {graph.outletNodes.map(({o,node})=>labelIds.has(o.domain)?<text key={o.domain} className="net-label" x={node.x} y={node.y-node.r-3.5/k} textAnchor="middle" style={{fontSize:10/k,strokeWidth:3/k}}>{node.label.length>24?node.label.slice(0,23)+'…':node.label}</text>:null)}
              {graph.hubNodes.map(({h,node})=>hubLabelIds.has('story\u0000'+h.key)?<text key={h.key} className="net-label story" x={node.x} y={node.y+node.r+9/k} textAnchor="middle" style={{fontSize:10/k,strokeWidth:3/k}}>{h.title.length>20?h.title.slice(0,20)+'…':h.title}</text>:null)}
            </g>
          </g>
        </svg>
        {tip&&<div className="tip" style={{left:tip.x,top:tip.y}} dangerouslySetInnerHTML={{__html:tip.html}}/>}
        {zoomed&&<button className="map-reset" onClick={()=>setView(fitView)}>复位视图</button>}
        </>}
    </div>
    {platforms&&<PlatformLegend platforms={platforms} selected={source} onSelect={onSelectSource}/>}
    <div className="net-legend">
      <span className="samp"><svg width="20" height="8"><line x1="1" y1="4" x2="14" y2="4" stroke={EDGE_COLOR} strokeWidth="1.4"/><path d="M14 1.4 L19.6 4 L14 6.6 Z" fill={EDGE_COLOR}/></svg><em>转载方向</em></span>
      <span className="samp"><svg width="10" height="10"><path d="M5 0 L10 5 L5 10 L0 5 Z" fill={HUB_COLOR}/></svg><em>同题通稿</em></span>
      <span className="samp" style={{color:'var(--muted)'}}>点=筛选 · 大小=转载活跃度 · 色=平台</span>
    </div>
  </div>;
}
