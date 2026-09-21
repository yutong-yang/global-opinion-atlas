'use client';
import {useMemo,useState} from 'react';
import {Article,regionBreakdown,name,fmt,compact} from '../lib/data';

export default function RegionPanel({filtered,country,selectedState,onSelectState}:{filtered:Article[];country:string|null;selectedState:string|null;onSelectState:(state:string|null)=>void}){
  const[expandedState,setExpandedState]=useState<string|null>(null);
  const{states,totalWithState,totalWithCity}=useMemo(()=>regionBreakdown(filtered),[filtered]);
  const maxArticles=useMemo(()=>Math.max(1,...states.map(s=>s.articles)),[states]);
  const coverage=filtered.length?Math.round(totalWithState/filtered.length*100):0;
  const handleSelect=(s:string)=>{
    onSelectState(selectedState===s?null:s);
    setExpandedState(selectedState===s?null:s);
  };
  if(!country)return null;
  if(!states.length)return null;
  const expandedCities=expandedState?states.find(s=>s.name===expandedState):null;
  const cityList=expandedCities?[...expandedCities.cities.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8):[];
  const maxCity=cityList.length?cityList[0][1]:1;
  return <section className="panel side-panel region-panel">
    <h3>地区分布 <small>{name(country)} · {totalWithState} 篇有州/省信息（{coverage}%） · {totalWithCity} 篇有城市信息</small></h3>
    <div className="region-list">
      {states.slice(0,20).map(s=><div key={s.name} className="region-group">
        <button className={selectedState===s.name?'region-row active':'region-row'} onClick={()=>handleSelect(s.name)}
          title={`${s.name}：${s.articles} 篇 · 触达 ${compact.format(s.reach)} · ${s.cities.size} 个城市`}>
          <span className="region-name">{s.name}</span>
          <span className="region-bar"><i style={{width:`${s.articles/maxArticles*100}%`}}/></span>
          <b>{fmt.format(s.articles)}</b>
        </button>
        {expandedState===s.name&&cityList.length>0&&<div className="city-list">
          {cityList.map(([city,count])=><div key={city} className="city-row">
            <span className="city-name">{city}</span>
            <span className="city-bar"><i style={{width:`${count/maxCity*100}%`}}/></span>
            <b>{fmt.format(count)}</b>
          </div>)}
        </div>}
      </div>)}
    </div>
    {states.length>20&&<p className="region-more">显示前 20 个州/省，共 {states.length} 个</p>}
  </section>;
}
