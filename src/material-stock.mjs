export const materialNames = ['Cチャンネル', 'ダブルバー', 'シングルバー'];
export const minimumJoinedPieceLength = 1250;
class MaterialLayoutError extends Error {}

export function getMaterialStockSpec(name,settings={}){
  const channel=name==='Cチャンネル';
  const settingKey=channel?'channelStockLength':name==='ダブルバー'?'doubleBarStockLength':'singleBarStockLength';
  const selected=Number(settings[settingKey]) || (!channel && Number(settings.barStockLength)) || (channel?4000:5000);
  const standardBar=!channel && (selected===5000 || selected===5005);
  return {stockLength:standardBar?5005:selected,nominalStockLength:standardBar?5000:selected,jointAllowance:channel?15:0};
}

export function getScrewsPerSheet(settings={}){
  const value=Number(settings.screwsPerSheet);
  if(Number.isSafeInteger(value) && value>0) return value;
  if(Number(settings.barPitch)===227 && Number(settings.barW)===455) return 14;
  if(Number(settings.barPitch)===303 && Number(settings.barW)===910) return 18;
  return 35;
}

export function calculateScrewCount(boardCount,settings={}){
  return boardCount*getScrewsPerSheet(settings);
}

export function getScrewResultName(settings={}){
  const pitch=Number(settings.barPitch),width=Number(settings.barW);
  return (pitch===227 && width===455) || (pitch===303 && width===910) ? 'カラービス' : 'ビス';
}

export function planMaterialPurchases(plan){
  if(plan.error) return null;
  const pieces=plan.groups.flatMap(group=>Array.from({length:group.count},()=>group.pieces).flat()).sort((a,b)=>b-a);
  const stockCuts=[];
  // First-fit decreasing combines cuts from this material only; remaining
  // offcuts are discarded. This is a feasible estimate, not an optimality claim.
  for(const piece of pieces){
    if(!Number.isFinite(piece) || piece<=0 || piece>plan.stockLength) return null;
    let stock=stockCuts.find(cut=>cut.remaining+0.000001>=piece);
    if(!stock){
      stock={pieces:[],remaining:plan.stockLength};
      stockCuts.push(stock);
    }
    stock.pieces.push(piece);
    stock.remaining=precise(Math.max(0,stock.remaining-piece));
  }
  return {count:stockCuts.length,stockCuts};
}

export function formatMaterialValue(item){
  if(item.stockPlan?.error) return item.stockPlan.error;
  if(!item.stockPlan?.groups.length) return item.value;
  let groups=item.stockPlan.groups;
  if(materialNames.includes(item.name)){
    const merged=new Map();
    for(const group of groups){
      const reversed=[...group.pieces].reverse();
      const difference=group.pieces.findIndex((piece,index)=>piece!==reversed[index]);
      const minimumFirst=group.pieces.includes(minimumJoinedPieceLength);
      const reverse=difference>=0 && (minimumFirst ? group.pieces[difference]>reversed[difference] : group.pieces[difference]<reversed[difference]);
      const pieces=reverse ? reversed : group.pieces;
      const key=JSON.stringify([group.length,pieces]);
      const previous=merged.get(key);
      if(previous) previous.count+=group.count;
      else merged.set(key,{length:group.length,pieces,count:group.count});
    }
    groups=[...merged.values()];
  }
  return groups.map(group=>{
    const dimensions=group.pieces.length>1 ? `(${group.length})${group.pieces.join('.')}` : String(group.length);
    return `${dimensions} × ${group.count}本`;
  }).join('　');
}

export function hasNonZeroQuantity(item){
  if(item.stockPlan?.error) return true;
  if(item.stockPlan) return item.stockPlan.groups.some(group=>group.count>0);
  const value=String(item.value).replace(/,/g,'');
  const quantities=[...value.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:本|コ|個|枚|発|kg|g|坪|㎡)/g)];
  if(quantities.length) return quantities.some(match=>Number(match[1])!==0);
  return !/^\s*0(?:\.0+)?\s*$/.test(value);
}

const precise=value=>Math.round(value*1e6)/1e6;

function splitFromFirst(length,stockLength,first){
  if(length<=stockLength) return [length];
  const pieces=[first];
  const remaining=precise(length-first);
  const full=Math.floor(remaining/stockLength);
  pieces.push(...Array(full).fill(stockLength));
  const last=precise(remaining-full*stockLength);
  if(last>0) pieces.push(last);
  return pieces;
}

function jointPositions(pieces,start,jointAllowance=0){
  let position=start;
  return pieces.slice(0,-1).map(piece=>{
    const center=precise(position+piece+jointAllowance/2);
    position=precise(position+piece+jointAllowance);
    return center;
  });
}

export function staggeredPieces(length,stockLength,rowIndex,start=0,previousJoints=[],options={}){
  if(length<=stockLength) return [length];
  const {nominalStockLength=stockLength,jointAllowance=0}=options;
  const minimum=minimumJoinedPieceLength;
  const count=Math.ceil((length+jointAllowance)/(stockLength+jointAllowance));
  if(stockLength<minimum || length-(count-1)*jointAllowance<count*minimum){
    throw new MaterialLayoutError('割付不可：継ぐ部材をすべて1250mm以上にできません');
  }
  // Add one allowance to the target and each stock span, then remove it from
  // each cut piece. This leaves exactly one 15mm gap per channel connection.
  const span=stockLength+jointAllowance;
  const target=length+jointAllowance;
  const remainder=precise(target%span);
  const nominalRemainder=precise(length%nominalStockLength);
  let preferred=nominalRemainder
    ? (rowIndex%2 ? (remainder||nominalStockLength/2) : span)
    : (rowIndex%2 ? span : nominalStockLength/2);
  if(remainder>0 && remainder<minimum+jointAllowance){
    preferred=rowIndex%2 ? span-(minimum+jointAllowance-remainder) : minimum+jointAllowance;
  }
  const makePieces=first=>{
    const pieces=splitFromFirst(target,span,first).map(piece=>precise(piece-jointAllowance));
    // Transfer length from neighboring cuts without changing the assembled span.
    for(let i=0;i<pieces.length;i++){
      if(pieces[i]>=minimum) continue;
      let needed=precise(minimum-pieces[i]);
      for(let distance=1;distance<pieces.length && needed>0;distance++){
        for(const j of [i-distance,i+distance]){
          if(j<0 || j>=pieces.length) continue;
          const moved=Math.min(needed,Math.max(0,pieces[j]-minimum));
          pieces[j]=precise(pieces[j]-moved);
          pieces[i]=precise(pieces[i]+moved);
          needed=precise(needed-moved);
        }
      }
    }
    return pieces;
  };
  const isClear=pieces=>pieces.every(piece=>piece>=minimum && piece<=stockLength) && jointPositions(pieces,start,jointAllowance).every(position=>previousJoints.every(previous=>Math.abs(previous-position)>0.000001));
  for(const first of [preferred,span,nominalStockLength/2,remainder,span/2].filter(value=>value>jointAllowance && value<=span)){
    const pieces=makePieces(first);
    if(isClear(pieces)) return pieces;
  }
  // Different stock lengths or stepped outlines can defeat reversal. Choose a
  // phase between the previous row's joint positions, in the same coordinates.
  const phases=[jointAllowance,span,...previousJoints.map(position=>precise(((position-start+jointAllowance/2)%span+span)%span))].sort((a,b)=>a-b);
  for(let i=1;i<phases.length;i++){
    if(phases[i]-phases[i-1]<=0.000002) continue;
    const pieces=makePieces((phases[i]+phases[i-1])/2);
    if(isClear(pieces)) return pieces;
  }
  // Pick cuts within feasible bounds when redistribution collapses trial phases
  // onto the same joint. The bounds reserve at least 1250mm for every later cut.
  for(const size of [count,count+1]){
    let remaining=precise(length-(size-1)*jointAllowance),position=start;
    if(remaining<size*minimum) continue;
    const pieces=[];
    for(let i=0;i<size-1;i++){
      const later=size-i-1;
      const low=Math.max(minimum,precise(remaining-later*stockLength));
      const high=Math.min(stockLength,precise(remaining-later*minimum));
      const forbidden=previousJoints.map(joint=>precise(joint-position-jointAllowance/2)).filter(cut=>cut>=low && cut<=high);
      const bounds=[low,...forbidden,high].sort((a,b)=>a-b);
      const candidates=[...bounds.slice(1).map((bound,index)=>precise((bounds[index]+bound)/2)),low,high];
      const cut=candidates.find(value=>value>=low && value<=high && forbidden.every(other=>Math.abs(value-other)>0.000001));
      if(cut===undefined) break;
      pieces.push(cut);
      remaining=precise(remaining-cut);
      position=precise(position+cut+jointAllowance);
    }
    if(pieces.length===size-1){
      pieces.push(remaining);
      if(isClear(pieces)) return pieces;
    }
  }
  throw new MaterialLayoutError('割付不可：1250mm以上を保って隣の継ぎ目をずらせません');
}

export function planStaggeredBars(barPlan,settings={}){
  return planStaggeredLines(barPlan.barAxis,[
    {name:'ダブルバー',lines:barPlan.doubleLines||[],...getMaterialStockSpec('ダブルバー',settings)},
    {name:'シングルバー',lines:barPlan.singleLines||[],...getMaterialStockSpec('シングルバー',settings)},
  ]);
}

export function planStaggeredChannels(channelPlan,settings={}){
  return planStaggeredLines(channelPlan.channelAxis,[
    {name:'Cチャンネル',lines:channelPlan.channelLines||[],...getMaterialStockSpec('Cチャンネル',settings)},
  ])['Cチャンネル'];
}

function planStaggeredLines(axis,types){
  const horizontal=axis!=='V';
  const along=horizontal?'x':'y';
  const across=horizontal?'y':'x';
  const plans=Object.fromEntries(types.map(({name,stockLength,nominalStockLength,jointAllowance})=>[name,{stockLength,nominalStockLength,jointAllowance,groups:[],stockCount:0,joints:0,runs:[]} ]));
  const rows=types.flatMap(({name,lines})=>lines.map(line=>({name,
    position:precise((line.a[across]+line.b[across])/2),
    start:Math.min(line.a[along],line.b[along]),
    length:Math.round(Math.hypot(line.b.x-line.a.x,line.b.y-line.a.y))
  }))).filter(row=>row.length>1).sort((a,b)=>a.position-b.position||a.start-b.start);
  let rowIndex=-1,position,previousJoints=[],currentJoints=[];
  for(const row of rows){
    if(position!==row.position){
      previousJoints=currentJoints;
      currentJoints=[];
      position=row.position;
      rowIndex++;
    }
    const plan=plans[row.name];
    let pieces;
    try{
      pieces=staggeredPieces(row.length,plan.stockLength,rowIndex,row.start,previousJoints,plan);
    }catch(error){
      if(!(error instanceof MaterialLayoutError)) throw error;
      plan.error=error.message;
      continue;
    }
    const positions=jointPositions(pieces,row.start,plan.jointAllowance);
    currentJoints.push(...positions);
    const key=pieces.join('+');
    let group=plan.groups.find(group=>group.length===row.length && group.pieces.join('+')===key);
    if(!group){
      group={length:row.length,count:0,pieces,stockCount:0,joints:0};
      plan.groups.push(group);
    }
    group.count++;
    group.stockCount+=pieces.length;
    group.joints+=positions.length;
    plan.stockCount+=pieces.length;
    plan.joints+=positions.length;
    plan.runs.push({...row,rowIndex,pieces,jointPositions:positions});
  }
  return plans;
}

// Preview estimate: each run uses fresh stock; saw kerf is not included.
export function planStock(value, stockLength,options={}) {
  if (!Number.isFinite(stockLength) || stockLength<1) throw new Error('Stock length must be at least 1mm');
  const groups = [...String(value).matchAll(/(\d+(?:\.\d+)?)\s*[×xX]\s*(\d+)\s*本/g)].map(match => {
    const length = Number(match[1]);
    const count = Number(match[2]);
    const allowance=options.jointAllowance||0;
    let pieces=length<=stockLength?[length]:splitFromFirst(length+allowance,stockLength+allowance,stockLength+allowance).map(piece=>precise(piece-allowance));
    if(pieces.length>1 && pieces.some(piece=>piece<minimumJoinedPieceLength)){
      try{
        pieces=staggeredPieces(length,stockLength,0,0,[],options);
      }catch(error){
        if(!(error instanceof MaterialLayoutError)) throw error;
        return {length,count,pieces:[],stockCount:0,joints:0,leftover:0,error:count>0?error.message:undefined};
      }
    }
    return {length, count, pieces, stockCount: pieces.length * count,
      joints: Math.max(0, pieces.length - 1) * count,
      leftover: precise(pieces.length*stockLength-pieces.reduce((sum,piece)=>sum+piece,0))};
  });
  return {stockLength,...options, groups,error:groups.find(group=>group.error)?.error, stockCount: groups.reduce((n,g)=>n+g.stockCount,0),
    joints: groups.reduce((n,g)=>n+g.joints,0)};
}

export function withStockResults(results, settings, barPlan, channelPlan) {
  const plans = Object.fromEntries(materialNames.map(name=>{
    const spec=getMaterialStockSpec(name,settings);
    return [name,planStock(results.find(item=>item.name===name)?.value || '',spec.stockLength,spec)];
  }));
  if(barPlan) Object.assign(plans,planStaggeredBars(barPlan,settings));
  if(channelPlan) plans['Cチャンネル']=planStaggeredChannels(channelPlan,settings);
  return results.flatMap(item=>{
    const stockPlan = plans[item.name];
    if(stockPlan && (stockPlan.groups.length || stockPlan.error)) return [{...item,stockPlan:{...stockPlan,purchaseCount:planMaterialPurchases(stockPlan)?.count ?? null},stockSettingKey:item.name==='Cチャンネル'?'channelStockLength':item.name==='ダブルバー'?'doubleBarStockLength':'singleBarStockLength'}];
    if(item.name==='シングルクリップ') return [item,
      {name:'ダブルジョイント',value:plans['ダブルバー'].error?'算出不可':`${plans['ダブルバー'].joints} コ`,category:'joint',stockSettingKey:'doubleBarStockLength'},
      {name:'シングルジョイント',value:plans['シングルバー'].error?'算出不可':`${plans['シングルバー'].joints} コ`,category:'joint',stockSettingKey:'singleBarStockLength'},
      {name:'チャンネルジョイント',value:plans['Cチャンネル'].error?'算出不可':`${plans['Cチャンネル'].joints} コ`,category:'joint',stockSettingKey:'channelStockLength'}];
    return [item];
  });
}
