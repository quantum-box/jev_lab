export type Robot={id:string;x:number;y:number;battery:number;capacity:number;failed:boolean;jobId:string|null};
export type Job={id:string;x:number;y:number;priority:number;fragile:boolean;weight:number;done:boolean};
export type SwarmEvent={step:number;type:'assign'|'move'|'complete'|'reject'|'failure';robotId?:string;jobId?:string;detail:string};
export type SwarmRun={seed:number;command:string;robots:Robot[];jobs:Job[];events:SwarmEvent[];step:number;stopped:boolean;completed:number;priorityCompleted:number;wastedMoves:number;apiCalls:number;estimatedCost:number;latencyMs:number};
export const swarmSeeds=Array.from({length:10},(_,i)=>900+i);
export function createSwarm(seed=swarmSeeds[0],count=20):SwarmRun{
 const robots=Array.from({length:count},(_,i)=>({id:`R${i+1}`,x:i%5,y:Math.floor(i/5),battery:50+(i*7+seed)%50,capacity:1+(i%3),failed:i===7&&seed%2===0,jobId:null}));
 const jobs=Array.from({length:8},(_,i)=>({id:`J${i+1}`,x:(i*2+seed)%8,y:(i*3+seed)%6,priority:i%3===0?3:1,fragile:i%4===0,weight:1+(i%3),done:false}));
 return {seed,command:'壊れ物を優先し、故障した仲間の仕事を引き継ぐ',robots,jobs,events:[],step:0,stopped:false,completed:0,priorityCompleted:0,wastedMoves:0,apiCalls:0,estimatedCost:0,latencyMs:0};
}
export function stepSwarm(run:SwarmRun):SwarmRun{
 if(run.stopped)return run; const robots=run.robots.map(r=>({...r})),jobs=run.jobs.map(j=>({...j})),events=[...run.events],step=run.step+1; const claimed=new Set<string>();
 for(const robot of robots){
  if(robot.failed){events.push({step,type:'failure',robotId:robot.id,detail:'故障個体をコード制約で停止'});continue;}
  let job=jobs.find(j=>j.id===robot.jobId&&!j.done&&!claimed.has(j.id));
  if(!job){job=jobs.filter(j=>!j.done&&!claimed.has(j.id)&&j.weight<=robot.capacity).sort((a,b)=>Number(b.fragile)-Number(a.fragile)||b.priority-a.priority||Math.abs(robot.x-a.x)+Math.abs(robot.y-a.y)-Math.abs(robot.x-b.x)-Math.abs(robot.y-b.y))[0];}
  if(!job){robot.jobId=null;continue;} claimed.add(job.id); robot.jobId=job.id; events.push({step,type:'assign',robotId:robot.id,jobId:job.id,detail:'有効な単一割当'});
  if(robot.battery<10||job.weight>robot.capacity){events.push({step,type:'reject',robotId:robot.id,jobId:job.id,detail:'容量/バッテリー制約'});robot.jobId=null;continue;}
  robot.x+=Math.sign(job.x-robot.x); robot.y+=Math.sign(job.y-robot.y); robot.battery--; events.push({step,type:'move',robotId:robot.id,jobId:job.id,detail:`(${robot.x},${robot.y})`});
  if(robot.x===job.x&&robot.y===job.y){job.done=true;robot.jobId=null;events.push({step,type:'complete',robotId:robot.id,jobId:job.id,detail:'二重処理なしで完了'});}
 }
 const completed=jobs.filter(j=>j.done).length,stopped=completed===jobs.length||step>=20;
 return {...run,robots,jobs,events,step,stopped,completed,priorityCompleted:jobs.filter(j=>j.done&&j.priority===3).length,wastedMoves:events.filter(e=>e.type==='reject').length,apiCalls:run.apiCalls+1,estimatedCost:run.estimatedCost+.8,latencyMs:run.latencyMs+55};
}
export function runSwarm(seed=swarmSeeds[0]){let run=createSwarm(seed);while(!run.stopped)run=stepSwarm(run);return run}
export const swarmFixedRun=runSwarm();

