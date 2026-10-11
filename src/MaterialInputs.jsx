import {useState} from 'react';
import {getScrewsPerSheet} from './material-stock.mjs';

export function BoltMemoInput({settings,setSettings}){
  const value=settings.boltMemoMm ?? '';
  const [draft,setDraft]=useState(null);
  const commit=()=>{
    const text=draft ?? String(value);
    const next=text.trim()==='' ? '' : Number(text);
    if(next==='' || (Number.isFinite(next) && next>=0)){
      setSettings(prev=>({...prev,boltMemoMm:next}));
    }
    setDraft(null);
  };
  return <label className="stockLengthField boltMemoField">
    <input type="number" inputMode="decimal" min="0" step="any" aria-label="ボルトの寸法メモ（mm）" value={draft ?? String(value)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
    <span>mm</span>
  </label>;
}

export function ScrewsPerSheetInput({settings,setSettings}){
  const value=getScrewsPerSheet(settings);
  const [draft,setDraft]=useState(null);
  const commit=()=>{
    const next=Number(draft ?? value);
    if(Number.isSafeInteger(next) && next>0){
      setSettings(prev=>({...prev,screwsPerSheet:next}));
    }
    setDraft(null);
  };
  return <label className="stockLengthField screwCountField">
    <input type="number" inputMode="numeric" min="1" step="1" aria-label="ボード1枚あたりのビス本数（発）" value={draft ?? String(value)} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
    <span>発/枚</span>
  </label>;
}

export function StockLengthInput({settings,setSettings,settingKey,label}){
  const length=Number(settings[settingKey])||(settingKey==='channelStockLength'?4000:5000);
  const [draft,setDraft]=useState(null);
  const text=draft ?? String(length/1000);
  const parsed=Number(text)*1000;
  const valid=text.trim()!=='' && Number.isFinite(parsed) && parsed>=1 && parsed<=Number.MAX_SAFE_INTEGER;
  const commit=()=>{
    if(valid){
      const next=Math.round(parsed);
      setSettings(prev=>({...prev,[settingKey]:next}));
    }
    setDraft(null);
  };
  return <label className="stockLengthField">
    <input type="number" inputMode="decimal" min="0.001" step="0.001" aria-label={label+'の材料長さ（m）'} value={text} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
    <span>m</span>
  </label>;
}
