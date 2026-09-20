import { ContinuousRuntime } from './runtime';

export type Point = { x: number; y: number };
export type ArenaAction = 'north' | 'south' | 'east' | 'west' | 'attack' | 'guard' | 'heal' | 'wait';
export type ArenaOutcome = 'running' | 'victory' | 'defeat';
export type ArenaState = {
  scenarioId: string; step: number; hero: Point; ally: Point; enemy: Point; exit: Point;
  health: number; allyHealth: number; enemyHealth: number; item: Point | null;
  obstacles: Point[]; guarding: boolean; outcome: ArenaOutcome; damageTaken: number;
};
export type ArenaScenario = { id: string; title: string; goal: string; seed: number; initial: Omit<ArenaState, 'scenarioId'|'step'|'outcome'|'damageTaken'|'guarding'> };
export const arenaActions: readonly ArenaAction[] = ['north','south','east','west','attack','guard','heal','wait'];
const point = (x:number,y:number):Point => ({x,y});
const base = (id:string,title:string,goal:string,seed:number,hero:Point,ally:Point,enemy:Point,exit:Point,item:Point|null,obstacles:Point[], health=5, allyHealth=5, enemyHealth=3):ArenaScenario => ({id,title,goal,seed,initial:{hero,ally,enemy,exit,item,obstacles,health,allyHealth,enemyHealth}});
export const scenarios: ArenaScenario[] = [
  base('survive-01','First Contact','敵を退けて生存する',488901,point(1,4),point(2,4),point(8,4),point(9,4),point(5,2),[point(4,3),point(4,4),point(4,5),point(6,3),point(6,4),point(6,5)]),
  base('survive-02','Narrow Passage','狭い通路で3ターン耐える',488902,point(1,1),point(1,2),point(8,8),point(9,9),null,[point(3,1),point(3,2),point(3,3),point(7,6),point(7,7),point(7,8)]),
  base('protect-01','Escort Signal','味方を出口まで守る',488903,point(2,8),point(1,8),point(8,2),point(9,1),point(5,7),[point(2,5),point(3,5),point(4,5),point(5,5),point(6,5)],5,4,4),
  base('protect-02','Supply Run','味方の体力を3以上で護衛する',488904,point(2,7),point(1,7),point(8,1),point(9,8),point(5,6),[point(4,2),point(5,2),point(6,2),point(4,7),point(5,7)]),
  base('recover-01','Field Kit','アイテムで体力を回復する',488905,point(1,8),point(2,8),point(8,1),point(9,9),point(3,7),[point(3,3),point(4,3),point(5,3),point(6,6)]),
  base('recover-02','Second Wind','負傷後に回復して脱出する',488906,point(3,8),point(2,8),point(7,2),point(9,9),point(4,7),[point(2,4),point(2,5),point(2,6),point(7,5),point(7,6)],3,5,3),
  base('shift-01','Tactic Shift','途中で攻撃から護衛へ切り替える',488907,point(1,5),point(2,5),point(8,5),point(9,5),point(5,1),[point(4,4),point(4,5),point(4,6),point(6,4),point(6,5),point(6,6)],5,5,5),
  base('shift-02','Changing Weather','状況に合わせて方針を変える',488908,point(1,2),point(1,3),point(8,7),point(9,8),point(3,2),[point(3,5),point(4,5),point(5,5),point(6,5),point(7,5)],4,4,4),
  base('mixed-01','Three Choices','攻撃・回復・護衛を判断する',488909,point(2,2),point(2,3),point(8,7),point(9,9),point(5,2),[point(4,1),point(4,2),point(4,3),point(7,6),point(7,7)],5,5,4),
  base('mixed-02','Last Beacon','最後のビーコンまで到達する',488910,point(1,9),point(2,9),point(7,1),point(9,0),point(3,8),[point(3,4),point(4,4),point(5,4),point(6,4),point(6,7)],4,4,4),
];
export function scenarioState(s: ArenaScenario): ArenaState { return { scenarioId:s.id, step:0, ...structuredClone(s.initial), guarding:false, outcome:'running', damageTaken:0 }; }
export function distance(a:Point,b:Point){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }
function blocked(p:Point,s:ArenaState){ return p.x<0||p.x>9||p.y<0||p.y>9||s.obstacles.some(o=>o.x===p.x&&o.y===p.y); }
function move(p:Point,a:ArenaAction){ const d = a==='north'?point(0,-1):a==='south'?point(0,1):a==='east'?point(1,0):a==='west'?point(-1,0):point(0,0); return point(p.x+d.x,p.y+d.y); }
export function candidates(s:ArenaState,tactic:string):ArenaAction[] {
  const out:ArenaAction[]=[]; for(const a of arenaActions){ if(validateAction(s,a).ok) out.push(a); }
  if(tactic.toLowerCase().includes('守')||tactic.toLowerCase().includes('protect')) return out.sort((a,b)=>(a==='guard'? -1:0)-(b==='guard'?-1:0));
  if(tactic.toLowerCase().includes('攻')||tactic.toLowerCase().includes('attack')) return out.sort((a,b)=>(a==='attack'?-1:0)-(b==='attack'?-1:0));
  return out;
}
export function validateAction(s:ArenaState,a:ArenaAction):{ok:true}|{ok:false;reason:string}{
  if(!arenaActions.includes(a)) return {ok:false,reason:'prohibited action'};
  if(s.outcome!=='running') return {ok:false,reason:'run is already complete'};
  if(['north','south','east','west'].includes(a) && blocked(move(s.hero,a),s)) return {ok:false,reason:'collision or arena boundary'};
  if(a==='attack'&&distance(s.hero,s.enemy)>1) return {ok:false,reason:'enemy is out of range'};
  if(a==='heal'&&(!s.item||distance(s.hero,s.item)>0)) return {ok:false,reason:'field kit is not here'};
  return {ok:true};
}
export function environment(s:ArenaState):ArenaState {
  if(s.outcome!=='running') return s;
  const enemy = s.enemy.x<s.hero.x?point(s.enemy.x+1,s.enemy.y):s.enemy.x>s.hero.x?point(s.enemy.x-1,s.enemy.y):s.enemy.y<s.hero.y?point(s.enemy.x,s.enemy.y+1):point(s.enemy.x,s.enemy.y-1);
  let next = {...s, step:s.step+1, enemy:blocked(enemy,s)?s.enemy:enemy, guarding:false};
  if(distance(next.enemy,next.ally)<=1){ const hit=next.guarding?0:1; next={...next,allyHealth:Math.max(0,next.allyHealth-hit),damageTaken:next.damageTaken+hit}; }
  if(next.health<=0||next.allyHealth<=0) next={...next,outcome:'defeat'};
  return next;
}
export function applyAction(s:ArenaState,a:ArenaAction):ArenaState {
  const check=validateAction(s,a); if(!check.ok) return {...s,damageTaken:s.damageTaken+1};
  let n={...s,hero:{...s.hero},item:s.item?{...s.item}:null};
  if(['north','south','east','west'].includes(a)) n.hero=move(n.hero,a);
  if(a==='attack') n.enemyHealth=Math.max(0,n.enemyHealth-1);
  if(a==='guard') n.guarding=true;
  if(a==='heal'){ n.health=Math.min(5,n.health+2); n.item=null; }
  if(n.enemyHealth<=0 || (n.hero.x===n.exit.x&&n.hero.y===n.exit.y&&n.ally.x===n.exit.x&&n.ally.y===n.exit.y)) n.outcome='victory';
  return n;
}
export function createArenaRuntime(s:ArenaScenario,mode:'replay'|'rule'|'jev',tacticRef:{current:string},liveKeyRef:{current:string}) {
  return new ContinuousRuntime<ArenaState,ArenaAction>({initialState:scenarioState(s),seed:s.seed,allowedActions:arenaActions,updateEnvironment:(state)=>environment(state),applyAction,validateAction,safeAction:'guard',adapterName:mode,decisionCadenceMs:500,caps:{maxSteps:24,maxElapsedMs:20_000,maxConcurrency:1},decide:async({snapshot,signal})=>{
    if(mode==='jev'){ const response=await fetch('/api/runtime-lab',{method:'POST',headers:{'content-type':'application/json','x-jev-live-access-key':liveKeyRef.current,'x-jev-request-id':crypto.randomUUID()},body:JSON.stringify({snapshot,actionIds:arenaActions}),signal}); const body=await response.json(); if(!response.ok) throw new Error(body.error??'Jev live failed'); return {action:body.action as ArenaAction}; }
    const cs=candidates(snapshot,tacticRef.current); let action:ArenaAction=cs[0]??'guard';
    if(mode==='replay'){ if(snapshot.enemyHealth>0&&distance(snapshot.hero,snapshot.enemy)<=1) action='attack'; else if(snapshot.item&&distance(snapshot.hero,snapshot.item)===0) action='heal'; else if(snapshot.allyHealth<4) action='guard'; else action=cs.find(x=>['east','south','north','west'].includes(x))??'wait'; }
    else { if(snapshot.item&&distance(snapshot.hero,snapshot.item)===0&&snapshot.health<5) action='heal'; else if(snapshot.enemyHealth>0&&distance(snapshot.hero,snapshot.enemy)<=1) action='attack'; else if(tacticRef.current.toLowerCase().includes('守')||tacticRef.current.toLowerCase().includes('protect')) action='guard'; else action=cs.find(x=>x==='east')??cs[0]??'wait'; }
    return {action};
  }});
}
