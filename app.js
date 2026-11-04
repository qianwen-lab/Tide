const STORAGE_KEY = 'tide.v1';
const VERSION = '9.4.2';
const SCHEMA_VERSION = 15; // Retire eating cutoff going forward; preserve historical scoring and add richer daily context.

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


// V8.3 — quiet End Goal anchor + local Daily Thought bank.
// The thoughts are bundled with the app so they work fully offline. They are
// intentionally original Tide copy: no attribution risk and no feed behavior.
const THOUGHT_HISTORY_KEY = 'tide.dailyThought.v2';
const THOUGHT_BANK = {
  身体:[
    "一天的体重很容易让人高兴或失望，但真正值得反应的是连续几天的方向。数字好看时不用立刻把计划收得更紧；数字不好看时，也不用马上惩罚自己。能保持原来的节奏，本身就是一种能力。",
    "一个真正适合长期执行的饮食方式，应该让你大多数时候不用反复谈判。规则越多，不一定越有效；如果每天都要花很多力气判断自己有没有做对，系统本身可能就太复杂了。",
    "身体的变化通常比人的耐心慢。很多时候不是方法失效了，而是结果还没有来得及完整地反映出来。先给一个合理的计划足够的时间，再决定要不要调整。",
    "健康并不只是把一个数字降下来。睡眠、力量、精力和对食物的注意力都属于结果的一部分。一个需要全天候克制才能维持的体重，也许还不是最舒服的终点。",
    "运动的价值不需要每天都由体重来证明。力量、心肺、睡眠和情绪都可能先发生变化，而体重只是其中一个比较吵闹的指标。",
    "偶尔吃多一次并不会决定趋势，真正改变趋势的是接下来几天是否继续把一次偏离放大。下一顿回到平常，通常比补偿、挨饿或重新制定规则更有用。",
    "饥饿不是意志力考试。偶尔饿很正常，但如果它频繁占据注意力，就值得把它当成系统反馈，而不是要求自己再坚持一点。",
    "真正轻松的维持状态，应该逐渐变得普通。你不需要每天都觉得自己正在‘减重’，生活仍然可以有聚餐、旅行和喜欢吃的东西。"
  ],
  心态:[
    "人很容易把‘还没有确定’误解成‘出了问题’。其实很多事情只是需要更多时间和信息。能在答案还不完整的时候继续生活，而不是立刻把它解决掉，是一种很实用的稳定感。",
    "有些问题反复想，并不是因为它们越来越重要，而是因为大脑把熟悉的焦虑当成了待办事项。判断一件事值不值得继续想，可以问自己：再想二十分钟，我真的会得到新的信息吗？",
    "做了一个已经足够合理的决定之后，继续比较所有没选的选项，常常不会让决定更好，只会让它更不安稳。选择的一部分，就是允许一些可能性永远不被验证。",
    "很多时候，我们真正想摆脱的不是事情本身，而是不确定带来的不舒服。可惜现实很少提供百分之百的确定。学会在七八成把握的时候继续往前，往往比寻找最后那一点确定更有用。",
    "不是每一个念头都值得变成行动，也不是每一个担心都需要建立一个系统。能注意到一个问题，同时暂时什么都不做，是判断力的一部分。",
    "平静并不意味着生活里没有未完成的事情。更现实的平静，是知道有些事现在不需要处理，等它真正需要你的时候，你有能力应付。",
    "如果一个很小的问题占据了远超它本身价值的注意力，也许最值得练习的不是把它解决得更漂亮，而是停止继续给它资源。",
    "减少焦虑的目的，不是为了腾出更多时间继续优化自己。更好的结果是把注意力还给朋友、书、好奇心、幽默和那些本来就值得生活的东西。"
  ],
  关系:[
    "关系变深通常不是靠一次特别精彩的谈话，而是靠很多次普通的联系。一起吃饭、随手发消息、记得对方最近在经历什么，这些看起来很小的事情，时间久了才组成真正的亲近。",
    "和一个人熟了以后，很容易觉得自己已经知道她是什么样的人。但人一直在变化。偶尔放下过去的判断，重新问一次、重新听一次，关系才不会只剩下旧印象。",
    "朋友不一定都要承担最深的情绪交流才算重要。有些人只是见面很开心、可以随时发消息、一起做某件事，这样的关系也会让生活明显变丰富。",
    "关心一个人不一定意味着马上给建议。很多时候，真正有用的是让对方知道：这件事你可以跟我说，而我不会急着把它修好。",
    "亲近的人之间最容易出现的一种误会，是把熟悉当成理解。知道一个人的习惯，不等于知道她此刻在想什么。留一点好奇，比快速下结论更有用。",
    "家庭生活很容易被安排、课程和待办事项填满。真正让人记住的，往往不是哪一天效率最高，而是那些没有特别目的、但大家都很放松的普通时间。",
    "对孩子的支持并不是越多越好。好的支持有时候是提供一个台阶，有时候则是忍住不立刻介入，让她有机会自己发现下一步。",
    "关系里有些不舒服并不需要马上谈成一个结论。只要彼此仍然有善意，给情绪一点时间，常常比在最激动的时候把每句话解释清楚更有效。"
  ],
  生活:[
    "有些事情没有必要优化。喜欢、好看、舒服、想去，这些理由本身就已经够了。生活如果所有选择都需要证明回报率，会慢慢变得很窄。",
    "人很容易高估一天能改变什么，又低估半年持续做一件小事能改变什么。真正有用的习惯，执行的时候通常没有什么戏剧性；过一段时间回头看，才发现生活已经被它推到了另一个位置。",
    "空出来的时间不一定需要马上被填满。无所事事、随便逛一逛、读一点没有明确用途的东西，有时正是你重新听见自己偏好的方式。",
    "生活里真正稀缺的东西往往不是选择，而是注意力。每多维护一个项目、一个物品、一个系统，都在向未来的自己收取一点管理费。",
    "想做一件事，不一定需要先把它变成一个长期计划。先做一次、去一次、读十页，很多兴趣只有在开始之后才知道值不值得继续。",
    "效率很有用，但它不是生活的最终目的。把所有事情做得更快，最后还是为了有更多空间去做那些并不需要更快的事。",
    "如果某样东西已经工作得不错，稳定本身就有价值。不断升级和重新设计会带来新鲜感，但也会把已经解决的问题重新变成项目。",
    "真正的休息不是把所有任务做完之后才被允许发生。因为任务通常不会真正归零，所以休息需要被当成生活的一部分，而不是完成清单之后的奖励。"
  ],
  成长:[
    "学习一件东西不一定需要证明它以后有用。好奇心本身就可以是足够的理由。很多真正长久的兴趣，反而是在没有绩效目标的时候才有空间长出来。",
    "做得更好和知道更多并不是同一件事。有时候再看十篇资料不会改变行动，真正缺的是把已经知道的东西重复做几次。",
    "成长并不总是增加东西。学会删掉一个没有价值的规则、停止维护一个不再需要的系统、接受某件事已经足够好，也属于进步。",
    "一个项目真正开始变成你的东西，通常是在新鲜感消失以后。还能愿意回来继续做，哪怕每次只推进一点，比一开始的兴奋更能说明它值不值得。",
    "反馈最有价值的地方，不是告诉你哪里做错了，而是缩短‘尝试—观察—调整’之间的距离。好的系统应该帮助你更快看见模式，而不是让你记录更多。",
    "如果一个目标已经变成每天都需要证明自己的地方，它可能开始吞掉本来应该服务的生活。偶尔问一次：这个目标现在还在帮我，还是我已经开始替它工作？",
    "真正的长期主义并不浪漫。它通常只是把重要的事情做得足够简单，以至于普通的一天也能继续。",
    "有些阶段最重要的进步，是从‘我应该做什么’慢慢变成‘我知道什么对我有用’。后者不一定更严格，但通常更稳定。"
  ]
};
function thoughtPool(){
  const out=[];
  Object.entries(THOUGHT_BANK).forEach(([category,rows])=>rows.forEach((text,i)=>out.push({id:`${category.toLowerCase()}-${i}`,category,text})));
  return out;
}
function chooseDailyThought(){
  const all=thoughtPool();
  let state={recent:[],lastCategory:'',date:'',currentId:''};
  try{ state={...state,...JSON.parse(localStorage.getItem(THOUGHT_HISTORY_KEY)||'{}')}; }catch{}
  if(state.date===today() && state.currentId){
    const same=all.find(x=>x.id===state.currentId); if(same) return same;
  }
  let eligible=all.filter(x=>!state.recent.includes(x.id));
  const differentCategory=eligible.filter(x=>x.category!==state.lastCategory);
  if(differentCategory.length>=8) eligible=differentCategory;
  if(!eligible.length) eligible=all;
  // Deterministic within a calendar day, while recent-history avoidance keeps variety.
  const seed=Number(today().replaceAll('-','')) + (state.recent.length*17);
  const item=eligible[seed%eligible.length]||all[0];
  state.recent=[item.id,...state.recent.filter(id=>id!==item.id)].slice(0,16);
  state.lastCategory=item.category; state.date=today(); state.currentId=item.id;
  try{ localStorage.setItem(THOUGHT_HISTORY_KEY,JSON.stringify(state)); }catch{}
  return item;
}
const END_GOAL_AREAS = [
  {name:'BODY',short:'Healthy. ~48 kg. Stronger. Sleeping well.',detail:'Reach around 48 kg and be able to maintain around that weight comfortably. Once weight loss is mostly done, gradually shift toward strength and building muscle. Sleep better and, overall, feel healthy and good in my body.'},
  {name:'MIND',short:'Calmer. More connected. More of my own life.',detail:'Have more friends and people I genuinely enjoy spending time with. Feel less anxious and spend less mental energy obsessing over small things. Keep space for reading, curiosity, learning, or projects that belong to me.'},
  {name:'FAMILY',short:'Close. Kids on the right track. Less second-guessing.',detail:'Feel more connected as a family. Feel that the kids’ education and support are on the right track and more confident about our decisions. Spend less time constantly re-optimizing classes, therapy, activities, and schedules.'},
  {name:'MONEY',short:'Clean. Intentional. Simple. Loose ends closed.',detail:'Close important tax, finance, and admin loose ends. Simplify things that are unnecessarily complicated, feel confident about where money is invested and why, and spend intentionally instead of constantly thinking about buying or optimizing.'}
];


const TRACKER_DEFS = {
  veg:{id:'veg',label:'Vegetables',group:'diet',cadence:'daily'},
  protein:{id:'protein',label:'Protein',group:'diet',cadence:'daily'},
  fruit:{id:'fruit',label:'Fruit',group:'diet',cadence:'daily'},
  noSnack:{id:'noSnack',label:'No snacks',group:'diet',cadence:'daily'},
  stop6:{id:'stop6',label:'Legacy eating cutoff',group:'diet',cadence:'daily'},
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
  const diet={...track,veg:'goal',protein:'goal',fruit:'goal',noSnack:'goal',stop6:'track',water:'track',bedtimeHunger:'track'};
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

const EVENTS=[
  {id:'eating_out',zh:'Eating out',en:'Eating out'},
  {id:'travel',zh:'Travel',en:'Travel'},
  {id:'party',zh:'Party',en:'Party'},
  {id:'vacation',zh:'Vacation',en:'Vacation'},
  {id:'poor_sleep',zh:'Poor sleep',en:'Poor sleep'},
  {id:'period',zh:'Period',en:'Period'},
  {id:'sick',zh:'Sick',en:'Sick'}
];
const LEGACY_EVENT_TO_ID={
  'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Period':'period','Sick':'sick'
};
function eventId(v){return LEGACY_EVENT_TO_ID[v]||v;}
function eventLabel(v){const id=eventId(v);const e=EVENTS.find(x=>x.id===id);if(e)return db.language==='zh'?e.zh:e.en;const custom=db.customEvents?.find(x=>x.id===id);return custom?custom.label:String(v);}

const defaults = {
  schemaVersion:SCHEMA_VERSION,
  version:SCHEMA_VERSION,
  language:'en',
  goal:{id:`goal-${today()}-active`,name:'Back to 50',start:today(),end:addDays(today(),31),startWeight:52.7,target:50,status:'active',focus:'both',trackers:defaultTrackersForFocus('both',today()),review:blankReview(),reviews:[]},
  days:{},
  calendarRuleHistory:[], // Dated rule revisions preserve past Calendar evaluations.
  customEvents:[],
  chartSettings:{categories:['food','hunger'],food:['eating_out','alcohol','snacks','more_than_intended'],exercise:['steps','cardio','strength'],other:['period','travel','party','vacation','poor_sleep','sick','short_sleep'],custom:[],hungerMin:4},
  plan:{veg:3,fruit:2,noSnack:true,stop:null,satiety:7,water:2,stepsTarget:10000,stepsDays:5,stretchDays:5,cardio:90,strength:60,strengthSessions:2},
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
let archiveConfirmOpen = false;
let removeCustomId = null;
let customReturnView = 'day';
let dailyThought = chooseDailyThought();
let thoughtHiddenAt = 0;
let goalEditSnapshot = null;
let goalEditDirty = false;
let discardGoalEditOpen = false;
let snapshotExpandedGoalId = null;

function fresh(){ return JSON.parse(JSON.stringify(defaults)); }
function mergeDay(x={}){
  return {
    date:x.date||today(), weight:x.weight??null, sleep:x.sleep??null,
    alcohol:x.alcohol??null, bowelMovement:x.bowelMovement??null,
    events:Array.isArray(x.events)?x.events.map(e=>({'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Period':'period','Sick':'sick'}[e]||e)).filter(e=>e!=='flight'):[],
    planMode:x.planMode||'default', plannedSleep:x.plannedSleep??null,
    customPlan:{
      veg:x.customPlan?.veg??null, fruit:x.customPlan?.fruit??null, noSnack:x.customPlan?.noSnack??null,
      stop:x.customPlan?.stop??null, satiety:x.customPlan?.satiety??null, water:x.customPlan?.water??null,
      steps:x.customPlan?.steps??null, stretch:x.customPlan?.stretch??null, cardio:x.customPlan?.cardio??null, strength:x.customPlan?.strength??null
    },
    plannedMove:{steps:x.plannedMove?.steps??null,stretch:x.plannedMove?.stretch??null,cardio:x.plannedMove?.cardio??null,strength:x.plannedMove?.strength??null},
    food:{veg:x.food?.veg??null,protein:x.food?.protein??null,fruit:x.food?.fruit??null,noSnack:x.food?.noSnack??null,moreThanIntended:x.food?.moreThanIntended??null,stop6:x.food?.stop6??null,water:x.food?.water??null,bedtimeHunger:x.food?.bedtimeHunger??null,satiety:x.food?.satiety??null},
    skips:(x.skips&&typeof x.skips==='object')?{...x.skips}:{},
    move:{steps:x.move?.steps??null,stretch:x.move?.stretch??null,cardio:x.move?.cardio??null,strength:x.move?.strength??null},
    close:x.close??null,note:x.note??''
  };
}
function migrate(raw){
  const out=fresh();
  if(!raw || typeof raw!=='object') return out;
  const previousSchema=+(raw.schemaVersion||raw.version||0);
  out.language='en';
  const rawGoal=raw.goal||{};
  out.goal={...out.goal,...rawGoal};
  out.goal.id=stableGoalId(out.goal,'-active'); out.goal.focus=['diet','exercise','both','other'].includes(out.goal.focus)?out.goal.focus:'both'; out.goal.trackers=normalizeTrackers({...out.goal,trackers:rawGoal.trackers||null},false);
  // Before V9.4, a missing stop6 config inherited the old Diet/Both default: Goal.
  // Reconstruct that historical default before retiring the tracker for current use.
  if(previousSchema<15 && !(rawGoal.trackers&&rawGoal.trackers.stop6) && ['diet','both'].includes(out.goal.focus)) out.goal.trackers.stop6={role:'goal',activeFrom:out.goal.start||today(),roleAuto:true};
  out.goal.review=normalizeReview(out.goal.review); out.goal.reviews=normalizeReviews(out.goal);
  out.plan={...out.plan,...(raw.plan||{}),stepsTarget:10000,strengthSessions:raw.plan?.strengthSessions??out.plan.strengthSessions};
  out.goals=Array.isArray(raw.goals)?raw.goals.map((g,i)=>{const x={...g,id:stableGoalId(g,`-${i}`),focus:['diet','exercise','both','other'].includes(g.focus)?g.focus:'both',review:normalizeReview(g.review),planSnapshot:g.planSnapshot?{...g.planSnapshot}:null,snapshot:true};x.trackers=normalizeTrackers(x,true);if(previousSchema<15 && !(g.trackers&&g.trackers.stop6) && ['diet','both'].includes(x.focus))x.trackers.stop6={role:'goal',activeFrom:x.start||today(),roleAuto:true};x.reviews=normalizeReviews(x);return x;}):[];
  out.days={};
  Object.entries(raw.days||{}).forEach(([k,v])=>out.days[k]=mergeDay({...v,date:k}));
  // Older backups had no rule history: their CURRENT rules form the starting
  // baseline. Past cutoff values cannot be reconstructed from old daily booleans.
  out.calendarRuleHistory=Array.isArray(raw.calendarRuleHistory)
    ? raw.calendarRuleHistory.filter(r=>r && /^\d{4}-\d{2}-\d{2}$/.test(String(r.effectiveFrom||'')) && r.goal && r.plan)
      .map(r=>({effectiveFrom:r.effectiveFrom,goal:JSON.parse(JSON.stringify(r.goal)),plan:{...r.plan}}))
      .sort((a,b)=>a.effectiveFrom.localeCompare(b.effectiveFrom))
    : [];
  // Historical free-text events become reusable options without rewriting day records.
  // Archived IDs stay registered so a removed option is never regenerated from history.
  const seen=new Set();
  out.customEvents=(Array.isArray(raw.customEvents)?raw.customEvents:[]).filter(e=>e&&typeof e.id==='string'&&typeof e.label==='string').map(e=>({id:e.id,label:e.label.slice(0,40),category:e.category==='food'?'food':'other',active:e.active!==false})).filter(e=>{if(seen.has(e.id))return false;seen.add(e.id);return true;});
  for(const rec of Object.values(out.days))for(const value of rec.events){
    const id=String(value);
    if(!EVENTS.some(e=>e.id===eventId(id)) && !seen.has(id)){
      out.customEvents.push({id,label:id.slice(0,40),category:'other',active:true});seen.add(id);
    }
  }
  const cs=raw.chartSettings||{};
  const opts=(value,allow,fallback)=>Array.isArray(value)?[...new Set(value.filter(x=>allow.includes(x)))]:[...fallback];
  const cats=['food','hunger','exercise','other'];
  const groups=opts(cs.categories,cats,defaults.chartSettings.categories).slice(0,2);
  const activeCustom=out.customEvents.filter(e=>e.active).map(e=>e.id);
  // V9.2 restores the intended 'Snacks = ate snacks' source. Preserve selections
  // made in V9.1 ('no_snacks') and older V9.0 ('snacks') without changing logs.
  const foodSources=Array.isArray(cs.food)?cs.food.map(x=>x==='no_snacks'?'snacks':x):null;
  out.chartSettings={categories:groups,food:opts(foodSources,['eating_out','alcohol','snacks','more_than_intended'],defaults.chartSettings.food),exercise:opts(cs.exercise,['steps','cardio','strength'],defaults.chartSettings.exercise),other:opts(cs.other,['period','travel','party','vacation','poor_sleep','sick','short_sleep'],defaults.chartSettings.other),custom:opts(cs.custom,activeCustom,[]),hungerMin:[3,4,5].includes(+cs.hungerMin)?+cs.hungerMin:4};
  if(previousSchema<15 && !out.chartSettings.food.includes('more_than_intended')) out.chartSettings.food.push('more_than_intended');
  // V9.4 retires the eating-cutoff tracker for new/current use without rewriting
  // any historical day or historical Calendar evaluation. The old rule remains
  // available inside dated rule snapshots and archived goals.
  if(previousSchema<15){
    const oldGoal=JSON.parse(JSON.stringify(out.goal)), oldPlan={...out.plan};
    if(!out.calendarRuleHistory.length){
      out.calendarRuleHistory.push({effectiveFrom:'0001-01-01',goal:oldGoal,plan:oldPlan});
    }
    out.plan.stop=null;
    out.goal.trackers=normalizeTrackers(out.goal,false);
    out.goal.trackers.stop6={role:'track',activeFrom:today(),roleAuto:false};
    out.calendarRuleHistory=out.calendarRuleHistory.filter(r=>r.effectiveFrom<today());
    out.calendarRuleHistory.push({effectiveFrom:today(),goal:JSON.parse(JSON.stringify(out.goal)),plan:{...out.plan}});
  }
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
function dayPlan(d){ return dayPlanForGoal(calendarRulesForDate(d.date).goal,d); }
// A rule change creates a new effective-dated revision, NEVER a rewrite of old
// daily food/weight logs. Date lookups use the most recent revision at or before
// that day; editing an old log still recomputes against that day's original rules.
function calendarRulesForDate(date){
  const rows=db.calendarRuleHistory||[];
  let chosen=null;
  for(const row of rows){if(row.effectiveFrom<=date)chosen=row;else break;}
  if(!chosen) return {goal:{...db.goal,planSnapshot:{...db.plan}},plan:db.plan};
  return {goal:{...chosen.goal,planSnapshot:{...chosen.plan}},plan:chosen.plan};
}
function calendarEffectiveDate(){
  const raw=document.getElementById('goalEffectiveFrom')?.value || document.getElementById('planEffectiveFrom')?.value || today();
  // Never silently regrade an already completed day with a retroactive rule.
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) && raw>=today()?raw:today();
}
function recordCalendarRuleChange(beforeGoal,beforePlan,effectiveFrom=today()){
  if(JSON.stringify(beforeGoal)===JSON.stringify(db.goal) && JSON.stringify(beforePlan)===JSON.stringify(db.plan))return;
  const from=effectiveFrom>=today()?effectiveFrom:today();
  if(!Array.isArray(db.calendarRuleHistory))db.calendarRuleHistory=[];
  if(!db.calendarRuleHistory.length){
    db.calendarRuleHistory.push({effectiveFrom:'0001-01-01',goal:JSON.parse(JSON.stringify(beforeGoal)),plan:{...beforePlan}});
  }
  // A newly edited rule supersedes any not-yet-effective scheduled revisions.
  db.calendarRuleHistory=db.calendarRuleHistory.filter(r=>r.effectiveFrom<from);
  db.calendarRuleHistory.push({effectiveFrom:from,goal:JSON.parse(JSON.stringify(db.goal)),plan:{...db.plan}});
}
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
  const dated=(g===db.goal && d?.date)?calendarRulesForDate(d.date).goal:g;
  const p=dayPlanForGoal(dated,d||day(today())), plan=planForGoal(dated);
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
  const {goal:g}=calendarRulesForDate(d.date);
  const inGoal=d.date>=g.start && d.date<=(g.ended||g.end);
  if(inGoal){
    const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].group==='diet'&&TRACKER_DEFS[id].cadence==='daily'&&trackerRole(g,id)==='goal'&&trackerActiveOn(g,id,d.date));
    if(ids.length){
      let recorded=0,pass=0,eligible=0;
      for(const id of ids){
        const e=dailyTrackerEval(g,id,d);
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
  const f=d.food, p=dayPlanForGoal(g,d), core=[f.veg,f.fruit,f.noSnack,f.stop6];
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
  const m=d.move, steps=+m.steps||0, cardio=+m.cardio||0, strength=+m.strength||0;
  const meaningful=steps>=10000 || cardio>=20 || strength>=20;
  const any=steps>0 || m.stretch===true || cardio>0 || strength>0;
  if(!any) return {done:false,recorded:false,calendarPass:false,label:'No record',shortLabel:'Not logged'};
  const pieces=[];
  if(steps>=10000) pieces.push(`${(steps/1000).toFixed(steps%1000?1:0)}k steps`);
  else if(steps>0) pieces.push(`${(steps/1000).toFixed(1)}k steps · below 10k`);
  if(cardio>0) pieces.push(`Cardio ${cardio} min${cardio<20?' · short':''}`);
  if(strength>0) pieces.push(`Strength ${strength} min${strength<20?' · short':''}`);
  if(!pieces.length&&m.stretch) pieces.push('Stretch logged');
  const shortLabel=meaningful?'Goal met':steps>0?`${(steps/1000).toFixed(1)}k · below 10K`:'Logged';
  return {done:meaningful,recorded:any,calendarPass:meaningful,label:pieces.slice(0,2).join(' · '),shortLabel};
}
function plannedMoveStatus(d){
  const m=d.plannedMove||{}; const any=(+m.steps||0)>0 || m.stretch===true || (+m.cardio||0)>0 || (+m.strength||0)>0;
  if(!any) return {planned:false,label:tr('noRecord')};
  const pieces=[];
  if(+m.steps>0) pieces.push(`${m.steps}${db.language==='zh'?'步':' steps'}`);
  if(m.stretch) pieces.push('Stretch');
  if(+m.cardio>0) pieces.push(`${m.cardio}${db.language==='zh'?'分有氧':'m cardio'}`);
  if(+m.strength>0) pieces.push(`${m.strength}${db.language==='zh'?'分力量':'m strength'}`);
  return {planned:true,calendarPass:(+m.steps||0)>=10000 || (+m.cardio||0)>=20 || (+m.strength||0)>=20,label:pieces.slice(0,2).join(' · ')};
}
function plannedMoveControls(d){
  const m=d.plannedMove||{};
  return `<div class="two"><label>${tr('steps')}<input data-day-field="plannedMove.steps" inputmode="numeric" type="number" min="0" value="${m.steps??''}" placeholder="10000"></label><label>${tr('cardio')} · ${tr('minutes')}<input data-day-field="plannedMove.cardio" inputmode="numeric" type="number" min="0" value="${m.cardio??''}" placeholder="0"></label><label>${tr('strength')} · ${tr('minutes')}<input data-day-field="plannedMove.strength" inputmode="numeric" type="number" min="0" value="${m.strength??''}" placeholder="0"></label><div style="padding-top:26px"><div class="switch-row"><span style="font-size:14px">${tr('stretch')}</span><button class="toggle ${m.stretch===true?'on':''}" data-toggle-planned-move="stretch"></button></div></div></div>`;
}
function morningResponse(){
  const d=readDay(today());
  if(d.weight==null) return '';
  const weights=latestWeights(today());
  const idx=weights.findIndex(x=>x.date===today());
  const prev=idx>0?weights[idx-1]:null;
  const current=+d.weight;
  const avgNow=movingAverage(today());
  const avgWeekAgo=movingAverage(addDays(today(),-7));
  const trend=(avgNow!=null&&avgWeekAgo!=null)?avgNow-avgWeekAgo:null;
  const change=prev?current-(+prev.weight):null;
  const changeText=change==null?'':`${Math.abs(change).toFixed(1)} kg`;
  if(change!=null && change<=-.2 && trend!=null && trend<=-.1){
    return `今天比上一次称重轻了 ${changeText}，而且 7 日平均也比一周前低了 ${Math.abs(trend).toFixed(1)} kg。单日数字和短期趋势同时往下，比只看到某一天更值得高兴。先保持现在的节奏，不需要因为今天漂亮就把计划再收紧。`;
  }
  if(change!=null && change<=-.2){
    return `今天轻了 ${changeText}，可以开心一下。不过 7 日平均还没有出现同样明显的变化，所以先把它当成一个好信号，而不是新的结论。再看几天，真正有意义的是这个方向能不能慢慢留下来。`;
  }
  if(change!=null && change>=.3 && trend!=null && trend<=-.1){
    return `今天比上一次高了 ${changeText}，但 7 日平均仍然比一周前低 ${Math.abs(trend).toFixed(1)} kg。一天的反弹没有改变目前的方向，不需要追着今天的数字去补偿或重新设计计划。`;
  }
  if(change!=null && change>=.3){
    return `今天的数字高了 ${changeText}。这值得留意，但还不足以说明趋势发生了变化。先继续按平常的方式记录两三天，再看 7 日平均是否真的往上；没有必要为了一个早晨立刻调整整个计划。`;
  }
  if(trend!=null && trend<=-.1){
    return `今天和上一次差别不大，但 7 日平均比一周前低了 ${Math.abs(trend).toFixed(1)} kg。趋势在慢慢移动，而不是靠某一个特别低的数字制造进展；这种变化通常更值得信任。`;
  }
  if(trend!=null && trend>=.15){
    return `今天本身没有特别大的变化，但最近一周的平均值比前一周高了 ${trend.toFixed(1)} kg。先把它当成需要继续观察的信号，而不是失败。看看接下来几天 Diet、活动量和晚间饥饿有没有形成连续模式，再决定是否值得调整。`;
  }
  return `今天的体重仍然在最近的波动区间里，没有出现需要马上反应的新信号。继续记录就好；当几天的数据开始朝同一个方向移动时，Tide 再把它当成真正的趋势。`;
}
function morningResponseBlock(){
  const text=morningResponse();
  return text?`<section class="morning-response"><div class="feedback-label">今早</div><div class="feedback-copy">${escapeHtml(text)}</div></section>`:'';
}
function recentWindow(days=7, through=today()){
  const from=addDays(through,-(days-1));
  const rows=[]; for(let d=from;d<=through;d=addDays(d,1)) rows.push(readDay(d));
  return rows;
}
function recentWins(){
  const rows=recentWindow(14), last7=rows.slice(-7), wins=[];
  const recentWeights=last7.filter(d=>d.weight!=null);
  const previous7=rows.slice(0,7).filter(d=>d.weight!=null);
  if(recentWeights.length>=3 && previous7.length>=3){
    const a=avg(recentWeights.map(d=>+d.weight)), b=avg(previous7.map(d=>+d.weight));
    if(a!=null&&b!=null&&a<=b-.15) wins.push(`最近 7 天的平均体重比前一周低了 ${(b-a).toFixed(1)} kg。`);
  }
  const snackLogged=last7.filter(d=>d.food.noSnack!=null&&!d.skips?.noSnack);
  const noSnack=snackLogged.filter(d=>d.food.noSnack===true).length;
  if(snackLogged.length>=4 && noSnack>=4) wins.push(`过去 7 天，有记录的 ${snackLogged.length} 天里 ${noSnack} 天没有吃零食。`);
  const steps10=last7.filter(d=>(+d.move.steps||0)>=10000).length;
  if(steps10>=2) wins.push(`过去 7 天有 ${steps10} 天走到 10K+ 步。`);
  const workouts=last7.filter(d=>(+d.move.cardio||0)>=20 || (+d.move.strength||0)>=20).length;
  if(workouts>=2) wins.push(`过去 7 天完成了 ${workouts} 天至少 20 分钟的 Cardio / Strength。`);
  const amountLogged=last7.filter(d=>d.food.moreThanIntended!=null);
  const aboutRight=amountLogged.filter(d=>d.food.moreThanIntended===false).length;
  if(amountLogged.length>=4 && aboutRight>=4) wins.push(`过去 7 天，有记录的 ${amountLogged.length} 天里 ${aboutRight} 天的进食量在自己原本想要的范围内。`);
  const weighCount=last7.filter(d=>d.weight!=null).length;
  if(weighCount>=5) wins.push(`这一周已经有 ${weighCount} 次晨间称重，趋势判断会比单日数字可靠得多。`);
  return wins.slice(0,3);
}
function recentWinsBlock(){
  const wins=recentWins(); if(!wins.length)return '';
  return `<section class="card recent-wins"><div class="feedback-label">最近的进展</div>${wins.map(x=>`<div class="win-row"><span>•</span><div>${escapeHtml(x)}</div></div>`).join('')}</section>`;
}
function weeklyPulseBlock(){
  const rows=recentWindow(7), weights=rows.filter(d=>d.weight!=null), snackLogged=rows.filter(d=>d.food.noSnack!=null&&!d.skips?.noSnack);
  const noSnack=snackLogged.filter(d=>d.food.noSnack===true).length;
  const steps10=rows.filter(d=>(+d.move.steps||0)>=10000).length;
  const hungers=rows.map(d=>d.food.bedtimeHunger).filter(v=>v!=null).map(Number);
  const avgNow=movingAverage(today()), avgAgo=movingAverage(addDays(today(),-7));
  const trend=(avgNow!=null&&avgAgo!=null)?avgNow-avgAgo:null;
  const enough=weights.length>=2||snackLogged.length>=3||steps10>=2||hungers.length>=3; if(!enough)return '';
  const metrics=[];
  metrics.push(`<div><span>7日趋势</span><b>${trend==null?'—':`${trend>0?'+':''}${trend.toFixed(1)} kg`}</b></div>`);
  metrics.push(`<div><span>No snacks</span><b>${snackLogged.length?`${noSnack}/${snackLogged.length}`:'—'}</b></div>`);
  metrics.push(`<div><span>10K+</span><b>${steps10} 天</b></div>`);
  if(hungers.length) metrics.push(`<div><span>晚间饥饿</span><b>${avg(hungers).toFixed(1)}/5</b></div>`);
  let note='这周的数据还在积累，先看方向，不急着给自己下结论。';
  if(trend!=null&&trend<=-.15) note='最明显的是体重趋势在往下。保持能重复的做法，比为了加快速度再增加规则更重要。';
  else if(steps10>=4) note='这一周活动量比较稳定。10K 是真正达到门槛的天数，低于 10K 的步数仍保留记录，但不会算成 Move day。';
  else if(snackLogged.length>=4&&noSnack/snackLogged.length>=.75) note='这一周 No snacks 的执行比较稳定。继续观察它和整体进食量，而不是把零食当成唯一的 Diet 指标。';
  return `<section class="card weekly-pulse"><div class="row between"><div class="feedback-label">最近 7 天</div><span class="small">Weekly pulse</span></div><div class="pulse-grid">${metrics.join('')}</div><div class="pulse-note">${escapeHtml(note)}</div></section>`;
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
  if(!r || r.date<addDays(today(),-21)) return '';
  const summary=String(r.summary||r.preview||'').trim();
  if(!summary) return '';
  return `<section class="today-learning-card"><div class="row between"><div class="today-learning-label">Goal review</div><div class="small">${fmtShortDate(r.date)}${r.day?` · Day ${r.day}`:''}</div></div><div class="today-learning-copy">${escapeHtml(summary)}</div><button class="review-inline-link" data-review-goal="${escapeHtml(db.goal.id)}">Review history →</button></section>`;
}


function endGoalTodayEntry(){
  return `<button class="end-goal-entry" data-action="openEndGoal"><div class="end-goal-entry-top"><span>End Goal · 2026</span><span class="end-goal-arrow">›</span></div><div class="end-goal-entry-copy">Healthy · Calmer · Connected · Simple</div></button>`;
}
function dailyThoughtBlock(){
  const t=dailyThought||chooseDailyThought();
  return `<section class="daily-thought"><div class="daily-thought-label">今日一想 · ${escapeHtml(t.category)}</div><div class="daily-thought-copy">${escapeHtml(t.text)}</div></section>`;
}
function endGoalPage(){
  return `${topbar('End Goal','',`<button class="btn ghost" data-action="backToday">Done</button>`)}
    <div class="end-goal-date">December 31, 2026</div>
    <div class="end-goal-question">What do I want to be true by the end of the year?</div>
    <div class="end-goal-list">${END_GOAL_AREAS.map(a=>`<details class="end-goal-area"><summary><span class="end-goal-area-name">${a.name}</span><span class="end-goal-area-short">${escapeHtml(a.short)}</span></summary><p>${escapeHtml(a.detail)}</p></details>`).join('')}</div>
    <div class="end-goal-footer">These are the things that actually matter this year.</div>`;
}

function todayPage(){
  const d=day(today()), lw=latestWeight(today());
  const startW=activeGoalStartWeight(), current=lw?.weight??startW, progress=goalProgress(current);
  const food=foodStatus(d), move=moveStatus(d), events=d.events.length;
  const remaining=Math.max(0,(+current)-(+db.goal.target));
  const daysLeft=Math.max(0,Math.ceil((parseDate(db.goal.end)-parseDate(today()))/86400000));
  const foodDone=food.calendarPass, moveDone=move.calendarPass, lifeDone=events>0;
  return `${topbar(`Today · ${fmtDate(today(),'en')}`)}
  ${flashHtml()}
  ${dailyThoughtBlock()}
  ${endGoalTodayEntry()}
  <section class="today-goal-card">
    <div class="row between"><div><div class="eyebrow">Current goal</div><div class="today-goal-name">${escapeHtml(db.goal.name)}</div></div><span class="status active">Active</span></div>
    <div class="today-goal-line"><i style="width:${progress}%"></i></div>
    <div class="today-goal-metrics"><div><span>Current</span><b>${fmt(current)}</b><em>kg</em></div><div><span>Target</span><b>${fmt(db.goal.target)}</b><em>kg</em></div><div><span>Goal date</span><b class="date-value">${fmtDate(db.goal.end)}</b></div></div>
  </section>
  <button class="quick-weight-card ${d.weight==null?'empty-weight':''}" data-action="quickWeight">
    <div><div class="quick-weight-label">Morning weight</div><div class="quick-weight-value">${d.weight==null?'Log morning weight':`${fmt(d.weight)} <span>kg</span>`}</div></div>
    <div class="quick-weight-action">${d.weight==null?'Log now':'Edit'} ›</div>
  </button>
  ${morningResponseBlock()}
  ${recentWinsBlock()}
  ${weeklyPulseBlock()}
  ${todayGoalLearning()}
  <section class="today-summary-grid">
    <button class="summary-tile green" data-action="editToday"><div class="summary-label">Diet</div><div class="summary-value">${foodDone?'Goal met':food.recorded?'In progress':'Not logged'}</div><span class="summary-dot ${foodDone?'done':''}"></span></button>
    <button class="summary-tile pink" data-action="editToday"><div class="summary-label">Move</div><div class="summary-value">${moveDone?'Move day':move.recorded?move.shortLabel:'Not logged'}</div><span class="summary-dot ${moveDone?'done':''}"></span></button>
    <button class="summary-tile green-soft" data-action="editToday"><div class="summary-label">Life</div><div class="summary-value">${events?`${events} event${events>1?'s':''}`:'No special events'}</div><span class="summary-dot ${lifeDone?'done':''}"></span></button>
  </section>
  <section class="today-progress-card">
    <div class="progress-stat"><div class="big-stat">${(startW-current)>=0?'-':''}${Math.abs(startW-current).toFixed(1)}</div><div class="stat-caption">kg from start</div></div>
    <div class="goal-ring" style="--p:${progress}"><div><b>${Math.round(progress)}%</b><span>complete</span></div></div>
    <div class="progress-stat right"><div class="big-stat">${daysLeft}</div><div class="stat-caption">days left</div><div class="tiny-remaining">${remaining.toFixed(1)} kg to go</div></div>
  </section>
  <button class="today-edit-button" data-action="editToday">View / edit today</button>`;
}
function skipButton(id,d){ return `<button class="skip-chip ${d.skips?.[id]?'on':''}" data-toggle-skip="${id}">${d.skips?.[id]?'N/A ✓':'N/A'}</button>`; }
function trackerHead(id,d){ return `<div class="tracker-head"><div class="actual-label">${TRACKER_DEFS[id].label} ${trackerRoleBadge(calendarRulesForDate(d.date).goal,id)}</div>${skipButton(id,d)}</div>`; }
function todayPlanChips(d){
  const dated=calendarRulesForDate(d.date).goal;
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].cadence==='daily'&&trackerRole(dated,id)==='goal'&&trackerActiveOn(dated,id,d.date));
  const chips=ids.map(id=>trackerRuleLabel(dated,id,d));
  return `<div class="rule-grid compact-rules">${chips.length?chips.map(x=>`<div class="rule">${escapeHtml(x)}</div>`).join(''):'<div class="small">No daily behavior goals set.</div>'}</div>${d.events.length?`<div class="life-events compact-events">${d.events.map(e=>`<span class="event-chip on">${escapeHtml(eventLabel(e))}</span>`).join('')}</div>`:''}`;
}
function actualFoodControls(d){
  const veg=[0,1,2,3,4], fruit=[0,1,2,3], hunger=[1,2,3,4,5];
  return `
  <div class="actual-row tracker-row ${d.skips?.veg?'is-skip':''}">${trackerHead('veg',d)}<div class="chip-row">${veg.map(v=>`<button class="pill ${d.food.veg!==null && +d.food.veg===v?'on':''}" data-set-food="veg" data-value="${v}">${v===4?'4+':v}</button>`).join('')}</div></div>
  <div class="actual-row tracker-row ${d.skips?.protein?'is-skip':''}">${trackerHead('protein',d)}<div class="switch-row compact-switch"><span>${d.food.protein===true?'Target met':'Mark when met'}</span><button class="toggle ${d.food.protein===true?'on':''}" data-toggle-food="protein" aria-label="Protein"></button></div></div>
  <div class="actual-row tracker-row ${d.skips?.fruit?'is-skip':''}">${trackerHead('fruit',d)}<div class="chip-row">${fruit.map(v=>`<button class="pill ${d.food.fruit!==null && +d.food.fruit===v?'on':''}" data-set-food="fruit" data-value="${v}">${v===3?'3+':v}</button>`).join('')}</div></div>
  <div class="actual-row tracker-row ${d.skips?.noSnack?'is-skip':''}">${trackerHead('noSnack',d)}<div class="snack-choices" role="group" aria-label="Snacks on this date">${[[true,'No snacks'],[false,'Had snacks'],[null,'Not logged']].map(([val,label])=>`<button type="button" class="snack-choice ${d.food.noSnack===val?'on':''}" data-no-snack="${val===null?'null':String(val)}" aria-pressed="${d.food.noSnack===val}">${label}</button>`).join('')}</div></div>
  <div class="actual-row tracker-row context-row"><div class="tracker-head"><div class="actual-label">Amount eaten <span class="role-mini track">Context</span></div></div><div class="snack-choices amount-choices" role="group" aria-label="Amount eaten on this date">${[[false,'About right'],[true,'More than intended'],[null,'Not logged']].map(([val,label])=>`<button type="button" class="snack-choice ${d.food.moreThanIntended===val?'on':''}" data-more-than="${val===null?'null':String(val)}" aria-pressed="${d.food.moreThanIntended===val}">${label}</button>`).join('')}</div></div>
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

function lifeEventTagsHtml(d,future=false){
  let html=EVENTS.map(e=>`<button class="event-chip ${d.events.includes(e.id)?'on':''}" data-event="${e.id}">${e.en}</button>`).join('');
  if(!future){
    const alcohol=d.alcohol==null?null:+d.alcohol;
    const alcoholLabel=alcohol>=2?'Alcohol · 2+':alcohol===1?'Alcohol · 1':'Alcohol';
    html+=`<button class="event-chip ${alcohol>0?'on':''}" data-cycle-alcohol>${alcoholLabel}</button>`;
  }
  // One shared list: the same custom event is used in the day and Chart Settings.
  const shown=db.customEvents.filter(e=>e.active||d.events.includes(e.id));
  // Archived names stay visible on historical days, but cannot be accidentally unticked.
  html+=shown.map(e=>e.active
    ? `<button class="event-chip ${d.events.includes(e.id)?'on':''}" data-event="${escapeHtml(e.id)}" title="Custom · ${e.category==='food'?'Food':'Other'}">${escapeHtml(e.label)}</button>`
    : `<span class="event-chip archived-event" title="Historical event · restore in Manage custom events to edit">${escapeHtml(e.label)} · archived</span>`).join('');
  return html;
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

function dayPage(){
  const d=day(selected), future=selected>today();
  const title=fmtDate(selected,'en'), sub=future?'Future plan':selected===today()?'Today':'Edit past day';
  const eventsNotes=`<section class="card events-notes-card" id="eventsNotes"><div class="row between"><div class="actual-label">Events & Notes</div><button class="quiet-link" data-action="manageCustom">Manage custom ›</button></div><div class="life-events">${lifeEventTagsHtml(d,future)}</div><div class="custom-event-inline"><input id="customEvent" maxlength="40" placeholder="New custom event" aria-label="New custom event"><button class="btn secondary" data-action="addEvent">Add</button></div><label class="notes-inline">Notes<textarea data-day-field="note" rows="2" placeholder="Optional">${escapeHtml(d.note)}</textarea></label></section>`;
  let main='';
  if(future){
    main=`${eventsNotes}<section class="card"><div class="actual-label">Day plan</div>${futurePlanSummary(d)}<hr class="sep"><div class="actual-label">Exercise plan (optional)</div>${plannedMoveControls(d)}</section>`;
  }else{
    main=`<section class="card blue-soft"><div class="actual-label">Morning log</div><div class="two"><label>Weight · kg<input data-day-field="weight" type="number" step="0.1" inputmode="decimal" value="${d.weight??''}"></label><label>Last night's sleep · hours<input data-day-field="sleep" type="number" step="0.1" inputmode="decimal" value="${d.sleep??''}"></label></div></section>${eventsNotes}<section class="card"><div class="actual-label">Diet</div>${actualFoodControls(d)}${plannedMoveStatus(d).planned?`<div class="planned-reference">Planned: ${escapeHtml(plannedMoveStatus(d).label)}</div>`:''}<hr class="sep"><div class="actual-label">Exercise</div>${movementControls(d)}</section>`;
  }
  return `${topbar(title,sub,`<button class="btn sky save-top" data-action="saveDay">Save</button>`)}
    ${flashHtml()}
    ${main}
    <button class="btn sky full" data-action="saveDayBottom">Done</button>`;
}
function futurePlanSummary(d){
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].cadence==='daily'&&trackerRole(db.goal,id)==='goal'&&trackerActiveOn(db.goal,id,d.date));
  return `<div class="rule-grid">${ids.map(id=>`<div class="rule">${escapeHtml(trackerRuleLabel(db.goal,id,d))}</div>`).join('')}</div>`;
}
function customPlanControls(d){const p=d.customPlan||{};return `<div class="custom-plan"><div class="actual-label">Custom food goals</div><div class="two"><label>Vegetables ≥<input data-day-field="customPlan.veg" type="number" value="${p.veg??db.plan.veg}"></label><label>Fruit ≤<input data-day-field="customPlan.fruit" type="number" value="${p.fruit??db.plan.fruit}"></label><label>Water ≥ L<input data-day-field="customPlan.water" type="number" step="0.1" value="${p.water??db.plan.water}"></label></div><div class="switch-row actual-row"><span>Allow snacks</span><button class="toggle ${p.noSnack===false?'on':''}" data-toggle-custom="allowSnack"></button></div><div class="small plan-helper">Protein is yes/no. Bedtime hunger is observation only and has no custom target.</div><hr class="sep"><div class="actual-label">Custom exercise</div><div class="two"><label>Steps<input data-day-field="customPlan.steps" type="number" value="${p.steps??''}" placeholder="10000"></label><label>Cardio · min<input data-day-field="customPlan.cardio" type="number" value="${p.cardio??''}"></label><label>Strength · min<input data-day-field="customPlan.strength" type="number" value="${p.strength??''}"></label><div style="padding-top:26px"><div class="switch-row"><span>Stretch</span><button class="toggle ${p.stretch===true?'on':''}" data-toggle-custom="stretch"></button></div></div></div></div>`; }

function median(values){
  const sorted=values.filter(Number.isFinite).slice().sort((a,b)=>a-b);
  if(!sorted.length) return null;
  const mid=Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}
function robustSevenDayMean(date,records){
  // Calendar-based 7-day mean; down-weight a single unusually distant reading
  // for the MODEL only. Actual plotted weights and backups are never changed.
  const first=addDays(date,-6);
  const values=records.filter(r=>r.date>=first&&r.date<=date).map(r=>+r.weight).filter(Number.isFinite);
  if(!values.length) return null;
  if(values.length<5) return avg(values);
  const center=median(values), mad=median(values.map(v=>Math.abs(v-center)));
  const limit=Math.max(.65,3*1.4826*mad);
  const kept=values.filter(v=>Math.abs(v-center)<=limit);
  return kept.length>=3?avg(kept):median(values);
}
function robustRecentSlope(rows){
  // Prefer pairwise slopes that span at least three days. Two distinct, spaced
  // readings can produce an explicitly provisional projection: five is NOT a
  // hard gate. A one-day change alone is too noisy to extrapolate.
  const slopes=[];
  for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++){
    const gap=(parseDate(rows[j].date)-parseDate(rows[i].date))/86400000;
    if(gap>=3) slopes.push((rows[j].value-rows[i].value)/gap);
  }
  return slopes.length?median(slopes):null;
}
function forecastWeightRecords(){
  const all=latestWeights(today());
  if(!all.length) return [];
  const goalOnly=all.filter(r=>r.date>=db.goal.start);
  const goalSpan=goalOnly.length>=2?(parseDate(goalOnly.at(-1).date)-parseDate(goalOnly[0].date))/86400000:0;
  // Once the goal has an established trend, preserve its own forecast basis.
  // Until then, borrow PREVIOUSLY RECORDED weights, without copying them into
  // the new goal or treating their behaviors as current-goal adherence.
  if(goalOnly.length>=5&&goalSpan>=7) return goalOnly;
  const last=all.at(-1);
  const recent=all.filter(r=>r.date>=addDays(last.date,-45));
  return recent.length>=2?recent:all.slice(-2);
}
function goalForecast(){
  const records=forecastWeightRecords();
  if(records.length<2) return {ready:false,reason:records.length?'One recorded weight is shown. Add another on a different day to estimate a trend.':'Your chart will show any existing weight records. Log a weight to begin.'};
  const lastRecord=records.at(-1);
  const staleDays=Math.round((parseDate(today())-parseDate(lastRecord.date))/86400000);
  if(staleDays>21) return {ready:false,reason:'Earlier weights are shown, but they are too old for a current forecast. Log a new weight.'};
  const covered=(parseDate(lastRecord.date)-parseDate(records[0].date))/86400000;
  if(covered<3) return {ready:false,reason:'Earlier weights are shown. A trend needs two readings at least 3 days apart.'};
  if(records.length===2 && covered>60) return {ready:false,reason:'Earlier readings are visible, but too far apart for a useful forecast. Add a recent weigh-in.'};
  // Keep the robust 7-day averages for established series. For 2-4 points
  // they would blend readings and artificially flatten the only available
  // slope, so use actual observations and label the result an early estimate.
  const earlyEstimate=records.length<5 || covered<7;
  const trend=records.map(r=>({date:r.date,value:earlyEstimate?+r.weight:robustSevenDayMean(r.date,records)}));
  const last=trend.at(-1);
  let usable=trend.filter(r=>r.date>=addDays(last.date,-14));
  if(usable.length<2||(parseDate(usable.at(-1).date)-parseDate(usable[0].date))/86400000<3)
    usable=trend.filter(r=>r.date>=addDays(last.date,-35));
  if(usable.length<2||(parseDate(usable.at(-1).date)-parseDate(usable[0].date))/86400000<3) usable=trend;
  let estimate=robustRecentSlope(usable);
  if(estimate==null && !earlyEstimate){
    // Widely spaced historical points can still offer an early estimate.
    const raw=records.map(r=>({date:r.date,value:+r.weight}));
    estimate=robustRecentSlope(raw);
  }
  if(estimate==null) return {ready:false,reason:'Earlier weights are shown, but their dates are too close for a trend.'};
  const slope=clamp(estimate,-.12,.08);
  const current=+last.value;
  const hasEstablishedGoal=records[0].date>=db.goal.start;
  const modelStart=hasEstablishedGoal?db.goal.start:records[0].date;
  const startValue=hasEstablishedGoal?activeGoalStartWeight():+trend[0].value;
  const elapsed=Math.max(1,Math.round((parseDate(last.date)-parseDate(modelStart))/86400000));
  const overallSlope=(current-startValue)/elapsed;
  const daysToEnd=Math.max(0,Math.round((parseDate(db.goal.end)-parseDate(last.date))/86400000));
  const damping=.035, retainedPace=.35, maxEstimateDays=120;
  const forecastValue=days=>{
    const d=Math.max(0,days);
    return current+slope*(retainedPace*d+(1-retainedPace)*(1-Math.exp(-damping*d))/damping);
  };
  const projectedEnd=forecastValue(daysToEnd);
  const backcastValue=daysFromStart=>{
    const u=clamp(daysFromStart/elapsed,0,1),u2=u*u,u3=u2*u;
    return (2*u3-3*u2+1)*startValue+(u3-2*u2+u)*elapsed*overallSlope+
      (-2*u3+3*u2)*current+(u3-u2)*elapsed*slope;
  };
  let targetDate=null,deltaDays=null,reachStatus='flat';
  if(current<=+db.goal.target){
    targetDate=last.date; reachStatus='reached';
  }else if(slope<-.007){
    reachStatus='beyond';
    for(let d=1;d<=maxEstimateDays;d++) if(forecastValue(d)<=+db.goal.target){
      targetDate=addDays(last.date,d); reachStatus='estimated'; break;
    }
  }
  if(targetDate) deltaDays=Math.round((parseDate(targetDate)-parseDate(db.goal.end))/86400000);
  return {ready:true,slope,current,startValue,modelStart,elapsed,lastDate:last.date,projectedEnd,
    targetDate,deltaDays,reachStatus,damping,forecastValue,backcastValue,
    earlyEstimate,usesEarlierData:records.some(r=>r.date<db.goal.start),
    trendWindowStart:usable[0].date,trendPoints:usable.length,
    method:earlyEstimate?'spaced historical readings (provisional)':'robust 7-day mean + Theil-Sen trend + slowing projection'};
}
function forecastMessage(f){
  if(!f.ready) return f.reason;
  if(f.reachStatus==='reached') return f.earlyEstimate?'Early estimate from recorded weights · check against your latest actual reading.':'Smoothed weight has reached the target.';
  if(f.reachStatus==='estimated') return f.earlyEstimate?`Early estimate from ${f.trendPoints} historical weigh-ins · not a deadline.`:'Estimate from recent trend · not a deadline.';
  if(f.reachStatus==='beyond') return f.earlyEstimate?'Early trend estimate: target not projected within 120 days.':'Target not projected within 120 days.';
  return f.earlyEstimate?'Early trend is flat or rising; no target date estimate yet.':'Recent trend is too flat or rising for a date estimate.';
}

function goalDeadlineCard(f){
  const end=db.goal.end, now=today(), recorded=readDay(end);
  const hasActual=end<=now && recorded.weight!=null && Number.isFinite(+recorded.weight);
  if(end<now) return {label:`${fmtDate(end,'en')} · ${hasActual?'Actual':'No weigh-in'}`, value:hasActual?`${fmt(recorded.weight)} kg`:'No weigh-in recorded'};
  if(end===now) return {label:hasActual?'Today · Actual':'Today · No weigh-in',value:hasActual?`${fmt(recorded.weight)} kg`:'No weigh-in yet'};
  return {label:`By ${fmtDate(end,'en')}`, value:f.ready?`${fmt(f.projectedEnd)} kg`:'—'};
}
function changePage(){
  const series=chartData();
  const lw=latestWeight(today()); const f=goalForecast(), deadline=goalDeadlineCard(f);
  const desc=lw?`${tr('actualWeight')} ${fmt(lw.weight)} kg`:tr('noRecord');
  return `${topbar(tr('weightChange'))}
    <section class="card change-goal-card">
      <div><b>${escapeHtml(db.goal.name)}</b><div class="small">${fmtDate(db.goal.start)} → ${fmtDate(db.goal.end)}</div></div>
      <div class="progress-weight-summary"><span>${desc}</span><span class="summary-sep">·</span><span>${tr('goalLine')} ${fmt(db.goal.target)} kg</span></div>
      <div class="chart-heading-row"><div class="legend"><span><span class="legend-line actual-line"></span>${tr('actualWeight')}</span><span><span class="legend-line goal-line"></span>${tr('goalLine')}</span><span><span class="legend-line forecast-line"></span>Forecast</span></div><button class="quiet-link chart-customize" data-action="chartSettings">⚙ Customize</button></div>
      <div class="chart-wrap">${renderChart(series,f)}</div>
    </section>
    <section class="forecast-grid compact-forecast">
      <div class="forecast-card pink"><div class="small">${deadline.label}</div><div class="forecast-value">${deadline.value}</div></div>
      <div class="forecast-card green"><div class="small">Reach ${fmt(db.goal.target)}</div><div class="forecast-text">${f.ready&&f.targetDate?fmtDate(f.targetDate,'en'):f.ready?(f.reachStatus==='beyond'?'> 120 days':'No date yet'):'—'}</div></div>
    </section>
    <div class="insight forecast-insight">${forecastMessage(f)}</div>
    <div class="section-title">Weekly behavior</div>
    <section class="card progress-behavior-card">${weeklyBehaviorProgress(db.goal)}</section>
    <div class="section-title">Weekly review</div>
    <section class="card">${weeklyReviewText()}</section>`;
}
function chartData(){
  // Show real, previously logged weight readings before a new goal begins.
  // Prefer the preceding 30 days (up to 14 points). If that window is sparse,
  // include the last two older readings instead. No synthetic day/weight is
  // written to db.days; earlier readings never enter this goal's adherence.
  const all=latestWeights(today());
  const earlier=all.filter(x=>x.date<db.goal.start);
  const inGoal=all.filter(x=>x.date>=db.goal.start);
  const recentEarlier=earlier.filter(x=>x.date>=addDays(db.goal.start,-30));
  const context=(recentEarlier.length>=2?recentEarlier:earlier.slice(-2)).slice(-14);
  return [...context,...inGoal].map(x=>({date:x.date,weight:+x.weight,
    preGoal:x.date<db.goal.start,avg:x.date<db.goal.start?movingAverage(x.date):goalMovingAverage(x.date)}));
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
function readDay(s){ return mergeDay({...((db.days||{})[s]||{}),date:s}); }
const CHART_GROUPS=[{id:'food',name:'Diet',dot:'social'},{id:'hunger',name:'Bedtime hunger',dot:'hunger'},{id:'exercise',name:'Exercise',dot:'exercise'},{id:'other',name:'Other context',dot:'other'}];
const CHART_FOOD=[['eating_out','Eating out'],['alcohol','Alcohol'],['snacks','Snacks · from daily log'],['more_than_intended','More than intended · from daily log']];
const CHART_EXERCISE=[['steps','10k steps'],['cardio','Cardio'],['strength','Strength']];
const CHART_OTHER=[['period','Period'],['travel','Travel'],['party','Party'],['vacation','Vacation'],['poor_sleep','Poor sleep'],['sick','Sick'],['short_sleep','Short sleep · <6h']];
function weightPointContext(weightDate){
  const prevDate=addDays(weightDate,-1);
  const prev=readDay(prevDate), same=readDay(weightDate), settings=db.chartSettings;
  const events=prev.events.map(eventId);
  const eatingOut=events.includes('eating_out');
  const alcohol=prev.alcohol==null?null:+prev.alcohol;
  const hadSnacks=prev.food.noSnack===false && !prev.skips?.noSnack; // D-1 explicit Had snacks ONLY; true, null and N/A do not match.
  const moreThanIntended=prev.food.moreThanIntended===true;
  const hunger=prev.food.bedtimeHunger==null?null:+prev.food.bedtimeHunger;
  const steps=prev.move.steps==null?null:+prev.move.steps;
  const cardio=prev.move.cardio==null?null:+prev.move.cardio;
  const strength=prev.move.strength==null?null:+prev.move.strength;
  const sleep=same.sleep==null?null:+same.sleep; // morning log for the same weigh-in
  const exerciseAvailable={steps:steps!=null&&steps>=10000,cardio:cardio!=null&&cardio>0,strength:strength!=null&&strength>0};
  const exerciseNotable=Object.values(exerciseAvailable).some(Boolean);
  const sleepNotable=sleep!=null&&sleep<6;
  const custom=db.customEvents.filter(e=>e.active&&settings.custom.includes(e.id)&&events.includes(e.id));
  const foodMatch=(eatingOut&&settings.food.includes('eating_out')) || (alcohol>0&&settings.food.includes('alcohol')) || (hadSnacks&&settings.food.includes('snacks')) || (moreThanIntended&&settings.food.includes('more_than_intended')) || custom.some(e=>e.category==='food');
  const otherMatch=events.some(id=>settings.other.includes(id)) || (sleepNotable&&settings.other.includes('short_sleep')) || custom.some(e=>e.category==='other');
  const exerciseMatch=settings.exercise.some(key=>exerciseAvailable[key]);
  const prevDetails=events.map(eventLabel);
  if(alcohol>0)prevDetails.push(`Alcohol ${alcohol>=2?'2+':alcohol}`);
  if(hadSnacks)prevDetails.push('Snacks');
  else if(prev.food.noSnack===true&&!prev.skips?.noSnack)prevDetails.push('No snacks');
  if(moreThanIntended)prevDetails.push('More than intended');
  if(hunger!=null)prevDetails.push(`Hunger ${hunger}/5`);
  if(exerciseNotable){
    const exercise=[];
    if(exerciseAvailable.steps)exercise.push(`${steps>=1000?(steps/1000).toFixed(1).replace('.0','')+'k':Math.round(steps)} steps`);
    if(exerciseAvailable.cardio)exercise.push(`Cardio ${Math.round(cardio)}m`);
    if(exerciseAvailable.strength)exercise.push(`Strength ${Math.round(strength)}m`);
    if(exercise.length)prevDetails.push(exercise.join(' · '));
  }
  // Sleep is logged on the weigh-in morning, not on the previous calendar day.
  return {prevDate,eatingOut,alcohol,hadSnacks,moreThanIntended,hunger,steps,cardio,strength,sleep,exerciseNotable,sleepNotable,prevDetails,
    markers:{food:foodMatch,hunger:hunger!=null&&hunger>=settings.hungerMin,exercise:exerciseMatch,other:otherMatch}};
}
function contextMarkersSvg(d,x,markerTop,rowGap){
  const c=weightPointContext(d.date);
  return db.chartSettings.categories.map((id,i)=>c.markers[id]?`<circle class="ctx-marker ${CHART_GROUPS.find(g=>g.id===id).dot}" cx="${x.toFixed(1)}" cy="${markerTop+i*rowGap}" r="2.7"></circle>`:'').join('');
}
function contextLegendHtml(){
  const active=CHART_GROUPS.filter(g=>db.chartSettings.categories.includes(g.id));
  if(!active.length)return `<div class="context-legend">Context markers off · enable in Chart settings.</div>`;
  return `<div class="context-legend">${active.map(g=>`<span><i class="ctx-dot ${g.dot}"></i>${g.name}</span>`).join('')}</div>`;
}

function renderChart(data,forecast){
  if(!data.length) return `<div class="empty">No weigh-ins yet. When you log your weight, it will appear here, even before the goal starts.</div>`;
  const W=340,H=264,L=48,R=16,Tp=24,labelBand=26,axisGap=10,markerRows=Math.max(1,db.chartSettings.categories.length),markerRowGap=9,markerBand=markerRows*markerRowGap;
  const axisY=H-labelBand-axisGap;
  const markerTop=axisY-markerBand+2;
  const plotBottom=markerTop-6;
  const last=data[data.length-1], lastDate=last.date;
  // Extend the x-axis only when the deadline is reached/passed. Future projections
  // must appear to the right of the last real weigh-in, never inside historical dates.
  const daysUntilTarget=forecast?.targetDate ? Math.round((parseDate(forecast.targetDate)-parseDate(lastDate))/86400000) : null;
  const extraDays=forecast?.ready && db.goal.end<=lastDate ? Math.min(30,Math.max(14,daysUntilTarget||14)) : 0;
  const chartEnd=[db.goal.end,lastDate,addDays(lastDate,extraDays)].sort().at(-1);
  const futureDays=Math.max(0,Math.round((parseDate(chartEnd)-parseDate(lastDate))/86400000));
  const vals=data.map(d=>d.weight).filter(v=>v!=null); vals.push(+db.goal.target);
  if(forecast?.ready){
    vals.push(forecast.projectedEnd);
    if(futureDays>0) vals.push(forecast.forecastValue(futureDays));
    const pastSamples=Math.min(20,Math.max(6,forecast.elapsed+1));
    for(let i=0;i<pastSamples;i++) vals.push(forecast.backcastValue(forecast.elapsed*i/(pastSamples-1)));
  }
  let min=Math.floor(Math.min(...vals)-.35), max=Math.ceil(Math.max(...vals)+.35); if(max-min<3){min-=1;max+=1;}
  const span=max-min, tickStep=span<=6?1:2;
  const chartStart=data[0].date<db.goal.start?data[0].date:db.goal.start;
  const startD=parseDate(chartStart), endD=parseDate(chartEnd), totalDays=Math.max(1,(endD-startD)/86400000);
  const xDate=date=>L+clamp((parseDate(date)-startD)/86400000/totalDays,0,1)*(W-L-R);
  const y=v=>Tp+(max-v)/(max-min)*(plotBottom-Tp);
  let grid='';
  for(let v=Math.ceil(min/tickStep)*tickStep;v<=max+.001;v+=tickStep){const yy=y(v);grid+=`<line class="grid" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><line class="tick" x1="${L-4}" y1="${yy}" x2="${L}" y2="${yy}"/><text class="y-label" x="${L-9}" y="${yy+3}" text-anchor="end">${v}</text>`;}
  // X-axis labels use one fixed calendar-day interval, so both the dates and their pixel spacing are truly even.
  // We intentionally do not force the goal end date to be a tick when it would break the interval.
  const xTickStep=Math.max(1,Math.ceil(totalDays/6));
  const xDates=[];
  for(let off=0;off<=totalDays;off+=xTickStep) xDates.push(addDays(chartStart,off));
  const xLabels=xDates.map((s,i)=>{
    const xx=xDate(s);
    const anchor=i===0?'start':(i===xDates.length-1?'end':'middle');
    return `<text x="${xx.toFixed(1)}" y="${H-10}" text-anchor="${anchor}">${fmtShortDate(s)}</text>`;
  }).join('');
  const trace=rows=>rows.map((d,i)=>`${i?'L':'M'} ${xDate(d.date).toFixed(1)} ${y(d.weight).toFixed(1)}`).join(' ');
  const earlierPoints=data.filter(d=>d.preGoal), goalPoints=data.filter(d=>!d.preGoal);
  const earlierPath=trace(earlierPoints), actualPath=trace(goalPoints);
  const bridgePath=earlierPoints.length&&goalPoints.length?trace([earlierPoints.at(-1),goalPoints[0]]):'';
  const goalY=y(+db.goal.target);
  const pointCoords=data.map(d=>({x:xDate(d.date),y:y(d.weight)}));
  const points=data.map((d,i)=>`<circle class="point${d.preGoal?' pre-goal-point':''}" cx="${pointCoords[i].x}" cy="${pointCoords[i].y}" r="2"></circle>`).join('');
  const hitBands=data.map((d,i)=>{
    const left=i===0?L:(pointCoords[i-1].x+pointCoords[i].x)/2;
    const right=i===pointCoords.length-1?W-R:(pointCoords[i].x+pointCoords[i+1].x)/2;
    return `<rect class="point-hit" data-chart-index="${i}" x="${left.toFixed(1)}" y="${Tp}" width="${Math.max(0,right-left).toFixed(1)}" height="${(axisY-Tp+8).toFixed(1)}" tabindex="0" role="button" aria-label="Show weight for ${fmtDate(d.date)}"></rect>`;
  }).join('');
  const contextMarks=data.map((d,i)=>contextMarkersSvg(d,pointCoords[i].x,markerTop,markerRowGap)).join('');

  // V9.3: restore the V9.1 visual language: one continuous pink trend from
  // goal start, through observed dates, and then toward the visible horizon.
  // Past fit and future projection share a curve but are not actual measurements.
  // The robust estimator and date/result cards are unchanged.
  let projectionPath='';
  if(forecast?.ready){
    const trajectory=[];
    const pastCount=Math.min(20,Math.max(6,forecast.elapsed+1));
    for(let i=0;i<pastCount;i++){
      const d=Math.round(forecast.elapsed*i/(pastCount-1));
      trajectory.push({date:addDays(forecast.modelStart,d),value:forecast.backcastValue(d)});
    }
    const horizon=Math.max(0,Math.round((parseDate(chartEnd)-parseDate(forecast.lastDate))/86400000));
    const step=Math.max(1,Math.round(horizon/14));
    for(let d=step;d<=horizon;d+=step) trajectory.push({date:addDays(forecast.lastDate,d),value:forecast.forecastValue(d)});
    if(horizon>0 && trajectory.at(-1)?.date!==chartEnd) trajectory.push({date:chartEnd,value:forecast.forecastValue(horizon)});
    const pts=trajectory.filter((p,i,a)=>i===0||p.date!==a[i-1].date).map(p=>[xDate(p.date),y(p.value)]);
    projectionPath=`<path class="forecast" d="${smoothSvgPath(pts)}"/>`;
  }
  const guideX=xDate(lastDate), goalDateX=xDate(db.goal.end);
  const goalStartX=xDate(db.goal.start);
  const goalStartMark=earlierPoints.length?`<line class="goal-start-marker" x1="${goalStartX}" y1="${Tp}" x2="${goalStartX}" y2="${axisY}"/><text class="goal-start-label" x="${goalStartX+4}" y="${Tp+10}">Goal start</text>`:'';
  const goalDateLabel=goalDateX>W-R-67?goalDateX-5:goalDateX+5;
  const goalDateAnchor=goalDateX>W-R-67?'end':'start';
  const goalDateMark=`<line class="goal-date-marker" x1="${goalDateX}" y1="${Tp}" x2="${goalDateX}" y2="${axisY}"/><path class="goal-date-flag" d="M ${goalDateX} ${Tp} l 0 -6 l 7 3 z"/><text class="goal-date-label" x="${goalDateLabel}" y="${Tp-9}" text-anchor="${goalDateAnchor}">Goal · ${fmtShortDate(db.goal.end)}</text>`;
  // Mention sleep only when the user has actually enabled short sleep in Other.
  const showSleepNote=db.chartSettings.categories.includes('other')&&db.chartSettings.other.includes('short_sleep');
  const sleepNote=showSleepNote?'<br>Short sleep uses the sleep logged on the same morning.':'';
  const info=`<div class="chart-context-row">${contextLegendHtml()}<details class="chart-info-wrap"><summary aria-label="About chart markers" title="About chart markers">ⓘ</summary><div class="chart-info-popover"><b>About the dots</b><br>Dots show selected logs from the previous day. They are context, not proven causes.${sleepNote}</div></details></div>`;
  const singlePointNote=data.length===1?'<div class="pre-goal-caption">One weigh-in is shown. A projection needs at least two spaced readings.</div>':'';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight chart. Muted line indicates pre-goal history. Pink dashed line is a trend estimate. Goal start and end are marked. Tap a weigh-in for its logs"><text x="4" y="13" class="axis-unit">kg</text>${grid}<line class="axis" x1="${L}" y1="${Tp}" x2="${L}" y2="${axisY}"/><line class="axis" x1="${L}" y1="${axisY}" x2="${W-R}" y2="${axisY}"/><line class="goal" x1="${L}" y1="${goalY}" x2="${W-R}" y2="${goalY}"/><line id="chartGuide" class="guide" x1="${guideX}" y1="${Tp}" x2="${guideX}" y2="${axisY}"/>${projectionPath}${goalStartMark}${goalDateMark}<path class="pre-goal-actual" d="${earlierPath}"/><path class="pre-goal-bridge" d="${bridgePath}"/><path class="actual" d="${actualPath}"/>${contextMarks}${points}${hitBands}${xLabels}</svg>${info}${singlePointNote}<div id="chartTip" class="tooltip" aria-live="polite">${chartTipHtml(last)}</div>`;
}
function chartTipHtml(d){
  if(!d) return '';
  const c=weightPointContext(d.date);
  const context=c.prevDetails.length?`<span class="tip-context-inline">· ${fmtShortDate(c.prevDate)} logs · ${escapeHtml(c.prevDetails.join(' · '))}</span>`:'';
  const sleepContext=c.sleepNotable?`<span class="tip-context-inline">· Last night sleep ${fmt(c.sleep)}h</span>`:'';
  return `<b>${fmtShortDate(d.date)}${d.date<db.goal.start?' · Before Goal':''}</b><span>${fmt(d.weight)} kg</span>${context}${sleepContext}`;
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
function goalTrackingSummary(g,id,through){
  const def=TRACKER_DEFS[id], role=trackerRole(g,id), start=g.start, end=through;
  if(end<start) return null;
  if(def.cadence==='daily'){
    let eligible=0, met=0, recorded=0, skipped=0;
    for(let date=start;date<=end;date=addDays(date,1)){
      if(!trackerActiveOn(g,id,date)) continue;
      const e=dailyTrackerEval(g,id,day(date));
      if(e.skip||e.na){ if(e.skip) skipped++; continue; }
      if(date===today()&&!e.recorded&&!e.met) continue;
      eligible++; if(e.recorded) recorded++; if(e.met) met++;
    }
    if(id==='bedtimeHunger'){
      const vals=[]; for(let date=start;date<=end;date=addDays(date,1)){if(!trackerActiveOn(g,id,date)||day(date).skips?.[id])continue;const v=day(date).food.bedtimeHunger;if(v!=null)vals.push(+v);}
      return vals.length?`${avg(vals).toFixed(1)}/5 avg · ${vals.length} logged`:'No entries yet';
    }
    if(role==='track'){
      if(id==='water'){const vals=[];for(let date=start;date<=end;date=addDays(date,1)){if(!trackerActiveOn(g,id,date)||day(date).skips?.[id])continue;const v=day(date).food.water;if(v!=null)vals.push(+v);}return vals.length?`${avg(vals).toFixed(1)}L avg · ${vals.length} logged`:'No entries yet';}
      return recorded?`${recorded} days logged`:'No entries yet';
    }
    return eligible?`${met} / ${eligible} days${skipped?` · ${skipped} N/A`:''}`:'No eligible days yet';
  }
  let value=0;
  for(let date=start;date<=end;date=addDays(date,1)) value+=weeklyTrackerContribution(id,day(date),g);
  if(id==='cardio') return `${Math.round(value)} min total · ${weeklyTargetFor(g,id)} min/wk`;
  const noun=id==='steps'?'days':id==='strength'?'sessions':'days';
  return `${Math.round(value)} ${noun} total · ${weeklyTargetFor(g,id)}/wk`;
}
function goalTrackingRecord(g){
  const through=(g.ended||today())<(g.end||today())?(g.ended||today()):(g.end||today());
  const groups=[['goal','Goal'],['bonus','Bonus'],['track','Track only']];
  const blocks=[];
  for(const [role,label] of groups){
    const ids=TRACKER_IDS.filter(id=>trackerRole(g,id)===role);
    const rows=ids.map(id=>{const summary=goalTrackingSummary(g,id,through);return summary?`<div class="goal-record-row ${role}"><div><span>${escapeHtml(trackerRuleLabel(g,id,day(through)))}</span>${role!=='goal'?`<em>${label}</em>`:''}</div><b>${escapeHtml(summary)}</b></div>`:'';}).filter(Boolean);
    if(rows.length) blocks.push(`${role==='goal'?'<div class="goal-record-heading">Goal tracking · to date</div>':`<div class="goal-record-subheading">${label}</div>`}${rows.join('')}`);
  }
  return `<div class="goal-record">${blocks.join('')||'<div class="small">No tracker records yet.</div>'}</div>`;
}

function weeklyBehaviorProgress(g){
  const ids=TRACKER_IDS.filter(id=>trackerRole(g,id)==='goal');
  return `<div class="weekly-behavior"><div class="row between behavior-heading"><b>Weekly behavior</b><span class="small">Goal trackers only</span></div>${ids.length?ids.map(id=>trackerGridRow(g,id)).join(''):'<div class="small">No behavior trackers are set as Goal.</div>'}${bonusWeekSummary(g)}${trackOnlyWeekSummary(g)}</div>`;
}
function roleEditorGroup(g,group){
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].group===group&&id!=='stop6');
  return `<div class="tracker-role-list">${ids.map(id=>{const role=trackerRole(g,id);return `<div class="tracker-role-row"><div><b>${TRACKER_DEFS[id].label}</b><span>${TRACKER_DEFS[id].cadence==='daily'?'Daily':'Weekly'}</span></div><div class="role-segment">${['goal','bonus','track'].map(r=>`<button class="${role===r?'on':''}" data-tracker-role="${id}" data-role="${r}">${ROLE_LABELS[r]}</button>`).join('')}</div></div>`;}).join('')}</div>`;
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
      ${goalTrackingRecord(db.goal)}
      <div class="goal-actions"><button class="btn secondary" data-action="editGoal">Edit goal</button><button class="btn ghost" data-review-goal="${escapeHtml(db.goal.id)}">Review goal</button></div>
      ${activeGoalLearning()}
    </section>
    <div class="section-title">${tr('pastGoals')}</div>
    <section class="card"><div class="goal-list">${db.goals.length?db.goals.slice().reverse().map(goalHistoryItem).join(''):`<div class="empty">No past goals yet.</div>`}</div></section>`;
}
function snapshotContextForDate(weightDate,settings){
  const prev=readDay(addDays(weightDate,-1)), same=readDay(weightDate), events=prev.events.map(eventId);
  const hadSnacks=prev.food.noSnack===false&&!prev.skips?.noSnack, more=prev.food.moreThanIntended===true, alcohol=+prev.alcohol||0;
  const food=(events.includes('eating_out')&&settings.food.includes('eating_out'))||(alcohol>0&&settings.food.includes('alcohol'))||(hadSnacks&&settings.food.includes('snacks'))||(more&&settings.food.includes('more_than_intended'));
  const hunger=prev.food.bedtimeHunger!=null&&+prev.food.bedtimeHunger>=settings.hungerMin;
  const exercise=(settings.exercise.includes('steps')&&(+prev.move.steps||0)>=10000)||(settings.exercise.includes('cardio')&&(+prev.move.cardio||0)>0)||(settings.exercise.includes('strength')&&(+prev.move.strength||0)>0);
  const other=(settings.other||[]).some(id=>events.includes(id))||(settings.other||[]).includes('short_sleep')&&same.sleep!=null&&+same.sleep<6;
  return {food,hunger,exercise,other};
}
function buildProgressSnapshot(g,endDate=today()){
  const settings=JSON.parse(JSON.stringify(db.chartSettings));
  const weights=latestWeights(endDate).filter(x=>x.date>=g.start&&x.date<=endDate).map(x=>({date:x.date,weight:+x.weight,markers:snapshotContextForDate(x.date,settings)}));
  return {createdAt:new Date().toISOString(),start:g.start,end:endDate,target:+g.target,chartSettings:settings,weights};
}
function goalProgressSnapshot(g){
  if(g.progressSnapshot&&Array.isArray(g.progressSnapshot.weights))return g.progressSnapshot;
  return buildProgressSnapshot(g,g.ended||g.end);
}
function renderProgressSnapshot(g){
  const snap=goalProgressSnapshot(g), data=snap.weights||[]; if(!data.length)return '<div class="empty">No weigh-ins were recorded during this goal.</div>';
  const W=320,H=142,L=30,R=10,Tp=18,B=32, bottom=H-B;
  const start=parseDate(snap.start), end=parseDate(snap.end), total=Math.max(1,(end-start)/86400000);
  const vals=data.map(d=>+d.weight).concat([+snap.target]), min=Math.floor((Math.min(...vals)-.4)*2)/2,max=Math.ceil((Math.max(...vals)+.4)*2)/2;
  const x=d=>L+clamp((parseDate(d)-start)/86400000/total,0,1)*(W-L-R), y=v=>Tp+(max-v)/(max-min||1)*(bottom-Tp);
  const path=data.map((d,i)=>`${i?'L':'M'} ${x(d.date).toFixed(1)} ${y(d.weight).toFixed(1)}`).join(' '), gy=y(+snap.target);
  const selected=snap.chartSettings?.categories||[];
  const markerDots=data.map(d=>selected.map((cat,i)=>d.markers?.[cat]?`<circle class="ctx-marker ${CHART_GROUPS.find(g=>g.id===cat)?.dot||'other'}" cx="${x(d.date).toFixed(1)}" cy="${(bottom+9+i*7).toFixed(1)}" r="2.2"></circle>`:'').join('')).join('');
  const pts=data.map(d=>`<circle class="point" cx="${x(d.date).toFixed(1)}" cy="${y(d.weight).toFixed(1)}" r="2"></circle>`).join('');
  return `<div class="snapshot-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Final weight progress for archived goal"><line class="goal" x1="${L}" y1="${gy}" x2="${W-R}" y2="${gy}"/><line class="snapshot-date" x1="${L}" y1="${Tp}" x2="${L}" y2="${bottom}"/><line class="snapshot-date" x1="${W-R}" y1="${Tp}" x2="${W-R}" y2="${bottom}"/><path class="actual" d="${path}"/>${pts}${markerDots}<text class="snapshot-label" x="${L}" y="${H-2}">${fmtShortDate(snap.start)}</text><text class="snapshot-label" x="${W-R}" y="${H-2}" text-anchor="end">${fmtShortDate(snap.end)}</text><text class="snapshot-target" x="${W-R}" y="${gy-4}" text-anchor="end">Target ${fmt(snap.target)}</text></svg></div>`;
}

function goalMet(g,end){
  if(end==null||!Number.isFinite(+end)) return null;
  const start=Number.isFinite(+g.startWeight)?+g.startWeight:+end, target=+g.target, value=+end;
  if(target<start) return value<=target+.1;
  if(target>start) return value>=target-.1;
  return Math.abs(value-target)<=.1;
}
function goalHistoryItem(g){
  const end=g.endWeight??null, met=goalMet(g,end), reviewCount=normalizeReviews(g).length;
  const hasEnd=end!=null&&Number.isFinite(+end);
  const away=hasEnd?Math.abs(+end-(+g.target)):null;
  const close=met===false&&away<=0.5+1e-9;
  const outcome=met===true?'Goal reached':close?`Close to goal · ${fmt(away)} kg away`:met===false?'Goal not reached':'No final weight';
  const outcomeClass=met===true?'reached':close?'close':met===false?'not-reached':'unknown';
  const endDate=g.ended||g.end;
  return `<div class="goal-item archived-goal-summary"><div class="row between archived-goal-head"><div><div class="name">${escapeHtml(g.name)}</div><div class="meta">${fmtDate(g.start,'en')} → ${fmtDate(endDate,'en')} · Ended</div></div><span class="archive-outcome ${outcomeClass}">${outcome}</span></div><div class="archived-weight-line"><b>${fmt(g.startWeight)}</b><span>→</span><b>${end==null?'—':fmt(end)} kg</b><span class="muted">Target ${fmt(g.target)}</span></div><button class="review-link" data-review-goal="${escapeHtml(g.id)}">${reviewCount?`Review · ${reviewCount}`:'Review'}</button></div>`;
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
  return `${topbar('Edit goal','',`<button class="btn ghost save-top" data-action="cancelGoalEdit">Cancel</button>`)}
    <section class="card"><label>Goal name</label><input id="goalName" value="${escapeHtml(g.name)}"><div class="two"><label>${tr('start')} kg<input id="goalStartWeight" type="number" step="0.1" value="${activeGoalStartWeight()}"></label><label>${tr('target')} kg<input id="goalTarget" type="number" step="0.1" value="${g.target}"></label></div><div class="compact-dates"><label>${tr('start')}<input id="goalStart" type="date" value="${g.start}"></label><label>End date<input id="goalEnd" type="date" value="${g.end}"></label></div></section>
    <section class="card"><div class="actual-label">Diet targets</div>${planInputsFood()}<label class="effective-date-setting">Calendar scoring effective from<input id="goalEffectiveFrom" type="date" min="${today()}" value="${today()}"></label><div class="small plan-helper">Earlier Calendar days keep their original rules. Old records are never rewritten.</div></section>
    <section class="card"><div class="actual-label">Weekly exercise targets</div>${planInputsMove()}</section>
    <section class="card"><div class="row between"><div class="actual-label" style="margin:0">Diet trackers</div><span class="small">Role for this goal</span></div>${roleEditorGroup(g,'diet')}</section>
    <section class="card"><div class="row between"><div class="actual-label" style="margin:0">Exercise trackers</div><span class="small">Role for this goal</span></div>${roleEditorGroup(g,'exercise')}</section>
    <div class="edit-goal-actions three-actions"><button class="btn ghost" data-action="cancelGoalEdit">Cancel</button><button class="btn end-archive-safe" data-action="requestArchiveGoal">End & Archive</button><button class="btn sky" data-action="saveGoal">Save</button></div>
    <div class="archive-helper">Only Save commits edits. Cancel restores the goal exactly as it was when you opened this page.</div>`;
}
function planInputsFood(){return `<div class="two"><label>Vegetables ≥<input data-plan="veg" type="number" value="${db.plan.veg}"></label><label>Fruit ≤<input data-plan="fruit" type="number" value="${db.plan.fruit}"></label><label>Water ≥ L<input data-plan="water" type="number" step="0.1" value="${db.plan.water}"></label></div><div class="small plan-helper">Protein and No snacks are yes/no trackers. Amount eaten and Bedtime hunger are context, not success scores.</div>`;}
function planInputsMove(){return `<div class="two"><label>10k-step days / week<input data-plan="stepsDays" type="number" min="0" max="7" value="${db.plan.stepsDays}"></label><label>Stretch days / week<input data-plan="stretchDays" type="number" min="0" max="7" value="${db.plan.stretchDays}"></label><label>Cardio · min/week<input data-plan="cardio" type="number" min="0" value="${db.plan.cardio}"></label><label>Strength sessions / week<input data-plan="strengthSessions" type="number" min="0" max="7" value="${db.plan.strengthSessions||2}"></label></div>`;}
function setGoalFocus(focus){
  if(!['diet','exercise','both','other'].includes(focus)) return;
  saveGoalForm();
  const g=db.goal, previous=normalizeTrackers(g,false), roles=focusRoles(focus), startToday=today()<g.start?g.start:today();
  const oldGoal=JSON.parse(JSON.stringify(g)),oldPlan={...db.plan};
  g.focus=focus; g.trackers={};
  for(const id of TRACKER_IDS){
    const was=previous[id]||{role:'track',activeFrom:g.start};
    const role=roles[id];
    g.trackers[id]={role,activeFrom:(role==='goal'&&was.role!=='goal')?startToday:(was.activeFrom||g.start),roleAuto:true};
  }
  recordCalendarRuleChange(oldGoal,oldPlan,calendarEffectiveDate());
  persist();render();
}
function setTrackerRole(id,role){
  if(!TRACKER_DEFS[id]||id==='stop6'||!['goal','bonus','track'].includes(role)) return;
  const editing=view==='goalEdit';
  saveGoalForm(!editing);
  db.goal.trackers=normalizeTrackers(db.goal,false);
  const oldGoal=JSON.parse(JSON.stringify(db.goal)),oldPlan={...db.plan};
  const prev=db.goal.trackers[id]; const activeFrom=prev.activeFrom||db.goal.start;
  db.goal.trackers[id]={role,activeFrom,roleAuto:false};
  if(editing){goalEditDirty=true;render();}
  else {recordCalendarRuleChange(oldGoal,oldPlan,calendarEffectiveDate());persist();render();}
}


function beginGoalEdit(){
  goalEditSnapshot={goal:JSON.parse(JSON.stringify(db.goal)),plan:{...db.plan},days:JSON.parse(JSON.stringify(db.days||{})),calendarRuleHistory:JSON.parse(JSON.stringify(db.calendarRuleHistory||[]))};
  goalEditDirty=false; discardGoalEditOpen=false; view='goalEdit'; render();
}
function markGoalEditDirty(){ if(view==='goalEdit') goalEditDirty=true; }
function restoreGoalEditSnapshot(){
  if(!goalEditSnapshot)return;
  db.goal=JSON.parse(JSON.stringify(goalEditSnapshot.goal)); db.plan={...goalEditSnapshot.plan}; db.days=JSON.parse(JSON.stringify(goalEditSnapshot.days||{})); db.calendarRuleHistory=JSON.parse(JSON.stringify(goalEditSnapshot.calendarRuleHistory));
}
function requestCancelGoalEdit(){
  // Capture text fields into memory only so we can accurately detect a changed form.
  const hasDomChange=goalEditFormChanged();
  if(goalEditDirty||hasDomChange){discardGoalEditOpen=true;render();return;}
  restoreGoalEditSnapshot(); goalEditSnapshot=null; view='goals'; render();
}
function goalEditFormChanged(){
  if(!goalEditSnapshot)return false;
  const g=goalEditSnapshot.goal,p=goalEditSnapshot.plan;
  const vals={name:document.getElementById('goalName')?.value.trim()||g.name,target:+(document.getElementById('goalTarget')?.value||g.target),start:document.getElementById('goalStart')?.value||g.start,end:document.getElementById('goalEnd')?.value||g.end,startWeight:+(document.getElementById('goalStartWeight')?.value||g.startWeight)};
  if(vals.name!==g.name||vals.target!==+g.target||vals.start!==g.start||vals.end!==g.end||vals.startWeight!==+g.startWeight)return true;
  for(const el of document.querySelectorAll('[data-plan]')){let val=el.type==='number'?(el.value===''?0:+el.value):el.value;if(String(val)!==String(p[el.dataset.plan]??''))return true;}
  return false;
}
function commitGoalEdit(){
  if(!goalEditSnapshot){saveGoalForm();persist();view='goals';render();return;}
  const original=goalEditSnapshot; const effectiveFrom=calendarEffectiveDate();
  saveGoalForm(false);
  recordCalendarRuleChange(original.goal,original.plan,effectiveFrom);
  goalEditSnapshot=null; goalEditDirty=false; discardGoalEditOpen=false; persist(); view='goals'; flash=tr('saved'); render();
}
function discardGoalEdit(){
  restoreGoalEditSnapshot(); goalEditSnapshot=null; goalEditDirty=false; discardGoalEditOpen=false; view='goals'; render();
}
function discardGoalEditModal(){
  if(!discardGoalEditOpen)return '';
  return `<div class="modal-backdrop" data-action="keepGoalEditing"><div class="archive-confirm-modal" role="dialog" aria-modal="true" aria-label="Discard unsaved goal changes"><div class="weight-modal-handle"></div><div class="archive-confirm-title">Discard unsaved changes?</div><div class="archive-confirm-copy">Your goal will return to exactly what it was before you opened Edit goal.</div><div class="archive-confirm-actions"><button class="btn ghost" data-action="keepGoalEditing">Keep editing</button><button class="btn archive-confirm-danger" data-action="discardGoalEdit">Discard</button></div></div></div>`;
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
    const hasData=rec.weight!=null || rec.sleep!=null || rec.alcohol!=null || foodValues || exerciseValues || Object.values(rec.skips||{}).some(Boolean) || rec.events.length || rec.note;
    if(!hasData) continue;
    records.push({date:s,weight:rec.weight,sevenDayAverage:goalAverageFor(g,s),lastNightSleepHours:rec.sleep,alcohol:rec.alcohol==null?null:(+rec.alcohol>=2?'2+':+rec.alcohol===1?'1':'none'),food:{veg:rec.food.veg,protein:rec.food.protein,fruit:rec.food.fruit,noSnack:rec.food.noSnack,moreThanIntended:rec.food.moreThanIntended,legacyNoFoodAfterCutoff:rec.food.stop6,waterLiters:rec.food.water,bedtimeHunger:rec.food.bedtimeHunger},exercise:{...rec.move},skipOrNA:{...rec.skips},lifeEvents:rec.events.map(eventLabel),note:rec.note||''});
  }
  const endWeight=active ? latestWeight(through)?.weight??null : g.endWeight??null;
  const startWeight=active ? activeGoalStartWeight() : +g.startWeight;
  const trackers=normalizeTrackers(g,!active);
  const trackerConfig=TRACKER_IDS.filter(id=>id!=='stop6'||planForGoal(g).stop!=null).map(id=>({id,label:TRACKER_DEFS[id].label,group:TRACKER_DEFS[id].group,cadence:TRACKER_DEFS[id].cadence,role:trackers[id].role,activeFrom:trackers[id].activeFrom,target:trackerRuleLabel(g,id,day(through))}));
  return {
    READ_THIS_FIRST_FOR_CHATGPT:{
      task:'The user is uploading this exported Tide goal data for a Goal Review. Follow these embedded instructions without asking the user to supply an additional prompt. Produce a useful review now.',
      output:'Return ONLY one valid UTF-8 JSON object suitable for direct import into Tide. No explanation before/after, no markdown fences, no trailing commas, no extra keys. If you can create a downloadable file, supply tide-goal-review.json containing exactly this object; otherwise print the object alone so the user can paste it into Tide.',
      mandatorySchema:{goalId:g.id,preview:'string: 1-2 sentences synthesizing the trend, behavior and next steps',review:{summary:'string: concise overall interpretation grounded in this goal data',learnings:['string: specific supported insight (1-3 total)'],next:['string: realistic, actionable step (1-3 total)']}},
      strictValidation:[
        'Use exactly THREE top-level keys: goalId, preview, review. Use exactly THREE keys inside review: summary, learnings, next. All other keys cause Tide import to FAIL.',
        `Copy goalId EXACTLY as ${JSON.stringify(g.id)}. Never invent an ID. This is required for import to the correct goal.`,
        'preview and review.summary MUST be nonempty strings. review.learnings and review.next MUST each be arrays containing 1 to 3 nonempty strings; no nulls, numbers, objects or empty strings.',
        'Write the string values in the language of the current conversation (Chinese if talking to the user in Chinese), but keep ALL JSON key names exactly in English.',
        'Do not echo the source file, daily records, instructions or markdown. Output the finished import JSON only.'
      ],
      analysisRequirements:[
        'Describe weight change using available readings and 7-day averages when sufficient; distinguish the dated result from any forecast. Do not invent missing weigh-ins or treat a single day as proof.',
        'Review Goal-role trackers as adherence only if logged and eligible. Bonus is optional and must never be labeled a failure; Track-only and weight are contextual rather than adherence metrics.',
        'Correct timing: weight on date D is a morning weigh-in. Eating out, alcohol, Snacks (food.noSnack is explicitly false), hunger, exercise, and events from D-1 are chart context for D. Never explain D with an event later on D.',
        'No snacks=true means NO snacks, noSnack=false means Had snacks; null/unlogged/N/A are unknown or excluded, not proof of either outcome. Eating out does not automatically mean eating more.',
        'Bedtime hunger 1=low and 5=very hungry. Do not praise high hunger, restrictive behavior or excessive exercise; prioritize sustainable practices.',
        'If this export includes sleep data, lastNightSleepHours on D is the night immediately before morning D. If not logged or irrelevant, do not discuss sleep.',
        'Period and other events are optional context. Note repeated associations as tentative, never claim a single event caused next-day weight change.',
        'Make 1-3 concrete observations supported by data and 1-3 practicable next actions; state important gaps in the summary if records are sparse.'
      ],
      inTide:'Open Goals → Goal Review → Add new review. Use Import review JSON if you saved the generated file, or paste the generated JSON, Preview review, then Save Review. Do not import the original goal-data export as a completed review.'
    },
    tideGoalReviewVersion:6,
    goalId:g.id,
    exportedAt:new Date().toISOString(),
    goal:{name:g.name,start:g.start,end:g.end,startWeight,targetWeight:+g.target,currentOrEndWeight:endWeight,status:active?'active':goalStatus(g,endWeight),focus:g.focus||'both'},
    trackerConfig,
    plan:{...(g.planSnapshot||db.plan)},
    planWasFrozenAtArchive:!!g.planSnapshot,
    summary:{daysCovered:records.length,weightChange:endWeight==null?null:+(endWeight-startWeight).toFixed(2),targetChange:+(+g.target-startWeight).toFixed(2)},
    reviewHistory:normalizeReviews(g),
    fieldGuide:{
      bedtimeHunger:{scale:'1-5',meaning:'1 = low hunger; 5 = very hungry',use:'Track-only context. Higher hunger is NOT success; use it to judge whether the diet may be too aggressive or hard to sustain.'},
      lastNightSleepHours:{meaning:'Sleep during the night immediately before the morning weight recorded on the same date.'},
      alcohol:{values:'none / 1 / 2+',meaning:'Alcohol consumed on that calendar day.'},
      snacks:{source:'food.noSnack === false, not marked N/A',meaning:'Shows a Diet marker on the next morning weigh-in after an explicitly logged Had snacks day. True, N/A, or missing never creates a Snacks marker. No duplicate event.'},
      moreThanIntended:{source:'food.moreThanIntended === true',meaning:'Self-reported quantity context: the user felt they ate more than intended. false means About right; null means Not logged. This is not automatically a Goal failure.'},
      sevenDayAverage:{meaning:'Calendar-based 7-day weight average used for trend context, not adherence.'},
      period:{meaning:'Period is a life-event context tag, not an adherence metric.'}
    },
    timingGuide:{
      morningWeight:'Weight is recorded in the morning.',
      previousDayContext:'Selected logs for eating out, alcohol, snacks (Had snacks), bedtime hunger, exercise and events on D-1 appear below morning weight D. Sleep from the night D-1 to D belongs to morning D. These are context, not causes.',
      sleepAlignment:'lastNightSleepHours on date D refers to the sleep during D-1 → D, immediately before that morning weight.',
      interpretation:'Context may help explain patterns but is not proof of causation. Prefer repeated or multi-day patterns over one-day explanations.'
    },
    daily:records,
    reviewInstructions:[
      'Review Goal-role behaviors first: these are the only adherence metrics and the only items that may be called execution gaps.',
      'Bonus items may only be mentioned as positive additions; not doing a Bonus is never a gap or failure.',
      'Track only items and Weight are context for patterns, not adherence scores.',
      'Bedtime hunger uses a 1-5 scale: 1 = low hunger and 5 = very hungry. Do not treat high hunger as success; use it as context for sustainability.',
      'More than intended is a self-reported quantity signal, not a moral judgment and not automatically a Goal failure.',
      'Look for multi-day or lagged patterns. Do not attribute a morning weight to an event logged later on that same day.',
      'Analyze weight seriously using the 7-day average and trend; do not call the plan failed because of one flat or higher weigh-in.',
      'Keep the review concise and practical; return the exact import JSON described in READ_THIS_FIRST_FOR_CHATGPT.'
    ],
    recommendedPrompt:'READ_THIS_FIRST_FOR_CHATGPT contains the full task, review standards and EXACT Tide import schema. Follow it immediately; do not request another prompt. Return ONLY the finished review JSON object.',
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
    ${!active?`<div class="section-title">Final progress</div><section class="card final-progress-card"><div class="row between"><div class="actual-label" style="margin:0">Final Progress Snapshot</div><span class="small">${g.progressSnapshot?'Frozen at goal end':'Reconstructed from saved records'}</span></div>${renderProgressSnapshot(g)}</section>`:''}
    ${latest?`<div class="section-title">Latest review</div><section class="card latest-review-card"><div class="row between"><div class="actual-label" style="margin:0">${fmtShortDate(latest.date)}${latest.day?` · Day ${latest.day}`:''}</div></div>${fullReviewHtml(latest)}</section>`:`<section class="card"><div class="empty">No reviews yet.</div></section>`}
    ${!composer?`<button class="btn secondary full review-add-button" data-action="openReviewComposer">Add new review</button>`:''}
    ${composer?`<section class="card review-composer"><div class="row between"><div class="actual-label" style="margin:0">Add new review</div><button class="review-inline-link review-cancel-inline" data-action="closeReviewComposer">Cancel</button></div><p class="small review-copy"><b>1.</b> Export goal data and upload the file to ChatGPT. The file already contains the complete review instructions and Tide import format—no extra prompt needed. <b>2.</b> Import the resulting review JSON file or paste the JSON below. <b>3.</b> Preview, then Save.</p><div class="review-actions"><button class="btn secondary" data-action="exportReviewGoal">Export Goal Data + Instructions</button><label class="btn secondary file-btn">Import review JSON<input id="reviewImportFile" type="file" accept=".json,application/json" hidden></label></div><label class="review-paste-label">Or paste ChatGPT JSON<textarea id="reviewPaste" rows="7" placeholder='{"goalId":"COPY_EXACT_GOAL_ID","preview":"...","review":{"summary":"...","learnings":["..."],"next":["..."]}}'>${escapeHtml(draft?.rawText||'')}</textarea></label><button class="btn secondary full" data-action="previewGoalReview">Preview review</button></section>`:''}
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
function loadGoalReviewDraft(text){
  const raw=parseReviewJSON(text), g=findGoalById(reviewGoalId);
  if(!g) throw new Error('Select a goal first.');
  if(String(raw.goalId)!==String(g.id)) throw new Error('The review goalId does not match this goal. Export data for the selected goal and use that result.');
  const checkpoint=makeCheckpoint(raw,g); // validates exact schema before any save
  reviewDraft={goalId:g.id,rawText:text,raw,checkpoint};
  reviewComposerOpen=true;
  flash='Review loaded. Check the preview below before saving.';
  render();
}
function importGoalReview(file){
  if(!file)return;
  const r=new FileReader();
  r.onload=()=>{try{loadGoalReviewDraft(r.result);}catch(e){alert(`Tide could not load this review. ${e.message||'Use the exact Tide JSON schema.'}`);}};
  r.readAsText(file);
}
function previewGoalReview(){
  try{loadGoalReviewDraft(document.getElementById('reviewPaste')?.value||'');}
  catch(e){alert(`Tide could not load this review. ${e.message||'Use the exact Tide JSON schema.'}`);}
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

function chartChoice(group,id,label){
  const checked=db.chartSettings[group].includes(id);
  return `<label class="chart-choice"><input type="checkbox" data-chart-source="${group}" data-source-id="${escapeHtml(id)}" ${checked?'checked':''}><span>${escapeHtml(label)}</span></label>`;
}
function chartSettingsPage(){
  const selected=db.chartSettings.categories;
  const sourcePanel=(group,choices)=>{
    if(!selected.includes(group))return '';
    const extra=['food','other'].includes(group)?db.customEvents.filter(e=>e.active&&e.category===group):[];
    return `<div class="chart-source-panel">${choices.map(([id,label])=>chartChoice(group,id,label)).join('')}${extra.map(e=>chartChoice('custom',e.id,e.label+' · custom')).join('')}${extra.length?'<div class="setting-helper">Custom names are shared with Life events.</div>':''}${group==='hunger'?`<div class="chart-threshold">Show when hunger is ${[3,4,5].map(v=>`<button data-hunger-min="${v}" class="${db.chartSettings.hungerMin===v?'on':''}">${v}+</button>`).join('')}</div>`:''}${['food','other'].includes(group)?'<button class="quiet-link" data-action="manageCustom">Manage custom events ›</button>':''}</div>`;
  };
  return `${topbar('Chart settings','',`<button class="btn secondary save-top" data-action="backProgress">Done</button>`)}${flashHtml()}
    <div class="insight chart-hint">Choose up to two categories to show under each weigh-in. Selecting a third replaces the first selected category; daily logs and Goals stay unchanged.</div>
    <section class="card chart-settings-card"><div class="row between"><div class="actual-label">Context markers</div><span class="small">${selected.length}/2</span></div>
      ${CHART_GROUPS.map(g=>`<div class="chart-group"><button data-chart-category="${g.id}" class="chart-group-row ${selected.includes(g.id)?'on':''}" aria-pressed="${selected.includes(g.id)}"><span class="ctx-dot ${g.dot}"></span><span>${g.name}</span><span class="chart-select-indicator">${selected.includes(g.id)?'✓':selected.length>=2?'Replace':'○'}</span></button>${sourcePanel(g.id,g.id==='food'?CHART_FOOD:g.id==='exercise'?CHART_EXERCISE:g.id==='other'?CHART_OTHER:[])}</div>`).join('')}
    </section><div class="small chart-footnote">Diet markers use only the sources you select. Snacks and More than intended are separate signals.</div>`;
}
function customEventsPage(){
  const active=db.customEvents.filter(e=>e.active),removed=db.customEvents.filter(e=>!e.active);
  const row=e=>`<div class="custom-manage-row"><div class="custom-manage-name">${escapeHtml(e.label)}</div><select data-custom-category="${escapeHtml(e.id)}" aria-label="Chart category for ${escapeHtml(e.label)}"><option value="other" ${e.category==='other'?'selected':''}>Other</option><option value="food" ${e.category==='food'?'selected':''}>Diet</option></select><button class="quiet-link custom-remove" data-archive-event="${escapeHtml(e.id)}" aria-label="Remove ${escapeHtml(e.label)}">Remove</button></div>`;
  return `${topbar('Custom events','',`<button class="btn secondary save-top" data-action="backFromCustom">Done</button>`)}${flashHtml()}
    <section class="card"><div class="actual-label">Your custom events <span class="small">· ${active.length}</span></div>
      <div class="small" style="margin-bottom:9px">Each event starts in Other. Change its chart category to Diet here if you want. These choices do not change your past records.</div>
      ${active.length?active.map(row).join(''):'<div class="small">No custom events yet. Add one in a day’s Life events.</div>'}
    </section><div class="insight">Remove hides a name from future choices and chart settings. Past dated records stay in your history and JSON backups.</div>
    ${removed.length?`<details class="card removed-custom"><summary>Removed events · ${removed.length}</summary>${removed.map(e=>`<div class="custom-manage-row"><div class="custom-manage-name">${escapeHtml(e.label)}</div><button class="quiet-link" data-restore-event="${escapeHtml(e.id)}">Restore</button></div>`).join('')}</details>`:''}`;
}
function customRemoveModal(){
  if(!removeCustomId)return '';
  const e=db.customEvents.find(x=>x.id===removeCustomId);
  if(!e)return '';
  return `<div class="modal-backdrop" data-action="cancelRemoveEvent"><div class="archive-confirm-modal custom-confirm" role="dialog" aria-modal="true" aria-label="Remove custom event"><div class="weight-modal-handle"></div><div class="archive-confirm-title">Remove ${escapeHtml(e.label)}?</div><div class="archive-confirm-copy">It will disappear from Life events and Chart settings. Your past records will remain. You can restore the name later.</div><div class="archive-confirm-actions"><button class="btn ghost" data-action="cancelRemoveEvent">Cancel</button><button class="btn archive-confirm-danger" data-action="confirmRemoveEvent">Remove</button></div></div></div>`;
}
function addCustomEvent(){
  const input=document.getElementById('customEvent');
  const label=String(input?.value||'').trim().replace(/\s+/g,' ').slice(0,40);
  if(!label)return;
  const category='other'; // Single-input add: choose chart category later in Manage custom.
  const reserved=[...EVENTS.map(e=>e.en),...EVENTS.map(e=>e.id),'Alcohol','Snacks','Bedtime hunger','Exercise','Short sleep'];
  if(reserved.some(x=>x.toLowerCase()===label.toLowerCase())){flash='Already a built-in event or tracker. Use its existing control.';render();return;}
  let found=db.customEvents.find(e=>e.label.toLowerCase()===label.toLowerCase());
  if(found&&!found.active){flash='This name was removed. Restore it in Manage custom events.';render();return;}
  if(!found){
    found={id:`custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`,label,category,active:true};
    db.customEvents.push(found);
  }
  const d=day(selected);
  if(!d.events.includes(found.id))d.events.push(found.id);
  save();
}
function removeCustomEvent(id){
  const e=db.customEvents.find(x=>x.id===id&&x.active);if(!e)return;
  e.active=false;
  db.chartSettings.custom=db.chartSettings.custom.filter(x=>x!==id);
  removeCustomId=null;save('Custom event removed from choices; history kept.');
}
function restoreCustomEvent(id){const e=db.customEvents.find(x=>x.id===id);if(!e)return;e.active=true;save('Custom event restored.');}
function changeCustomCategory(id,category){const e=db.customEvents.find(x=>x.id===id&&x.active);if(!e||!['food','other'].includes(category))return;e.category=category;save();}
function toggleChartCategory(group){
  if(!CHART_GROUPS.some(g=>g.id===group))return;
  const a=db.chartSettings.categories;
  if(a.includes(group)){db.chartSettings.categories=a.filter(x=>x!==group);flash='';}
  else if(a.length<2){db.chartSettings.categories=[...a,group];flash='';}
  else {const replaced=a[0];db.chartSettings.categories=[a[1],group];flash=`${CHART_GROUPS.find(g=>g.id===group).name} now shown; replaced ${CHART_GROUPS.find(g=>g.id===replaced).name}.`;}
  save();
}
function toggleChartSource(group,id,checked){
  const valid={food:CHART_FOOD.map(x=>x[0]),exercise:CHART_EXERCISE.map(x=>x[0]),other:CHART_OTHER.map(x=>x[0]),custom:db.customEvents.filter(e=>e.active).map(e=>e.id)};
  if(!valid[group]?.includes(id))return;
  const a=db.chartSettings[group];db.chartSettings[group]=checked?[...new Set([...a,id])]:a.filter(x=>x!==id);save();
}

function settingsPage(){
  return `${topbar('Settings')}
    <section class="settings-list"><button class="setting-row" data-action="editPlan" style="width:100%;border:0;background:#fff;text-align:left"><span>Default Plan</span><span class="right">›</span></button><button class="setting-row" data-action="chartSettings"><span>Chart settings</span><span class="right">›</span></button><button class="setting-row" data-action="manageCustom"><span>Custom events</span><span class="right">›</span></button><button class="setting-row" data-action="export"><span>Export Data</span><span class="right">JSON ›</span></button><label class="setting-row" style="margin:0"><span>Import Data</span><span class="right">JSON ›</span><input id="importFile" type="file" accept="application/json" style="display:none"></label><div class="setting-row"><span>About Tide</span><span class="right">Version ${VERSION}</span></div></section>
    <div class="insight" style="margin-top:16px">Your data stays on this device. Tide upgrades migrate existing data automatically; export a JSON backup anytime for extra safety.</div>`;
}

function planEditPage(){
  return `${topbar('Default Plan','',`<button class="btn sky save-top" data-action="savePlan">${tr('save')}</button>`)}<section class="card"><div class="actual-label">Diet goals</div>${planInputsFood()}<label class="effective-date-setting">Calendar scoring effective from<input id="planEffectiveFrom" type="date" min="${today()}" value="${today()}"></label><div class="small plan-helper">Earlier Calendar days keep their original rules.</div></section><section class="card"><div class="actual-label">Weekly exercise goals</div>${planInputsMove()}</section><button class="btn sky full" data-action="savePlanBottom">${tr('done')}</button>`;
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

function saveInputsFromDOM(recordRuleHistory=true){
  const beforeGoal=JSON.parse(JSON.stringify(db.goal)), beforePlan={...db.plan};
  const effectiveFrom=calendarEffectiveDate();
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
  if(recordRuleHistory)recordCalendarRuleChange(beforeGoal,beforePlan,effectiveFrom);
}
function setFood(key,val){ const d=day(view==='day'?selected:today()); d.food[key]=val; d.skips[key]=false; save(); }
function setNoSnack(value){const d=day(view==='day'?selected:today());d.food.noSnack=value==='null'?null:value==='true';d.skips.noSnack=false;save();}
function setMoreThanIntended(value){const d=day(view==='day'?selected:today());d.food.moreThanIntended=value==='null'?null:value==='true';persist();render();}
function toggleFood(key){ const d=day(view==='day'?selected:today()); d.food[key]=d.food[key]===true?false:true; d.skips[key]=false; save(); }
function toggleMove(key){ const d=day(view==='day'?selected:today()); d.move[key]=d.move[key]===true?false:true; d.skips[key]=false; save(); }
function toggleSkip(id){ const d=day(view==='day'?selected:today()); d.skips[id]=!d.skips[id]; save(); }
function toggleCustom(key){ const d=day(selected); if(key==='allowSnack') d.customPlan.noSnack=d.customPlan.noSnack===false?true:false; else d.customPlan[key]=d.customPlan[key]===true?false:true; save(); }
function togglePlannedMove(key){ const d=day(selected); d.plannedMove[key]=d.plannedMove[key]===true?false:true; save(); }
function toggleEvent(e,button){ const d=day(selected); d.events=d.events.includes(e)?d.events.filter(x=>x!==e):[...d.events,e]; persist(); if(button)button.classList.toggle('on',d.events.includes(e)); }
function cycleAlcohol(button){ const d=day(selected),v=d.alcohol==null?0:+d.alcohol; d.alcohol=v<=0?1:v===1?2:null; persist(); if(button){const a=+d.alcohol||0;button.classList.toggle('on',a>0);button.textContent=a>=2?'Alcohol · 2+':a===1?'Alcohol · 1':'Alcohol';} }
function shiftMonth(n){ const d=parseDate(calendarMonth); d.setMonth(d.getMonth()+n); calendarMonth=iso(new Date(d.getFullYear(),d.getMonth(),1,12)); selected=calendarMonth; render(); }
function saveGoalForm(recordRuleHistory=true){
  const beforeGoal=JSON.parse(JSON.stringify(db.goal)), beforePlan={...db.plan};
  const effectiveFrom=calendarEffectiveDate();
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
  if(entered!==undefined&&entered!=='' && Number.isFinite(+entered)) {
    // Changing a goal start date must not invent a historical weigh-in.
    if(+entered!==activeGoalStartWeight() && newStart===oldStart)day(newStart).weight=+entered;
    db.goal.startWeight=+entered;
  }
  saveInputsFromDOM(false);
  if(recordRuleHistory)recordCalendarRuleChange(beforeGoal,beforePlan,effectiveFrom);
}
function archiveGoal(){
  saveGoalForm();
  const oldGoal=JSON.parse(JSON.stringify(db.goal)),oldPlan={...db.plan};
  const end=latestWeight(today())?.weight??null; const startSnapshot=activeGoalStartWeight(); const status=goalStatus({...db.goal,startWeight:startSnapshot,snapshot:true},end);
  let planDays=0, strengthMinutes=0, cardioMinutes=0, eventCount=0;
  for(let s=db.goal.start;s<=today()&&s<=db.goal.end;s=addDays(s,1)){
    const rec=day(s), fs=foodStatus(rec);
    if(fs.enough&&fs.score>=.8) planDays++;
    strengthMinutes+=(+rec.move.strength||0); cardioMinutes+=(+rec.move.cardio||0); eventCount+=rec.events.length;
  }
  const snapshot={...db.goal,id:db.goal.id||newGoalId(),trackers:normalizeTrackers(db.goal,false),review:blankReview(),reviews:normalizeReviews(db.goal),planSnapshot:{...db.plan},startWeight:startSnapshot,ended:today(),endWeight:end,resultStatus:status,planDays,strengthMinutes,cardioMinutes,eventCount,progressSnapshot:buildProgressSnapshot(db.goal,today()),snapshot:true,schemaVersion:SCHEMA_VERSION}; db.goals.push(snapshot);
  db.goal={id:newGoalId(),name:'New goal',start:today(),end:addDays(today(),30),startWeight:end??db.goal.target,target:Math.max(35,(end??db.goal.target)-2),status:'active',focus:'both',trackers:defaultTrackersForFocus('both',today()),review:blankReview(),reviews:[]};
  recordCalendarRuleChange(oldGoal,oldPlan,today());
  view='goals'; save(db.language==='zh'?'当前目标已归档。':'Goal archived.');
}
function exportData(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`tide-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importData(file){
  if(!file)return; const r=new FileReader(); r.onload=()=>{try{db=migrate(JSON.parse(r.result)); persist(); view='today'; flash=db.language==='zh'?'备份已恢复。':'Backup restored.'; render();}catch{alert(db.language==='zh'?'这个备份无法读取。':'This backup could not be read.')}}; r.readAsText(file);
}


function archiveGoalModal(){
  if(!archiveConfirmOpen) return '';
  return `<div class="modal-backdrop archive-confirm-backdrop" data-action="cancelArchiveGoal">
    <div class="archive-confirm-modal" role="dialog" aria-modal="true" aria-label="End and archive goal">
      <div class="weight-modal-handle"></div>
      <div class="archive-confirm-title">End this goal?</div>
      <div class="archive-confirm-copy">This freezes the current goal and its tracking record, then starts a new goal. Nothing you logged will be deleted.</div>
      <div class="archive-confirm-actions"><button class="btn ghost" data-action="cancelArchiveGoal">Cancel</button><button class="btn archive-confirm-danger" data-action="confirmArchiveGoal">Yes, end & archive</button></div>
    </div>
  </div>`;
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
    if(a==='openEndGoal'){view='endGoal';render();}
    if(a==='backToday'){view='today';render();}
    if(a==='quickWeight'){quickWeightOpen=true;render();setTimeout(()=>document.getElementById('quickWeightInput')?.focus(),30);}
    if(a==='closeQuickWeight'){quickWeightOpen=false;render();}
    if(a==='saveQuickWeight'){const el=document.getElementById('quickWeightInput');const v=el?.value===''?null:+el.value;if(v!=null&&Number.isFinite(v)){day(today()).weight=v;persist();quickWeightOpen=false;flash='Morning weight saved.';render();}}
    if(a==='openSelected'){view='day';render();}
    if(a==='saveDay'||a==='saveDayBottom'){saveInputsFromDOM();view='calendar';save(tr('saved'));}
    if(a==='addEvent')addCustomEvent();
    if(a==='chartSettings'){view='chartSettings';render();}
    if(a==='backProgress'){view='change';render();}
    if(a==='manageCustom'){customReturnView=view;view='customEvents';render();}
    if(a==='backFromCustom'){view=customReturnView||'day';render();}
    if(a==='cancelRemoveEvent'){removeCustomId=null;render();}
    if(a==='confirmRemoveEvent')removeCustomEvent(removeCustomId);
    if(a==='editGoal')beginGoalEdit();
    if(a==='saveGoal')commitGoalEdit();
    if(a==='cancelGoalEdit')requestCancelGoalEdit();
    if(a==='keepGoalEditing'){discardGoalEditOpen=false;render();}
    if(a==='discardGoalEdit')discardGoalEdit();
    if(a==='requestArchiveGoal'){saveGoalForm();archiveConfirmOpen=true;render();}
    if(a==='cancelArchiveGoal'){archiveConfirmOpen=false;render();}
    if(a==='confirmArchiveGoal'){archiveConfirmOpen=false;archiveGoal();}
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
  document.querySelectorAll('[data-no-snack]').forEach(b=>b.addEventListener('click',()=>setNoSnack(b.dataset.noSnack)));
  document.querySelectorAll('[data-more-than]').forEach(b=>b.addEventListener('click',()=>setMoreThanIntended(b.dataset.moreThan)));
  document.querySelectorAll('[data-toggle-move]').forEach(b=>b.addEventListener('click',()=>toggleMove(b.dataset.toggleMove)));
  document.querySelectorAll('[data-toggle-skip]').forEach(b=>b.addEventListener('click',()=>toggleSkip(b.dataset.toggleSkip)));
  document.querySelectorAll('[data-tracker-role]').forEach(b=>b.addEventListener('click',()=>setTrackerRole(b.dataset.trackerRole,b.dataset.role)));
  document.querySelectorAll('[data-toggle-custom]').forEach(b=>b.addEventListener('click',()=>toggleCustom(b.dataset.toggleCustom)));
  document.querySelectorAll('[data-toggle-planned-move]').forEach(b=>b.addEventListener('click',()=>togglePlannedMove(b.dataset.togglePlannedMove)));
  document.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.date;render();}));
  document.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>shiftMonth(+b.dataset.month)));
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>toggleEvent(b.dataset.event,b)));
  document.querySelectorAll('[data-chart-category]').forEach(b=>b.addEventListener('click',()=>toggleChartCategory(b.dataset.chartCategory)));
  document.querySelectorAll('[data-chart-source]').forEach(b=>b.addEventListener('change',()=>toggleChartSource(b.dataset.chartSource,b.dataset.sourceId,b.checked)));
  document.querySelectorAll('[data-hunger-min]').forEach(b=>b.addEventListener('click',()=>{db.chartSettings.hungerMin=+b.dataset.hungerMin;save();}));
  document.querySelectorAll('[data-custom-category]').forEach(el=>el.addEventListener('change',()=>changeCustomCategory(el.dataset.customCategory,el.value)));
  document.querySelectorAll('[data-archive-event]').forEach(b=>b.addEventListener('click',()=>{removeCustomId=b.dataset.archiveEvent;render();}));
  document.querySelectorAll('[data-restore-event]').forEach(b=>b.addEventListener('click',()=>restoreCustomEvent(b.dataset.restoreEvent)));
  document.querySelectorAll('[data-cycle-alcohol]').forEach(b=>b.addEventListener('click',()=>cycleAlcohol(b)));
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.range;render();}));
  document.querySelectorAll('[data-day-field]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
  document.querySelectorAll('[data-plan]').forEach(el=>el.addEventListener('change',()=>{if(view==='goalEdit'){goalEditDirty=true;return;}saveInputsFromDOM();persist();}));
  if(view==='goalEdit') document.querySelectorAll('#goalName,#goalStartWeight,#goalTarget,#goalStart,#goalEnd,#goalEffectiveFrom').forEach(el=>el.addEventListener('input',markGoalEditDirty));
  const f=document.getElementById('importFile'); if(f) f.addEventListener('change',()=>importData(f.files[0]));
  const reviewFile=document.getElementById('reviewImportFile'); if(reviewFile) reviewFile.addEventListener('change',()=>importGoalReview(reviewFile.files[0]));
  document.querySelectorAll('[data-review-goal]').forEach(b=>b.addEventListener('click',()=>{reviewGoalId=b.dataset.reviewGoal;reviewDraft=null;reviewComposerOpen=false;view='goalReview';render();}));
  const chart=document.querySelector('svg.chart');
  if(chart){
    const choosePoint=i=>{
      const d=chartData()[i],tip=document.getElementById('chartTip'),guide=document.getElementById('chartGuide');
      const point=chart.querySelectorAll('circle.point')[i];
      if(d&&tip&&point){
        tip.innerHTML=chartTipHtml(d);
        if(guide){guide.setAttribute('x1',point.getAttribute('cx'));guide.setAttribute('x2',point.getAttribute('cx'));}
      }
    };
    // Mobile Safari may synthesize its final click several pixels away from the
    // actual finger position. Select on the real pointer/touch coordinates, and
    // ignore the later synthetic mouseenter/click (which can select D-1 instead).
    const chooseNearest=clientX=>{
      const box=chart.getBoundingClientRect();
      if(!box.width)return;
      const x=(clientX-box.left)*340/box.width;
      const points=[...chart.querySelectorAll('circle.point')];
      if(x<36||x>336||!points.length)return;
      const nearest=points.reduce((best,point,i)=>Math.abs(+point.getAttribute('cx')-x)<best.distance?{index:i,distance:Math.abs(+point.getAttribute('cx')-x)}:best,{index:0,distance:Infinity});
      choosePoint(nearest.index);
    };
    let suppressSyntheticClick=false;
    chart.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'||e.pointerType==='pen'){
        suppressSyntheticClick=true;chooseNearest(e.clientX);
      }
    });
    chart.addEventListener('touchstart',e=>{
      if(e.touches.length){suppressSyntheticClick=true;chooseNearest(e.touches[0].clientX);}
    },{passive:true});
    chart.addEventListener('click',e=>{
      if(suppressSyntheticClick){suppressSyntheticClick=false;return;}
      chooseNearest(e.clientX);
    });
    chart.querySelectorAll('[data-chart-index]').forEach(p=>{
      p.addEventListener('mouseenter',()=>{if(!suppressSyntheticClick)choosePoint(+p.dataset.chartIndex);});
      p.addEventListener('focus',()=>{
        if(!suppressSyntheticClick)choosePoint(+p.dataset.chartIndex);
        chart.querySelectorAll('circle.point').forEach(point=>point.classList.remove('keyboard-focus'));
        chart.querySelectorAll('circle.point')[+p.dataset.chartIndex]?.classList.add('keyboard-focus');
      });
      p.addEventListener('blur',()=>chart.querySelectorAll('circle.point').forEach(point=>point.classList.remove('keyboard-focus')));
      p.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choosePoint(+p.dataset.chartIndex);}});
    });
  }
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
  else if(view==='chartSettings')content=chartSettingsPage();
  else if(view==='customEvents')content=customEventsPage();
  else if(view==='endGoal')content=endGoalPage();
  else if(view==='planEdit')content=planEditPage();
  document.getElementById('app').innerHTML=`<main class="shell">${content}${['today','calendar','change','goals','settings'].includes(view)?nav():''}</main>${quickWeightModal()}${archiveGoalModal()}${customRemoveModal()}${discardGoalEditModal()}`;
  bind();
  document.querySelector('.weight-modal')?.addEventListener('click',e=>e.stopPropagation());
  document.querySelector('.archive-confirm-modal')?.addEventListener('click',e=>e.stopPropagation());
  document.querySelector('.custom-confirm')?.addEventListener('click',e=>e.stopPropagation());
  if(discardGoalEditOpen) document.querySelectorAll('.archive-confirm-modal').forEach(x=>x.addEventListener('click',e=>e.stopPropagation()));
  const q=document.getElementById('quickWeightInput'); if(q) q.addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector('[data-action=\"saveQuickWeight\"]')?.click();});
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){ thoughtHiddenAt=Date.now(); return; }
  if(thoughtHiddenAt && Date.now()-thoughtHiddenAt>=10*60*1000){ dailyThought=chooseDailyThought(); thoughtHiddenAt=0; if(view==='today') render(); }
});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{}); }
render();
