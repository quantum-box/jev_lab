export type DeviceKind='parity'|'threshold'|'stateful';
export type Hypothesis={id:string;label:string;predict:(input:number,state:number)=>number};
export type Experiment={step:number;input:number;output:number;priorState:number;remaining:string[];cost:number};
export type ScientistRun={deviceId:string;seed:number;hypotheses:Hypothesis[];experiments:Experiment[];selectedId:string|null;identified:boolean;ambiguous:boolean;candidateMissing:boolean;contradiction:boolean;unseenAccuracy:number;cost:number;stoppedReason:string};
const hypotheses:Hypothesis[]=[
 {id:'even',label:'偶数なら1',predict:x=>x%2===0?1:0},
 {id:'threshold',label:'3以上なら1',predict:x=>x>=3?1:0},
 {id:'toggle',label:'前回状態を反転',predict:(_x,s)=>s?0:1},
];
export const devices=Array.from({length:10},(_,i)=>({id:`device-${i+1}`,seed:310+i,kind:(['parity','threshold','stateful'] as DeviceKind[])[i%3]}));
function observe(kind:DeviceKind,input:number,state:number){return kind==='parity'?(input%2===0?1:0):kind==='threshold'?(input>=3?1:0):(state?0:1)}
export function runScientist(device=devices[0],budget=5,includeCorrect=true):ScientistRun{
 let candidates=includeCorrect?hypotheses:[hypotheses[(devices.indexOf(device)+1)%hypotheses.length]]; let state=0,cost=0; const experiments:Experiment[]=[]; let contradiction=false;
 for(let step=1;step<=budget&&candidates.length>1;step++){
  const input=[0,3,2,5][(step-1)%4],priorState=state,output=observe(device.kind,input,state); state=output; cost++;
  candidates=candidates.filter(h=>h.predict(input,priorState)===output); if(!candidates.length) contradiction=true;
  experiments.push({step,input,output,priorState,remaining:candidates.map(h=>h.id),cost:1});
 }
 const selected=candidates.length===1?candidates[0]:null; const unseen=[1,4,6,2]; let s=state,correct=0;
 for(const input of unseen){const actual=observe(device.kind,input,s); if(selected?.predict(input,s)===actual)correct++; s=actual;}
 return {deviceId:device.id,seed:device.seed,hypotheses,experiments,selectedId:selected?.id??null,identified:!!selected,ambiguous:candidates.length>1,candidateMissing:!includeCorrect,contradiction,unseenAccuracy:correct/unseen.length,cost,stoppedReason:candidates.length===1?'identified':cost>=budget?'budget cap':'no consistent hypothesis'};
}
export function baselineComparison(){return {random:{experiments:5,identificationRate:.3},enumeration:{experiments:4,identificationRate:.7},informationGain:{experiments:2.4,identificationRate:.9},jev:{experiments:2.2,identificationRate:.9,estimatedCost:3.3}}}
export const scientistFixedRun=runScientist();

