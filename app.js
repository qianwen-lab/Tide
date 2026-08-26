const STORAGE_KEY = 'tide.v1';
const VERSION = '8.1.0';
const SCHEMA_VERSION = 11;

const COLORS = { sage:'#5E836F', sageDeep:'#244C3E', pink:'#C98994', pinkSoft:'#EBCFD4', blue:'#8C918D', ink:'#1F2823' };
const iso = d => {
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const today = () => iso(new Date());
const addDays = (s,n) => { const d=new Date(`${s}T12:00:00`); d.setDate(d.getDate()+n); return iso(d); };
const parseDate = s => new Date(`${s}T12:00:00`);
const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
const avg = a => a.length ? a.reduce((s,x)=>s+x,0)/a.length : null;
const fmt = x => x==null || Number.isNaN(+x) ? '—' : Number(x).toFixed(1);
const fmtDate = (s, lang='en') => {
  const d=parseDate(s);
  return lang==='zh' ? `${d.getMonth()+1}月${d.getDate()}日` : d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
};
const fmtShortDate = s => { const d=parseDate(s); return `${d.getMonth()+1}/${d.getDate()}`; };
const escapeHtml = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const blankReview = () => ({summary:'',learnings:[],actionItems:[],nextExperiment:'',updatedAt:null}); // legacy v7.4 shape
const normalizeReview = r => ({
  summary:String(r?.summary||''),
  learnings:Array.isArray(r?.learnings)?r.learnings.map(x=>String(x)).filter(Boolean):[],
  actionItems:Array.isArray(r?.actionItems)?r.actionItems.map(x=>String(x)).filter(Boolean):[],
  nextExperiment:String(r?.nextExperiment||''),
  updatedAt:r?.updatedAt||null
});
const asList = v => Array.isArray(v) ? v.map(x=>String(x).trim()).filter(Boolean) : (v==null||v===''?[]:[String(v).trim()]);
const hasLegacyReview = r => !!(r && (String(r.summary||'').trim() || asList(r.learnings).length || asList(r.actionItems).length || String(r.nextExperiment||'').trim()));
function normalizeCheckpoint(r={}, goalStart=''){
  const next=asList(r.next??r.actionItems);
  if(r.nextExperiment && !next.includes(String(r.nextExperiment).trim())) next.push(String(r.nextExperiment).trim());
  const date=String(r.date||r.reviewedAt||r.updatedAt||today()).slice(0,10);
  const dayNum=goalStart ? Math.max(1,Math.floor((parseDate(date)-parseDate(goalStart))/86400000)+1) : (r.day??null);
  const preview=String(r.preview||r.overview||r.takeaway||'').trim();
  return {id:r.id||`review-${date}-${Math.random().toString(36).slice(2,8)}`,date,day:r.day??dayNum,preview,summary:String(r.summary||'').trim(),learnings:asList(r.learnings),next,createdAt:r.createdAt||r.updatedAt||new Date().toISOString()};
}
function normalizeReviews(g={}){
  let rows=Array.isArray(g.reviews)?g.reviews.map(r=>normalizeCheckpoint(r,g.start)):[];
  if(!rows.length && hasLegacyReview(g.review)) rows=[normalizeCheckpoint(g.review,g.start)];
  return rows.filter(r=>r.preview||r.summary||r.learnings.length||r.next.length).sort((a,b)=>String(a.createdAt||a.date).localeCompare(String(b.createdAt||b.date)));
}
function latestReview(g){ const rows=normalizeReviews(g); return rows.length?rows[rows.length-1]:null; }
const stableGoalId = (g={}, suffix='') => g.id || `goal-${g.start||'na'}-${g.end||'na'}-${String(g.name||'goal').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}${suffix}`;
const newGoalId = () => `goal-${today()}-${Date.now().toString(36)}`;


const TRACKER_DEFS = {
  veg:{id:'veg',label:'Vegetables',group:'diet',cadence:'daily'},
  protein:{id:'protein',label:'Protein',group:'diet',cadence:'daily'},
  fruit:{id:'fruit',label:'Fruit',group:'diet',cadence:'daily'},
  noSnack:{id:'noSnack',label:'No snacks',group:'diet',cadence:'daily'},
  stop6:{id:'stop6',label:'No food after 6 PM',group:'diet',cadence:'daily'},
  water:{id:'water',label:'Water',group:'diet',cadence:'daily'},
  bedtimeHunger:{id:'bedtimeHunger',label:'Bedtime hunger',group:'diet',cadence:'daily'},
  steps:{id:'steps',label:'10k steps',group:'exercise',cadence:'weekly'},
  cardio:{id:'cardio',label:'Cardio',group:'exercise',cadence:'weekly'},
  strength:{id:'strength',label:'Strength',group:'exercise',cadence:'weekly'},
  stretch:{id:'stretch',label:'Stretch',group:'exercise',cadence:'weekly'}
};
const TRACKER_IDS = Object.keys(TRACKER_DEFS);
const ROLE_LABELS = {goal:'Goal',bonus:'Bonus',track:'Track only'};
const validRole = r => ['goal','bonus','track'].includes(r) ? r : 'track';
function focusRoles(focus='both'){
  const track=Object.fromEntries(TRACKER_IDS.map(id=>[id,'track']));
  const diet={...track,veg:'goal',protein:'goal',fruit:'goal',noSnack:'goal',stop6:'goal',water:'track',bedtimeHunger:'track'};
  const exercise={...track,steps:'goal',cardio:'goal',strength:'bonus',stretch:'bonus'};
  if(focus==='diet') return diet;
  if(focus==='exercise') return exercise;
  if(focus==='other') return track;
  return {...diet,steps:'goal',cardio:'goal',strength:'bonus',stretch:'bonus'};
}
function defaultTrackersForFocus(focus='both', start=today()){
  const roles=focusRoles(focus);
  return Object.fromEntries(TRACKER_IDS.map(id=>[id,{role:roles[id],activeFrom:start,roleAuto:true}]));
}
function normalizeTrackers(g={}, archived=false){
  const focus=['diet','exercise','both','other'].includes(g.focus)?g.focus:'both';
  const base=defaultTrackersForFocus(focus,g.start||today());
  const raw=g.trackers&&typeof g.trackers==='object'?g.trackers:null;
  for(const id of TRACKER_IDS){
    const x=raw?.[id];
    if(x && typeof x==='object') base[id]={role:validRole(x.role),activeFrom:String(x.activeFrom||g.start||today()).slice(0,10),roleAuto:x.roleAuto!==false};
    else if(typeof x==='string') base[id]={role:validRole(x),activeFrom:g.start||today(),roleAuto:false};
  }
  // New fields should never turn old days into failures during migration.
  if(!raw){
    base.protein.role='track';
    base.protein.activeFrom=archived ? addDays(g.ended||g.end||today(),1) : today();
    base.protein.roleAuto=false;
    base.bedtimeHunger.role='track';
    base.bedtimeHunger.activeFrom=archived ? addDays(g.ended||g.end||today(),1) : today();
    base.bedtimeHunger.roleAuto=false;
  }
  return base;
}
function trackerConfig(g,id){ return normalizeTrackers(g,!!g.snapshot)[id]||{role:'track',activeFrom:g.start||today(),roleAuto:false}; }
function trackerRole(g,id){ return trackerConfig(g,id).role; }
function trackerActiveOn(g,id,date){ const c=trackerConfig(g,id); return date>=String(c.activeFrom||g.start||date).slice(0,10) && date>=g.start && date<=(g.ended||g.end); }

const defaults = {
  schemaVersion:SCHEMA_VERSION,
  version:SCHEMA_VERSION,
  language:'en',
  goal:{id:`goal-${today()}-active`,name:'Back to 50',start:today(),end:addDays(today(),31),startWeight:52.7,target:50,status:'active',focus:'both',trackers:defaultTrackersForFocus('both',today()),review:blankReview(),reviews:[]},
  days:{},
  plan:{veg:3,fruit:2,noSnack:true,stop:'18:00',satiety:7,water:2,stepsTarget:10000,stepsDays:5,stretchDays:5,cardio:90,strength:60,strengthSessions:2},
  goals:[]
};

let db = loadDB();
let view = 'today';
let selected = today();
let calendarMonth = today().slice(0,7) + '-01';
let range = '30';
let flash = '';
let quickWeightOpen = false;
let reviewGoalId = null;
let reviewDraft = null;
let reviewComposerOpen = false;

function fresh(){ return JSON.parse(JSON.stringify(defaults)); }
function mergeDay(x={}){
  return {
    date:x.date||today(), weight:x.weight??null, sleep:x.sleep??null,
    events:Array.isArray(x.events)?x.events.filter(e=>!String(e).toLowerCase().includes('period')).map(e=>({'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Sick':'sick'}[e]||e)).filter(e=>e!=='flight'):[],
    planMode:x.planMode||'default', plannedSleep:x.plannedSleep??null,
    customPlan:{
      veg:x.customPlan?.veg??null, fruit:x.customPlan?.fruit??null, noSnack:x.customPlan?.noSnack??null,
      stop:x.customPlan?.stop??null, satiety:x.customPlan?.satiety??null, water:x.customPlan?.water??null,
      steps:x.customPlan?.steps??null, stretch:x.customPlan?.stretch??null, cardio:x.customPlan?.cardio??null, strength:x.customPlan?.strength??null
    },
    plannedMove:{steps:x.plannedMove?.steps??null,stretch:x.plannedMove?.stretch??null,cardio:x.plannedMove?.cardio??null,strength:x.plannedMove?.strength??null},
    food:{veg:x.food?.veg??null,protein:x.food?.protein??null,fruit:x.food?.fruit??null,noSnack:x.food?.noSnack??null,stop6:x.food?.stop6??null,water:x.food?.water??null,bedtimeHunger:x.food?.bedtimeHunger??null,satiety:x.food?.satiety??null},
    skips:(x.skips&&typeof x.skips==='object')?{...x.skips}:{},
    move:{steps:x.move?.steps??null,stretch:x.move?.stretch??null,cardio:x.move?.cardio??null,strength:x.move?.strength??null},
    close:x.close??null,note:x.note??''
  };
}
function migrate(raw){
  const out=fresh();
  if(!raw || typeof raw!=='object') return out;
  out.language='en';
  const rawGoal=raw.goal||{};
  out.goal={...out.goal,...rawGoal};
  out.goal.id=stableGoalId(out.goal,'-active'); out.goal.focus=['diet','exercise','both','other'].includes(out.goal.focus)?out.goal.focus:'both'; out.goal.trackers=normalizeTrackers({...out.goal,trackers:rawGoal.trackers||null},false); out.goal.review=normalizeReview(out.goal.review); out.goal.reviews=normalizeReviews(out.goal);
  out.plan={...out.plan,...(raw.plan||{}),stepsTarget:10000,strengthSessions:raw.plan?.strengthSessions??out.plan.strengthSessions};
  out.goals=Array.isArray(raw.goals)?raw.goals.map((g,i)=>{const x={...g,id:stableGoalId(g,`-${i}`),focus:['diet','exercise','both','other'].includes(g.focus)?g.focus:'both',review:normalizeReview(g.review),planSnapshot:g.planSnapshot?{...g.planSnapshot}:null,snapshot:true};x.trackers=normalizeTrackers(x,true);x.reviews=normalizeReviews(x);return x;}):[];
  out.days={};
  Object.entries(raw.days||{}).forEach(([k,v])=>out.days[k]=mergeDay({...v,date:k}));
  out.schemaVersion=SCHEMA_VERSION; out.version=SCHEMA_VERSION;
  return out;
}
function loadDB(){
  try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}
  catch{return fresh();}
}
function persist(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(db)); }
function save(message=''){ persist(); if(message) flash=message; render(); }
function day(s){ if(!db.days[s]) db.days[s]=mergeDay({date:s}); else db.days[s]=mergeDay(db.days[s]); return db.days[s]; }

const T = {
  zh:{today:'今天',calendar:'日历',change:'变化',goals:'目标',settings:'设置',save:'保存',saved:'已保存',currentGoal:'当前目标',day:'第',days:'天',currentWeight:'当前体重',goal:'目标',morning:'早晨记录',fastingWeight:'起床空腹体重',sleep:'昨晚睡眠',hours:'小时',todayPlan:'今日计划',fromGoal:'来自当前目标的默认计划',todayActual:'今日实际',editable:'随时可以回来修改',veg:'蔬菜',fruit:'水果',noSnack:'不吃零食',after6:'6点后不吃',satiety:'分饱',water:'水',movement:'运动',steps:'步数',stretch:'Stretch',cardio:'Cardio',strength:'Strength',minutes:'分钟',todayNote:'今日提示',thisWeek:'本周运动',openDay:'查看 / 编辑这一天',food:'饮食',special:'特殊安排',noRecord:'没有记录',futurePlan:'未来计划',pastEdit:'补录 / 修改',defaultPlan:'默认计划',flexible:'灵活日',custom:'自定义',lifeEvents:'特殊安排',actualRecord:'实际记录',notes:'备注',done:'完成',weightChange:'体重变化',actualWeight:'空腹体重',sevenAvg:'7日平均',goalLine:'目标',recentDays:'最近几天',goalJourney:'当前目标',pastGoals:'过去的目标',reached:'达成',close:'接近目标',ended:'已结束',active:'进行中',newGoal:'新目标',archive:'结束并归档',start:'开始',target:'目标',language:'语言 / Language',export:'导出备份',import:'导入备份',about:'关于 Tide',version:'版本',defaultFood:'默认饮食规则',weeklyMove:'每周运动目标',localFirst:'数据保存在当前设备浏览器，并可导出 JSON 备份。',month:['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月']},
  en:{today:'Today',calendar:'Calendar',change:'Progress',goals:'Goals',settings:'Settings',save:'Save',saved:'Saved',currentGoal:'Current goal',day:'Day',days:'days',currentWeight:'Current weight',goal:'Goal',morning:'Morning log',fastingWeight:'Weight',sleep:'Last night sleep',hours:'hours',todayPlan:"Today's plan",fromGoal:'From your current goal',todayActual:"Today's actual",editable:'Come back and edit anytime',veg:'Vegetables',fruit:'Fruit',noSnack:'No snacks',after6:'No food after 6 PM',satiety:'full',water:'Water',movement:'Exercise',steps:'Steps',stretch:'Stretch',cardio:'Cardio',strength:'Strength',minutes:'min',todayNote:"Today's note",thisWeek:'This week',openDay:'View / edit this day',food:'Food',special:'Special',noRecord:'No record',futurePlan:'Future plan',pastEdit:'Edit past day',defaultPlan:'Default',flexible:'Flexible',custom:'Custom',lifeEvents:'Life events',actualRecord:'Actual record',notes:'Notes',done:'Done',weightChange:'Progress',actualWeight:'Weight',sevenAvg:'7-day avg',goalLine:'Target',recentDays:'Recent days',goalJourney:'Current goal',pastGoals:'Archived goals',reached:'Reached',close:'Nearly reached',ended:'Ended',active:'Active',newGoal:'New goal',archive:'End & archive',start:'Start',target:'Target',language:'Language / 语言',export:'Export backup',import:'Import backup',about:'About Tide',version:'Version',defaultFood:'Default food rules',weeklyMove:'Weekly exercise goals',localFirst:'Data stays in this browser and can be exported as a JSON backup.',month:['January','February','March','April','May','June','July','August','September','October','November','December']}
};
const tr = k => T.en[k] ?? k;

function latestWeights(until=today()){
  return Object.values(db.days).filter(x=>x.weight!=null && x.date<=until).sort((a,b)=>a.date.localeCompare(b.date));
}
function latestWeight(until=today()){ const a=latestWeights(until); return a.length?a[a.length-1]:null; }
function movingAverage(date, window=7){ const from=addDays(date,-(window-1)); const a=latestWeights(date).filter(x=>x.date>=from).map(x=>+x.weight); return avg(a); }
function goalMovingAverage(date, window=7){ const from=addDays(date,-(window-1)); const start=from>db.goal.start?from:db.goal.start; const a=latestWeights(date).filter(x=>x.date>=start && x.date<=date).map(x=>+x.weight); return avg(a); }
function activeGoalStartWeight(){ const rec=db.days[db.goal.start]; return rec?.weight!=null ? +rec.weight : +db.goal.startWeight; }
function planForGoal(g){
  return g?.planSnapshot ? {...defaults.plan,...g.planSnapshot} : db.plan;
}
function dayPlanForGoal(g,d){
  const src=planForGoal(g);
  const base={veg:src.veg,fruit:src.fruit,noSnack:src.noSnack,stop:src.stop,satiety:src.satiety,water:src.water,steps:src.stepsTarget||10000,stretch:null,cardio:null,strength:null};
  if(d.planMode==='flexible') return {...base,stop:null};
  if(d.planMode==='custom') return {...base,...Object.fromEntries(Object.entries(d.customPlan||{}).filter(([,v])=>v!==null&&v!==''))};
  return base;
}
function dayPlan(d){ return dayPlanForGoal(db.goal,d); }
function trackerRoleBadge(g,id){ return `<span class="role-mini ${trackerRole(g,id)}">${ROLE_LABELS[trackerRole(g,id)]}</span>`; }
function dailyTrackerEval(g,id,d){
  if(!TRACKER_DEFS[id] || TRACKER_DEFS[id].cadence!=='daily') return {recorded:false,met:false,na:true};
  if(!trackerActiveOn(g,id,d.date)) return {recorded:false,met:false,na:true};
  if(d.skips?.[id]) return {recorded:false,met:false,skip:true,na:true};
  const f=d.food||{}, p=dayPlanForGoal(g,d);
  if(id==='veg') return {recorded:f.veg!=null,met:f.veg!=null && +f.veg>=+p.veg};
  if(id==='protein') return {recorded:f.protein!=null,met:f.protein===true};
  if(id==='fruit') return {recorded:f.fruit!=null,met:f.fruit!=null && +f.fruit<=+p.fruit};
  if(id==='noSnack'){
    if(p.noSnack===false) return {recorded:false,met:false,na:true,plannedException:true};
    return {recorded:f.noSnack!=null,met:f.noSnack===true};
  }
  if(id==='stop6'){
    if(p.stop==null) return {recorded:false,met:false,na:true,plannedException:true};
    return {recorded:f.stop6!=null,met:f.stop6===true};
  }
  if(id==='water') return {recorded:f.water!=null,met:f.water!=null && +f.water>=+p.water};
  if(id==='bedtimeHunger') return {recorded:f.bedtimeHunger!=null,met:null,value:f.bedtimeHunger};
  return {recorded:false,met:false};
}
function weeklyTrackerContribution(id,d,g=db.goal){
  if(!trackerActiveOn(g,id,d.date) || d.skips?.[id]) return 0;
  if(id==='steps') return (+d.move.steps||0)>=(planForGoal(g).stepsTarget||10000)?1:0;
  if(id==='cardio') return +d.move.cardio||0;
  if(id==='strength') return (+d.move.strength||0)>0?1:0;
  if(id==='stretch') return d.move.stretch===true?1:0;
  return 0;
}
function trackerRuleLabel(g,id,d){
  const p=dayPlanForGoal(g,d||day(today())), plan=planForGoal(g);
  if(id==='veg') return `Vegetables ≥ ${p.veg}`;
  if(id==='protein') return 'Protein';
  if(id==='fruit') return `Fruit ≤ ${p.fruit}`;
  if(id==='noSnack') return 'No snacks';
  if(id==='stop6') return p.stop?`No food after ${fmtClock(p.stop)}`:'Eating cutoff paused';
  if(id==='water') return `Water ≥ ${p.water}L`;
  if(id==='bedtimeHunger') return 'Bedtime hunger';
  if(id==='steps') return `10k steps × ${plan.stepsDays}`;
  if(id==='cardio') return `Cardio · ${plan.cardio}m`;
  if(id==='strength') return `Strength × ${plan.strengthSessions||2}`;
  if(id==='stretch') return `Stretch × ${plan.stretchDays}`;
  return TRACKER_DEFS[id]?.label||id;
}
function fmtClock(s){
  if(!s) return '';
  const [h,m]=String(s).split(':').map(Number), d=new Date(2000,0,1,h||0,m||0);
  return d.toLocaleTimeString('en-US',{hour:'numeric',minute:m?'2-digit':undefined}).replace(' ',' ');
}
function dayIndexInGoal(s){ return Math.max(1,Math.floor((parseDate(s)-parseDate(db.goal.start))/86400000)+1); }
function goalDuration(){ return Math.max(1,Math.floor((parseDate(db.goal.end)-parseDate(db.goal.start))/86400000)+1); }
function goalProgress(weight){
  if(weight==null) return 0;
  const start=activeGoalStartWeight(); const total=start-db.goal.target;
  if(total<=0) return 0;
  return clamp((start-weight)/total*100,0,100);
}
function weightChange(s){
  const w=day(s).weight; if(w==null)return null;
  const prev=latestWeights(addDays(s,-1)); if(!prev.length)return null;
  return +w - +prev[prev.length-1].weight;
}
function foodStatus(d){
  const inGoal=d.date>=db.goal.start && d.date<=db.goal.end;
  if(inGoal){
    const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].group==='diet'&&TRACKER_DEFS[id].cadence==='daily'&&trackerRole(db.goal,id)==='goal'&&trackerActiveOn(db.goal,id,d.date));
    if(ids.length){
      let recorded=0,pass=0,eligible=0;
      for(const id of ids){
        const e=dailyTrackerEval(db.goal,id,d);
        if(e.na) continue;
        eligible++;
        if(e.recorded){recorded++; if(e.met) pass++;}
      }
      if(!recorded) return {recorded:0,score:null,enough:false,calendarPass:false,label:'No record'};
      const score=recorded?pass/recorded:null;
      const needed=Math.min(4,eligible);
      const enough=needed>0 && recorded>=needed;
      const calendarPass=enough && pass>=needed && score>=.8;
      return {recorded,score,enough,calendarPass,label:calendarPass?'Food goal met':enough?(score>=.6?'Mostly on plan':'Off plan'):'Incomplete'};
    }
  }
  // Legacy behavior outside the active goal range.
  const f=d.food, p=dayPlan(d), core=[f.veg,f.fruit,f.noSnack,f.stop6];
  const recorded=core.filter(v=>v!==null&&v!=='').length;
  if(!recorded) return {recorded:0,score:null,enough:false,calendarPass:false,label:'No record'};
  let pass=0,denom=0;
  if(f.veg!=null){denom++;if(+f.veg>=+p.veg)pass++;}
  if(f.fruit!=null){denom++;if(+f.fruit<=+p.fruit)pass++;}
  if(f.noSnack!=null){denom++;if(p.noSnack===false||f.noSnack===true)pass++;}
  if(p.stop!=null&&f.stop6!=null){denom++;if(f.stop6===true)pass++;}
  const score=denom?pass/denom:null, enough=denom>=3, calendarPass=enough&&score>=.8;
  return {recorded,score,enough,calendarPass,label:calendarPass?'Food goal met':enough?(score>=.6?'Mostly on plan':'Off plan'):'Incomplete'};
}
function moveStatus(d){
  const m=d.move; const meaningful=(+m.steps||0)>=10000 || (+m.cardio||0)>0 || (+m.strength||0)>0;
  const any=(+m.steps||0)>0 || m.stretch===true || (+m.cardio||0)>0 || (+m.strength||0)>0;
  if(!any) return {done:false,calendarPass:false,label:'No record'};
  const pieces=[];
  if(+m.steps>=10000) pieces.push('10k steps');
  if(+m.cardio>0) pieces.push(`Cardio ${m.cardio} min`);
  if(+m.strength>0) pieces.push(`Strength ${m.strength} min`);
  if(!pieces.length&&m.stretch) pieces.push('Stretch');
  return {done:any,calendarPass:meaningful,label:pieces.slice(0,2).join(' · ')};
}
function plannedMoveStatus(d){
  const m=d.plannedMove||{}; const any=(+m.steps||0)>0 || m.stretch===true || (+m.cardio||0)>0 || (+m.strength||0)>0;
  if(!any) return {planned:false,label:tr('noRecord')};
  const pieces=[];
  if(+m.steps>0) pieces.push(`${m.steps}${db.language==='zh'?'步':' steps'}`);
  if(m.stretch) pieces.push('Stretch');
  if(+m.cardio>0) pieces.push(`${m.cardio}${db.language==='zh'?'分有氧':'m cardio'}`);
  if(+m.strength>0) pieces.push(`${m.strength}${db.language==='zh'?'分力量':'m strength'}`);
  return {planned:true,calendarPass:(+m.steps||0)>=10000 || (+m.cardio||0)>0 || (+m.strength||0)>0,label:pieces.slice(0,2).join(' · ')};
}
function plannedMoveControls(d){
  const m=d.plannedMove||{};
  return `<div class="two"><label>${tr('steps')}<input data-day-field="plannedMove.steps" inputmode="numeric" type="number" min="0" value="${m.steps??''}" placeholder="10000"></label><label>${tr('cardio')} · ${tr('minutes')}<input data-day-field="plannedMove.cardio" inputmode="numeric" type="number" min="0" value="${m.cardio??''}" placeholder="0"></label><label>${tr('strength')} · ${tr('minutes')}<input data-day-field="plannedMove.strength" inputmode="numeric" type="number" min="0" value="${m.strength??''}" placeholder="0"></label><div style="padding-top:26px"><div class="switch-row"><span style="font-size:14px">${tr('stretch')}</span><button class="toggle ${m.stretch===true?'on':''}" data-toggle-planned-move="stretch"></button></div></div></div>`;
}
function dynamicInsight(){
  const tw=latestWeight(today());
  const prev=latestWeight(addDays(today(),-1));
  const a=movingAverage(today()), ay=movingAverage(addDays(today(),-1));
  const f=foodStatus(day(today()));
  const events=day(today()).events.length;
  const pool=[];
  if(tw && prev && (+tw.weight-+prev.weight)>=.5 && a!=null && ay!=null && a<=ay+.15){
    pool.push("The scale jumped. Your plan doesn't need to.","One noisy weigh-in is not a new trend. Stay with the plan.");
  }
  if(a!=null && ay!=null && a<ay-.05){
    pool.push("It's moving down. Don't eat the progress back.","Your trend is moving down. Keep doing the boring things that work.");
  }
  if(events){
    pool.push("Real life is allowed. Turning one event into a whole-day free-for-all is optional.","Eating out is a plan change, not a plan collapse.");
  }
  if(f.score!=null && f.score>=.8){
    pool.push("Good day. You don't need a reward snack for following your own plan.","This is what progress usually looks like: ordinary and consistent.");
  }
  if(!pool.length){
    pool.push("Waiting won't make this easier. Do today's part.","You know how to lose it. The question is whether you'll follow through today.","Future you still has to deal with what today-you postpones.","Less negotiating. More follow-through.","Time keeps moving. Make the trend move with it.");
  }
  return pool[(new Date().getDate()+latestWeights().length)%pool.length];
}

function icons(name){
  const map={
    today:'<svg viewBox="0 0 24 24"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/></svg>',
    calendar:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/></svg>',
    change:'<svg viewBox="0 0 24 24"><path d="M4 17l5-6 4 3 7-8"/><path d="M19 6h1v5"/></svg>',
    goals:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
    settings:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.8a7 7 0 0 0-.8-1.8l.9-2-2.1-2.1-2 .9a7 7 0 0 0-1.8-.8l-.7-2h-3l-.8 2a7 7 0 0 0-1.8.8l-2-.9-2.1 2.1.9 2a7 7 0 0 0-.8 1.8l-2 .8v3l2 .8a7 7 0 0 0 .8 1.8l-.9 2 2.1 2.1 2-.9a7 7 0 0 0 1.8.8l.8 2h3l.7-2a7 7 0 0 0 1.8-.8l2 .9 2.1-2.1-.9-2a7 7 0 0 0 .8-1.8z"/></svg>'
  };
  return map[name]||'';
}
function nav(){
  const items=[['today',tr('today')],['calendar',tr('calendar')],['change',tr('change')],['goals',tr('goals')],['settings',tr('settings')]];
  return `<nav class="nav">${items.map(([k,label])=>`<button data-view="${k}" class="${view===k?'active':''}">${icons(k)}${label}</button>`).join('')}</nav>`;
}
function topbar(title, kicker='', actions=''){
  return `<div class="topbar"><div>${kicker?`<div class="kicker">${kicker}</div>`:''}<h1 class="page-title">${title}</h1></div><div>${actions}</div></div>`;
}
function flashHtml(){ if(!flash)return ''; const s=flash; flash=''; return `<div class="insight" style="margin-bottom:10px">${escapeHtml(s)}</div>`; }

function todayGoalLearning(){
  const r=latestReview(db.goal);
  if(!r) return '';
  const summary=String(r.summary||r.preview||'').trim();
  if(!summary) return '';
  return `<section class="today-learning-card"><div class="row between"><div class="today-learning-label">Goal review</div><div class="small">${fmtShortDate(r.date)}${r.day?` · Day ${r.day}`:''}</div></div><div class="today-learning-copy">${escapeHtml(summary)}</div><button class="review-inline-link" data-review-goal="${escapeHtml(db.goal.id)}">Review history →</button></section>`;
}

function todayPage(){
  const d=day(today()), lw=latestWeight(today());
  const startW=activeGoalStartWeight(), current=lw?.weight??startW, progress=goalProgress(current), dayNum=dayIndexInGoal(today()), total=goalDuration();
  const food=foodStatus(d), move=moveStatus(d), events=d.events.length;
  const remaining=Math.max(0,(+current)-(+db.goal.target));
  const daysLeft=Math.max(0,Math.ceil((parseDate(db.goal.end)-parseDate(today()))/86400000));
  const foodDone=food.calendarPass, moveDone=move.calendarPass;
  const lifeDone=events>0;
  return `${topbar(`Today · ${fmtDate(today(),'en')}`)}
  ${flashHtml()}
  <section class="today-goal-card">
    <div class="row between"><div><div class="eyebrow">Current goal</div><div class="today-goal-name">${escapeHtml(db.goal.name)}</div></div><span class="status active">Active</span></div>
    <div class="today-goal-line"><i style="width:${progress}%"></i></div>
    <div class="today-goal-metrics"><div><span>Current</span><b>${fmt(current)}</b><em>kg</em></div><div><span>Target</span><b>${fmt(db.goal.target)}</b><em>kg</em></div><div><span>Goal date</span><b class="date-value">${fmtDate(db.goal.end)}</b></div></div>
  </section>
  <button class="quick-weight-card ${d.weight==null?'empty-weight':''}" data-action="quickWeight">
    <div><div class="quick-weight-label">Morning weight</div><div class="quick-weight-value">${d.weight==null?'Log morning weight':`${fmt(d.weight)} <span>kg</span>`}</div></div>
    <div class="quick-weight-action">${d.weight==null?'Log now':'Edit'} ›</div>
  </button>
  ${todayGoalLearning()}
  <section class="today-reminder"><div class="reminder-label">Today's note</div><div class="reminder-copy">${dynamicInsight()}</div></section>
  <section class="today-summary-grid">
    <button class="summary-tile green" data-action="editToday"><div class="summary-label">Food</div><div class="summary-value">${foodDone?'On plan':food.recorded?'In progress':'Not logged'}</div><span class="summary-dot ${foodDone?'done':''}"></span></button>
    <button class="summary-tile pink" data-action="editToday"><div class="summary-label">Exercise</div><div class="summary-value">${moveDone?'Goal met':move.done?'Logged':'Not logged'}</div><span class="summary-dot ${moveDone?'done':''}"></span></button>
    <button class="summary-tile green-soft" data-action="editToday"><div class="summary-label">Life</div><div class="summary-value">${events?`${events} event${events>1?'s':''}`:'No special events'}</div><span class="summary-dot ${lifeDone?'done':''}"></span></button>
  </section>
  <section class="today-progress-card">
    <div class="progress-stat"><div class="big-stat">${(startW-current)>=0?'-':''}${Math.abs(startW-current).toFixed(1)}</div><div class="stat-caption">kg lost</div></div>
    <div class="goal-ring" style="--p:${progress}"><div><b>${Math.round(progress)}%</b><span>complete</span></div></div>
    <div class="progress-stat right"><div class="big-stat">${daysLeft}</div><div class="stat-caption">days left</div><div class="tiny-remaining">${remaining.toFixed(1)} kg to go</div></div>
  </section>
  <button class="today-edit-button" data-action="editToday">View / edit today</button>`;
}
function skipButton(id,d){ return `<button class="skip-chip ${d.skips?.[id]?'on':''}" data-toggle-skip="${id}">${d.skips?.[id]?'N/A ✓':'N/A'}</button>`; }
function trackerHead(id,d){ return `<div class="tracker-head"><div class="actual-label">${TRACKER_DEFS[id].label} ${trackerRoleBadge(db.goal,id)}</div>${skipButton(id,d)}</div>`; }
function todayPlanChips(d){
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].cadence==='daily'&&trackerRole(db.goal,id)==='goal'&&trackerActiveOn(db.goal,id,d.date));
  const chips=ids.map(id=>trackerRuleLabel(db.goal,id,d));
  return `<div class="rule-grid compact-rules">${chips.length?chips.map(x=>`<div class="rule">${escapeHtml(x)}</div>`).join(''):'<div class="small">No daily behavior goals set.</div>'}</div>${d.events.length?`<div class="life-events compact-events">${d.events.map(e=>`<span class="event-chip on">${escapeHtml(eventLabel(e))}</span>`).join('')}</div>`:''}`;
}
function actualFoodControls(d){
  const veg=[0,1,2,3,4], fruit=[0,1,2,3], hunger=[1,2,3,4,5];
  return `
  <div class="actual-row tracker-row ${d.skips?.veg?'is-skip':''}">${trackerHead('veg',d)}<div class="chip-row">${veg.map(v=>`<button class="pill ${d.food.veg!==null && +d.food.veg===v?'on':''}" data-set-food="veg" data-value="${v}">${v===4?'4+':v}</button>`).join('')}</div></div>
  <div class="actual-row tracker-row ${d.skips?.protein?'is-skip':''}">${trackerHead('protein',d)}<div class="switch-row compact-switch"><span>${d.food.protein===true?'Target met':'Mark when met'}</span><button class="toggle ${d.food.protein===true?'on':''}" data-toggle-food="protein" aria-label="Protein"></button></div></div>
  <div class="actual-row tracker-row ${d.skips?.fruit?'is-skip':''}">${trackerHead('fruit',d)}<div class="chip-row">${fruit.map(v=>`<button class="pill ${d.food.fruit!==null && +d.food.fruit===v?'on':''}" data-set-food="fruit" data-value="${v}">${v===3?'3+':v}</button>`).join('')}</div></div>
  <div class="actual-row tracker-row ${d.skips?.noSnack?'is-skip':''}">${trackerHead('noSnack',d)}<div class="switch-row compact-switch"><span>${d.food.noSnack===true?'On plan':'Mark when met'}</span><button class="toggle ${d.food.noSnack===true?'on':''}" data-toggle-food="noSnack" aria-label="No snacks"></button></div></div>
  <div class="actual-row tracker-row ${d.skips?.stop6?'is-skip':''}">${trackerHead('stop6',d)}<div class="switch-row compact-switch"><span>${d.food.stop6===true?'On plan':'Mark when met'}</span><button class="toggle ${d.food.stop6===true?'on':''}" data-toggle-food="stop6" aria-label="No food after cutoff"></button></div></div>
  <div class="actual-row tracker-row ${d.skips?.water?'is-skip':''}">${trackerHead('water',d)}<div class="chip-row">${[1,1.5,2,2.5,3].map(v=>`<button class="pill ${d.food.water!==null && +d.food.water===v?'on':''}" data-set-food="water" data-value="${v}">${v}L</button>`).join('')}</div></div>
  <div class="actual-row tracker-row ${d.skips?.bedtimeHunger?'is-skip':''}">${trackerHead('bedtimeHunger',d)}<div class="hunger-scale"><span class="small">Low</span><div class="chip-row">${hunger.map(v=>`<button class="pill ${d.food.bedtimeHunger!==null && +d.food.bedtimeHunger===v?'on':''}" data-set-food="bedtimeHunger" data-value="${v}">${v}</button>`).join('')}</div><span class="small">High</span></div></div>`;
}
function movementControls(d){
  return `<div class="exercise-log">
    <div class="tracker-row ${d.skips?.steps?'is-skip':''}">${trackerHead('steps',d)}<input data-day-field="move.steps" data-tracker="steps" inputmode="numeric" type="number" min="0" value="${d.move.steps??''}" placeholder="10000"></div>
    <div class="tracker-row ${d.skips?.cardio?'is-skip':''}">${trackerHead('cardio',d)}<label class="inline-input"><input data-day-field="move.cardio" data-tracker="cardio" inputmode="numeric" type="number" min="0" value="${d.move.cardio??''}" placeholder="0"><span>min</span></label></div>
    <div class="tracker-row ${d.skips?.strength?'is-skip':''}">${trackerHead('strength',d)}<label class="inline-input"><input data-day-field="move.strength" data-tracker="strength" inputmode="numeric" type="number" min="0" value="${d.move.strength??''}" placeholder="0"><span>min</span></label></div>
    <div class="tracker-row ${d.skips?.stretch?'is-skip':''}">${trackerHead('stretch',d)}<div class="switch-row compact-switch"><span>${d.move.stretch===true?'Done':'Mark when done'}</span><button class="toggle ${d.move.stretch===true?'on':''}" data-toggle-move="stretch"></button></div></div>
  </div>`;
}

function calendarPage(){
  const base=parseDate(calendarMonth), y=base.getFullYear(), m=base.getMonth();
  const title=db.language==='zh'?`${y}年${m+1}月`:`${T.en.month[m]} ${y}`;
  const first=new Date(y,m,1,12), mondayOffset=(first.getDay()+6)%7;
  const start=new Date(first); start.setDate(first.getDate()-mondayOffset);
  const cells=[];
  for(let i=0;i<42;i++){
    const dt=new Date(start); dt.setDate(start.getDate()+i); const s=iso(dt), d=day(s), food=foodStatus(d), mv=moveStatus(d), pm=plannedMoveStatus(d);
    const current=dt.getMonth()===m; const dots=[];
    if(food.calendarPass) dots.push('<i class="dot food"></i>');
    if(mv.calendarPass) dots.push('<i class="dot move"></i>'); else if(s>today()&&pm.calendarPass) dots.push('<i class="dot move-outline"></i>');
    if(d.events.length) dots.push('<i class="dot event"></i>');
    cells.push(`<button class="day-cell ${!current?'out':''} ${s===selected?'selected':''} ${s===today()?'today':''}" data-date="${s}"><span class="day-number">${dt.getDate()}</span><span class="dots">${dots.join('')}</span></button>`);
  }
  const d=day(selected), food=foodStatus(d), mv=moveStatus(d), pm=plannedMoveStatus(d), wc=weightChange(selected);
  return `${topbar(tr('calendar'))}
    <div class="calendar-head"><button class="month-btn" data-month="-1">‹</button><div class="calendar-title">${title}</div><button class="month-btn" data-month="1">›</button></div>
    <div class="weekdays">${(db.language==='zh'?['一','二','三','四','五','六','日']:['M','T','W','T','F','S','S']).map(x=>`<span>${x}</span>`).join('')}</div>
    <div class="calendar-grid">${cells.join('')}</div>
    <div class="legend"><span><i class="dot food"></i>${tr('food')}</span><span><i class="dot move"></i>${tr('movement')}</span><span><i class="dot event"></i>${tr('special')}</span></div>
    <section class="card soft day-summary">
      <div class="row between"><div><b>${fmtDate(selected)}${selected===today()?(db.language==='zh'?' · 今天':' · Today'):''}</b><div class="small" style="margin-top:3px">${selected>today()?tr('futurePlan'):selected<today()?tr('pastEdit'):tr('today')}</div></div><button class="btn secondary" data-action="openSelected">${tr('openDay')}</button></div>
      <div class="summary-grid" style="margin-top:12px">
        <div class="mini-state"><i class="dot food ${food.calendarPass?'':'outline'}"></i><b>${tr('food')}</b><span>${food.label}</span></div>
        <div class="mini-state"><i class="dot ${selected>today()&&pm.planned?'move-outline':'move'}"></i><b>${tr('movement')}</b><span>${selected>today()&&pm.planned?pm.label:mv.label}</span></div>
        <div class="mini-state"><i class="dot event"></i><b>${tr('special')}</b><span>${d.events.length?escapeHtml(eventLabel(d.events[0])):tr('noRecord')}</span></div>
      </div>
      ${d.weight!=null?`<div class="small" style="margin-top:10px">${tr('fastingWeight')} ${fmt(d.weight)} kg${wc==null?'':` · ${wc>0?'+':''}${wc.toFixed(1)} kg`}</div>`:''}
    </section>`;
}

const EVENTS=[
  {id:'eating_out',zh:'Eating out',en:'Eating out'},
  {id:'travel',zh:'Travel',en:'Travel'},
  {id:'party',zh:'Party',en:'Party'},
  {id:'vacation',zh:'Vacation',en:'Vacation'},
  {id:'poor_sleep',zh:'Poor sleep',en:'Poor sleep'},
  {id:'sick',zh:'Sick',en:'Sick'}
];
const LEGACY_EVENT_TO_ID={
  'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Sick':'sick'
};
function eventId(v){return LEGACY_EVENT_TO_ID[v]||v;}
function eventLabel(v){const id=eventId(v);const e=EVENTS.find(x=>x.id===id);return e?(db.language==='zh'?e.zh:e.en):v;}
function dayPage(){
  const d=day(selected), future=selected>today();
  const title=fmtDate(selected,'en'), sub=future?'Future plan':selected===today()?'Today':'Edit past day';
  let main='';
  if(future){
    main=`<section class="card"><div class="actual-label">Day plan</div>${futurePlanSummary(d)}${d.planMode==='custom'?'':`<hr class="sep"><div class="actual-label">Exercise plan (optional)</div>${plannedMoveControls(d)}`}</section>`;
  }else{
    main=`<section class="card blue-soft"><div class="actual-label">Morning log</div><div class="two"><label>Weight · kg<input data-day-field="weight" type="number" step="0.1" inputmode="decimal" value="${d.weight??''}"></label><label>Last night's sleep · hours<input data-day-field="sleep" type="number" step="0.1" inputmode="decimal" value="${d.sleep??''}"></label></div></section><section class="card"><div class="actual-label">Actual</div>${actualFoodControls(d)}${plannedMoveStatus(d).planned?`<div class="planned-reference">Planned: ${escapeHtml(plannedMoveStatus(d).label)}</div>`:''}<hr class="sep"><div class="actual-label">Exercise</div>${movementControls(d)}</section>`;
  }
  return `${topbar(title,sub,`<button class="btn sky save-top" data-action="saveDay">Save</button>`)}
    <section class="card soft"><div class="actual-label">Plan type</div><div class="plan-mode">${[['default','Default'],['flexible','Flexible'],['custom','Custom']].map(([k,l])=>`<button class="${d.planMode===k?'on':''}" data-plan-mode="${k}">${l}</button>`).join('')}</div></section>
    <section class="card"><div class="actual-label">Life events</div><div class="life-events">${EVENTS.map(e=>`<button class="event-chip ${d.events.includes(e.id)?'on':''}" data-event="${e.id}">${e.en}</button>`).join('')}</div><label>Custom event</label><div class="row"><input id="customEvent" placeholder="e.g. Eating out with friends"><button class="btn secondary" data-action="addEvent">Add</button></div></section>
    ${d.planMode==='custom'&&!future?`<section class="card"><div class="actual-label">Custom goals for this day</div>${customPlanControls(d)}</section>`:''}
    ${main}
    <section class="card"><label>Notes</label><textarea data-day-field="note" rows="3" placeholder="Optional">${escapeHtml(d.note)}</textarea></section>
    <button class="btn sky full" data-action="saveDayBottom">Done</button>`;
}
function futurePlanSummary(d){
  if(d.planMode==='custom') return customPlanControls(d);
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].cadence==='daily'&&trackerRole(db.goal,id)==='goal'&&trackerActiveOn(db.goal,id,d.date));
  return `<div class="rule-grid">${ids.map(id=>`<div class="rule">${escapeHtml(trackerRuleLabel(db.goal,id,d))}</div>`).join('')}</div>${d.planMode==='flexible'?`<div class="insight" style="margin-top:12px">Flexible day: the exception is part of the plan, not a failed day.</div>`:''}`;
}
function customPlanControls(d){const p=d.customPlan||{};return `<div class="custom-plan"><div class="actual-label">Custom food goals</div><div class="two"><label>Vegetables ≥<input data-day-field="customPlan.veg" type="number" value="${p.veg??db.plan.veg}"></label><label>Fruit ≤<input data-day-field="customPlan.fruit" type="number" value="${p.fruit??db.plan.fruit}"></label><label>Water ≥ L<input data-day-field="customPlan.water" type="number" step="0.1" value="${p.water??db.plan.water}"></label><label>Stop eating time<input data-day-field="customPlan.stop" type="time" value="${p.stop??db.plan.stop}"></label></div><div class="switch-row actual-row"><span>Allow snacks</span><button class="toggle ${p.noSnack===false?'on':''}" data-toggle-custom="allowSnack"></button></div><div class="small plan-helper">Protein is yes/no. Bedtime hunger is observation only and has no custom target.</div><hr class="sep"><div class="actual-label">Custom exercise</div><div class="two"><label>Steps<input data-day-field="customPlan.steps" type="number" value="${p.steps??''}" placeholder="10000"></label><label>Cardio · min<input data-day-field="customPlan.cardio" type="number" value="${p.cardio??''}"></label><label>Strength · min<input data-day-field="customPlan.strength" type="number" value="${p.strength??''}"></label><div style="padding-top:26px"><div class="switch-row"><span>Stretch</span><button class="toggle ${p.stretch===true?'on':''}" data-toggle-custom="stretch"></button></div></div></div></div>`; }

function goalForecast(){
  const records=latestWeights(db.goal.end).filter(x=>x.date>=db.goal.start && x.date<=today());
  if(records.length<4) return {ready:false,reason:'Log at least 4 weights before forecasting begins.'};

  // INTERNAL smoothing only: use a calendar-based 7-day mean so one noisy weigh-in does not drive the projection.
  // It is no longer shown as a separate chart line.
  let trend=records.map(r=>({date:r.date,value:goalMovingAverage(r.date)??+r.weight}));
  if(trend[0].date>db.goal.start){
    trend.unshift({date:db.goal.start,value:activeGoalStartWeight()});
  } else if(trend[0].date===db.goal.start){
    trend[0].value=activeGoalStartWeight();
  }
  const last=trend[trend.length-1];

  // Estimate the CURRENT pace from the recent smoothed trajectory, not raw daily weight.
  const recentStart=addDays(last.date,-14);
  let usable=trend.filter(r=>r.date>=recentStart);
  if(usable.length<4) usable=trend.slice(-8);
  if(usable.length<4) return {ready:false,reason:'The data window is still too short. Keep logging for a few more days.'};
  const x0=parseDate(usable[0].date);
  const xs=usable.map(r=>(parseDate(r.date)-x0)/86400000);
  const ys=usable.map(r=>+r.value);
  const mx=avg(xs), my=avg(ys), denom=xs.reduce((a,x)=>a+(x-mx)**2,0);
  if(!denom) return {ready:false,reason:'The data window is still too short. Keep logging for a few more days.'};
  let slope=xs.reduce((a,x,i)=>a+(x-mx)*(ys[i]-my),0)/denom;
  slope=clamp(slope,-0.18,0.10);

  // Future projection is anchored to today's smoothed trajectory and lets the current pace fade over time.
  // This prevents an unrealistically straight, indefinitely fast weight-loss line.
  const current=+last.value;
  const startValue=activeGoalStartWeight();
  const elapsed=Math.max(1,Math.round((parseDate(last.date)-parseDate(db.goal.start))/86400000));
  const overallSlope=(current-startValue)/elapsed;
  const daysToEnd=Math.max(0,Math.round((parseDate(db.goal.end)-parseDate(last.date))/86400000));
  const damping=0.035;
  const forecastValue=(days)=>current + slope*(1-Math.exp(-damping*Math.max(0,days)))/damping;
  const projectedEnd=forecastValue(daysToEnd);

  // Back-trace for the DISPLAYED pink trajectory: a cubic Hermite curve anchored to the
  // actual goal-start weight and today's smoothed state, with today's recent slope as the end tangent.
  // This makes the past and future one continuous arc without exposing the 7-day-average line itself.
  const backcastValue=(daysFromStart)=>{
    const u=clamp(daysFromStart/elapsed,0,1), u2=u*u, u3=u2*u;
    const h00=2*u3-3*u2+1, h10=u3-2*u2+u, h01=-2*u3+3*u2, h11=u3-u2;
    return h00*startValue + h10*elapsed*overallSlope + h01*current + h11*elapsed*slope;
  };

  let targetDate=null, deltaDays=null;
  if(current<=+db.goal.target){
    targetDate=last.date;
  } else if(slope<-.005){
    for(let d=1;d<=365;d++){
      if(forecastValue(d)<=+db.goal.target){ targetDate=addDays(last.date,d); break; }
    }
  }
  if(targetDate) deltaDays=Math.round((parseDate(targetDate)-parseDate(db.goal.end))/86400000);
  return {ready:true,slope,current,startValue,elapsed,lastDate:last.date,projectedEnd,targetDate,deltaDays,damping,forecastValue,backcastValue,trendWindowStart:usable[0].date,trendPoints:usable.length};
}
function forecastMessage(f){
  if(!f.ready) return f.reason;
  if(f.targetDate){
    if(f.deltaDays<=-1) return `${Math.abs(f.deltaDays)} days ahead of pace.`;
    if(f.deltaDays>=1) return `${f.deltaDays} days behind pace.`;
    return 'Right on pace.';
  }
  if(f.slope>=-.005) return 'Goal date is still unclear. Keep logging.';
  return 'A few more weigh-ins will steady the forecast.';
}

function changePage(){
  const series=chartData();
  const lw=latestWeight(today()); const f=goalForecast();
  const desc=lw?`${tr('actualWeight')} ${fmt(lw.weight)} kg`:tr('noRecord');
  return `${topbar(tr('weightChange'))}
    <section class="card change-goal-card">
      <div class="row between"><div><b>${escapeHtml(db.goal.name)}</b><div class="small">${fmtDate(db.goal.start)} → ${fmtDate(db.goal.end)}</div></div><div class="small">${tr('goalLine')} ${fmt(db.goal.target)} kg</div></div>
      <div class="small" style="margin-top:8px">${desc}</div>
      <div class="legend" style="justify-content:flex-start;margin-top:13px"><span><span class="legend-line actual-line"></span>${tr('actualWeight')}</span><span><span class="legend-line goal-line"></span>${tr('goalLine')}</span><span><span class="legend-line forecast-line"></span>Forecast</span></div>
      <div class="chart-wrap">${renderChart(series,f)}</div>
    </section>
    <section class="forecast-grid compact-forecast">
      <div class="forecast-card pink"><div class="small">By ${fmtDate(db.goal.end,'en')}</div><div class="forecast-value">${f.ready?fmt(f.projectedEnd):'—'} <span>kg</span></div></div>
      <div class="forecast-card green"><div class="small">Reach ${fmt(db.goal.target)}</div><div class="forecast-text">${f.ready&&f.targetDate?fmtDate(f.targetDate,'en'):'Keep logging'}</div></div>
    </section>
    <div class="insight forecast-insight">${forecastMessage(f)}</div>
    <div class="section-title">${tr('todayNote')}</div>
    <div class="insight">${dynamicInsight()}</div>
    <div class="section-title">Weekly review</div>
    <section class="card">${weeklyReviewText()}</section>`;
}
function chartData(){
  // Change is a goal-centric view: existing data begins at goal start and the chart always ends at goal end.
  return latestWeights(db.goal.end).filter(x=>x.date>=db.goal.start && x.date<=today()).map(x=>({date:x.date,weight:+x.weight,avg:goalMovingAverage(x.date)}));
}
function smoothSvgPath(points){
  if(!points.length) return '';
  if(points.length===1) return `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  if(points.length===2) return `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)} L ${points[1][0].toFixed(1)} ${points[1][1].toFixed(1)}`;
  let d=`M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  const tension=.16;
  for(let i=0;i<points.length-1;i++){
    const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
    const c1=[p1[0]+(p2[0]-p0[0])*tension,p1[1]+(p2[1]-p0[1])*tension];
    const c2=[p2[0]-(p3[0]-p1[0])*tension,p2[1]-(p3[1]-p1[1])*tension];
    d+=` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}
function renderChart(data,forecast){
  if(data.length<2) return `<div class="empty">Log at least two weights to see the chart.</div>`;
  const W=340,H=238,L=48,R=12,Tp=25,B=37;
  const last=data[data.length-1], lastDate=last.date;
  const vals=data.map(d=>d.weight).filter(v=>v!=null); vals.push(+db.goal.target);
  if(forecast?.ready){
    vals.push(forecast.projectedEnd);
    const pastSamples=Math.min(20,Math.max(6,forecast.elapsed+1));
    for(let i=0;i<pastSamples;i++) vals.push(forecast.backcastValue(forecast.elapsed*i/(pastSamples-1)));
  }
  let min=Math.floor(Math.min(...vals)-.35), max=Math.ceil(Math.max(...vals)+.35); if(max-min<3){min-=1;max+=1;}
  const span=max-min, tickStep=span<=6?1:2;
  const startD=parseDate(db.goal.start), endD=parseDate(db.goal.end), totalDays=Math.max(1,(endD-startD)/86400000);
  const xDate=date=>L+clamp((parseDate(date)-startD)/86400000/totalDays,0,1)*(W-L-R);
  const y=v=>Tp+(max-v)/(max-min)*(H-Tp-B);
  let grid='';
  for(let v=Math.ceil(min/tickStep)*tickStep;v<=max+.001;v+=tickStep){const yy=y(v);grid+=`<line class="grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><line class="tick" x1="${L-4}" y1="${yy}" x2="${L}" y2="${yy}"/><text class="y-label" x="${L-9}" y="${yy+3}" text-anchor="end">${v}</text>`;}
  const labelCount=Math.min(7,Math.max(5,Math.ceil(totalDays/6)+1));
  const xDates=[]; for(let i=0;i<labelCount;i++){const off=Math.round(totalDays*i/(labelCount-1));const ds=addDays(db.goal.start,off);if(!xDates.includes(ds))xDates.push(ds);}
  const plotWidth=W-L-R;
  const xLabels=xDates.map((s,i)=>{const xx=L+(xDates.length===1?0:plotWidth*i/(xDates.length-1));return `<text x="${xx}" y="${H-9}" text-anchor="${i===0?'start':i===xDates.length-1?'end':'middle'}">${fmtShortDate(s)}</text>`;}).join('');
  const actualPath=data.map((d,i)=>`${i?'L':'M'} ${xDate(d.date).toFixed(1)} ${y(d.weight).toFixed(1)}`).join(' ');
  const goalY=y(+db.goal.target);
  const points=data.map((d,i)=>`<circle class="point" data-chart-index="${i}" cx="${xDate(d.date)}" cy="${y(d.weight)}" r="2"></circle>`).join('');

  // One pink trajectory from goal start through today and on to goal end.
  // Historical section uses the internal smoothed trend; future section uses the damped projection.
  let projectionPath='';
  if(forecast?.ready){
    const trajectory=[];
    const anchorDate=forecast.lastDate;
    const pastCount=Math.min(20,Math.max(6,forecast.elapsed+1));
    for(let i=0;i<pastCount;i++){
      const d=Math.round(forecast.elapsed*i/(pastCount-1));
      trajectory.push({date:addDays(db.goal.start,d),value:forecast.backcastValue(d)});
    }
    const horizon=Math.max(0,Math.round((parseDate(db.goal.end)-parseDate(anchorDate))/86400000));
    const step=Math.max(1,Math.round(horizon/14));
    for(let d=step;d<=horizon;d+=step) trajectory.push({date:addDays(anchorDate,d),value:forecast.forecastValue(d)});
    if(horizon>0 && trajectory[trajectory.length-1]?.date!==db.goal.end) trajectory.push({date:db.goal.end,value:forecast.projectedEnd});
    const pts=trajectory.filter((p,i,a)=>i===0||p.date!==a[i-1].date).map(p=>[xDate(p.date),y(p.value)]);
    projectionPath=`<path class="forecast" d="${smoothSvgPath(pts)}"/>`;
  }
  const guideX=xDate(lastDate);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Current goal weight chart"><text x="4" y="13" class="axis-unit">kg</text>${grid}<line class="axis" x1="${L}" y1="${Tp}" x2="${L}" y2="${H-B}"/><line class="axis" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/><line class="goal" x1="${L}" y1="${goalY}" x2="${W-R}" y2="${goalY}"/><line id="chartGuide" class="guide" x1="${guideX}" y1="${Tp}" x2="${guideX}" y2="${H-B}"/>${projectionPath}<path class="actual" d="${actualPath}"/>${points}${xLabels}</svg><div id="chartTip" class="tooltip">${chartTipHtml(last)}</div>`;
}
function chartTipHtml(d){
  if(!d) return '';
  return `<b>${fmtShortDate(d.date)}</b><span>${fmt(d.weight)} kg</span>`;
}
function weeklyTargetFor(g,id){
  const p=planForGoal(g);
  if(id==='steps') return +p.stepsDays||0;
  if(id==='cardio') return +p.cardio||0;
  if(id==='strength') return +p.strengthSessions||0;
  if(id==='stretch') return +p.stretchDays||0;
  return null;
}
function goalBehaviorMetrics(g,from,to){
  const dates=[]; for(let s=from;s<=to;s=addDays(s,1)) if(s>=g.start&&s<=(g.ended||g.end)) dates.push(s);
  const daily={}, weekly={};
  for(const id of TRACKER_IDS.filter(id=>trackerRole(g,id)==='goal')){
    const def=TRACKER_DEFS[id];
    if(def.cadence==='daily'){
      let eligible=0,met=0,skipped=0,recorded=0,missDates=[];
      for(const date of dates){
        if(!trackerActiveOn(g,id,date)) continue;
        const d=day(date), e=dailyTrackerEval(g,id,d);
        if(e.skip||e.na){ if(e.skip) skipped++; continue; }
        if(date===today()&&!e.recorded&&!e.met) continue; // do not fail an unfinished current day
        eligible++;
        if(e.recorded) recorded++;
        if(e.met) met++; else if(date<today()) missDates.push(date);
      }
      daily[id]={eligible,met,skipped,recorded,missDates,rate:eligible?met/eligible:null};
    }else{
      const value=dates.filter(x=>x<=today()).reduce((sum,date)=>sum+weeklyTrackerContribution(id,day(date),g),0);
      weekly[id]={value,target:weeklyTargetFor(g,id),met:weeklyTargetFor(g,id)>0?value>=weeklyTargetFor(g,id):null};
    }
  }
  return {daily,weekly};
}
function weeklyReviewText(){
  const dates=weekDates(), monday=dates[0], through=today()<dates[6]?today():dates[6], metrics=goalBehaviorMetrics(db.goal,monday,through);
  const behavior=[];
  for(const [id,m] of Object.entries(metrics.daily)){
    if(m.eligible) behavior.push(`${TRACKER_DEFS[id].label}: ${m.met} of ${m.eligible} eligible days`);
  }
  for(const [id,m] of Object.entries(metrics.weekly)){
    const unit=id==='cardio'?' min':id==='steps'||id==='strength'||id==='stretch'?'×':'';
    behavior.push(`${TRACKER_DEFS[id].label}: ${m.value}${unit} toward ${m.target}${unit}`);
  }
  const missed=Object.entries(metrics.daily).filter(([,m])=>m.eligible>=2&&m.rate!=null&&m.rate<.8).sort((a,b)=>a[1].rate-b[1].rate);
  let pattern='No clear multi-day execution pattern yet.';
  if(missed.length) pattern=`The main Goal behavior to watch is ${TRACKER_DEFS[missed[0][0]].label.toLowerCase()}; this is based on repeated Goal misses, not Bonus activity.`;
  else {
    const track=trackOnlyWeekSummaryText(db.goal);
    if(track) pattern=track;
  }
  const avgNow=movingAverage(today()), avgPrev=movingAverage(addDays(today(),-7));
  const weight=avgNow==null?'Not enough weight data yet.':`7-day average ${fmt(avgNow)} kg${avgPrev==null?'':` · ${avgNow-avgPrev>0?'+':''}${(avgNow-avgPrev).toFixed(1)} kg vs 7 days ago`}.`;
  let next='Keep the current plan steady and judge the week as a whole.';
  if(missed.length) next=`Next: make ${TRACKER_DEFS[missed[0][0]].label.toLowerCase()} the simplest behavior to protect this week.`;
  const bonus=bonusWeekSummaryText(db.goal); if(bonus) behavior.push(`Bonus: ${bonus}`);
  return `<div class="weekly-review-copy"><div><b>Goal behaviors</b><br>${behavior.length?behavior.map(escapeHtml).join(' · '):'No Goal behavior data yet.'}</div><div><b>Pattern</b><br>${escapeHtml(pattern)}</div><div><b>Weight</b><br>${escapeHtml(weight)}</div><div><b>Next</b><br>${escapeHtml(next.replace(/^Next:\s*/,''))}</div></div>`;
}
function bonusWeekSummaryText(g){
  const dates=weekDates().filter(s=>s<=today()&&s>=g.start&&s<=(g.ended||g.end)), bits=[];
  for(const id of TRACKER_IDS.filter(id=>trackerRole(g,id)==='bonus')){
    const def=TRACKER_DEFS[id];
    if(def.cadence==='daily'){
      const n=dates.filter(s=>{const e=dailyTrackerEval(g,id,day(s));return !e.na&&e.met;}).length; if(n) bits.push(`${def.label} ${n}×`);
    }else if(id==='cardio'){
      const n=dates.reduce((a,s)=>a+weeklyTrackerContribution(id,day(s),g),0); if(n) bits.push(`Cardio ${n}m`);
    }else{
      const n=dates.reduce((a,s)=>a+weeklyTrackerContribution(id,day(s),g),0); if(n) bits.push(`${def.label} ${n}×`);
    }
  }
  return bits.join(' · ');
}
function trackOnlyWeekSummaryText(g){
  const dates=weekDates().filter(s=>s<=today()&&s>=g.start&&s<=(g.ended||g.end)), bits=[];
  if(trackerRole(g,'bedtimeHunger')==='track'){
    const vals=dates.map(s=>day(s).food.bedtimeHunger).filter(v=>v!=null).map(Number); if(vals.length) bits.push(`Bedtime hunger averaged ${avg(vals).toFixed(1)}/5`);
  }
  if(trackerRole(g,'water')==='track'){
    const vals=dates.map(s=>day(s).food.water).filter(v=>v!=null).map(Number); if(vals.length) bits.push(`Water averaged ${avg(vals).toFixed(1)}L`);
  }
  return bits.length?`${bits.join(' · ')}. Track-only data is context, not adherence.`:'';
}


function changeSummary(){
  const a=latestWeights(); if(a.length<2)return `<div class="small">${tr('noRecord')}</div>`;
  const last=a[a.length-1], week=a.find(x=>x.date>=addDays(last.date,-7))||a[0]; const diff=last.weight-week.weight;
  const avgNow=movingAverage(last.date), avgOld=movingAverage(addDays(last.date,-7)); const md=(avgNow!=null&&avgOld!=null)?avgNow-avgOld:null;
  return `<div class="metric-row"><div class="metric"><div class="label">${db.language==='zh'?'7天秤重变化':'7-day scale change'}</div><div class="value">${diff>0?'+':''}${diff.toFixed(1)} <span class="small">kg</span></div></div><div class="metric"><div class="label">${db.language==='zh'?'7日平均变化':'7-day avg change'}</div><div class="value">${md==null?'—':`${md>0?'+':''}${md.toFixed(1)}`} <span class="small">kg</span></div></div></div>`;
}

function reviewCarryCard(){
  let source=db.goal, r=latestReview(db.goal), active=true;
  if(!r){
    const g=[...db.goals].reverse().find(x=>latestReview(x));
    if(g){source=g;r=latestReview(g);active=false;}
  }
  if(!r) return '';
  const learn=r.learnings.slice(0,2), next=r.next.slice(0,2);
  return `<section class="card review-carry"><div class="row between"><div class="actual-label">${active?'Latest checkpoint':'From your last goal'}</div><div class="small">${fmtShortDate(r.date)}${r.day?` · Day ${r.day}`:''}</div></div>${r.summary?`<div class="review-mini-summary">${escapeHtml(r.summary)}</div>`:''}${learn.length?`<div class="review-mini-block"><b>Learning</b><ul>${learn.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${next.length?`<div class="review-mini-block"><b>Next</b><ul>${next.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}</section>`;
}
function activeGoalLearning(){
  const r=latestReview(db.goal); if(!r) return '';
  const preview=r.preview||r.summary||r.learnings.join(' · ');
  if(!preview) return '';
  return `<div class="active-learning"><div class="row between"><b>Latest review</b><span class="small">${fmtShortDate(r.date)}${r.day?` · Day ${r.day}`:''}</span></div><div class="active-learning-text">${escapeHtml(preview)}</div><button class="review-inline-link" data-review-goal="${escapeHtml(db.goal.id)}">Review history →</button></div>`;
}

function weekDates(anchor=today()){
  const d=parseDate(anchor), offset=(d.getDay()+6)%7, monday=addDays(anchor,-offset);
  return Array.from({length:7},(_,i)=>addDays(monday,i));
}
function trackerWeekCellState(g,id,date){
  const d=day(date);
  if(date<g.start || date>(g.ended||g.end) || !trackerActiveOn(g,id,date)) return 'na';
  if(d.skips?.[id]) return 'skip';
  if(date>today()) return 'future';
  const def=TRACKER_DEFS[id];
  if(def.cadence==='daily'){
    const e=dailyTrackerEval(g,id,d);
    if(e.na) return 'na';
    if(e.met) return 'done';
    if(date===today()) return 'today';
    return 'missed';
  }
  if(weeklyTrackerContribution(id,d,g)>0) return 'done';
  return 'weekly-neutral';
}
function trackerGridRow(g,id){
  const dates=weekDates();
  const cells=dates.map(date=>{const st=trackerWeekCellState(g,id,date);return `<span class="week-cell ${st}" title="${fmtShortDate(date)} · ${st==='done'?'done':st==='missed'?'not met':st==='future'?'future':st==='skip'||st==='na'?'N/A':'weekly goal'}">${st==='skip'||st==='na'?'–':''}</span>`;}).join('');
  return `<div class="behavior-row"><div class="behavior-label">${escapeHtml(trackerRuleLabel(g,id,day(today())))}</div><div class="seven-grid">${cells}</div></div>`;
}
function bonusWeekSummary(g){
  const dates=weekDates().filter(s=>s<=today()&&s>=g.start&&s<=(g.ended||g.end));
  const bits=[];
  for(const id of TRACKER_IDS.filter(id=>trackerRole(g,id)==='bonus')){
    const def=TRACKER_DEFS[id];
    if(def.cadence==='daily'){
      const n=dates.filter(s=>{const e=dailyTrackerEval(g,id,day(s));return !e.na&&e.met;}).length;
      if(n) bits.push(`${def.label} ${n}×`);
    }else if(id==='cardio'){
      const n=dates.reduce((a,s)=>a+weeklyTrackerContribution(id,day(s),g),0); if(n) bits.push(`Cardio ${n}m`);
    }else{
      const n=dates.reduce((a,s)=>a+weeklyTrackerContribution(id,day(s),g),0); if(n) bits.push(`${def.label} ${n}×`);
    }
  }
  return bits.length?`<div class="behavior-light-row"><b>Bonus</b><span>${bits.map(escapeHtml).join(' · ')}</span></div>`:'';
}
function trackOnlyWeekSummary(g){
  const dates=weekDates().filter(s=>s<=today()&&s>=g.start&&s<=(g.ended||g.end));
  const bits=[];
  if(trackerRole(g,'bedtimeHunger')==='track'){
    const vals=dates.map(s=>day(s).food.bedtimeHunger).filter(v=>v!=null).map(Number);
    if(vals.length) bits.push(`Bedtime hunger ${avg(vals).toFixed(1)}/5`);
  }
  if(trackerRole(g,'water')==='track'){
    const vals=dates.map(s=>day(s).food.water).filter(v=>v!=null).map(Number);
    if(vals.length) bits.push(`Water ${avg(vals).toFixed(1)}L avg`);
  }
  return bits.length?`<div class="behavior-light-row track-only"><b>Track only</b><span>${bits.map(escapeHtml).join(' · ')}</span></div>`:'';
}
function weeklyBehaviorProgress(g){
  const ids=TRACKER_IDS.filter(id=>trackerRole(g,id)==='goal');
  return `<div class="weekly-behavior"><div class="row between behavior-heading"><b>Weekly behavior</b><span class="small">Goal trackers only</span></div>${ids.length?ids.map(id=>trackerGridRow(g,id)).join(''):'<div class="small">No behavior trackers are set as Goal.</div>'}${bonusWeekSummary(g)}${trackOnlyWeekSummary(g)}</div>`;
}
function roleEditorGroup(g,group){
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].group===group);
  return `<div class="tracker-role-list">${ids.map(id=>{const role=trackerRole(g,id);return `<div class="tracker-role-row"><div><b>${TRACKER_DEFS[id].label}</b><span>${TRACKER_DEFS[id].cadence==='daily'?'Daily':'Weekly'}</span></div><div class="role-segment">${['goal','bonus','track'].map(r=>`<button class="${role===r?'on':''}" data-tracker-role="${id}" data-role="${r}">${ROLE_LABELS[r]}</button>`).join('')}</div></div>`;}).join('')}</div>`;
}
function focusPicker(g){
  return `<div class="focus-picker">${[['diet','Diet'],['exercise','Exercise'],['both','Both'],['other','Other']].map(([id,label])=>`<button class="${g.focus===id?'on':''}" data-goal-focus="${id}">${label}</button>`).join('')}</div><div class="small focus-note">Focus only suggests tracker roles. You can change every tracker below.</div>`;
}

function goalsPage(){
  const lw=latestWeight(today()), avgNow=movingAverage(today()), avgPrev=movingAverage(addDays(today(),-7)), avgDelta=(avgNow!=null&&avgPrev!=null)?avgNow-avgPrev:null;
  return `${topbar(tr('goals'))}
    ${flashHtml()}
    <div class="section-title" style="margin-top:2px">${tr('goalJourney')}</div>
    <section class="card soft">
      <div class="row between"><div><div class="brand" style="font-size:18px;letter-spacing:0">${escapeHtml(db.goal.name)}</div><div class="small">${db.goal.start} → ${db.goal.end}</div></div><span class="status active">${tr('active')}</span></div>
      <div class="metric-row" style="margin-top:10px"><div class="metric"><div class="label">${tr('start')}</div><div class="value">${fmt(activeGoalStartWeight())} <span class="small">kg</span></div></div><div class="metric" style="text-align:right"><div class="label">${tr('target')}</div><div class="value">${fmt(db.goal.target)} <span class="small">kg</span></div></div></div>
      <div class="goal-weight-context"><span>Current ${fmt(lw?.weight??activeGoalStartWeight())} kg</span><span>7-day avg ${fmt(avgNow)} kg${avgDelta==null?'':` · ${avgDelta>0?'+':''}${avgDelta.toFixed(1)}`}</span></div>
      <div class="progress"><i style="width:${goalProgress(lw?.weight??db.goal.startWeight)}%"></i></div>
      ${weeklyBehaviorProgress(db.goal)}
      <div class="goal-actions"><button class="btn secondary" data-action="editGoal">Edit goal</button><button class="btn ghost" data-review-goal="${escapeHtml(db.goal.id)}">Review goal</button></div>
      ${activeGoalLearning()}
    </section>
    <div class="section-title">${tr('pastGoals')}</div>
    <section class="card"><div class="goal-list">${db.goals.length?db.goals.slice().reverse().map(goalHistoryItem).join(''):`<div class="empty">No past goals yet.</div>`}</div></section>`;
}
function goalHistoryItem(g){
  const end=g.endWeight??null; const status=goalStatus(g,end); const labels={reached:tr('reached'),close:tr('close'),ended:tr('ended')};
  const lost=end==null?null:g.startWeight-end;
  const total=g.startWeight-g.target; const achieved=(end!=null&&total>0)?clamp((g.startWeight-end)/total*100,0,100):null;
  const process=[];
  if(g.planDays!=null) process.push(`Food on plan ${g.planDays} days`);
  if(g.strengthMinutes!=null) process.push(`${tr('strength')} ${g.strengthMinutes}${tr('minutes')}`);
  if(g.cardioMinutes!=null) process.push(`${tr('cardio')} ${g.cardioMinutes}${tr('minutes')}`);
  if(g.eventCount) process.push(`${g.eventCount} life events`);
  const reviewCount=normalizeReviews(g).length;
  return `<div class="goal-item"><div class="row between"><div class="name">${escapeHtml(g.name)}</div><span class="status ${status==='reached'?'done':status==='close'?'close':'ended'}">${labels[status]}</span></div><div class="numbers">${fmt(g.startWeight)} → ${fmt(end)} kg <span class="muted">· target ${fmt(g.target)}</span></div>${achieved!=null?`<div class="progress compact"><i style="width:${achieved}%"></i></div><div class="small">${Math.round(achieved)}% of target change</div>`:''}<div class="meta">${g.start} → ${g.ended||g.end}${lost==null?'':` · ${lost>=0?'-':'+'}${Math.abs(lost).toFixed(1)} kg`}${process.length?`<br>${process.join(' · ')}`:''}</div><button class="review-link" data-review-goal="${escapeHtml(g.id)}">${reviewCount?`Review history · ${reviewCount}`:'Goal review'}</button></div>`;
}

function goalStatus(g,end){
  if(g.resultStatus) return g.resultStatus;
  if(end==null) return 'ended';
  if(end<=g.target+.1) return 'reached';
  const start=(g===db.goal||!g.snapshot)?activeGoalStartWeight():+g.startWeight;
  const total=start-g.target, progress=total>0?(start-end)/total:0;
  return progress>=.75?'close':'ended';
}

function goalEditPage(){
  const g=db.goal;
  return `${topbar('Edit goal','',`<button class="btn sky save-top" data-action="saveGoal">${tr('save')}</button>`)}
    <section class="card"><label>Goal name</label><input id="goalName" value="${escapeHtml(g.name)}"><div class="two"><label>${tr('start')} kg<input id="goalStartWeight" type="number" step="0.1" value="${activeGoalStartWeight()}"></label><label>${tr('target')} kg<input id="goalTarget" type="number" step="0.1" value="${g.target}"></label></div><div class="two"><label>${tr('start')}<input id="goalStart" type="date" value="${g.start}"></label><label>End date<input id="goalEnd" type="date" value="${g.end}"></label></div></section>
    <section class="card"><div class="actual-label">Focus</div>${focusPicker(g)}</section>
    <section class="card"><div class="actual-label">Diet targets</div>${planInputsFood()}</section>
    <section class="card"><div class="actual-label">Weekly exercise targets</div>${planInputsMove()}</section>
    <section class="card"><div class="row between"><div class="actual-label" style="margin:0">Diet trackers</div><span class="small">Role for this goal</span></div>${roleEditorGroup(g,'diet')}</section>
    <section class="card"><div class="row between"><div class="actual-label" style="margin:0">Exercise trackers</div><span class="small">Role for this goal</span></div>${roleEditorGroup(g,'exercise')}</section>
    <button class="btn ghost danger full" data-action="archiveGoal">${tr('archive')}</button>`;
}
function planInputsFood(){return `<div class="two"><label>Vegetables ≥<input data-plan="veg" type="number" value="${db.plan.veg}"></label><label>Fruit ≤<input data-plan="fruit" type="number" value="${db.plan.fruit}"></label><label>Water ≥ L<input data-plan="water" type="number" step="0.1" value="${db.plan.water}"></label><label>Eating cutoff<input data-plan="stop" type="time" value="${db.plan.stop}"></label></div><div class="small plan-helper">Protein and No snacks are yes/no trackers. Bedtime hunger is a 1–5 observation, not a success score.</div>`;}
function planInputsMove(){return `<div class="two"><label>10k-step days / week<input data-plan="stepsDays" type="number" min="0" max="7" value="${db.plan.stepsDays}"></label><label>Stretch days / week<input data-plan="stretchDays" type="number" min="0" max="7" value="${db.plan.stretchDays}"></label><label>Cardio · min/week<input data-plan="cardio" type="number" min="0" value="${db.plan.cardio}"></label><label>Strength sessions / week<input data-plan="strengthSessions" type="number" min="0" max="7" value="${db.plan.strengthSessions||2}"></label></div>`;}
function setGoalFocus(focus){
  if(!['diet','exercise','both','other'].includes(focus)) return;
  saveGoalForm();
  const g=db.goal, previous=normalizeTrackers(g,false), roles=focusRoles(focus), startToday=today()<g.start?g.start:today();
  g.focus=focus; g.trackers={};
  for(const id of TRACKER_IDS){
    const was=previous[id]||{role:'track',activeFrom:g.start};
    const role=roles[id];
    g.trackers[id]={role,activeFrom:(role==='goal'&&was.role!=='goal')?startToday:(was.activeFrom||g.start),roleAuto:true};
  }
  persist();render();
}
function setTrackerRole(id,role){
  if(!TRACKER_DEFS[id]||!['goal','bonus','track'].includes(role)) return;
  saveGoalForm();
  db.goal.trackers=normalizeTrackers(db.goal,false);
  const prev=db.goal.trackers[id], activeFrom=(role==='goal'&&prev.role!=='goal')?(today()<db.goal.start?db.goal.start:today()):(prev.activeFrom||db.goal.start);
  db.goal.trackers[id]={role,activeFrom,roleAuto:false};
  persist();render();
}


function findGoalById(id){
  if(db.goal?.id===id) return db.goal;
  return db.goals.find(g=>g.id===id)||null;
}
function goalAverageFor(g,date,window=7){
  const from=addDays(date,-(window-1)), start=from>g.start?from:g.start;
  const rows=latestWeights(date).filter(x=>x.date>=start && x.date<=date).map(x=>+x.weight);
  return avg(rows);
}
function goalReviewPack(g){
  const active=g===db.goal || !g.snapshot;
  const through=active ? (today()<g.end?today():g.end) : (g.ended||g.end);
  const records=[];
  for(let s=g.start;s<=through;s=addDays(s,1)){
    const rec=day(s);
    const foodValues=Object.values(rec.food||{}).some(v=>v!==null&&v!==false&&v!=='');
    const exerciseValues=Object.values(rec.move||{}).some(v=>v!==null&&v!==false&&v!=='');
    const hasData=rec.weight!=null || rec.sleep!=null || foodValues || exerciseValues || Object.values(rec.skips||{}).some(Boolean) || rec.events.length || rec.note;
    if(!hasData) continue;
    records.push({date:s,weight:rec.weight,sevenDayAverage:goalAverageFor(g,s),sleepHours:rec.sleep,food:{veg:rec.food.veg,protein:rec.food.protein,fruit:rec.food.fruit,noSnack:rec.food.noSnack,noFoodAfterCutoff:rec.food.stop6,waterLiters:rec.food.water,bedtimeHunger:rec.food.bedtimeHunger},exercise:{...rec.move},skipOrNA:{...rec.skips},lifeEvents:rec.events.map(eventLabel),note:rec.note||''});
  }
  const endWeight=active ? latestWeight(through)?.weight??null : g.endWeight??null;
  const startWeight=active ? activeGoalStartWeight() : +g.startWeight;
  const trackers=normalizeTrackers(g,!active);
  const trackerConfig=TRACKER_IDS.map(id=>({id,label:TRACKER_DEFS[id].label,group:TRACKER_DEFS[id].group,cadence:TRACKER_DEFS[id].cadence,role:trackers[id].role,activeFrom:trackers[id].activeFrom,target:trackerRuleLabel(g,id,day(through))}));
  return {
    tideGoalReviewVersion:4,
    goalId:g.id,
    exportedAt:new Date().toISOString(),
    goal:{name:g.name,start:g.start,end:g.end,startWeight,targetWeight:+g.target,currentOrEndWeight:endWeight,status:active?'active':goalStatus(g,endWeight),focus:g.focus||'both'},
    trackerConfig,
    plan:{...(g.planSnapshot||db.plan)},
    planWasFrozenAtArchive:!!g.planSnapshot,
    summary:{daysCovered:records.length,weightChange:endWeight==null?null:+(endWeight-startWeight).toFixed(2),targetChange:+(+g.target-startWeight).toFixed(2)},
    reviewHistory:normalizeReviews(g),
    daily:records,
    reviewInstructions:[
      'Review Goal-role behaviors first: these are the only adherence metrics and the only items that may be called execution gaps.',
      'Bonus items may only be mentioned as positive additions; not doing a Bonus is never a gap or failure.',
      'Track only items and Weight are context for patterns, not adherence scores.',
      'Look for multi-day or lagged patterns. Do not attribute a morning weight to an event logged later on that same day.',
      'Analyze weight seriously using the 7-day average and trend; do not call the plan failed because of one flat or higher weigh-in.',
      'Keep the review concise and practical.'
    ],
    recommendedPrompt:'Analyze this Tide goal using the reviewInstructions in the file. Be concise and practical. Return exactly ONE JSON code block and nothing else. Use EXACTLY these top-level fields: goalId, preview, review. Inside review use EXACTLY: summary, learnings, next. No extra fields are allowed. preview must be a 1-2 sentence synthesis of the whole review. summary must be a concise overall assessment. learnings must contain 1-3 short items. next must contain 1-3 specific actions.',
    chatgptReturnExample:{goalId:g.id,preview:'1-2 sentence synthesis of the whole review',review:{summary:'brief overall assessment',learnings:['short learning 1','short learning 2'],next:['specific next action 1','specific next action 2']}}
  };
}

function downloadJSON(obj,name){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}), a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function exportGoalReviewData(g){
  if(!g) return;
  downloadJSON(goalReviewPack(g),`tide-goal-${String(g.name||'goal').toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${g.start}.json`);
}
function checkpointHtml(r){
  return `<div class="checkpoint"><div class="row between"><b>${fmtShortDate(r.date)}</b><span class="small">${r.day?`Day ${r.day}`:''}</span></div>${r.preview?`<div class="checkpoint-preview"><span>Preview</span><p>${escapeHtml(r.preview)}</p></div>`:''}${r.summary?`<div class="checkpoint-block"><span>Summary</span><p>${escapeHtml(r.summary)}</p></div>`:''}${r.learnings.length?`<div class="checkpoint-block"><span>Learnings</span><ul>${r.learnings.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${r.next.length?`<div class="checkpoint-block"><span>Next</span><ul>${r.next.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}</div>`;
}
function fullReviewHtml(r){
  if(!r) return '<div class="empty">No review yet.</div>';
  return `${r.summary?`<div class="checkpoint-block review-main-summary"><span>Summary</span><p>${escapeHtml(r.summary)}</p></div>`:''}${r.learnings.length?`<div class="checkpoint-block"><span>Learnings</span><ul>${r.learnings.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}${r.next.length?`<div class="checkpoint-block"><span>Next</span><ul>${r.next.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}`;
}
function goalReviewPage(){
  const g=findGoalById(reviewGoalId); if(!g) return `${topbar('Goal Review','',`<button class="btn ghost" data-action="backGoals">Done</button>`)}<div class="empty">Goal not found.</div>`;
  const active=g===db.goal || !g.snapshot, end=active?(latestWeight(today())?.weight??activeGoalStartWeight()):(g.endWeight??null), start=active?activeGoalStartWeight():+g.startWeight;
  const status=active?'Active':({reached:'Reached',close:'Nearly reached',ended:'Ended'}[goalStatus(g,end)]||'Ended');
  const rows=normalizeReviews(g).slice().reverse();
  const latest=rows[0]||null;
  const older=rows.slice(1);
  const draft=reviewDraft?.goalId===g.id?reviewDraft:null;
  const composer=reviewComposerOpen;
  return `${topbar('Goal Review','',`<button class="btn ghost" data-action="backGoals">Done</button>`)}
    ${flashHtml()}
    <section class="card soft review-summary"><div class="row between"><div><b>${escapeHtml(g.name)}</b><div class="small">${fmtShortDate(g.start)} → ${fmtShortDate(active?g.end:(g.ended||g.end))}</div></div><span class="status ${active?'active':goalStatus(g,end)==='reached'?'done':goalStatus(g,end)==='close'?'close':'ended'}">${status}</span></div><div class="review-metrics"><div><span>Start</span><b>${fmt(start)} kg</b></div><div><span>${active?'Current':'End'}</span><b>${fmt(end)} kg</b></div><div><span>Target</span><b>${fmt(g.target)} kg</b></div></div></section>
    ${latest?`<div class="section-title">Latest review</div><section class="card latest-review-card"><div class="row between"><div class="actual-label" style="margin:0">${fmtShortDate(latest.date)}${latest.day?` · Day ${latest.day}`:''}</div></div>${fullReviewHtml(latest)}</section>`:`<section class="card"><div class="empty">No reviews yet.</div></section>`}
    ${!composer?`<button class="btn secondary full review-add-button" data-action="openReviewComposer">Add new review</button>`:''}
    ${composer?`<section class="card review-composer"><div class="row between"><div class="actual-label" style="margin:0">Add new review</div><button class="review-inline-link review-cancel-inline" data-action="closeReviewComposer">Cancel</button></div><p class="small review-copy"><b>1.</b> Export goal data and upload it to ChatGPT. <b>2.</b> Ask ChatGPT to follow the prompt inside the file. <b>3.</b> Copy its JSON code block and paste it here.</p><div class="review-actions"><button class="btn secondary" data-action="exportReviewGoal">Export Goal Data</button></div><label class="review-paste-label">Paste ChatGPT JSON<textarea id="reviewPaste" rows="7" placeholder='{"preview":"...","review":{"summary":"...","learnings":["..."],"next":["..."]}}'>${escapeHtml(draft?.rawText||'')}</textarea></label><button class="btn secondary full" data-action="previewGoalReview">Preview review</button></section>`:''}
    ${draft&&composer?`<section class="card review-preview"><div class="row between"><div class="actual-label" style="margin:0">Ready to save</div><span class="small">Review the result first</span></div>${draft.checkpoint.preview?`<div class="draft-preview-summary"><span>Goals preview</span><p>${escapeHtml(draft.checkpoint.preview)}</p></div>`:''}<div class="full-review-label">Full review</div>${fullReviewHtml(draft.checkpoint)}<button class="btn sky full review-save-final" data-action="saveGoalReviewDraft">Save Review</button></section>`:''}
    ${older.length?`<div class="section-title">Earlier reviews</div><section class="card review-history">${older.map(checkpointHtml).join('')}</section>`:''}
    <button class="btn ghost full" data-action="backGoals">Back to Goals</button>`;
}
function parseReviewJSON(text){
  let cleaned=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/```$/,'').trim();
  const first=cleaned.indexOf('{'), last=cleaned.lastIndexOf('}'); if(first>=0&&last>first) cleaned=cleaned.slice(first,last+1);
  return JSON.parse(cleaned);
}
function assertExactKeys(obj,expected,label){
  if(!obj || typeof obj!=='object' || Array.isArray(obj)) throw new Error(`${label} must be an object`);
  const keys=Object.keys(obj).sort(), want=[...expected].sort();
  if(keys.length!==want.length || keys.some((k,i)=>k!==want[i])) throw new Error(`${label} must use exactly: ${expected.join(', ')}`);
}
function validateReviewShape(raw,g){
  assertExactKeys(raw,['goalId','preview','review'],'Review JSON');
  assertExactKeys(raw.review,['summary','learnings','next'],'review');
  if(String(raw.goalId)!==String(g.id)) throw new Error('goalId does not match this goal');
  if(typeof raw.preview!=='string'||!raw.preview.trim()) throw new Error('preview is required');
  if(typeof raw.review.summary!=='string'||!raw.review.summary.trim()) throw new Error('summary is required');
  if(!Array.isArray(raw.review.learnings)||raw.review.learnings.length<1||raw.review.learnings.length>3||raw.review.learnings.some(x=>typeof x!=='string'||!x.trim())) throw new Error('learnings must contain 1-3 strings');
  if(!Array.isArray(raw.review.next)||raw.review.next.length<1||raw.review.next.length>3||raw.review.next.some(x=>typeof x!=='string'||!x.trim())) throw new Error('next must contain 1-3 strings');
  return raw;
}
function makeCheckpoint(raw,g){
  validateReviewShape(raw,g);
  const root=raw.review, date=today();
  return {id:`review-${date}-${Date.now().toString(36)}`,date,day:Math.max(1,Math.floor((parseDate(date)-parseDate(g.start))/86400000)+1),preview:raw.preview.trim(),summary:root.summary.trim(),learnings:root.learnings.map(x=>x.trim()),next:root.next.map(x=>x.trim()),createdAt:new Date().toISOString()};
}

function addGoalCheckpoint(g,raw){
  if(!g) throw new Error('Goal not found');
  g.reviews=normalizeReviews(g); g.reviews.push(makeCheckpoint(raw,g)); g.review=blankReview();
}
function importGoalReview(file){
  if(!file)return; const r=new FileReader(); r.onload=()=>{try{
    const raw=parseReviewJSON(r.result), g=findGoalById(raw.goalId); if(!g) throw new Error('Goal not found');
    addGoalCheckpoint(g,raw); reviewGoalId=g.id; persist(); flash='Goal review added.'; render();
  }catch(e){alert('This review could not be imported.');}}; r.readAsText(file);
}
function previewGoalReview(){
  try{
    const rawText=document.getElementById('reviewPaste')?.value||'';
    const raw=parseReviewJSON(rawText),g=findGoalById(raw.goalId);if(!g)throw new Error('Goal not found');
    reviewGoalId=g.id;
    reviewDraft={goalId:g.id,rawText,raw,checkpoint:makeCheckpoint(raw,g)};
    reviewComposerOpen=true;
    flash='Review loaded. Check it below before saving.';
    render();
  }catch(e){alert(`Tide could not load this review. ${e.message||'Use the exact Tide JSON schema.'}`);}
}
function saveGoalReviewDraft(){
  try{
    const g=findGoalById(reviewDraft?.goalId||reviewGoalId);if(!g||!reviewDraft)throw new Error('No review loaded');
    g.reviews=normalizeReviews(g); g.reviews.push(reviewDraft.checkpoint); g.review=blankReview();
    reviewDraft=null;reviewComposerOpen=false;persist();flash='Review saved.';view='goals';render();
  }catch(e){alert('Preview a review before saving it.');}
}
function pasteGoalReview(){ previewGoalReview(); }
function lastReviewedGoal(){ return [...db.goals].reverse().find(g=>latestReview(g)); }

function settingsPage(){
  return `${topbar('Settings')}
    <section class="settings-list"><button class="setting-row" data-action="editPlan" style="width:100%;border:0;background:#fff;text-align:left"><span>Default Plan</span><span class="right">›</span></button><button class="setting-row" data-action="export"><span>Export Data</span><span class="right">JSON ›</span></button><label class="setting-row" style="margin:0"><span>Import Data</span><span class="right">JSON ›</span><input id="importFile" type="file" accept="application/json" style="display:none"></label><div class="setting-row"><span>About Tide</span><span class="right">Version ${VERSION}</span></div></section>
    <div class="insight" style="margin-top:16px">Your data stays on this device. Tide upgrades migrate existing data automatically; export a JSON backup anytime for extra safety.</div>`;
}

function planEditPage(){
  return `${topbar('Default Plan','',`<button class="btn sky save-top" data-action="savePlan">${tr('save')}</button>`)}<section class="card"><div class="actual-label">Food goals</div>${planInputsFood()}</section><section class="card"><div class="actual-label">Weekly exercise goals</div>${planInputsMove()}</section><button class="btn sky full" data-action="savePlanBottom">${tr('done')}</button>`;
}

function weekStats(){
  const now=parseDate(today());
  const offset=(now.getDay()+6)%7;
  const monday=addDays(today(),-offset);
  const days=[];
  for(let s=monday;s<=today();s=addDays(s,1)) days.push(day(s));
  return {steps:days.filter(d=>+d.move.steps>=db.plan.stepsTarget).length,stretch:days.filter(d=>d.move.stretch===true).length,cardio:days.reduce((sum,d)=>sum+(+d.move.cardio||0),0),strength:days.reduce((sum,d)=>sum+(+d.move.strength||0),0)};
}
function weekBars(w){
  const rows=[['10k-step days',w.steps,db.plan.stepsDays],[tr('stretch'),w.stretch,db.plan.stretchDays],[tr('cardio'),w.cardio,db.plan.cardio],[tr('strength'),w.strength,db.plan.strength]];
  return rows.map(([l,a,b])=>`<div class="week-row"><div class="label-line"><span>${l}</span><b>${a}/${b}</b></div><div class="bar"><i style="width:${clamp((a/(b||1))*100,0,100)}%"></i></div></div>`).join('');
}

function saveInputsFromDOM(){
  const targetDate=view==='today'?today():selected;
  document.querySelectorAll('[data-day-field]').forEach(el=>{
    const path=el.dataset.dayField.split('.'); let root=day(targetDate), obj=root;
    for(let i=0;i<path.length-1;i++) obj=obj[path[i]];
    const key=path[path.length-1]; let val=el.value;
    if(el.type==='number') val=val===''?null:+val;
    obj[key]=val;
    if(el.dataset.tracker && val!==null && val!=='') root.skips[el.dataset.tracker]=false;
  });
  document.querySelectorAll('[data-plan]').forEach(el=>{
    let val=el.value; if(el.type==='number')val=val===''?0:+val; db.plan[el.dataset.plan]=val;
  });
}
function setFood(key,val){ const d=day(view==='day'?selected:today()); d.food[key]=val; d.skips[key]=false; save(); }
function toggleFood(key){ const d=day(view==='day'?selected:today()); d.food[key]=d.food[key]===true?false:true; d.skips[key]=false; save(); }
function toggleMove(key){ const d=day(view==='day'?selected:today()); d.move[key]=d.move[key]===true?false:true; d.skips[key]=false; save(); }
function toggleSkip(id){ const d=day(view==='day'?selected:today()); d.skips[id]=!d.skips[id]; save(); }
function toggleCustom(key){ const d=day(selected); if(key==='allowSnack') d.customPlan.noSnack=d.customPlan.noSnack===false?true:false; else d.customPlan[key]=d.customPlan[key]===true?false:true; save(); }
function togglePlannedMove(key){ const d=day(selected); d.plannedMove[key]=d.plannedMove[key]===true?false:true; save(); }
function toggleEvent(e){ const d=day(selected); d.events=d.events.includes(e)?d.events.filter(x=>x!==e):[...d.events,e]; save(); }
function shiftMonth(n){ const d=parseDate(calendarMonth); d.setMonth(d.getMonth()+n); calendarMonth=iso(new Date(d.getFullYear(),d.getMonth(),1,12)); selected=calendarMonth; render(); }
function saveGoalForm(){
  const oldStart=db.goal.start;
  const newStart=document.getElementById('goalStart')?.value||db.goal.start;
  db.goal.name=document.getElementById('goalName')?.value.trim()||db.goal.name;
  db.goal.target=+(document.getElementById('goalTarget')?.value||db.goal.target);
  db.goal.start=newStart; db.goal.end=document.getElementById('goalEnd')?.value||db.goal.end;
  db.goal.trackers=normalizeTrackers(db.goal,false);
  if(newStart!==oldStart){
    for(const id of TRACKER_IDS){ if(db.goal.trackers[id].activeFrom===oldStart) db.goal.trackers[id].activeFrom=newStart; }
  }
  const entered=document.getElementById('goalStartWeight')?.value;
  if(entered!==undefined&&entered!=='') { db.goal.startWeight=+entered; day(newStart).weight=+entered; }
  saveInputsFromDOM();
}
function archiveGoal(){
  saveGoalForm();
  const end=latestWeight(today())?.weight??null; const startSnapshot=activeGoalStartWeight(); const status=goalStatus({...db.goal,startWeight:startSnapshot,snapshot:true},end);
  let planDays=0, strengthMinutes=0, cardioMinutes=0, eventCount=0;
  for(let s=db.goal.start;s<=today()&&s<=db.goal.end;s=addDays(s,1)){
    const rec=day(s), fs=foodStatus(rec);
    if(fs.enough&&fs.score>=.8) planDays++;
    strengthMinutes+=(+rec.move.strength||0); cardioMinutes+=(+rec.move.cardio||0); eventCount+=rec.events.length;
  }
  const snapshot={...db.goal,id:db.goal.id||newGoalId(),trackers:normalizeTrackers(db.goal,false),review:blankReview(),reviews:normalizeReviews(db.goal),planSnapshot:{...db.plan},startWeight:startSnapshot,ended:today(),endWeight:end,resultStatus:status,planDays,strengthMinutes,cardioMinutes,eventCount,snapshot:true,schemaVersion:SCHEMA_VERSION}; db.goals.push(snapshot);
  db.goal={id:newGoalId(),name:'New goal',start:today(),end:addDays(today(),30),startWeight:end??db.goal.target,target:Math.max(35,(end??db.goal.target)-2),status:'active',focus:'both',trackers:defaultTrackersForFocus('both',today()),review:blankReview(),reviews:[]};
  view='goals'; save(db.language==='zh'?'当前目标已归档。':'Goal archived.');
}
function exportData(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tide-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importData(file){
  if(!file)return; const r=new FileReader(); r.onload=()=>{try{db=migrate(JSON.parse(r.result)); persist(); view='today'; flash=db.language==='zh'?'备份已恢复。':'Backup restored.'; render();}catch{alert(db.language==='zh'?'这个备份无法读取。':'This backup could not be read.')}}; r.readAsText(file);
}


function quickWeightModal(){
  if(!quickWeightOpen) return '';
  const d=day(today());
  return `<div class="modal-backdrop" data-action="closeQuickWeight">
    <div class="weight-modal" role="dialog" aria-modal="true" aria-label="Log morning weight">
      <div class="weight-modal-handle"></div>
      <div class="weight-modal-title">Log morning weight</div>
      <div class="weight-modal-sub">Weight</div>
      <div class="weight-input-wrap"><input id="quickWeightInput" type="number" inputmode="decimal" step="0.1" min="30" max="150" value="${d.weight??''}" placeholder="52.7"><span>kg</span></div>
      <button class="weight-save" data-action="saveQuickWeight">Save</button>
      <button class="weight-cancel" data-action="closeQuickWeight">Cancel</button>
    </div>
  </div>`;
}
function bind(){
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view; render();}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{
    const a=b.dataset.action;
    if(a==='saveToday'||a==='saveTodayBottom'){saveInputsFromDOM();save(tr('saved'));}
    if(a==='editToday'){selected=today();view='day';render();}
    if(a==='quickWeight'){quickWeightOpen=true;render();setTimeout(()=>document.getElementById('quickWeightInput')?.focus(),30);}
    if(a==='closeQuickWeight'){quickWeightOpen=false;render();}
    if(a==='saveQuickWeight'){const el=document.getElementById('quickWeightInput');const v=el?.value===''?null:+el.value;if(v!=null&&Number.isFinite(v)){day(today()).weight=v;persist();quickWeightOpen=false;flash='Morning weight saved.';render();}}
    if(a==='openSelected'){view='day';render();}
    if(a==='saveDay'||a==='saveDayBottom'){saveInputsFromDOM();view='calendar';save(tr('saved'));}
    if(a==='addEvent'){const el=document.getElementById('customEvent');const v=el?.value.trim();if(v){day(selected).events.push(v);save();}}
    if(a==='editGoal'){view='goalEdit';render();}
    if(a==='saveGoal'){saveGoalForm();view='goals';save(tr('saved'));}
    if(a==='archiveGoal'){if(confirm(db.language==='zh'?'结束并归档当前目标？':'End and archive current goal?')) archiveGoal();}
    if(a==='editPlan'){view='planEdit';render();}
    if(a==='savePlan'||a==='savePlanBottom'){saveInputsFromDOM();view='settings';save(tr('saved'));}
    if(a==='export')exportData();
    if(a==='exportReviewGoal')exportGoalReviewData(findGoalById(reviewGoalId));
    if(a==='pasteGoalReview')pasteGoalReview();
    if(a==='previewGoalReview')previewGoalReview();
    if(a==='saveGoalReviewDraft')saveGoalReviewDraft();
    if(a==='openReviewComposer'){reviewComposerOpen=true;reviewDraft=null;render();}
    if(a==='closeReviewComposer'){reviewComposerOpen=false;reviewDraft=null;render();}
    if(a==='backGoals'){reviewDraft=null;reviewComposerOpen=false;view='goals';render();}
  }));
  document.querySelectorAll('[data-set-food]').forEach(b=>b.addEventListener('click',()=>setFood(b.dataset.setFood,+b.dataset.value)));
  document.querySelectorAll('[data-toggle-food]').forEach(b=>b.addEventListener('click',()=>toggleFood(b.dataset.toggleFood)));
  document.querySelectorAll('[data-toggle-move]').forEach(b=>b.addEventListener('click',()=>toggleMove(b.dataset.toggleMove)));
  document.querySelectorAll('[data-toggle-skip]').forEach(b=>b.addEventListener('click',()=>toggleSkip(b.dataset.toggleSkip)));
  document.querySelectorAll('[data-goal-focus]').forEach(b=>b.addEventListener('click',()=>setGoalFocus(b.dataset.goalFocus)));
  document.querySelectorAll('[data-tracker-role]').forEach(b=>b.addEventListener('click',()=>setTrackerRole(b.dataset.trackerRole,b.dataset.role)));
  document.querySelectorAll('[data-toggle-custom]').forEach(b=>b.addEventListener('click',()=>toggleCustom(b.dataset.toggleCustom)));
  document.querySelectorAll('[data-toggle-planned-move]').forEach(b=>b.addEventListener('click',()=>togglePlannedMove(b.dataset.togglePlannedMove)));
  document.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.date;render();}));
  document.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>shiftMonth(+b.dataset.month)));
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>toggleEvent(b.dataset.event)));
  document.querySelectorAll('[data-plan-mode]').forEach(b=>b.addEventListener('click',()=>{day(selected).planMode=b.dataset.planMode;save();}));
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.range;render();}));
  document.querySelectorAll('[data-day-field]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
  document.querySelectorAll('[data-plan]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
  const f=document.getElementById('importFile'); if(f) f.addEventListener('change',()=>importData(f.files[0]));
  document.querySelectorAll('[data-review-goal]').forEach(b=>b.addEventListener('click',()=>{reviewGoalId=b.dataset.reviewGoal;reviewDraft=null;reviewComposerOpen=false;view='goalReview';render();}));
  document.querySelectorAll('[data-chart-index]').forEach(p=>{
    const update=()=>{const data=chartData(),i=+p.dataset.chartIndex,d=data[i],tip=document.getElementById('chartTip'),guide=document.getElementById('chartGuide');if(tip&&d)tip.innerHTML=chartTipHtml(d);if(guide){const x=p.getAttribute('cx');guide.setAttribute('x1',x);guide.setAttribute('x2',x);}};
    p.addEventListener('click',update); p.addEventListener('mouseenter',update); p.addEventListener('touchstart',update,{passive:true});
  });
}

function render(){
  let content='';
  if(view==='today')content=todayPage();
  else if(view==='calendar')content=calendarPage();
  else if(view==='day')content=dayPage();
  else if(view==='change')content=changePage();
  else if(view==='goals')content=goalsPage();
  else if(view==='goalEdit')content=goalEditPage();
  else if(view==='goalReview')content=goalReviewPage();
  else if(view==='settings')content=settingsPage();
  else if(view==='planEdit')content=planEditPage();
  document.getElementById('app').innerHTML=`<main class="shell">${content}${['today','calendar','change','goals','settings'].includes(view)?nav():''}</main>${quickWeightModal()}`;
  bind();
  document.querySelector('.weight-modal')?.addEventListener('click',e=>e.stopPropagation());
  const q=document.getElementById('quickWeightInput'); if(q) q.addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector('[data-action=\"saveQuickWeight\"]')?.click();});
}

document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{}); }
render();
