const STORAGE_KEY = 'tide.v1';
const VERSION = '9.4.1';
const SCHEMA_VERSION = 15; // Date-effective calendar rule history; original daily records remain unchanged.

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
const THOUGHT_HISTORY_KEY = 'tide.dailyThought.v1';
const THOUGHT_BANK = {
  Body:[
    "A plan that works on ordinary days matters more than a perfect plan that only works when life is quiet. Keep the approach simple enough to repeat.",
    "Daily weight is noisy; the direction over several days is the useful part. One number does not deserve the power to rewrite the whole plan.",
    "Reaching a lower weight is only half the job. The better end state is a weight you can maintain without spending all day thinking about food.",
    "Strength does not need to compete with weight loss right now. It can become the next emphasis once the basic weight trend is where you want it.",
    "Sleep is part of body progress, not an unrelated side project. A body that is tired makes every other choice feel harder than it needs to.",
    "You do not need to make today stricter because yesterday was imperfect. Returning to the normal plan is usually more useful than compensating.",
    "The most useful diet rule is one that reduces decisions. If a rule creates constant negotiation, it may be adding more mental work than value.",
    "A flat day on the scale can still be a successful day. Behavior is the input; weight is an outcome that often arrives with a delay.",
    "Being lighter is not the same as feeling good in your body. The end goal includes energy, sleep, strength, and being able to live normally at that weight.",
    "There is no prize for making weight loss maximally difficult. A repeatable calorie deficit beats a dramatic plan that creates rebound eating.",
    "When the plan is working, boredom is not a problem. Repetition is often what allows the result to become predictable.",
    "A meal outside the usual routine is information, not a moral event. The useful question is whether you returned to your normal pattern afterward.",
    "If hunger keeps becoming the main event of the day, that is useful feedback. The goal is not to prove how much discomfort you can tolerate.",
    "The best maintenance plan will probably look less intense than the weight-loss phase. That is a feature, not a loss of discipline.",
    "Muscle is a long-term investment in how your body feels and functions. It does not need to be rushed into the same phase as every other body goal.",
    "A few consistent weeks tell you more than one unusually good or bad day. Give a plan enough time to produce a pattern before judging it.",
    "Do not confuse urgency with effectiveness. Faster is only better if the approach is still sustainable enough to finish and maintain.",
    "Your body does not need a new intervention every time the scale pauses. Sometimes the correct response is simply to keep collecting data.",
    "Exercise is useful even when it does not immediately change the scale. Strength, mood, sleep, and fitness are real outcomes too.",
    "The goal is not to win against hunger. The goal is to build an eating pattern that creates progress without making food dominate your attention.",
    "One simple day can be enough: eat according to the plan, move if it helps, sleep, and let the trend do its work.",
    "A comfortable body weight should eventually feel ordinary. If maintaining it requires constant emergency-level effort, the system still needs work.",
    "You can be serious about the goal without monitoring every variable. Track the few inputs that actually help you make better decisions.",
    "The scale can confirm progress, but it cannot create it. Most of today's useful work happens before tomorrow morning's number exists.",
    "A good body goal should leave room for the rest of your life. Health is not improved if the process consumes all of your attention.",
    "When weight loss is mostly finished, the question changes from 'How do I get smaller?' to 'How do I feel strong and stay here comfortably?'",
    "Sleep, food, and exercise interact, but they do not need to be optimized all at once. Fix the biggest friction first and let the rest stay simple.",
    "A slower week is not automatically a problem. Look for a real multi-day pattern before deciding that anything needs to change.",
    "Consistency is easier when the plan has fewer exceptions to negotiate. Simple boundaries can be more freeing than constant optimization.",
    "The body end goal is not just a number. It is reaching a place where the number, your habits, and how you feel can coexist comfortably."
  ],
  Mind:[
    "Not every thought deserves a decision. Sometimes calm comes from noticing a concern and allowing it to remain unresolved for a while.",
    "A fuller life is not created only by removing anxiety. It is also created by adding people, books, ideas, and projects that are genuinely yours.",
    "If a small issue keeps taking up a large amount of mental space, the useful goal may be less analysis rather than a better analysis.",
    "Connection usually grows from repeated ordinary contact, not from finding the perfect friendship immediately. Make room for people you simply enjoy.",
    "Reading something because you are curious is productive enough. Not every interest needs to become a credential, project, or measurable outcome.",
    "Calm does not require every loose end to be solved. It often requires confidence that you can handle things when they actually need handling.",
    "Your own life deserves protected space even when family logistics are busy. A small amount of regular time can matter more than waiting for a completely free season.",
    "There is a difference between useful thinking and repetitive thinking. If the same question has produced no new information, more thinking may not help.",
    "You do not need to optimize every hour for it to be worthwhile. Time spent reading, wandering through an idea, or doing nothing urgent can still belong to a good life.",
    "Anxiety often asks for certainty before allowing you to move on. Real life rarely provides that much certainty, so 'good enough to proceed' is an important skill.",
    "A decision can be reasonable without being provably best. Leaving some alternatives unexplored is part of actually living the choice you made.",
    "Friendship does not need to be maximally deep to be valuable. A person you enjoy seeing regularly can make life noticeably better.",
    "Curiosity is easier to hear when every open space is not immediately filled with errands, optimization, or scrolling. Leave a little room unassigned.",
    "You can care about something without revisiting it every day. Attention is a resource, and not every concern deserves a permanent subscription.",
    "The goal is not to eliminate all worry. It is to make worry smaller than the life happening around it.",
    "Sometimes the most meaningful personal project is simply the one you keep returning to because you like it. It does not need a strategic justification.",
    "If you already made a thoughtful decision, repeatedly reopening it can create the feeling of control while actually increasing uncertainty.",
    "A calmer mind often comes from fewer active questions. Decide which questions truly need an answer this week and let the others wait.",
    "Being connected means having people in your life before you urgently need them. Small invitations and casual plans are part of building that fabric.",
    "Learning for pleasure is still learning. The absence of a practical payoff can be exactly what makes an interest feel like your own.",
    "The point of reducing anxiety is not to become endlessly efficient. It is to have more attention available for things that are interesting, warm, and alive.",
    "You do not need to turn every insight into a system. Sometimes noticing a pattern once is enough to make a different choice next time.",
    "A quiet afternoon is not empty space waiting to be optimized. It can be the part of life where your own preferences become visible again.",
    "If a problem is small but emotionally sticky, ask whether solving it will meaningfully change your life. If not, letting it be imperfect may be the better skill.",
    "More information is not always more reassuring. At some point, another search or comparison can make a decision feel less settled rather than more informed.",
    "Your mind needs experiences that are not about fixing yourself. Friendship, humor, stories, and curiosity can do work that self-analysis cannot.",
    "It is possible to be thoughtful without being continuously vigilant. Good judgment can include knowing when to stop monitoring.",
    "A personal life grows through repetition too: the book you keep reading, the friend you keep seeing, the subject you keep returning to.",
    "You do not need a grand new identity. More of your own life can start with one small recurring thing that is chosen because you want it.",
    "The end state is not a perfectly controlled mind. It is a mind with enough room that small worries no longer crowd out everything else."
  ],
  Family:[
    "Not every concern needs a new class, therapist, or intervention. Sometimes the best sign that something is working is that you can stop thinking about it for a while.",
    "Family life can be going well without every child-related decision being optimized. Good enough choices made with confidence often create more calm than endless refinement.",
    "The children do not need every possible advantage at the same time. A few well-chosen supports plus room to grow can be a stronger system.",
    "Connection is not another item to schedule perfectly. Ordinary meals, rides, jokes, and unhurried time often do more than a carefully designed family activity.",
    "A good education plan should eventually reduce parental mental load. If the plan requires constant re-evaluation, simplification may be part of the solution.",
    "You can notice a weakness without immediately turning it into a project. Children are allowed to develop unevenly and improve over time.",
    "The question is not whether every activity is beneficial. The question is whether the whole family system still has enough time, energy, and ease.",
    "Confidence in parenting does not come from always knowing the best answer. It grows from making reasonable choices and allowing enough time to see what happens.",
    "Sometimes supporting a child means adding something; sometimes it means protecting space from one more thing. Both are active choices.",
    "A child can be on the right track without looking optimized in every domain. Direction matters more than a perfectly polished schedule.",
    "Not every difficult week is evidence that a program is wrong. Look for recurring patterns before rebuilding the plan around a temporary problem.",
    "Family closeness is easier when not every conversation becomes evaluation. There should be plenty of interactions where nobody is being improved.",
    "It is useful to ask whether an intervention is solving a meaningful problem or simply reducing parental uncertainty. Those are not always the same thing.",
    "A schedule that looks impressive from the outside can still be too expensive in family energy. The hidden cost of logistics counts.",
    "Children benefit from adults who can tolerate some uncertainty about how everything will turn out. Not knowing yet is often a normal stage, not an emergency.",
    "The goal is not to make childhood maximally productive. It is to help the kids grow while keeping enough room for friendship, play, family, and ordinary life.",
    "When something is working reasonably well, stability has value. Changing less can sometimes be the more thoughtful parenting decision.",
    "You do not have to solve a child's entire future from this semester's schedule. Choose what matters now and let later decisions remain later.",
    "Family systems improve when the adults are not exhausted by maintaining them. Ease is a legitimate design criterion.",
    "A supportive parent notices problems, but does not need to become the full-time manager of every developing skill. Children also learn by carrying some of the work themselves.",
    "If you keep revisiting the same activity decision, ask what new information would actually change your mind. Without new information, repetition may just be anxiety in planning form.",
    "The right track is usually a direction, not a perfectly mapped route. You need enough evidence to continue, not certainty about every future turn.",
    "Shared family time does not need to be educational or memorable to count. Familiar ordinary time is part of what makes a family feel close.",
    "A child having one area that is hard does not mean the whole support system is failing. Keep the problem proportional to its actual impact.",
    "More support is not automatically better support. The best intervention is often the smallest one that meaningfully helps.",
    "You can care deeply about education while refusing to let education planning dominate family life. Those two positions are compatible.",
    "The aim is eventually to trust the system you built: school, a few supports, the child's own development, and your ability to adjust when real evidence appears.",
    "Second-guessing can make even good decisions feel unstable. Sometimes the next family improvement is not a new choice, but allowing the current choice to settle.",
    "A family's success is not visible in a list of lessons and achievements. It is also visible in whether people like being together and have enough room to breathe.",
    "By the end of the year, the best sign may be that fewer child-related questions feel urgent. A good system should create more trust, not more monitoring."
  ],
  Money:[
    "Complexity has a cost even when the numbers look fine. A financial system is better when you understand it, trust it, and rarely need to think about it.",
    "A loose end is expensive partly because it keeps reopening in your mind. Closing one annoying tax or admin item can be worth more than another round of optimization.",
    "The best portfolio is not necessarily the one with the most clever components. Simplicity can improve the odds that you understand what you own and leave it alone.",
    "Money is doing its job when it supports the life you want without demanding constant attention. More monitoring is not the same as better management.",
    "An intentional purchase can be enjoyable. The exhausting part is often the repeated browsing, comparing, and thinking that happens before and after it.",
    "Not every available tax optimization deserves implementation. The benefit has to be large enough to justify the complexity it adds.",
    "A financial decision can be good because it is clear and maintainable, even if another option might be marginally more efficient on paper.",
    "The goal is not to stop caring about money. It is to move money from a daily mental preoccupation into a system you can review deliberately and then leave alone.",
    "When you understand why an investment is in the portfolio, short-term noise becomes easier to ignore. Clarity reduces the urge to keep rearranging things.",
    "Administrative tasks become mentally larger the longer they stay open. A short boring session that closes one item can create disproportionate relief.",
    "Spending intentionally does not mean spending as little as possible. It means knowing which purchases genuinely improve your life and which mainly create another cycle of wanting.",
    "Optimization has diminishing returns. Once the important decisions are right, the next tiny improvement may not deserve another hour of attention.",
    "A clean financial system has fewer things you need to remember. Automate, consolidate, document, or close what repeatedly depends on your memory.",
    "It is easier to trust an investment plan when every holding has a clear role. If you cannot explain why something is there, that is useful information.",
    "Money can buy convenience, time, beauty, and experiences. It does not need to turn every purchase into a referendum on whether you are being perfectly rational.",
    "A decision does not have to maximize expected return to be financially intelligent. Liquidity, simplicity, taxes, and peace of mind are real inputs too.",
    "The most useful financial review may end with fewer decisions than it started with. Clarity often looks like removing options from active consideration.",
    "If a purchase keeps occupying your attention after you decided not to buy it, the real cost may be attention rather than money. Closing the loop matters.",
    "There is value in having a short list of financial questions that actually matter this year. Everything else can wait until it earns a place on that list.",
    "Good systems make routine money boring. Boring is helpful when it means taxes, cash, investments, and bills are handled without repeated emergencies.",
    "A complicated strategy needs to earn back its complexity. Compare the real after-tax benefit with the time, fees, restrictions, and attention it consumes.",
    "Spending can be generous and intentional at the same time. The useful boundary is not 'never buy'; it is 'buy for a reason you still respect tomorrow.'",
    "Financial confidence comes partly from knowing what you have decided not to optimize. Explicitly choosing simplicity is different from neglecting something.",
    "One completed admin task is often more valuable than ten tabs of research about future possibilities. Closure creates usable attention.",
    "If money decisions keep returning to the same unresolved question, write down the rule once. A clear policy can replace dozens of future micro-decisions.",
    "A portfolio does not need to express every interesting market view. Its job is to serve your actual financial life, not demonstrate sophistication.",
    "The purpose of wealth is not to create an endless management hobby unless you genuinely enjoy that hobby. It is allowed to become infrastructure.",
    "A simpler financial life can still be highly deliberate. Simplicity is often the result of making the important decisions clearly, not avoiding them.",
    "Before optimizing another small number, ask what larger loose end is still open. Closing the important unfinished thing may have the higher return on attention.",
    "The end goal is not a perfect spreadsheet. It is confidence that the important money decisions are handled, the loose ends are closed, and your attention is free for something else."
  ]
};
function thoughtPool(){
  const out=[];
  Object.entries(THOUGHT_BANK).forEach(([category,rows])=>rows.forEach((text,i)=>out.push({id:`${category.toLowerCase()}-${i}`,category,text})));
  return out;
}
function chooseDailyThought(){
  const all=thoughtPool();
  let state={recent:[],lastCategory:''};
  try{ state={...state,...JSON.parse(localStorage.getItem(THOUGHT_HISTORY_KEY)||'{}')}; }catch{}
  let eligible=all.filter(x=>!state.recent.includes(x.id));
  const differentCategory=eligible.filter(x=>x.category!==state.lastCategory);
  if(differentCategory.length>=20) eligible=differentCategory;
  if(!eligible.length) eligible=all;
  const item=eligible[Math.floor(Math.random()*eligible.length)]||all[0];
  state.recent=[item.id,...state.recent.filter(id=>id!==item.id)].slice(0,12);
  state.lastCategory=item.category;
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
  journey:{effectiveFrom:today(),eveningPlans:[{effectiveFrom:today(),text:'2 eggs + 1 fruit'}],returns:[]},
  days:{},
  calendarRuleHistory:[], // Dated rule revisions preserve past Calendar evaluations.
  customEvents:[],
  chartSettings:{categories:['food','hunger'],food:['eating_out','alcohol','snacks'],exercise:['steps','cardio','strength'],other:['period','travel','party','vacation','poor_sleep','sick','short_sleep'],custom:[],hungerMin:4},
  plan:{veg:3,fruit:2,noSnack:true,stop:'18:00',satiety:7,water:2,stepsTarget:10000,stepsDays:5,stretchDays:5,cardio:90,strength:60,strengthSessions:2},
  goals:[]
};

let db = loadDB();
let view = 'today';
let selected = today();
let calendarMonth = today().slice(0,7) + '-01';
let range = 'goal';
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
let eveningEditDate=null, eveningReturnView='today', goalEditSnapshot=null, showForecast=false;
let lastRenderDate=today();

function fresh(){ return JSON.parse(JSON.stringify(defaults)); }
function mergeDay(x={}){
  return {
    date:x.date||today(), weight:x.weight??null, sleep:x.sleep??null,
    alcohol:x.alcohol??null, bowelMovement:x.bowelMovement??null,
    events:Array.isArray(x.events)?x.events.map(e=>({'Dinner out':'eating_out','Eating out':'eating_out','dinner':'eating_out','Travel':'travel','Party':'party','Long flight':'flight','Vacation':'vacation','Poor sleep':'poor_sleep','Period':'period','Sick':'sick'}[e]||e)).filter(e=>e!=='flight'):[],
    eveningOut:typeof x.eveningOut==='boolean'?x.eveningOut:null,
    eveningPlan:typeof x.eveningPlan==='string'?x.eveningPlan:null,
    eveningFood:['had','not-needed'].includes(x.eveningFood)?x.eveningFood:null,
    planMode:x.planMode||'default', plannedSleep:x.plannedSleep??null,
    customPlan:{
      veg:x.customPlan?.veg??null, fruit:x.customPlan?.fruit??null, noSnack:x.customPlan?.noSnack??null,
      stop:x.customPlan?.stop??null, satiety:x.customPlan?.satiety??null, water:x.customPlan?.water??null,
      steps:x.customPlan?.steps??null, stretch:x.customPlan?.stretch??null, cardio:x.customPlan?.cardio??null, strength:x.customPlan?.strength??null
    },
    plannedMove:{steps:x.plannedMove?.steps??null,stretch:x.plannedMove?.stretch??null,cardio:x.plannedMove?.cardio??null,strength:x.plannedMove?.strength??null},
    food:{veg:x.food?.veg??null,protein:x.food?.protein??null,fruit:x.food?.fruit??null,noSnack:x.food?.noSnack??null,extraSnacks:typeof x.food?.extraSnacks==='boolean'?x.food.extraSnacks:null,stop6:x.food?.stop6??null,water:x.food?.water??null,bedtimeHunger:x.food?.bedtimeHunger??null,satiety:x.food?.satiety??null},
    skips:(x.skips&&typeof x.skips==='object')?{...x.skips}:{},
    move:{steps:x.move?.steps??null,stretch:x.move?.stretch??null,cardio:x.move?.cardio??null,strength:x.move?.strength??null},
    close:x.close??null,note:x.note??''
  };
}
function migrate(raw){
  const out=fresh();
  if(!raw || typeof raw!=='object') return migrateJourney(out,raw);
  out.language='en';
  const rawGoal=raw.goal||{};
  out.goal={...out.goal,...rawGoal};
  out.goal.id=stableGoalId(out.goal,'-active'); out.goal.focus=['diet','exercise','both','other'].includes(out.goal.focus)?out.goal.focus:'both'; out.goal.trackers=normalizeTrackers({...out.goal,trackers:rawGoal.trackers||null},false); out.goal.review=normalizeReview(out.goal.review); out.goal.reviews=normalizeReviews(out.goal);
  out.plan={...out.plan,...(raw.plan||{}),stepsTarget:10000,strengthSessions:raw.plan?.strengthSessions??out.plan.strengthSessions};
  out.goals=Array.isArray(raw.goals)?raw.goals.map((g,i)=>{const x={...g,id:stableGoalId(g,`-${i}`),focus:['diet','exercise','both','other'].includes(g.focus)?g.focus:'both',review:normalizeReview(g.review),planSnapshot:g.planSnapshot?{...g.planSnapshot}:null,snapshot:true};x.trackers=normalizeTrackers(x,true);x.reviews=normalizeReviews(x);return x;}):[];
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
  out.chartSettings={categories:groups,food:opts(foodSources,['eating_out','alcohol','snacks'],defaults.chartSettings.food),exercise:opts(cs.exercise,['steps','cardio','strength'],defaults.chartSettings.exercise),other:opts(cs.other,['period','travel','party','vacation','poor_sleep','sick','short_sleep'],defaults.chartSettings.other),custom:opts(cs.custom,activeCustom,[]),hungerMin:[3,4,5].includes(+cs.hungerMin)?+cs.hungerMin:4};
  migrateJourney(out,raw);
  out.schemaVersion=SCHEMA_VERSION; out.version=SCHEMA_VERSION;
  return out;
}
function loadDB(){
  try{return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}
  catch{return migrateJourney(fresh(),null);}
}
function persist(){ localStorage.setItem(STORAGE_KEY,JSON.stringify(goalEditSnapshot?{...db,...goalEditSnapshot}:db)); }
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
function goalMovingAverage(date) { return trendStats(date).value; }

function activeGoalStartWeight(){ return db.goal.startWeight==null?null:+db.goal.startWeight; }
function planForGoal(g){
  return g?.planSnapshot ? {...defaults.plan,...g.planSnapshot} : db.plan;
}
function dayPlanForGoal(g,d){
  const src=planForGoal(g);
  const base={veg:src.veg,fruit:src.fruit,noSnack:src.noSnack,stop:src.stop,satiety:src.satiety,water:src.water,steps:src.stepsTarget||10000,stretch:null,cardio:null,strength:null};
  if(usesEveningPlan(d.date)) base.stop=null;
  if(d.planMode==='flexible') return {...base,stop:null};
  if(d.planMode==='custom') return {...base,...Object.fromEntries(Object.entries(d.customPlan||{}).filter(([k,v])=>v!==null&&v!==''&&!(k==='stop'&&usesEveningPlan(d.date))))};
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
    const value=snackValue(d); return {recorded:value!=null,met:value===true};
  }
  if(id==='stop6'){
    if(p.stop==null || usesEveningPlan(d.date)) return {recorded:false,met:false,na:true,plannedException:true};
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
  if(id==='noSnack') return usesEveningPlan(d?.date||today())?'No extra snacks':'No snacks';
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
  const f=d.food, p=dayPlanForGoal(g,d), core=[f.veg,f.fruit,snackValue(d),p.stop==null?null:f.stop6];
  const recorded=core.filter(v=>v!==null&&v!=='').length;
  if(!recorded) return {recorded:0,score:null,enough:false,calendarPass:false,label:'No record'};
  let pass=0,denom=0;
  if(f.veg!=null){denom++;if(+f.veg>=+p.veg)pass++;}
  if(f.fruit!=null){denom++;if(+f.fruit<=+p.fruit)pass++;}
  if(snackValue(d)!=null){denom++;if(p.noSnack===false||snackValue(d)===true)pass++;}
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
  const d=readDay(today());
  if(returnedOn(today())) return 'You came back. One ordinary day is a useful next step.';
  if(d.food.bedtimeHunger>=4) return 'Hunger is useful feedback. Make room for satisfying meals and planned evening food.';
  if(snackValue(d)===false) return 'One day does not erase your history. Return to regular meals at your next opportunity.';
  return 'Look at the trend over time. Your meals, sleep, and how the plan feels matter too.';
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


function endGoalTodayEntry(){
  return `<button class="end-goal-entry" data-action="openEndGoal"><div class="end-goal-entry-top"><span>End Goal · 2026</span><span class="end-goal-arrow">›</span></div><div class="end-goal-entry-copy">Healthy · Calmer · Connected · Simple</div></button>`;
}
function dailyThoughtBlock(){
  const t=dailyThought||chooseDailyThought();
  return `<section class="daily-thought"><div class="daily-thought-label">${escapeHtml(t.category.toUpperCase())} · Daily thought</div><div class="daily-thought-copy">${escapeHtml(t.text)}</div></section>`;
}
function endGoalPage(){
  return `${topbar('End Goal','',`<button class="btn ghost" data-action="backToday">Done</button>`)}
    <div class="end-goal-date">December 31, 2026</div>
    <div class="end-goal-question">What do I want to be true by the end of the year?</div>
    <div class="end-goal-list">${END_GOAL_AREAS.map(a=>`<details class="end-goal-area"><summary><span class="end-goal-area-name">${a.name}</span><span class="end-goal-area-short">${escapeHtml(a.short)}</span></summary><p>${escapeHtml(a.detail)}</p></details>`).join('')}</div>
    <div class="end-goal-footer">These are the things that actually matter this year.</div>`;
}

function todayPage(){ return journeyTodayPage(); }

function skipButton(id,d){ return `<button class="skip-chip ${d.skips?.[id]?'on':''}" data-toggle-skip="${id}">${d.skips?.[id]?'N/A ✓':'N/A'}</button>`; }
function trackerHead(id,d){ return `<div class="tracker-head"><div class="actual-label">${id==='noSnack'&&usesEveningPlan(d.date)?'No extra snacks':TRACKER_DEFS[id].label} ${trackerRoleBadge(calendarRulesForDate(d.date).goal,id)}</div>${skipButton(id,d)}</div>`; }
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
  ${snackControls(d)}${eveningFoodCard(d)}
  ${!usesEveningPlan(d.date)?`<div class="actual-row tracker-row ${d.skips?.stop6?'is-skip':''}">${trackerHead('stop6',d)}<div class="switch-row compact-switch"><span>${d.food.stop6===true?'On plan':'Mark when met'}</span><button class="toggle ${d.food.stop6===true?'on':''}" data-toggle-food="stop6" aria-label="No food after cutoff"></button></div></div>`:''}
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
    if(d.events.length||d.eveningOut) dots.push('<i class="dot event"></i>');
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
        <div class="mini-state"><i class="dot event"></i><b>${tr('special')}</b><span>${d.events.length?escapeHtml(eventLabel(d.events[0])):d.eveningOut?'Dinner out':tr('noRecord')}</span></div>
      </div>
      ${d.weight!=null?`<div class="small" style="margin-top:10px">${tr('fastingWeight')} ${fmt(d.weight)} kg${wc==null?'':` · ${wc>0?'+':''}${wc.toFixed(1)} kg`}</div>`:''}
    </section>`;
}

function dayPage(){
  const d=day(selected), future=selected>today();
  return `${topbar(fmtDate(selected),future?'Plan':selected===today()?'Today':'Edit',`<button class="btn sky save-top" data-action="saveDay">Save</button>`)}${flashHtml()}
    ${future?`<section class="card">${futurePlanSummary(d)}${eveningFoodCard(d)}${plannedMoveControls(d)}</section>`:`<section class="card blue-soft"><div class="two"><label>Weight · kg<input data-day-field="weight" type="number" step="0.1" inputmode="decimal" value="${d.weight??''}"></label><label>Sleep · hours<input data-day-field="sleep" type="number" step="0.1" inputmode="decimal" value="${d.sleep??''}"></label></div></section><section class="card day-food"><div class="actual-label">Food</div>${actualFoodControls(d)}${returnCard(d)}</section><section class="card"><div class="actual-label">Exercise</div>${movementControls(d)}</section>`}
    <details class="card"><summary>Events & notes</summary><div class="life-events">${lifeEventTagsHtml(d,future)}</div><div class="row"><input id="customEvent" maxlength="40" placeholder="Add event" aria-label="New custom event"><button class="btn secondary" data-action="addEvent">Add</button></div><button class="quiet-link" data-action="manageCustom">Manage events</button><label>Notes<textarea data-day-field="note" rows="3">${escapeHtml(d.note)}</textarea></label></details><button class="btn sky full" data-action="saveDayBottom">Done</button>`;
}

function futurePlanSummary(d){
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].cadence==='daily'&&trackerRole(db.goal,id)==='goal'&&trackerActiveOn(db.goal,id,d.date));
  return `<div class="rule-grid">${ids.map(id=>`<div class="rule">${escapeHtml(trackerRuleLabel(db.goal,id,d))}</div>`).join('')}</div>`;
}
function customPlanControls(d){const p=d.customPlan||{};return `<div class="custom-plan"><div class="actual-label">Custom food goals</div><div class="two"><label>Vegetables ≥<input data-day-field="customPlan.veg" type="number" value="${p.veg??db.plan.veg}"></label><label>Fruit ≤<input data-day-field="customPlan.fruit" type="number" value="${p.fruit??db.plan.fruit}"></label><label>Water ≥ L<input data-day-field="customPlan.water" type="number" step="0.1" value="${p.water??db.plan.water}"></label><label>Stop eating time<input data-day-field="customPlan.stop" type="time" value="${p.stop??db.plan.stop}"></label></div><div class="switch-row actual-row"><span>Allow snacks</span><button class="toggle ${p.noSnack===false?'on':''}" data-toggle-custom="allowSnack"></button></div><div class="small plan-helper">Protein is yes/no. Bedtime hunger is observation only and has no custom target.</div><hr class="sep"><div class="actual-label">Custom exercise</div><div class="two"><label>Steps<input data-day-field="customPlan.steps" type="number" value="${p.steps??''}" placeholder="10000"></label><label>Cardio · min<input data-day-field="customPlan.cardio" type="number" value="${p.cardio??''}"></label><label>Strength · min<input data-day-field="customPlan.strength" type="number" value="${p.strength??''}"></label><div style="padding-top:26px"><div class="switch-row"><span>Stretch</span><button class="toggle ${p.stretch===true?'on':''}" data-toggle-custom="stretch"></button></div></div></div></div>`; }

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
  // Theil-Sen median pairwise slope, spaced to reduce overlapping-window noise.
  const slopes=[];
  for(let i=0;i<rows.length;i++) for(let j=i+1;j<rows.length;j++){
    const gap=(parseDate(rows[j].date)-parseDate(rows[i].date))/86400000;
    if(gap>=3) slopes.push((rows[j].value-rows[i].value)/gap);
  }
  return slopes.length>=3?median(slopes):null;
}
function goalForecast(){
  const records=latestWeights(today()).filter(r=>r.date>=addDays(today(),-35));
  if(!records.length || records.at(-1).date<addDays(today(),-3)) return {ready:false,reason:'Log a recent weight before estimating a trend.'};
  if(records.length<5) return {ready:false,reason:'Log at least 5 weights to see an estimate.'};
  if((parseDate(records.at(-1).date)-parseDate(records[0].date))/86400000<7) return {ready:false,reason:'An estimate needs at least a week of data.'};
  const trend=records.map(r=>({date:r.date,value:robustSevenDayMean(r.date,records)})), last=trend.at(-1);
  let usable=trend.filter(r=>r.date>=addDays(last.date,-14));
  if(usable.length<5)usable=trend.filter(r=>r.date>=addDays(last.date,-21));
  if(usable.length<5) return {ready:false,reason:'Not enough recent readings for an estimate.'};
  const estimate=robustRecentSlope(usable);
  if(estimate==null)return {ready:false,reason:'More spaced weigh-ins are needed.'};
  const slope=clamp(estimate,-.12,.08), current=+last.value;
  const forecastValue=days=>{const d=Math.max(0,days);return current+slope*(.35*d+.65*(1-Math.exp(-.035*d))/.035);};
  return {ready:true,slope,current,lastDate:last.date,forecastValue,trendWindowStart:usable[0].date,trendPoints:usable.length};
}

function changePage(){
  const series=chartData(), f=goalForecast();
  const targetVisible=db.goal.status!=='idle'&&db.goal.mode!=='record'&&(range==='goal'||(series.length&&db.goal.start<=series.at(-1).date&&db.goal.end>=series[0].date));
  return `${topbar('Progress')}<section class="card change-goal-card"><div class="row between"><b>Weight</b><button class="quiet-link" data-action="chartSettings">Customize</button></div><div class="range-controls" role="group" aria-label="Chart range">${[['goal','Goal'],['30','30D'],['90','90D'],['all','All']].map(([v,label])=>`<button class="pill ${range===v?'on':''}" data-range="${v}" aria-pressed="${range===v}">${label}</button>`).join('')}</div><div class="legend"><span><span class="legend-line actual-line"></span>Weight</span><span><span class="legend-line average-line"></span>7-day avg</span>${targetVisible?'<span><span class="legend-line goal-line"></span>Target</span>':''}${showForecast?'<span><span class="legend-line forecast-line"></span>Estimate</span>':''}</div><div class="chart-wrap">${renderChart(series,showForecast?f:null)}</div><div class="chart-bottom"><button class="quiet-link" data-action="toggleForecast" aria-pressed="${showForecast}">${showForecast?'Hide':'Show'} estimate</button><details class="chart-info-wrap"><summary aria-label="Chart information">i</summary><div class="chart-info-popover">Goal includes the previous 7 days. Longer views start at the first available reading. Missing stretches stay open. An average needs 3 readings. Dots show previous-day context, not causes.</div></details></div>${showForecast&&!f.ready?'<div class="small">Not enough recent data.</div>':''}</section>${db.goal.status!=='idle'?`<section class="card progress-behavior-card">${weeklyBehaviorProgress(db.goal)}</section><section class="card other-signals-card">${otherSignals(db.goal)}</section>`:''}${returnCount()?`<div class="small return-count">Back on plan ${returnCount()} time${returnCount()===1?'':'s'}.</div>`:''}`;
}

function chartData(){
  return latestWeights().filter(x=>x.date>=chartWindowStart()).map(x=>({date:x.date,weight:+x.weight,avg:trendStats(x.date).value,averageCount:trendStats(x.date).count}));
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
const CHART_FOOD=[['eating_out','Eating out'],['alcohol','Alcohol'],['snacks','Snacks · from daily log']];
const CHART_EXERCISE=[['steps','10k steps'],['cardio','Cardio'],['strength','Strength']];
const CHART_OTHER=[['period','Period'],['travel','Travel'],['party','Party'],['vacation','Vacation'],['poor_sleep','Poor sleep'],['sick','Sick'],['short_sleep','Short sleep · <6h']];
function weightPointContext(weightDate){
  const prevDate=addDays(weightDate,-1);
  const prev=readDay(prevDate), same=readDay(weightDate), settings=db.chartSettings;
  const events=prev.events.map(eventId);
  const eatingOut=events.includes('eating_out')||prev.eveningOut===true;
  const alcohol=prev.alcohol==null?null:+prev.alcohol;
  const hadSnacks=snackValue(prev)===false; // D-1 explicit Had snacks ONLY; true, null and N/A do not match.
  const hunger=prev.food.bedtimeHunger==null?null:+prev.food.bedtimeHunger;
  const steps=prev.move.steps==null?null:+prev.move.steps;
  const cardio=prev.move.cardio==null?null:+prev.move.cardio;
  const strength=prev.move.strength==null?null:+prev.move.strength;
  const sleep=same.sleep==null?null:+same.sleep; // morning log for the same weigh-in
  const exerciseAvailable={steps:steps!=null&&steps>=10000,cardio:cardio!=null&&cardio>0,strength:strength!=null&&strength>0};
  const exerciseNotable=Object.values(exerciseAvailable).some(Boolean);
  const sleepNotable=sleep!=null&&sleep<6;
  const custom=db.customEvents.filter(e=>e.active&&settings.custom.includes(e.id)&&events.includes(e.id));
  const foodMatch=(eatingOut&&settings.food.includes('eating_out')) || (alcohol>0&&settings.food.includes('alcohol')) || (hadSnacks&&settings.food.includes('snacks')) || custom.some(e=>e.category==='food');
  const otherMatch=events.some(id=>settings.other.includes(id)) || (sleepNotable&&settings.other.includes('short_sleep')) || custom.some(e=>e.category==='other');
  const exerciseMatch=settings.exercise.some(key=>exerciseAvailable[key]);
  const prevDetails=events.map(eventLabel);
  if(prev.eveningOut===true)prevDetails.push('Dinner out');
  if(alcohol>0)prevDetails.push(`Alcohol ${alcohol>=2?'2+':alcohol}`);
  if(hadSnacks)prevDetails.push(usesEveningPlan(prevDate)?'Extra snacks':'Snacks');
  else if(snackValue(prev)===true)prevDetails.push(usesEveningPlan(prevDate)?'No extra snacks':'No snacks');
  if(prev.eveningFood==='had')prevDetails.push(`Planned evening food: ${eveningPlanFor(prevDate)}`);
  if(hunger!=null)prevDetails.push(`Hunger ${hunger}/5`);
  if(exerciseNotable){
    const exercise=[];
    if(exerciseAvailable.steps)exercise.push(`${steps>=1000?(steps/1000).toFixed(1).replace('.0','')+'k':Math.round(steps)} steps`);
    if(exerciseAvailable.cardio)exercise.push(`Cardio ${Math.round(cardio)}m`);
    if(exerciseAvailable.strength)exercise.push(`Strength ${Math.round(strength)}m`);
    if(exercise.length)prevDetails.push(exercise.join(' · '));
  }
  // Sleep is logged on the weigh-in morning, not on the previous calendar day.
  return {prevDate,eatingOut,alcohol,hadSnacks,hunger,steps,cardio,strength,sleep,exerciseNotable,sleepNotable,prevDetails,
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
  if(!data.length) return '<div class="empty">No weigh-ins in this range. Choose All to see earlier history.</div>';
  const W=340,H=264,L=44,R=14,Tp=24,axisY=228,plotBottom=204;
  const last=data.at(-1), ready=forecast?.ready&&forecast.lastDate===last.date;
  const bounds=chartBounds(data,ready);
  const start=bounds.start, end=bounds.end;
  const days=Math.max(1,(parseDate(end)-parseDate(start))/86400000);
  const x=date=>L+((parseDate(date)-parseDate(start))/86400000)/days*(W-L-R);
  const goalVisible=db.goal.status!=='idle'&&db.goal.end>=start&&db.goal.start<=end;
  const targetVisible=goalVisible&&db.goal.mode!=='record'&&Number.isFinite(+db.goal.target);
  const values=data.flatMap(d=>d.avg==null?[d.weight]:[d.weight,d.avg]);
  if(targetVisible)values.push(+db.goal.target);
  const horizon=ready?Math.min(14,Math.round((parseDate(end)-parseDate(last.date))/86400000)):0;
  if(ready)values.push(forecast.forecastValue(horizon));
  let min=Math.floor((Math.min(...values)-.3)*2)/2, max=Math.ceil((Math.max(...values)+.3)*2)/2;
  if(max-min<1){min-=.5;max+=.5;}
  const y=v=>Tp+(max-v)/(max-min)*(plotBottom-Tp), step=max-min<=3?.5:Math.ceil((max-min)/5);
  let grid='';
  for(let v=Math.ceil(min/step)*step;v<=max+.001;v+=step)grid+=`<line class="grid" x1="${L}" y1="${y(v)}" x2="${W-R}" y2="${y(v)}"/><text class="y-label" x="${L-7}" y="${y(v)+3}" text-anchor="end">${Number(v.toFixed(1))}</text>`;
  const segmentPath=key=>{
    let previous=null;
    return data.map(d=>{
      if(d[key]==null){previous=null;return '';}
      const gap=previous?(parseDate(d.date)-parseDate(previous.date))/86400000:Infinity;
      const command=gap>3?'M':'L';previous=d;
      return `${command} ${x(d.date).toFixed(1)} ${y(d[key]).toFixed(1)}`;
    }).join(' ');
  };
  const ticks=Array.from({length:5},(_,i)=>addDays(start,Math.round(days*i/4)));
  const labels=[...new Set(ticks)].map((date,i,a)=>`<text x="${x(date)}" y="254" text-anchor="${i===0?'start':i===a.length-1?'end':'middle'}">${fmtShortDate(date)}</text>`).join('');
  let annotation='';
  if(goalVisible){
    const left=x(db.goal.start<start?start:db.goal.start), right=x(db.goal.end>end?end:db.goal.end);
    annotation=`<rect class="goal-interval" x="${left}" y="${Tp}" width="${Math.max(1,right-left)}" height="${plotBottom-Tp}"/><text class="goal-date-label" x="${left}" y="15">Goal</text>`;
    if(targetVisible)annotation+=`<line class="goal" x1="${left}" y1="${y(+db.goal.target)}" x2="${right}" y2="${y(+db.goal.target)}"/>`;
  }
  let projection='';
  if(ready){
    const points=Array.from({length:horizon+1},(_,i)=>[x(addDays(last.date,i)),y(forecast.forecastValue(i))]);
    projection=`<path class="forecast" d="${smoothSvgPath(points)}"/>`;
  }
  const circles=data.map(d=>`<circle class="point" cx="${x(d.date)}" cy="${y(d.weight)}" r="2.3"/>`).join('');
  const hits=data.map((d,i)=>{
    const left=i===0?L:(x(data[i-1].date)+x(d.date))/2;
    const right=i===data.length-1?W-R:(x(d.date)+x(data[i+1].date))/2;
    return `<rect class="point-hit" data-chart-index="${i}" x="${left}" y="${Tp}" width="${Math.max(1,right-left)}" height="${axisY-Tp}" tabindex="0" role="button" aria-label="Show weight for ${fmtDate(d.date)}"/>`;
  }).join('');
  const marks=data.map(d=>contextMarkersSvg(d,x(d.date),215,8)).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Continuous weight history. Green points are measurements, pink is the 7-day average. Missing stretches are not connected."><text x="4" y="14" class="axis-unit">kg</text>${annotation}${grid}<line class="axis" x1="${L}" y1="${axisY}" x2="${W-R}" y2="${axisY}"/><path class="actual" d="${segmentPath('weight')}"/><path class="smooth" d="${segmentPath('avg')}"/>${projection}<line id="chartGuide" class="guide" x1="${x(last.date)}" y1="${Tp}" x2="${x(last.date)}" y2="${axisY}"/>${circles}${marks}${hits}${labels}</svg>${contextLegendHtml()}<div id="chartTip" class="tooltip" aria-live="polite">${chartTipHtml(last,false)}</div>`;
}

function chartTipHtml(d,showContext=true){
  if(!d) return '';
  const c=weightPointContext(d.date);
  const context=showContext&&c.prevDetails.length?`<span class="tip-context-inline">· ${fmtShortDate(c.prevDate)} logs · ${escapeHtml(c.prevDetails.join(' · '))}</span>`:'';
  const sleepContext=showContext&&c.sleepNotable?`<span class="tip-context-inline">· Last night sleep ${fmt(c.sleep)}h</span>`:'';
  return `<b>${fmtShortDate(d.date)}</b><span>${fmt(d.weight)} kg${d.avg==null?'':` · avg ${fmt(d.avg)}`}</span>${context}${sleepContext}`;
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
        if(e.met) met++; else if(e.recorded&&date<today()) missDates.push(date);
      }
      daily[id]={eligible,met,skipped,recorded,missDates,unknown:eligible-recorded,rate:recorded?met/recorded:null};
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
    if(m.eligible) behavior.push(`${TRACKER_DEFS[id].label}: ${m.met} of ${m.recorded} logged days · ${m.unknown} unknown`);
  }
  for(const [id,m] of Object.entries(metrics.weekly)){
    const unit=id==='cardio'?' min':id==='steps'||id==='strength'||id==='stretch'?'×':'';
    behavior.push(`${TRACKER_DEFS[id].label}: ${m.value}${unit} toward ${m.target}${unit}`);
  }
  const missed=Object.entries(metrics.daily).filter(([,m])=>m.recorded>=2&&m.rate!=null&&m.rate<.8).sort((a,b)=>a[1].rate-b[1].rate);
  let pattern='No clear multi-day execution pattern yet.';
  if(missed.length) pattern=`The main Goal behavior to watch is ${TRACKER_DEFS[missed[0][0]].label.toLowerCase()}; this is based on repeated Goal misses, not Bonus activity.`;
  else {
    const track=trackOnlyWeekSummaryText(db.goal);
    if(track) pattern=track;
  }
  const avgNow=trendStats(today()).value, avgPrev=trendStats(addDays(today(),-7)).value;
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
    if(!e.recorded) return 'unknown';
    if(date===today()) return 'today';
    return 'missed';
  }
  if(weeklyTrackerContribution(id,d,g)>0) return 'done';
  return 'weekly-neutral';
}
function trackerGridRow(g,id){
  const dates=weekDates();
  const cells=dates.map(date=>{const st=trackerWeekCellState(g,id,date);return `<span class="week-cell ${st}" title="${fmtShortDate(date)} · ${st==='done'?'done':st==='missed'?'not met':st==='unknown'?'not logged':st==='future'?'future':st==='skip'||st==='na'?'N/A':'weekly goal'}">${st==='skip'||st==='na'?'–':''}</span>`;}).join('');
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
    return eligible?`${met} / ${recorded} logged days · ${eligible-recorded} unknown${skipped?` · ${skipped} N/A`:''}`:'No eligible days yet';
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
    const ids=TRACKER_IDS.filter(id=>trackerRole(g,id)===role&&!(id==='stop6'&&g===db.goal));
    const rows=ids.map(id=>{const summary=goalTrackingSummary(g,id,through);return summary?`<div class="goal-record-row ${role}"><div><span>${escapeHtml(trackerRuleLabel(g,id,day(through)))}</span>${role!=='goal'?`<em>${label}</em>`:''}</div><b>${escapeHtml(summary)}</b></div>`:'';}).filter(Boolean);
    if(rows.length) blocks.push(`${role==='goal'?'<div class="goal-record-heading">Goal tracking · to date</div>':`<div class="goal-record-subheading">${label}</div>`}${rows.join('')}`);
  }
  return `<div class="goal-record">${blocks.join('')||'<div class="small">No tracker records yet.</div>'}</div>`;
}

function weeklyBehaviorProgress(g){
  const ids=TRACKER_IDS.filter(id=>trackerRole(g,id)==='goal'&&id!=='stop6');
  return `<div class="weekly-behavior"><div class="row between behavior-heading"><b>Goal tracking</b><span class="small">This week</span></div>${weekGridHeader()}${ids.map(id=>trackerGridRow(g,id)).join('')||'<div class="small">No goal trackers.</div>'}</div>`;
}

function roleEditorGroup(g,group){
  const ids=TRACKER_IDS.filter(id=>TRACKER_DEFS[id].group===group&&id!=='stop6');
  return `<div class="tracker-role-list">${ids.map(id=>{const role=trackerRole(g,id);return `<div class="tracker-role-row"><div><b>${id==='noSnack'?'No extra snacks':TRACKER_DEFS[id].label}</b><span>${TRACKER_DEFS[id].cadence==='daily'?'Daily':'Weekly'}</span></div><div class="role-segment">${['goal','bonus','track'].map(r=>`<button class="${role===r?'on':''}" data-tracker-role="${id}" data-role="${r}">${ROLE_LABELS[r]}</button>`).join('')}</div></div>`;}).join('')}</div>`;
}
function goalsPage(){
  const g=db.goal;
  return `${topbar('Goals')}${flashHtml()}${g.status==='idle'?nextStepChoices():`${todayGoalCard()}${localGoalReview(g)}<div class="goal-actions"><button class="btn secondary" data-action="editGoal">Edit goal</button><button class="btn ghost" data-review-goal="${escapeHtml(g.id)}">Review →</button></div><details class="card"><summary>Tracking details</summary>${goalTrackingRecord(g)}</details>`}<div class="section-title">Past goals</div><div class="goal-history-grid">${db.goals.length?db.goals.slice().reverse().map(goalHistoryItem).join(''):'<div class="small">No past goals.</div>'}</div>`;
}

function goalHistoryItem(g){
  const e=goalEvidence(g), theme=goalTheme(g);
  return `<button class="goal-history-tile tone-${theme.tone}" data-review-goal="${escapeHtml(g.id)}"><div class="history-status">${theme.symbol} ${theme.label}</div><b>${escapeHtml(g.name)}</b>${goalMiniChart(g)}<div class="history-foot"><span>${fmtShortDate(g.start)}–${fmtShortDate(g.ended||g.end)}</span><span>${e.last&&!e.stale&&!e.discrepancy?`${e.delta>0?'+':''}${fmt(e.delta)} kg`:'Review ›'}</span></div></button>`;
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
  return `${topbar('Edit goal','',`<button class="btn ghost" data-action="cancelGoalEdit">Cancel</button>`)}
    <section class="card"><label>Goal name</label><input id="goalName" value="${escapeHtml(g.name)}">${g.mode==='record'?'':`<div class="two"><label>${tr('start')} kg<input id="goalStartWeight" type="number" step="0.1" value="${activeGoalStartWeight()??''}"></label><label>${g.mode==='maintain'?'Maintenance weight':'Weight direction'} kg<input id="goalTarget" type="number" step="0.1" value="${g.target}"></label></div>`}<div class="two"><label>${tr('start')}<input id="goalStart" type="date" value="${g.start}"></label><label>Review date<input id="goalEnd" type="date" value="${g.end}"></label></div></section>
    <section class="card"><div class="actual-label">Diet targets</div>${planInputsFood()}<label class="effective-date-setting">Calendar scoring effective from<input id="goalEffectiveFrom" type="date" min="${today()}" value="${today()}"></label><div class="small plan-helper">Earlier Calendar days keep their original rules. Old records are never rewritten.</div></section>
    <section class="card"><div class="actual-label">Weekly exercise targets</div>${planInputsMove()}</section>
    <section class="card"><div class="row between"><div class="actual-label" style="margin:0">Diet trackers</div><span class="small">Role for this goal</span></div>${roleEditorGroup(g,'diet')}</section>
    <section class="card"><div class="row between"><div class="actual-label" style="margin:0">Exercise trackers</div><span class="small">Role for this goal</span></div>${roleEditorGroup(g,'exercise')}</section>
    <div class="edit-goal-actions">${goalEditSnapshot?.goal.status==='idle'?'':'<button class="btn end-archive-safe" data-action="requestArchiveGoal">End & review</button>'}<button class="btn sky" data-action="saveGoal">Save</button></div>
    <div class="archive-helper">Ending a goal requires a second confirmation. Your tracking history will be preserved.</div>`;
}
function planInputsFood(){return `<div class="two"><label>Vegetables ≥<input data-plan="veg" type="number" min="0" value="${db.plan.veg}"></label><label>Fruit ≤<input data-plan="fruit" type="number" min="0" value="${db.plan.fruit}"></label><label>Water ≥ L<input data-plan="water" type="number" min="0" step="0.1" value="${db.plan.water}"></label></div><p class="small">Planned evening food is allowed. Eating time is not scored.</p><button class="btn secondary" data-action="editEvening" data-evening-date="${today()}">Edit planned evening food</button><div class="small plan-helper">Bedtime hunger is a 1–5 observation, not a success score.</div>`;}

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
  saveGoalForm();
  db.goal.trackers=normalizeTrackers(db.goal,false);
  const oldGoal=JSON.parse(JSON.stringify(db.goal)),oldPlan={...db.plan};
  const prev=db.goal.trackers[id];
  // A role change must never wipe or hide previously entered tracker data.
  // Keep the tracker's existing activation date; new migrated trackers already start from their safe migration date.
  const activeFrom=prev.activeFrom||db.goal.start;
  db.goal.trackers[id]={role,activeFrom,roleAuto:false};
  recordCalendarRuleChange(oldGoal,oldPlan,calendarEffectiveDate());
  persist();render();
}


function findGoalById(id){
  if(db.goal?.id===id) return db.goal;
  return db.goals.find(g=>g.id===id)||null;
}
function goalAverageFor(g,date){ return trendStats(date).value; }

function goalReviewPack(g){
  const active=g===db.goal || !g.snapshot;
  const through=goalEvidence(g).through;
  const records=[];
  for(let s=g.start;s<=through;s=addDays(s,1)){
    const rec=day(s);
    const foodValues=Object.values(rec.food||{}).some(v=>v!==null&&v!=='');
    const exerciseValues=Object.values(rec.move||{}).some(v=>v!==null&&v!=='');
    const hasData=rec.weight!=null || rec.sleep!=null || rec.alcohol!=null || foodValues || exerciseValues || Object.values(rec.skips||{}).some(Boolean) || rec.events.length || rec.note;
    if(!hasData&&!rec.eveningFood&&rec.eveningOut==null) continue;
    records.push({date:s,weight:rec.weight,sevenDayAverage:goalAverageFor(g,s),lastNightSleepHours:rec.sleep,alcohol:rec.alcohol==null?null:(+rec.alcohol>=2?'2+':+rec.alcohol===1?'1':'none'),eveningFood:{plan:eveningPlanFor(s),status:rec.eveningFood,dinnerOut:rec.eveningOut},returnPlanned:!!returnFor(s),food:{extraSnacks:rec.food.extraSnacks,veg:rec.food.veg,protein:rec.food.protein,fruit:rec.food.fruit,noSnack:rec.food.noSnack,noFoodAfterCutoff:rec.food.stop6,waterLiters:rec.food.water,bedtimeHunger:rec.food.bedtimeHunger},exercise:{...rec.move},skipOrNA:{...rec.skips},lifeEvents:rec.events.map(eventLabel),note:rec.note||''});
  }
  const endWeight=active ? goalEvidence(g).last?.weight??null : g.endWeight??null;
  const startWeight=active ? activeGoalStartWeight() : +g.startWeight;
  const trackers=normalizeTrackers(g,!active);
  const trackerConfig=TRACKER_IDS.map(id=>({id,label:TRACKER_DEFS[id].label,group:TRACKER_DEFS[id].group,cadence:TRACKER_DEFS[id].cadence,role:trackers[id].role,activeFrom:trackers[id].activeFrom,target:trackerRuleLabel(g,id,day(through))}));
  return {
    READ_THIS_FIRST_FOR_CHATGPT:{
      task:'The user is uploading this exported Tide goal data for a Goal review. Follow these embedded instructions without asking the user to supply an additional prompt. Produce a useful review now.',
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
        'Before snackPolicy.effectiveFrom, noSnack=true means NO snacks and false means Had snacks. From that date use food.extraSnacks instead: true means extra snacks, false means no extra snacks. Planned evening food is allowed. Null/unlogged/N/A stays unknown. Never recommend compensation or skipping meals.',
        'Bedtime hunger 1=low and 5=very hungry. Do not praise high hunger, restrictive behavior or excessive exercise; prioritize sustainable practices.',
        'If this export includes sleep data, lastNightSleepHours on D is the night immediately before morning D. If not logged or irrelevant, do not discuss sleep.',
        'Period and other events are optional context. Note repeated associations as tentative, never claim a single event caused next-day weight change.',
        'Make 1-3 concrete observations supported by data and 1-3 practicable next actions; state important gaps in the summary if records are sparse.'
      ],
      inTide:'Open Goals → Goal review → Add review. Use Import review JSON if you saved the generated file, or paste the generated JSON, Preview review, then Save Review. Do not import the original goal-data export as a completed review.'
    },
    tideGoalReviewVersion:7,
    snackPolicy:{effectiveFrom:db.journey.effectiveFrom,meaning:'From this date food.extraSnacks is authoritative: true = extra snacks, false = no extra snacks, null = unknown. Planned evening food is allowed. Legacy noSnack and cutoff retain their original meanings. Cutoff is no longer scored.'},
    priorWeightContext:latestWeights(addDays(g.start,-1)).filter(r=>r.date>=addDays(g.start,-21)).map(r=>({date:r.date,weight:r.weight})),
    calendarRuleHistory:db.calendarRuleHistory.filter(r=>r.effectiveFrom<=through),
    datedEvidence:goalEvidence(g),
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
      'Bedtime hunger uses a 1-5 scale: 1 = low hunger and 5 = very hungry. Do not treat high hunger as success; use it as context for sustainability and whether the diet may be too aggressive.',
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
  const g=findGoalById(reviewGoalId); if(!g) return `${topbar('Goal review','',`<button class="btn ghost" data-action="backGoals">Done</button>`)}<div class="empty">Goal not found.</div>`;
  const active=g===db.goal || !g.snapshot, end=active?(goalEvidence(g).last?.weight??null):(g.endWeight??null), start=active?activeGoalStartWeight():+g.startWeight;
  const status=active?journeyGoalState(g):goalEvidence(g).outcome;
  const rows=normalizeReviews(g).slice().reverse();
  const latest=rows[0]||null;
  const older=rows.slice(1);
  const draft=reviewDraft?.goalId===g.id?reviewDraft:null;
  const composer=reviewComposerOpen;
  return `${topbar('Goal review','',`<button class="btn ghost" data-action="backGoals">Done</button>`)}
    ${flashHtml()}
    <section class="card review-heading"><b>${escapeHtml(g.name)}</b><span class="small">${fmtShortDate(g.start)}–${fmtShortDate(active?g.end:(g.ended||g.end))}</span></section>
    ${localGoalReview(g)}${active&&g.status!=='idle'?'<button class="btn secondary full" data-action="requestArchiveGoal">Finish goal</button>':''}${db.goal.status==='idle'?nextStepChoices():''}
    ${latest?`<details class="card latest-review-card"><summary>Saved review · ${fmtShortDate(latest.date)}</summary>${fullReviewHtml(latest)}</details>`:''}
    ${!composer?`<button class="btn secondary full review-add-button" data-action="openReviewComposer">Add review</button>`:''}
    ${composer?`<section class="card review-composer"><div class="row between"><div class="actual-label" style="margin:0">Add review</div><button class="review-inline-link review-cancel-inline" data-action="closeReviewComposer">Cancel</button></div><p class="small review-copy"><b>1.</b> Export goal data and upload the file to ChatGPT. The file already contains the complete review instructions and Tide import format—no extra prompt needed. <b>2.</b> Import the resulting review JSON file or paste the JSON below. <b>3.</b> Preview, then Save.</p><div class="review-actions"><button class="btn secondary" data-action="exportReviewGoal">Export Goal Data + Instructions</button><label class="btn secondary file-btn">Import review JSON<input id="reviewImportFile" type="file" accept=".json,application/json" hidden></label></div><label class="review-paste-label">Or paste ChatGPT JSON<textarea id="reviewPaste" rows="7" placeholder='{"goalId":"COPY_EXACT_GOAL_ID","preview":"...","review":{"summary":"...","learnings":["..."],"next":["..."]}}'>${escapeHtml(draft?.rawText||'')}</textarea></label><button class="btn secondary full" data-action="previewGoalReview">Preview review</button></section>`:''}
    ${draft&&composer?`<section class="card review-preview"><div class="row between"><div class="actual-label" style="margin:0">Ready to save</div><span class="small">Review the result first</span></div>${draft.checkpoint.preview?`<div class="draft-preview-summary"><span>Goals preview</span><p>${escapeHtml(draft.checkpoint.preview)}</p></div>`:''}<div class="full-review-label">Full review</div>${fullReviewHtml(draft.checkpoint)}<button class="btn sky full review-save-final" data-action="saveGoalReviewDraft">Save Review</button></section>`:''}
    ${older.length?`<div class="section-title">Earlier reviews</div><section class="card review-history">${older.map(checkpointHtml).join('')}</section>`:''}
    `;
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
    </section><div class="small chart-footnote">Snacks dot = Had snacks explicitly recorded the previous day. No snacks, Not logged and N/A do not trigger it. Eating out does not mean “ate more.” Period is optional context, not a weight correction or proof of causation.</div>`;
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
  return `${topbar('Default Plan','',`<button class="btn sky save-top" data-action="savePlan">${tr('save')}</button>`)}<section class="card"><div class="actual-label">Food goals</div>${planInputsFood()}<label class="effective-date-setting">Calendar scoring effective from<input id="planEffectiveFrom" type="date" min="${today()}" value="${today()}"></label><div class="small plan-helper">Earlier Calendar days keep their original rules.</div></section><section class="card"><div class="actual-label">Weekly exercise goals</div>${planInputsMove()}</section><button class="btn sky full" data-action="savePlanBottom">${tr('done')}</button>`;
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
function setNoSnack(value){const d=day(view==='day'?selected:today());const v=value==='null'?null:value==='true';if(usesEveningPlan(d.date)){d.food.extraSnacks=v==null?null:!v;snapshotEveningPlan(d);}else d.food.noSnack=v;d.skips.noSnack=false;save();}
function toggleFood(key){ const d=day(view==='day'?selected:today()); d.food[key]=d.food[key]===true?false:true; d.skips[key]=false; save(); }
function toggleMove(key){ const d=day(view==='day'?selected:today()); d.move[key]=d.move[key]===true?false:true; d.skips[key]=false; save(); }
function toggleSkip(id){ const d=day(view==='day'?selected:today()); d.skips[id]=!d.skips[id]; save(); }
function toggleCustom(key){ const d=day(selected); if(key==='allowSnack') d.customPlan.noSnack=d.customPlan.noSnack===false?true:false; else d.customPlan[key]=d.customPlan[key]===true?false:true; save(); }
function togglePlannedMove(key){ const d=day(selected); d.plannedMove[key]=d.plannedMove[key]===true?false:true; save(); }
function toggleEvent(e){ const d=day(selected); d.events=d.events.includes(e)?d.events.filter(x=>x!==e):[...d.events,e]; save(); }
function cycleAlcohol(){ const d=day(selected),v=d.alcohol==null?0:+d.alcohol; d.alcohol=v<=0?1:v===1?2:null; save(); }
function shiftMonth(n){ const d=parseDate(calendarMonth); d.setMonth(d.getMonth()+n); calendarMonth=iso(new Date(d.getFullYear(),d.getMonth(),1,12)); selected=calendarMonth; render(); }
function saveGoalForm(){
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
    db.goal.startWeight=+entered;
  }
  saveInputsFromDOM(false);
  recordCalendarRuleChange(beforeGoal,beforePlan,effectiveFrom);
}
function archiveGoal(){
  if(db.goal.status==='idle') return;
  saveGoalForm();
  const oldGoal=JSON.parse(JSON.stringify(db.goal)), oldPlan={...db.plan}, e=goalEvidence(db.goal);
  const snapshot={...db.goal,trackers:normalizeTrackers(db.goal),reviews:normalizeReviews(db.goal),planSnapshot:{...db.plan},ended:e.through,archivedAt:new Date().toISOString(),endWeight:e.last?.weight??null,endWeightDate:e.last?.date??null,snapshot:true,schemaVersion:SCHEMA_VERSION};
  snapshot.resultStatus=goalStatus(snapshot,snapshot.endWeight);
  db.goals.push(snapshot);
  db.goal={...db.goal,id:newGoalId(),status:'idle',start:today(),end:addDays(today(),28),reviews:[],review:blankReview()};
  recordCalendarRuleChange(oldGoal,oldPlan,today());
  goalEditSnapshot=null;reviewGoalId=snapshot.id;view='goalReview';save('Chapter saved. Your history continues.');
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
      <div class="archive-confirm-copy">This freezes the current goal and its tracking record, then lets you choose your next step. Nothing you logged will be deleted.</div>
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
    if(handleJourneyAction(a,b)) return;
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
    if(a==='editGoal'){beginGoalEdit();view='goalEdit';render();}
    if(a==='saveGoal'){if(!validateGoalForm())return;saveGoalForm();finishGoalEdit();view='goals';save(tr('saved'));}
    if(a==='requestArchiveGoal'){if(view==='goalEdit'&&!validateGoalForm())return;saveGoalForm();archiveConfirmOpen=true;render();}
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
  document.querySelectorAll('[data-toggle-move]').forEach(b=>b.addEventListener('click',()=>toggleMove(b.dataset.toggleMove)));
  document.querySelectorAll('[data-toggle-skip]').forEach(b=>b.addEventListener('click',()=>toggleSkip(b.dataset.toggleSkip)));
  document.querySelectorAll('[data-tracker-role]').forEach(b=>b.addEventListener('click',()=>setTrackerRole(b.dataset.trackerRole,b.dataset.role)));
  document.querySelectorAll('[data-toggle-custom]').forEach(b=>b.addEventListener('click',()=>toggleCustom(b.dataset.toggleCustom)));
  document.querySelectorAll('[data-toggle-planned-move]').forEach(b=>b.addEventListener('click',()=>togglePlannedMove(b.dataset.togglePlannedMove)));
  document.querySelectorAll('[data-date]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.date;render();}));
  document.querySelectorAll('[data-month]').forEach(b=>b.addEventListener('click',()=>shiftMonth(+b.dataset.month)));
  document.querySelectorAll('[data-event]').forEach(b=>b.addEventListener('click',()=>toggleEvent(b.dataset.event)));
  document.querySelectorAll('[data-chart-category]').forEach(b=>b.addEventListener('click',()=>toggleChartCategory(b.dataset.chartCategory)));
  document.querySelectorAll('[data-chart-source]').forEach(b=>b.addEventListener('change',()=>toggleChartSource(b.dataset.chartSource,b.dataset.sourceId,b.checked)));
  document.querySelectorAll('[data-hunger-min]').forEach(b=>b.addEventListener('click',()=>{db.chartSettings.hungerMin=+b.dataset.hungerMin;save();}));
  document.querySelectorAll('[data-custom-category]').forEach(el=>el.addEventListener('change',()=>changeCustomCategory(el.dataset.customCategory,el.value)));
  document.querySelectorAll('[data-archive-event]').forEach(b=>b.addEventListener('click',()=>{removeCustomId=b.dataset.archiveEvent;render();}));
  document.querySelectorAll('[data-restore-event]').forEach(b=>b.addEventListener('click',()=>restoreCustomEvent(b.dataset.restoreEvent)));
  document.querySelectorAll('[data-cycle-alcohol]').forEach(b=>b.addEventListener('click',cycleAlcohol));
  document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=b.dataset.range;render();}));
  document.querySelectorAll('[data-day-field]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
  document.querySelectorAll('[data-plan]').forEach(el=>el.addEventListener('change',()=>{saveInputsFromDOM();persist();}));
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
  else if(view==='eveningEdit')content=eveningEditPage();
  lastRenderDate=today();
  document.getElementById('app').innerHTML=`<main class="shell">${content}${['today','calendar','change','goals','settings'].includes(view)?nav():''}</main>${quickWeightModal()}${archiveGoalModal()}${customRemoveModal()}`;
  bind();
  document.querySelector('.weight-modal')?.addEventListener('click',e=>e.stopPropagation());
  document.querySelector('.archive-confirm-modal')?.addEventListener('click',e=>e.stopPropagation());
  document.querySelector('.custom-confirm')?.addEventListener('click',e=>e.stopPropagation());
  const q=document.getElementById('quickWeightInput'); if(q) q.addEventListener('keydown',e=>{if(e.key==='Enter')document.querySelector('[data-action=\"saveQuickWeight\"]')?.click();});
}

document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden'){ thoughtHiddenAt=Date.now(); return; }
  if(lastRenderDate!==today()){dailyThought=chooseDailyThought();render();return;}
  if(thoughtHiddenAt && Date.now()-thoughtHiddenAt>=10*60*1000){ dailyThought=chooseDailyThought(); thoughtHiddenAt=0; if(view==='today') render(); }
});
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('dblclick',e=>e.preventDefault(),{passive:false});
if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').then(r=>r.update()).catch(()=>{}); }
persist();
render();
