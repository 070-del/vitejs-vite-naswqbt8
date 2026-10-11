export function getBoardLabelRegions(tile,polygon,pointInside){
  const left=tile.x,right=tile.x+tile.width,top=tile.y,bottom=tile.y+tile.height;
  const xs=[...new Set([left,right,...polygon.map(p=>p.x).filter(x=>x>left && x<right)])].sort((a,b)=>a-b);
  const ys=[...new Set([top,bottom,...polygon.map(p=>p.y).filter(y=>y>top && y<bottom)])].sort((a,b)=>a-b);
  const cells=new Map();
  for(let row=0;row<ys.length-1;row++){
    for(let col=0;col<xs.length-1;col++){
      const rect={x:xs[col],y:ys[row],width:xs[col+1]-xs[col],height:ys[row+1]-ys[row]};
      if(rect.width<=1e-8 || rect.height<=1e-8) continue;
      if(pointInside({x:rect.x+rect.width/2,y:rect.y+rect.height/2},polygon)) cells.set(`${col},${row}`,{col,row,rect});
    }
  }
  // Orthogonal polygon edges partition the tile into exact rectangular cells.
  // Label each edge-connected component, retaining its original sheet number.
  const regions=[];
  while(cells.size){
    const first=cells.values().next().value;
    cells.delete(`${first.col},${first.row}`);
    const pending=[first],component=[];
    while(pending.length){
      const cell=pending.pop();
      component.push(cell.rect);
      for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]){
        const key=`${cell.col+dx},${cell.row+dy}`;
        const neighbor=cells.get(key);
        if(neighbor){cells.delete(key);pending.push(neighbor);}
      }
    }
    const x=Math.min(...component.map(rect=>rect.x));
    const y=Math.min(...component.map(rect=>rect.y));
    const width=Math.max(...component.map(rect=>rect.x+rect.width))-x;
    const height=Math.max(...component.map(rect=>rect.y+rect.height))-y;
    const area=component.reduce((sum,rect)=>sum+rect.width*rect.height,0);
    const usedRect=Math.abs(area-width*height)<1e-6 ? {x,y,width,height} : component.reduce((best,rect)=>rect.width*rect.height>best.width*best.height?rect:best);
    regions.push({...tile,usedRect});
  }
  return regions;
}
