import { useState, useEffect, useRef, useCallback } from "react";

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const MEMBERS = ["Gift","Nun","Off","Nutt","Tanny","Donut"];
const PINS = {Gift:"4827",Nun:"7391",Off:"2658",Nutt:"9143",Tanny:"5076",Donut:"8412",Admin:"3759"};
const CATEGORIES = ["","Beauty & Skincare","Health & Wellness","Food & Beverage","Fashion & Accessories","Home & Living","Tech & Gadgets","Sports & Outdoors","Baby & Kids","Pet Products","Other"];
const VIABILITY = ["","🔥 สูงมาก (High)","⚡ ปานกลาง (Medium)","🌱 เริ่มต้น (Early Stage)"];
const AFFILIATE_STATUS = ["","✅ มี Program แล้ว","📩 ต้องติดต่อเอง","❓ ยังไม่แน่ใจ"];
const TARGET_MARKETS = ["ผู้หญิง (Women)","ผู้ชาย (Men)","เด็ก (Kids)","ผู้สูงอายุ (Elderly)","B2B","ทุกเพศ (All)"];
const RULES = [
  {num:"01",th:"สมาชิกแต่ละคนต้องเสนอสินค้า 3 รายการที่คิดว่ามีศักยภาพในตลาดไทยและต่างประเทศ",en:"Each member nominates 3 products with sales potential in Thai & intl markets."},
  {num:"02",th:"ห้ามเปิดเผยสินค้าที่ตัวเองเลือกให้สมาชิกคนอื่นทราบก่อนการโหวต เพื่อความยุติธรรม",en:"Keep your picks secret until voting opens."},
  {num:"03",th:"กรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมาย * เพื่อให้ข้อมูลสมบูรณ์และน่าเชื่อถือ",en:"Fill in all required fields marked with *."},
  {num:"04",th:"สินค้าที่เสนอควรทำ Affiliate ได้จริง และมีลิงก์หรือเว็บไซต์อ้างอิงประกอบ",en:"Products must be viable for affiliate marketing with a reference link."},
  {num:"05",th:"ใส่เหตุผลให้ชัดเจนและเป็นรูปธรรมที่สุด ยิ่งชัดยิ่งดี",en:"Explain why this product has potential — be specific."},
  {num:"06",th:"กด 'บันทึก' ทุกครั้งหลังกรอกเสร็จ ข้อมูลจะเซฟอัตโนมัติ",en:"Press Save after filling in each product."},
  {num:"07",th:"หน้าโหวตจะเปิดเมื่อ Admin เปิดระบบ — ห้ามโหวตก่อน",en:"Voting opens when Admin unlocks it."},
  {num:"08",th:"โหวตได้ไม่จำกัด และโหวตให้สินค้าของตัวเองได้ ผลสะท้อนความเห็นกลุ่ม",en:"Vote freely with no limits, including your own picks."},
];

// ── API ──────────────────────────────────────────────────────────────────────
const API = "/api/db";
const RETRY = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function dbGet(key) {
  for (let i = 0; i < RETRY; i++) {
    try {
      const r = await fetch(`${API}?key=${encodeURIComponent(key)}`);
      const j = await r.json();
      return j.ok && j.value != null ? JSON.parse(j.value) : null;
    } catch { if (i === RETRY-1) return null; await sleep(400*(i+1)); }
  }
}

async function dbSet(key, value) {
  for (let i = 0; i < RETRY; i++) {
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: JSON.stringify(value) }),
      });
      const j = await r.json();
      if (j.ok) return true;
    } catch {}
    if (i < RETRY-1) await sleep(600*(i+1));
  }
  return false;
}

// ── DATA HELPERS ─────────────────────────────────────────────────────────────
const emptyProduct = () => ({ name:"", category:"", priceRange:"", targetMarkets:[], websiteLink:"", affiliateLink:"", competitor:"", imageUrl:"", imageUrl2:"", imageUrl3:"", whySell:"", thaiMarket:"", intlMarket:"", affiliateStatus:"", viability:"" });
const defaultMeta = () => ({ votingOpen:false, votingRevealed:false, activeMembers:Object.fromEntries(MEMBERS.map(m=>[m,true])), votes:{} });

function migrateProduct(p) {
  if (!p) return emptyProduct();
  const targetMarkets = p.targetMarkets?.length>0 ? p.targetMarkets : p.targetMarket ? [p.targetMarket] : [];
  return { ...emptyProduct(), ...p, targetMarkets, imageUrl2:p.imageUrl2||"", imageUrl3:p.imageUrl3||"" };
}

// ── RESPONSIVE ───────────────────────────────────────────────────────────────
function useW() {
  const [w,setW] = useState(window.innerWidth);
  useEffect(()=>{ const f=()=>setW(window.innerWidth); window.addEventListener("resize",f); return()=>window.removeEventListener("resize",f); },[]);
  return w;
}

// ── PALETTE ──────────────────────────────────────────────────────────────────
const C = { bg:"#F9F8F5", card:"#FFFFFF", dark:"#18181A", charcoal:"#2C2C2E", rg:"#B76E79", rgL:"#F7EAEC", rgM:"#D4959E", muted:"#98989E", border:"#E9E4DE", soft:"#F3F0EB", ok:"#3A9E72", err:"#C0392B", text:"#18181A", sub:"#6B6B70" };
const inp = (big) => ({ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:16, background:C.card, padding:big?"14px 16px":"12px 14px", fontFamily:"inherit", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none" });
const ghost = () => ({ padding:"8px 14px", border:`1.5px solid ${C.border}`, borderRadius:8, background:"transparent", cursor:"pointer", fontFamily:"inherit", fontSize:13, color:C.sub, WebkitTapHighlightColor:"transparent" });
const prime = (full) => ({ width:full?"100%":"auto", padding:"14px 28px", background:C.rg, color:"#fff", border:"none", borderRadius:10, fontSize:15, fontWeight:500, cursor:"pointer", fontFamily:"inherit", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" });

function Logo({ size=18, light=false }) {
  const c=light?"#fff":C.rg, cl=light?"rgba(255,255,255,.25)":C.rgL;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <svg width={size+6} height={size+6} viewBox="0 0 30 30" fill="none">
        <circle cx="13" cy="13" r="9.5" stroke={c} strokeWidth="2"/>
        <circle cx="13" cy="13" r="4" fill={cl} stroke={light?"rgba(255,255,255,.6)":C.rgM} strokeWidth="1.5"/>
        <line x1="20" y1="20" x2="27" y2="27" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <span style={{fontFamily:"'Libre Baskerville',serif",fontSize:size,fontWeight:700,color:light?"#fff":C.dark,letterSpacing:-.3}}>
        Product <em style={{color:light?"rgba(255,255,255,.65)":C.rg,fontStyle:"italic"}}>Scout</em>
      </span>
    </div>
  );
}

function SyncBar({ synced, lastSaved, fmtTime, refreshing, onRefresh }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.muted}}>
      {lastSaved && <span style={{whiteSpace:"nowrap"}}>{synced?"☁️":"💾"} {fmtTime(lastSaved)}</span>}
      <button onClick={onRefresh} style={{background:"none",border:"none",cursor:"pointer",padding:4,color:C.muted,fontSize:15,WebkitTapHighlightColor:"transparent"}}>
        <span style={{display:"inline-block",animation:refreshing?"spin 1s linear infinite":"none"}}>↻</span>
      </button>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]           = useState("login");
  const [user, setUser]               = useState(null);
  const [meta, setMeta]               = useState(null);
  const [nominations, setNominations] = useState({});
  const [ready, setReady]             = useState(false);
  const [synced, setSynced]           = useState(false);
  const [lastSaved, setLastSaved]     = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const [activeProd, setActiveProd]   = useState(0);
  const [localProds, setLocalProds]   = useState([emptyProduct(),emptyProduct(),emptyProduct()]);
  const [localVotes, setLocalVotes]   = useState({});
  const [loginName, setLoginName]     = useState("");
  const [loginPin, setLoginPin]       = useState("");
  const [loginErr, setLoginErr]       = useState("");
  const [saveMsg, setSaveMsg]         = useState("");
  const userRef   = useRef(null);
  const screenRef = useRef("login");
  const timerRef  = useRef(null);

  const fmtTime = iso => { try { return new Date(iso).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };

  // Load meta + all nominations separately
  const loadAll = useCallback(async () => {
    const [m, ...noms] = await Promise.all([
      dbGet("meta"),
      ...MEMBERS.map(m => dbGet(`nom_${m}`))
    ]);
    const newMeta = m ? { ...defaultMeta(), ...m } : defaultMeta();
    const newNoms = {};
    MEMBERS.forEach((name,i) => {
      newNoms[name] = noms[i] ? noms[i].map(migrateProduct) : [emptyProduct(),emptyProduct(),emptyProduct()];
    });
    setMeta(newMeta);
    setNominations(newNoms);
    setSynced(true);
    setLastSaved(new Date().toISOString());
    return { meta: newMeta, nominations: newNoms };
  }, []);

  useEffect(() => { loadAll().then(() => setReady(true)); }, []);

  // Auto-refresh every 20s except when editing form
  useEffect(() => {
    if (!ready) return;
    timerRef.current = setInterval(() => {
      if (userRef.current && screenRef.current !== "form") loadAll();
    }, 20000);
    return () => clearInterval(timerRef.current);
  }, [ready]);

  useEffect(() => { screenRef.current = screen; }, [screen]);

  const manualRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const doLogin = () => {
    if (!loginName) { setLoginErr("กรุณาเลือกชื่อของคุณ"); return; }
    if (loginPin !== PINS[loginName]) { setLoginErr("PIN ไม่ถูกต้อง"); return; }
    setLoginErr(""); setUser(loginName); userRef.current = loginName;
    if (loginName === "Admin") { setScreen("admin"); return; }
    const ex = nominations[loginName];
    if (ex) setLocalProds(ex.map(migrateProduct));
    setLocalVotes(meta?.votes?.[loginName] || {});
    setScreen("rules");
  };

  // Save ONLY this user's nominations — no race condition
  const doSave = async () => {
    setSaveMsg("saving");
    const ok = await dbSet(`nom_${user}`, localProds);
    // Also update nominations in local state
    setNominations(prev => ({ ...prev, [user]: localProds }));
    setSaveMsg(ok ? "ok" : "err");
    if (ok) setSynced(true);
  };

  // Save ONLY this user's votes inside meta.votes
  const doVote = async (key) => {
    const nv = { ...localVotes, [key]: (localVotes[key]||0)+1 };
    setLocalVotes(nv);
    const newMeta = { ...meta, votes: { ...meta.votes, [user]: nv } };
    setMeta(newMeta);
    await dbSet("meta", newMeta);
  };
  const doUnvote = async (key) => {
    const nv = { ...localVotes };
    if (!nv[key]) return;
    nv[key]--; if (nv[key] <= 0) delete nv[key];
    setLocalVotes(nv);
    const newMeta = { ...meta, votes: { ...meta.votes, [user]: nv } };
    setMeta(newMeta);
    await dbSet("meta", newMeta);
  };

  const saveMeta = async (newMeta) => { setMeta(newMeta); await dbSet("meta", newMeta); };

  const logout = () => {
    setUser(null); userRef.current=null;
    setLoginPin(""); setLoginName(""); setLoginErr(""); setSaveMsg("");
    setScreen("login");
  };
  const switchTab = i => { setActiveProd(i); setSaveMsg(""); };

  if (!ready) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:16,fontFamily:"'DM Sans',sans-serif"}}>
      <Logo size={22}/>
      <div style={{fontSize:13,color:C.muted}}>กำลังเชื่อมต่อ...</div>
      <div style={{display:"flex",gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.rg,animation:`pulse 1s ease ${i*.2}s infinite alternate`}}/>)}</div>
    </div>
  );

  const active   = meta?.activeMembers || Object.fromEntries(MEMBERS.map(m=>[m,true]));
  const allVotes = {};
  Object.values(meta?.votes||{}).forEach(mv => Object.entries(mv).forEach(([k,v]) => { allVotes[k]=(allVotes[k]||0)+v; }));
  const completed = MEMBERS.filter(m => active[m] && (nominations[m]||[]).filter(p=>p?.name?.trim()).length===3);
  const allProds  = MEMBERS.filter(m=>active[m]).flatMap(m=>(nominations[m]||[]).map((p,i)=>p?.name?.trim()?{...p,member:m,key:`${m}_${i}`}:null).filter(Boolean));

  const shared = { user, meta, nominations, active, completed, allProds, allVotes, localProds, setLocalProds, activeProd, switchTab, localVotes, doVote, doUnvote, doSave, saveMsg, setSaveMsg, saveMeta, loginName, setLoginName, loginPin, setLoginPin, loginErr, doLogin, synced, lastSaved, fmtTime, refreshing, manualRefresh, logout, go: s => setScreen(s) };

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Sans',sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{-webkit-text-size-adjust:100%;}
        input,select,textarea{font-size:16px!important;-webkit-appearance:none;appearance:none;font-family:inherit;}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${C.rg}!important;box-shadow:0 0 0 3px ${C.rgL};}
        ::placeholder{color:#C5C0BA;}
        button{-webkit-tap-highlight-color:transparent;touch-action:manipulation;font-family:inherit;}
        textarea{resize:vertical;}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{from{opacity:.3}to{opacity:1}}
        .fade{animation:fi .3s ease;}
        select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%2398989E' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px!important;}
        @media(max-width:639px){.grid2{grid-template-columns:1fr!important;}.grid3{grid-template-columns:1fr 1fr!important;}.hide-mob{display:none!important;}.login-split{grid-template-columns:1fr!important;}}
        @media(min-width:640px)and(max-width:1023px){.grid3{grid-template-columns:1fr 1fr!important;}}
      `}</style>
      {screen==="login" && <Login {...shared}/>}
      {screen==="rules" && <Rules {...shared}/>}
      {screen==="form"  && <Form  {...shared}/>}
      {screen==="admin" && <Admin {...shared}/>}
      {screen==="vote"  && <Vote  {...shared}/>}
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function Login({ loginName,setLoginName,loginPin,setLoginPin,loginErr,doLogin,completed,synced,lastSaved,fmtTime,refreshing,manualRefresh }) {
  const w = useW(); const mob = w<640;
  return (
    <div className="login-split" style={{minHeight:"100vh",display:"grid",gridTemplateColumns:"1fr 1fr"}}>
      <div className="hide-mob" style={{background:`linear-gradient(150deg,${C.charcoal},#111)`,display:"flex",flexDirection:"column",justifyContent:"space-between",padding:"48px 52px"}}>
        <Logo size={17} light/>
        <div>
          <div style={{fontSize:10,letterSpacing:5,color:C.rgM,textTransform:"uppercase",marginBottom:14}}>Thai Market · Affiliate Scout</div>
          <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:34,color:"#fff",lineHeight:1.25,marginBottom:18}}>ค้นหาสินค้า<br/>พระเอกของเรา</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.4)",lineHeight:1.8,maxWidth:300}}>A private platform to discover, evaluate, and vote on the most promising affiliate products.</div>
        </div>
        <div>
          <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:10}}>
            {MEMBERS.map(m=><span key={m} style={{fontSize:11,padding:"3px 11px",borderRadius:20,background:completed.includes(m)?"rgba(183,110,121,.25)":"rgba(255,255,255,.06)",color:completed.includes(m)?C.rgM:"rgba(255,255,255,.3)",border:`1px solid ${completed.includes(m)?"rgba(183,110,121,.35)":"rgba(255,255,255,.08)"}`}}>{m}{completed.includes(m)?" ✓":""}</span>)}
            <span style={{fontSize:11,color:"rgba(255,255,255,.2)"}}>{completed.length}/6</span>
          </div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",gap:6}}>
            {lastSaved&&<span>{synced?"☁️":"💾"} {fmtTime(lastSaved)}</span>}
            <button onClick={manualRefresh} style={{background:"none",border:"none",color:"rgba(255,255,255,.3)",fontSize:15,cursor:"pointer",padding:4}}><span style={{display:"inline-block",animation:refreshing?"spin 1s linear infinite":"none"}}>↻</span></button>
          </div>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:mob?"24px 20px":"48px",background:C.bg,minHeight:"100vh"}}>
        <div className="fade" style={{width:"100%",maxWidth:360}}>
          {mob&&<div style={{textAlign:"center",marginBottom:28}}><Logo size={20}/><div style={{marginTop:12,display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}}>{MEMBERS.map(m=><span key={m} style={{fontSize:10,padding:"2px 9px",borderRadius:20,background:completed.includes(m)?C.rgL:C.soft,color:completed.includes(m)?C.rg:C.muted,border:`1px solid ${completed.includes(m)?C.rgM:C.border}`}}>{m}{completed.includes(m)?" ✓":""}</span>)}</div></div>}
          <div style={{marginBottom:28}}><div style={{fontFamily:"'Libre Baskerville',serif",fontSize:22,fontWeight:700,color:C.dark,marginBottom:5}}>Welcome back</div><div style={{fontSize:14,color:C.muted}}>เลือกชื่อและใส่ PIN เพื่อเข้าสู่ระบบ</div></div>
          <div style={{marginBottom:16}}>
            <FL>ชื่อของคุณ / Your Name</FL>
            <select value={loginName} onChange={e=>setLoginName(e.target.value)} style={inp()}>
              <option value="">— เลือกชื่อ —</option>
              {MEMBERS.map(m=><option key={m} value={m}>{m}{completed.includes(m)?" ✓":""}</option>)}
              <option value="Admin">🔑 Admin</option>
            </select>
          </div>
          <div style={{marginBottom:22}}>
            <FL>PIN Code</FL>
            <input type="password" inputMode="numeric" maxLength={4} value={loginPin} onChange={e=>setLoginPin(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doLogin()} placeholder="• • • •" style={{...inp(),fontSize:24,letterSpacing:14,textAlign:"center"}}/>
          </div>
          {loginErr&&<div style={{background:"#FDF0EF",border:`1.5px solid ${C.err}`,borderRadius:8,padding:"10px 14px",marginBottom:14,fontSize:14,color:C.err}}>{loginErr}</div>}
          <button onClick={doLogin} style={prime(true)}>เข้าสู่ระบบ →</button>
          <div style={{marginTop:16,padding:"12px 16px",background:C.soft,borderRadius:9,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:12,color:C.muted,lineHeight:1.7}}>PIN ของคุณถูกส่งให้โดย Admin เป็นการส่วนตัว<br/>หากลืม PIN กรุณาติดต่อ Donut</div>
          </div>
          <div style={{marginTop:12,display:"flex",justifyContent:"center"}}><SyncBar synced={synced} lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} onRefresh={manualRefresh}/></div>
        </div>
      </div>
    </div>
  );
}

// ── RULES ─────────────────────────────────────────────────────────────────────
function Rules({ user, go }) {
  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px 16px",background:C.bg}}>
      <div className="fade" style={{width:"100%",maxWidth:620}}>
        <div style={{textAlign:"center",marginBottom:24}}><Logo size={17}/><div style={{marginTop:18,fontFamily:"'Libre Baskerville',serif",fontSize:24,fontWeight:700,color:C.dark}}>สวัสดี {user} 👋</div><div style={{fontSize:13,color:C.muted,marginTop:5}}>กรุณาอ่านกฎก่อนเริ่มกรอกข้อมูล</div></div>
        <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",boxShadow:"0 4px 28px rgba(0,0,0,0.06)",marginBottom:16}}>
          <div style={{background:`linear-gradient(135deg,${C.charcoal},#111)`,padding:"16px 22px",display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:30,height:30,borderRadius:7,background:"rgba(183,110,121,.2)",border:"1px solid rgba(183,110,121,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0}}>📋</div>
            <div><div style={{fontFamily:"'Libre Baskerville',serif",fontSize:15,color:"#fff",fontWeight:700}}>กฎและวิธีการกรอกข้อมูล</div><div style={{fontSize:10,color:"rgba(255,255,255,.35)"}}>Rules & Guidelines</div></div>
          </div>
          <div style={{padding:"4px 0"}}>
            {RULES.map((r,i)=>(
              <div key={r.num} style={{display:"flex",gap:12,padding:"13px 20px",borderBottom:i<RULES.length-1?`1px solid ${C.border}`:"none"}}>
                <div style={{flexShrink:0,width:24,height:24,borderRadius:6,background:C.rgL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.rg}}>{r.num}</div>
                <div><div style={{fontSize:13,fontWeight:500,color:C.dark,marginBottom:2,lineHeight:1.5}}>{r.th}</div><div style={{fontSize:11,color:C.muted,lineHeight:1.5}}>{r.en}</div></div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={()=>go("form")} style={prime(true)}>เข้าใจแล้ว — เริ่มกรอกข้อมูล →</button>
      </div>
    </div>
  );
}

// ── FORM ─────────────────────────────────────────────────────────────────────
function Form({ user, meta, localProds, setLocalProds, activeProd, switchTab, doSave, saveMsg, setSaveMsg, synced, lastSaved, fmtTime, refreshing, manualRefresh, go, logout }) {
  const w=useW(); const mob=w<640;
  const [showRules,setShowRules]=useState(false);
  const filled=localProds.filter(p=>p.name.trim()).length;
  const p=localProds[activeProd];
  const upd=(f,v)=>setLocalProds(prev=>prev.map((x,i)=>i===activeProd?{...x,[f]:v}:x));
  const toggleMkt=(m)=>{ const cur=p.targetMarkets||[]; upd("targetMarkets",cur.includes(m)?cur.filter(x=>x!==m):[...cur,m]); };
  const imgs=[{f:"imageUrl",label:"🖼 รูปภาพหลัก",sub:"Main"},{f:"imageUrl2",label:"🖼 รูปภาพที่ 2",sub:"Optional"},{f:"imageUrl3",label:"🖼 รูปภาพที่ 3",sub:"Optional"}];
  const px=mob?"16px":"26px";

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:C.bg}}>
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:`0 ${px}`,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20,gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <Logo size={mob?13:14}/>
          {!mob&&<><div style={{width:1,height:18,background:C.border,flexShrink:0}}/><span style={{fontSize:12,color:C.muted,whiteSpace:"nowrap"}}><span style={{color:C.rg,fontWeight:500}}>{user}</span> · {filled}/3</span></>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <SyncBar synced={synced} lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} onRefresh={manualRefresh}/>
          {meta?.votingOpen&&<button onClick={()=>go("vote")} style={{...ghost(),color:C.ok,borderColor:C.ok,fontSize:12}}>🗳️</button>}
          <button onClick={()=>setShowRules(s=>!s)} style={{...ghost(),fontSize:12}}>📋</button>
          <button onClick={logout} style={{...ghost(),fontSize:12}}>{mob?"✕":"ออก"}</button>
        </div>
      </div>

      {mob&&<div style={{background:C.soft,padding:"7px 16px",fontSize:12,color:C.muted,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span><span style={{color:C.rg,fontWeight:500}}>{user}</span> · {filled}/3 สินค้า</span>{meta?.votingOpen&&<button onClick={()=>go("vote")} style={{...ghost(),color:C.ok,borderColor:C.ok,fontSize:11}}>🗳️ โหวต!</button>}</div>}

      {showRules&&<div style={{background:C.rgL,borderBottom:`1px solid #EDD0D5`,padding:`12px ${px}`}}>{RULES.map(r=><div key={r.num} style={{display:"flex",gap:8,marginBottom:6,fontSize:12}}><span style={{color:C.rg,fontWeight:700,flexShrink:0}}>{r.num}.</span><span style={{color:C.charcoal,lineHeight:1.5}}>{r.th}</span></div>)}</div>}

      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:`0 ${mob?"8px":px}`,display:"flex"}}>
        {["สินค้าที่ 1","สินค้าที่ 2","สินค้าที่ 3"].map((t,i)=>(
          <button key={i} onClick={()=>switchTab(i)} style={{flex:mob?1:undefined,padding:mob?"12px 8px":"14px 20px",border:"none",background:"transparent",borderBottom:activeProd===i?`2px solid ${C.rg}`:"2px solid transparent",color:activeProd===i?C.rg:C.muted,cursor:"pointer",fontSize:mob?12:13,fontWeight:activeProd===i?500:400,display:"flex",alignItems:"center",justifyContent:mob?"center":"flex-start",gap:5,WebkitTapHighlightColor:"transparent"}}>
            {t}{localProds[i]?.name?.trim()&&<span style={{width:6,height:6,borderRadius:"50%",background:C.ok,display:"inline-block",flexShrink:0}}/>}
          </button>
        ))}
      </div>

      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:mob?`16px 16px 80px`:`24px ${px} 60px`}}>
        <div className="fade" style={{maxWidth:700,margin:"0 auto"}}>
          <Sec title="ข้อมูลพื้นฐาน" sub="Basic Information">
            <FR><FW label="ชื่อสินค้า *" sub="Product Name" s={2}><input value={p.name} onChange={e=>upd("name",e.target.value)} placeholder="เช่น Konjac Jelly Drink, คอลลาเจน 10000mg..." style={inp(true)}/></FW></FR>
            <FR cols={2}>
              <FW label="หมวดหมู่ *" sub="Category"><select value={p.category} onChange={e=>upd("category",e.target.value)} style={inp()}>{CATEGORIES.map(c=><option key={c} value={c}>{c||"— เลือก —"}</option>)}</select></FW>
              <FW label="ราคาโดยประมาณ" sub="THB"><input value={p.priceRange} onChange={e=>upd("priceRange",e.target.value)} placeholder="เช่น 150–350 บาท" style={inp()}/></FW>
            </FR>
            <FR cols={2}>
              <FW label="กลุ่มเป้าหมาย" sub="เลือกได้หลายกลุ่ม">
                <div style={{display:"flex",flexWrap:"wrap",gap:7,paddingTop:4}}>
                  {TARGET_MARKETS.map(m=>{ const sel=(p.targetMarkets||[]).includes(m); return <div key={m} onClick={()=>toggleMkt(m)} style={{padding:"7px 13px",borderRadius:20,border:`1.5px solid ${sel?C.rg:C.border}`,background:sel?C.rgL:C.card,color:sel?C.rg:C.sub,fontSize:13,fontWeight:sel?500:400,cursor:"pointer",userSelect:"none",WebkitUserSelect:"none",WebkitTapHighlightColor:"transparent"}}>{sel?"✓ ":""}{m}</div>; })}
                </div>
              </FW>
              <FW label="ความน่าสนใจ" sub="Viability"><select value={p.viability} onChange={e=>upd("viability",e.target.value)} style={inp()}>{VIABILITY.map(v=><option key={v} value={v}>{v||"— เลือก —"}</option>)}</select></FW>
            </FR>
          </Sec>

          <Sec title="ลิงก์และอ้างอิง" sub="Links & References">
            <FR><FW label="🌐 เว็บไซต์สินค้า *" sub="Website" s={2}><input value={p.websiteLink} onChange={e=>upd("websiteLink",e.target.value)} placeholder="https://..." style={inp()} inputMode="url" autoCapitalize="none"/></FW></FR>
            <FR><FW label="🔗 ลิงก์ Affiliate" sub="Affiliate Link" s={2}><input value={p.affiliateLink} onChange={e=>upd("affiliateLink",e.target.value)} placeholder="ลิงก์ affiliate หรือลิงก์ซื้อสินค้า" style={inp()} inputMode="url" autoCapitalize="none"/></FW></FR>
            <FR cols={2}>
              <FW label="🥊 คู่แข่งหลัก" sub="Competitor"><input value={p.competitor} onChange={e=>upd("competitor",e.target.value)} placeholder="เช่น แบรนด์ X หรือ top seller" style={inp()}/></FW>
              <FW label="สถานะ Affiliate"><select value={p.affiliateStatus} onChange={e=>upd("affiliateStatus",e.target.value)} style={inp()}>{AFFILIATE_STATUS.map(a=><option key={a} value={a}>{a||"— เลือก —"}</option>)}</select></FW>
            </FR>
            {imgs.map(({f,label,sub})=><FR key={f}><FW label={label} sub={sub} s={2}><input value={p[f]||""} onChange={e=>upd(f,e.target.value)} placeholder="วางลิงก์รูปภาพที่นี่..." style={inp()} inputMode="url" autoCapitalize="none"/></FW></FR>)}
            {[p.imageUrl,p.imageUrl2,p.imageUrl3].some(Boolean)&&(
              <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:4}}>
                {[p.imageUrl,p.imageUrl2,p.imageUrl3].filter(Boolean).map((url,i)=>(
                  <div key={i} style={{padding:8,background:C.soft,borderRadius:10,border:`1px solid ${C.border}`}}>
                    <img src={url} alt="" style={{maxHeight:90,maxWidth:140,objectFit:"contain",borderRadius:6,display:"block"}} onError={e=>{e.target.parentElement.style.display="none"}}/>
                  </div>
                ))}
              </div>
            )}
          </Sec>

          <Sec title="วิเคราะห์โอกาส" sub="Opportunity Analysis — ยิ่งละเอียดยิ่งดี">
            <FR><FW label="💡 ทำไมสินค้านี้ถึงมีโอกาส? *" sub="Why does this product have potential?" s={2}><textarea value={p.whySell} onChange={e=>upd("whySell",e.target.value)} placeholder="อธิบายเหตุผล — กระแส trend, ปัญหาที่แก้ได้, margin ที่คุ้มค่า, ความต้องการในตลาด..." rows={4} style={{...inp(),lineHeight:1.7}}/></FW></FR>
            <FR><FW label="🇹🇭 โอกาสในตลาดไทย" sub="Thai Market" s={2}><textarea value={p.thaiMarket} onChange={e=>upd("thaiMarket",e.target.value)} placeholder="กลุ่มลูกค้าในไทยคือใคร? ช่องทาง เช่น Shopee, TikTok Shop, Line OA..." rows={3} style={{...inp(),lineHeight:1.7}}/></FW></FR>
            <FR><FW label="🌍 โอกาสต่างประเทศ" sub="International Potential" s={2}><textarea value={p.intlMarket} onChange={e=>upd("intlMarket",e.target.value)} placeholder="ประเทศหรือภูมิภาคที่น่าสนใจ? Amazon, ClickBank..." rows={3} style={{...inp(),lineHeight:1.7}}/></FW></FR>
          </Sec>

          <div style={{display:"flex",alignItems:"center",gap:12,paddingTop:4,flexWrap:"wrap",paddingBottom:mob?20:0}}>
            <button onClick={doSave} disabled={saveMsg==="saving"} style={{...prime(),opacity:saveMsg==="saving"?.7:1}}>
              {saveMsg==="saving"?"⏳ กำลังบันทึก...":"💾 บันทึกข้อมูล"}
            </button>
            {saveMsg==="ok"&&<><span style={{fontSize:13,color:C.ok,fontWeight:500}}>✓ บันทึกสำเร็จ ☁️</span><button onClick={logout} style={{...ghost(),fontSize:13}}>← หน้าแรก</button></>}
            {saveMsg==="err"&&<span style={{fontSize:13,color:C.err}}>⚠ บันทึกไม่สำเร็จ — ลองอีกครั้ง</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
function Admin({ meta, nominations, active, completed, allProds, saveMeta, synced, lastSaved, fmtTime, refreshing, manualRefresh, go, logout }) {
  const w=useW(); const mob=w<640; const px=mob?"16px":"26px";
  const toggle       = () => saveMeta({ ...meta, votingOpen:!meta.votingOpen });
  const reveal       = () => saveMeta({ ...meta, votingRevealed:true });
  const resetAll     = () => { if(window.confirm("รีเซ็ตทุกอย่าง?")) saveMeta(defaultMeta()); };
  const toggleMember = m  => { const cur=meta.activeMembers||{}; saveMeta({ ...meta, activeMembers:{ ...cur, [m]:!cur[m] } }); };
  const activeCount  = Object.values(active).filter(Boolean).length;

  return (
    <div style={{minHeight:"100vh",background:C.bg}}>
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:`0 ${px}`,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}><Logo size={mob?13:14}/>{!mob&&<><div style={{width:1,height:18,background:C.border}}/><span style={{fontSize:11,background:C.charcoal,color:"#fff",padding:"3px 12px",borderRadius:20}}>🔑 Admin</span></>}</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <SyncBar synced={synced} lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} onRefresh={manualRefresh}/>
          <button onClick={()=>go("vote")} style={{...ghost(),fontSize:12}}>🗳️{!mob&&" Dashboard"}</button>
          <button onClick={logout} style={{...ghost(),fontSize:12}}>{mob?"✕":"ออก"}</button>
        </div>
      </div>
      <div style={{maxWidth:760,margin:"0 auto",padding:`20px ${px}`}}>
        <div className="grid3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}}>
          {[{l:"กรอกครบ/เข้าร่วม",v:`${completed.length}/${activeCount}`,c:C.ok},{l:"สินค้าทั้งหมด",v:`${allProds.length}`,c:C.rg},{l:"สถานะโหวต",v:meta?.votingOpen?"เปิด 🟢":"ปิด 🔴",c:meta?.votingOpen?C.ok:C.muted}].map(s=>(
            <div key={s.l} style={{background:C.card,borderRadius:12,padding:"16px",border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
              <div style={{fontSize:10,color:C.muted,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{s.l}</div>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:24,fontWeight:700,color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{background:C.card,borderRadius:12,padding:mob?"16px":"22px",marginBottom:16,border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
          <SH title="จัดการสมาชิก" sub="คลิกเพื่อเปิด/ปิด · สมาชิกที่ปิดจะไม่แสดงในหน้าโหวต"/>
          <div className="grid3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
            {MEMBERS.map(m=>{
              const isOn=active[m]!==false;
              const cnt=(nominations[m]||[]).filter(p=>p?.name?.trim()).length;
              return (
                <div key={m} onClick={()=>toggleMember(m)} style={{padding:"12px",borderRadius:9,background:isOn?(cnt===3?"#EDF8F3":C.soft):"#F5F5F5",border:`1.5px solid ${isOn?(cnt===3?C.ok:C.border):"#DDD"}`,cursor:"pointer",opacity:isOn?1:.55,WebkitTapHighlightColor:"transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:13,fontWeight:500,color:isOn?C.dark:"#AAA"}}>{m}</span>
                    <div style={{width:30,height:17,borderRadius:9,background:isOn?C.ok:"#CCC",position:"relative",flexShrink:0}}>
                      <div style={{position:"absolute",top:1.5,left:isOn?13:1.5,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.2)"}}/>
                    </div>
                  </div>
                  <div style={{fontSize:11,color:isOn?(cnt===3?C.ok:C.muted):"#BBB"}}>{isOn?`${cnt}/3${cnt===3?" ✓":""}` : "ไม่เข้าร่วม"}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{background:C.card,borderRadius:12,padding:mob?"16px":"22px",border:`1px solid ${C.border}`,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
          <SH title="ควบคุมการโหวต" sub="Voting Controls"/>
          <div style={{fontSize:13,color:C.muted,marginBottom:16,padding:"10px 14px",background:C.soft,borderRadius:8,lineHeight:1.6}}>
            เปิดระบบโหวตเมื่อสมาชิกทุกคนกรอกครบ ({completed.length}/{activeCount} คน) · เมื่อทุกคนโหวตครบให้กด "เปิดเผยผล"
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={toggle} style={{padding:"12px 20px",borderRadius:9,border:"none",cursor:"pointer",background:meta?.votingOpen?C.err:C.ok,color:"#fff",fontSize:14,fontWeight:500,WebkitTapHighlightColor:"transparent"}}>{meta?.votingOpen?"🔒 ปิดโหวต":"🔓 เปิดโหวต"}</button>
            {!meta?.votingRevealed?<button onClick={reveal} style={{...ghost(),fontSize:13,color:C.charcoal,borderColor:C.charcoal}}>🏆 เปิดเผยผล</button>:<span style={{fontSize:13,color:C.ok,fontWeight:500}}>✓ เปิดเผยผลแล้ว</span>}
            <button onClick={resetAll} style={{...ghost(),fontSize:13,color:C.err,borderColor:C.err,marginLeft:"auto"}}>🗑 Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── VOTE (Full Card Dashboard) ────────────────────────────────────────────────
function Vote({ user, meta, allProds, localVotes, allVotes, doVote, doUnvote, synced, lastSaved, fmtTime, refreshing, manualRefresh, go }) {
  const w=useW(); const mob=w<640;
  const [idx, setIdx] = useState(0);
  const touchStart = useRef(null);

  const revealed = meta?.votingRevealed;
  const sorted   = revealed ? [...allProds].sort((a,b)=>(allVotes[b.key]||0)-(allVotes[a.key]||0)) : allProds;
  const maxV     = revealed ? Math.max(...allProds.map(p=>allVotes[p.key]||0),1) : 1;
  const myTotal  = Object.values(localVotes).reduce((s,v)=>s+v,0);
  const total    = allProds.length;

  const prev = () => setIdx(i=>Math.max(0,i-1));
  const next = () => setIdx(i=>Math.min(total-1,i+1));

  // Keyboard navigation
  useEffect(()=>{
    const f=e=>{ if(e.key==="ArrowLeft") prev(); if(e.key==="ArrowRight") next(); };
    window.addEventListener("keydown",f); return()=>window.removeEventListener("keydown",f);
  },[total]);

  // Touch swipe
  const onTouchStart = e => { touchStart.current=e.touches[0].clientX; };
  const onTouchEnd   = e => {
    if (touchStart.current===null) return;
    const diff=touchStart.current-e.changedTouches[0].clientX;
    if (Math.abs(diff)>50) diff>0?next():prev();
    touchStart.current=null;
  };

  if (total===0) return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:C.bg,gap:16}}>
      <Logo size={18}/>
      <div style={{fontSize:14,color:C.muted}}>ยังไม่มีสินค้าในระบบ</div>
      <button onClick={()=>go(user==="Admin"?"admin":"form")} style={{...ghost(),fontSize:13}}>← กลับ</button>
    </div>
  );

  const safeIdx = Math.min(idx, total-1);
  const p = sorted[safeIdx];
  const mv = localVotes[p.key]||0;
  const tv = allVotes[p.key]||0;
  const images = [p.imageUrl,p.imageUrl2,p.imageUrl3].filter(Boolean);

  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",background:C.bg}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Topbar */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:`0 ${mob?"16px":"26px"}`,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20,gap:8,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
          <Logo size={mob?13:14}/>
          {!mob&&<><div style={{width:1,height:18,background:C.border}}/><span style={{fontSize:12,color:C.muted,whiteSpace:"nowrap"}}><span style={{color:C.rg,fontWeight:500}}>{user}</span> · {myTotal} คะแนน</span></>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <SyncBar synced={synced} lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} onRefresh={manualRefresh}/>
          <button onClick={()=>go(user==="Admin"?"admin":"form")} style={{...ghost(),fontSize:12,whiteSpace:"nowrap"}}>← กลับ</button>
        </div>
      </div>

      {/* Progress + nav */}
      <div style={{background:C.card,borderBottom:`1px solid ${C.border}`,padding:`10px ${mob?"16px":"26px"}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={prev} disabled={safeIdx===0} style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${C.border}`,background:safeIdx===0?C.soft:C.card,color:safeIdx===0?C.muted:C.dark,cursor:safeIdx===0?"default":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12,color:C.muted}}>
            <span>สินค้าที่ {safeIdx+1} จาก {total}</span>
            {revealed && <span style={{color:C.rg,fontWeight:500}}>{tv} คะแนน</span>}
          </div>
          <div style={{height:4,background:C.soft,borderRadius:4,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${((safeIdx+1)/total)*100}%`,background:`linear-gradient(90deg,${C.rg},${C.rgM})`,borderRadius:4,transition:"width .3s"}}/>
          </div>
        </div>
        <button onClick={next} disabled={safeIdx===total-1} style={{width:32,height:32,borderRadius:8,border:`1.5px solid ${C.border}`,background:safeIdx===total-1?C.soft:C.card,color:safeIdx===total-1?C.muted:C.dark,cursor:safeIdx===total-1?"default":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>›</button>
      </div>

      {/* Winner banner */}
      {revealed && safeIdx===0 && tv>0 && (
        <div style={{background:`linear-gradient(90deg,${C.rg},${C.rgM})`,padding:"10px 24px",fontSize:13,color:"#fff",fontWeight:500,textAlign:"center",letterSpacing:.5}}>
          🏆 อันดับ 1 — Winner · {tv} คะแนน
        </div>
      )}

      {/* Main card */}
      <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",padding:mob?"16px":"24px 26px"}}>
        <div className="fade" style={{maxWidth:700,margin:"0 auto"}} key={p.key}>

          {/* Images */}
          {images.length>0 && (
            <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:mob?"wrap":"nowrap"}}>
              {images.map((url,i)=>(
                <div key={i} style={{flex:i===0?"0 0 auto":undefined,width:i===0?(mob?"100%":280):undefined,height:mob?200:220,background:C.soft,borderRadius:12,border:`1px solid ${C.border}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <img src={url} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:8}} onError={e=>{e.target.parentElement.style.display="none"}}/>
                </div>
              ))}
            </div>
          )}
          {images.length===0 && (
            <div style={{height:140,background:C.soft,borderRadius:12,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:20}}>
              <span style={{fontSize:40}}>🔍</span>
            </div>
          )}

          {/* Name + meta */}
          <div style={{marginBottom:20}}>
            <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:mob?22:26,fontWeight:700,color:C.dark,lineHeight:1.2,marginBottom:8}}>{p.name}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {p.category&&<Tag>{p.category}</Tag>}
              {p.priceRange&&<Tag>💰 {p.priceRange}</Tag>}
              {p.viability&&<Tag>{p.viability}</Tag>}
              {(p.targetMarkets||[]).map(m=><Tag key={m}>👥 {m}</Tag>)}
            </div>
          </div>

          {/* Info sections */}
          {p.whySell&&<InfoBlock icon="💡" title="ทำไมสินค้านี้ถึงมีโอกาส?" text={p.whySell}/>}
          {p.thaiMarket&&<InfoBlock icon="🇹🇭" title="โอกาสในตลาดไทย" text={p.thaiMarket}/>}
          {p.intlMarket&&<InfoBlock icon="🌍" title="โอกาสในตลาดต่างประเทศ" text={p.intlMarket}/>}

          {/* Details row */}
          {(p.competitor||p.affiliateStatus)&&(
            <div style={{display:"grid",gridTemplateColumns:mob?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>
              {p.competitor&&<Detail label="🥊 คู่แข่งหลัก" value={p.competitor}/>}
              {p.affiliateStatus&&<Detail label="🔗 สถานะ Affiliate" value={p.affiliateStatus}/>}
            </div>
          )}

          {/* Links */}
          {(p.websiteLink||p.affiliateLink)&&(
            <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
              {p.websiteLink&&<a href={p.websiteLink} target="_blank" rel="noreferrer" style={{padding:"10px 18px",borderRadius:8,background:C.soft,border:`1.5px solid ${C.border}`,color:C.dark,textDecoration:"none",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>🌐 เว็บไซต์สินค้า</a>}
              {p.affiliateLink&&<a href={p.affiliateLink} target="_blank" rel="noreferrer" style={{padding:"10px 18px",borderRadius:8,background:C.rgL,border:`1.5px solid ${C.rgM}`,color:C.rg,textDecoration:"none",fontSize:13,fontWeight:500,display:"flex",alignItems:"center",gap:6}}>🔗 ลิงก์ Affiliate</a>}
            </div>
          )}

          {/* Vote bar */}
          <div style={{background:C.card,border:`2px solid ${mv>0?C.rg:C.border}`,borderRadius:14,padding:"20px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,marginBottom:40,boxShadow:mv>0?`0 4px 20px rgba(183,110,121,.15)`:"0 2px 10px rgba(0,0,0,0.05)"}}>
            <div>
              <div style={{fontSize:13,color:C.muted,marginBottom:4}}>
                {!meta?.votingOpen ? "การโหวตยังไม่เปิด" : revealed ? "คะแนนรวม" : "คะแนนของคุณ"}
              </div>
              <div style={{fontFamily:"'Libre Baskerville',serif",fontSize:36,fontWeight:700,color:C.dark}}>
                {revealed ? tv : mv>0 ? `+${mv}` : "—"}
              </div>
              {revealed && tv>0 && (
                <div style={{marginTop:8,height:4,width:200,background:C.soft,borderRadius:4,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(tv/maxV)*100}%`,background:`linear-gradient(90deg,${C.rg},${C.rgM})`,borderRadius:4}}/>
                </div>
              )}
            </div>
            {meta?.votingOpen && (
              <div style={{display:"flex",gap:10,alignItems:"center"}}>
                {mv>0&&<button onClick={()=>doUnvote(p.key)} style={{width:48,height:48,background:C.soft,color:C.muted,border:`1.5px solid ${C.border}`,borderRadius:12,fontSize:24,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>—</button>}
                <button onClick={()=>doVote(p.key)} style={{width:56,height:56,background:C.rg,color:"#fff",border:"none",borderRadius:12,fontSize:26,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(183,110,121,.35)",WebkitTapHighlightColor:"transparent",touchAction:"manipulation"}}>＋</button>
              </div>
            )}
          </div>

          {/* Nav hint */}
          <div style={{textAlign:"center",fontSize:11,color:C.muted,paddingBottom:20}}>
            {mob?"← เลื่อนซ้าย/ขวาเพื่อดูสินค้าถัดไป →":"← → เพื่อดูสินค้าถัดไป"}
          </div>

        </div>
      </div>

      {/* Bottom dot nav */}
      <div style={{background:C.card,borderTop:`1px solid ${C.border}`,padding:"12px 16px",display:"flex",justifyContent:"center",gap:6,flexShrink:0,flexWrap:"wrap"}}>
        {sorted.map((_,i)=>(
          <button key={i} onClick={()=>setIdx(i)} style={{width:i===safeIdx?24:8,height:8,borderRadius:4,background:i===safeIdx?C.rg:C.border,border:"none",cursor:"pointer",transition:"all .2s",padding:0,WebkitTapHighlightColor:"transparent"}}/>
        ))}
      </div>
    </div>
  );
}

// ── UI COMPONENTS ─────────────────────────────────────────────────────────────
function InfoBlock({ icon, title, text }) {
  return (
    <div style={{marginBottom:16,background:C.soft,borderRadius:12,padding:"16px 18px",border:`1px solid ${C.border}`}}>
      <div style={{fontSize:12,fontWeight:600,color:C.dark,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>{icon} {title}</div>
      <div style={{fontSize:14,color:C.sub,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{text}</div>
    </div>
  );
}
function Tag({ children }) {
  return <span style={{fontSize:11,padding:"4px 10px",borderRadius:20,background:C.soft,color:C.sub,border:`1px solid ${C.border}`,whiteSpace:"nowrap"}}>{children}</span>;
}
function Detail({ label, value }) {
  return (
    <div style={{background:C.soft,borderRadius:10,padding:"12px 14px",border:`1px solid ${C.border}`}}>
      <div style={{fontSize:11,color:C.muted,marginBottom:3}}>{label}</div>
      <div style={{fontSize:13,color:C.dark,fontWeight:500}}>{value}</div>
    </div>
  );
}
function Sec({ title, sub, children }) {
  return (
    <div style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,overflow:"hidden",marginBottom:14,boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
      <div style={{padding:"13px 20px",borderBottom:`1px solid ${C.border}`,background:C.soft}}><div style={{fontFamily:"'Libre Baskerville',serif",fontSize:15,fontWeight:700,color:C.dark}}>{title}</div>{sub&&<div style={{fontSize:11,color:C.muted,marginTop:1}}>{sub}</div>}</div>
      <div style={{padding:"18px 20px"}}>{children}</div>
    </div>
  );
}
function SH({ title, sub }) { return <div style={{marginBottom:14}}><div style={{fontFamily:"'Libre Baskerville',serif",fontSize:15,fontWeight:700,color:C.dark}}>{title}</div>{sub&&<div style={{fontSize:11,color:C.muted,marginTop:2}}>{sub}</div>}</div>; }
function FR({ children, cols=1 }) { return <div className={cols===2?"grid2":""} style={{display:"grid",gridTemplateColumns:cols===2?"1fr 1fr":"1fr",gap:12,marginBottom:12}}>{children}</div>; }
function FW({ label, sub, children, s=1 }) { return <div style={{gridColumn:s===2?"1/-1":undefined}}><div style={{marginBottom:6,display:"flex",alignItems:"baseline",gap:5,flexWrap:"wrap"}}><span style={{fontSize:12,fontWeight:500,color:C.dark}}>{label}</span>{sub&&<span style={{fontSize:11,color:C.muted}}>{sub}</span>}</div>{children}</div>; }
function FL({ children }) { return <div style={{fontSize:13,fontWeight:500,color:C.dark,marginBottom:6}}>{children}</div>; }
