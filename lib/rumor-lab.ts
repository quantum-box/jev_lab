export type RumorLabel = 'supported' | 'contradiction' | 'omission' | 'exaggeration' | 'addition';
export type RumorScenario = { id:string; title:string; original:string; path:string[]; maxWords:number; verification:boolean; expected:RumorLabel[] };
export type RumorNode = { id:string; speaker:string; parentId:string|null; message:string; label:RumorLabel; humanLabel:RumorLabel; changed:string[]; cost:number; latencyMs:number };
export type RumorRun = { scenario:RumorScenario; nodes:RumorNode[]; stopped:boolean; stopReason:string; totalCost:number; totalLatencyMs:number; metrics:{ unintendedChangeRate:number; assertionRate:number; detectorAccuracy:number; falsePositiveRate:number } };

export const rumorScenarios:RumorScenario[] = Array.from({length:10},(_,i)=>({
  id:`rumor-${i+1}`, title:`架空シナリオ ${i+1}`,
  original:i%2===0?'架空の港で試験船が火曜に到着する可能性がある。':'架空の研究所は金曜までに予備結果を共有する予定だ。',
  path:['発信者','中継A','中継B','受信者'].slice(0,3+(i%2)), maxWords:i%3===0?16:28, verification:i%2===0,
  expected:i%3===0?['supported','omission','exaggeration']:i%3===1?['supported','addition','contradiction']:['supported','supported','omission'],
}));

function transform(message:string,label:RumorLabel,maxWords:number,verification:boolean){
  let next=message;
  if(label==='omission') next=message.replace(/火曜に|金曜までに|予備/g,'').replace(/\s+/g,' ');
  if(label==='exaggeration') next=message.replace(/可能性がある|予定だ/g,'確定した');
  if(label==='addition') next=message+' 責任者は承認済みだ。';
  if(label==='contradiction') next=message.replace(/火曜/g,'木曜').replace(/金曜/g,'月曜');
  if(verification && (label==='addition'||label==='exaggeration')) next=message+'（原文確認済み）';
  return next.split(/\s+/).slice(0,maxWords).join(' ');
}
export function runRumorScenario(scenario:RumorScenario,budget=20):RumorRun{
  const nodes:RumorNode[]=[]; let message=scenario.original,totalCost=0,totalLatencyMs=0;
  for(let i=0;i<scenario.path.length;i++){
    const humanLabel=i===0?'supported':scenario.expected[Math.min(i-1,scenario.expected.length-1)];
    const cost=1.5+i*.2; if(totalCost+cost>budget) break;
    const next=i===0?message:transform(message,humanLabel,scenario.maxWords,scenario.verification);
    const label=next===message?'supported':humanLabel;
    nodes.push({id:`${scenario.id}-n${i}`,speaker:scenario.path[i],parentId:i?`${scenario.id}-n${i-1}`:null,message:next,label,humanLabel,changed:label==='supported'?[]:[label],cost,latencyMs:40+i*7});
    message=next; totalCost+=cost; totalLatencyMs+=40+i*7;
  }
  const judged=nodes.slice(1); const correct=judged.filter(n=>n.label===n.humanLabel).length;
  const changed=judged.filter(n=>n.label!=='supported').length; const assertive=judged.filter(n=>n.label==='exaggeration'||n.label==='addition').length;
  return {scenario,nodes,stopped:nodes.length<scenario.path.length,stopReason:nodes.length<scenario.path.length?'budget cap':'path completed',totalCost,totalLatencyMs,metrics:{unintendedChangeRate:changed/Math.max(1,judged.length),assertionRate:assertive/Math.max(1,judged.length),detectorAccuracy:correct/Math.max(1,judged.length),falsePositiveRate:0}};
}
export const rumorFixedRun=runRumorScenario(rumorScenarios[0]);

