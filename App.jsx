import { useState, useEffect, useRef, useCallback } from "react";

const MEMBERS = ["Gift","Nun","Off","Nutt","Tanny","Donut"];
const PINS = {Gift:"4827",Nun:"7391",Off:"2658",Nutt:"9143",Tanny:"5076",Donut:"8412",Admin:"3759"};
const CATEGORIES = ["","Beauty & Skincare","Health & Wellness","Food & Beverage","Fashion & Accessories","Home & Living","Tech & Gadgets","Sports & Outdoors","Baby & Kids","Pet Products","Other"];
const VIABILITY = ["","🔥 สูงมาก (High)","⚡ ปานกลาง (Medium)","🌱 เริ่มต้น (Early Stage)"];
const AFFILIATE_STATUS = ["","✅ มี Program แล้ว","📩 ต้องติดต่อเอง","❓ ยังไม่แน่ใจ"];
const TARGET_MARKETS = ["ผู้หญิง (Women)","ผู้ชาย (Men)","เด็ก (Kids)","ผู้สูงอายุ (Elderly)","B2B","ทุกเพศ (All)"];
const RULES = [
  {num:"01",th:"สมาชิกแต่ละคนต้องเสนอสินค้า 3 รายการที่คิดว่ามีศักยภาพในตลาดไทยและต่างประเทศ",en:"Each member nominates 3 products with sales potential in Thai & international markets."},
  {num:"02",th:"ห้ามเปิดเผยสินค้าที่ตัวเองเลือกให้สมาชิกคนอื่นทราบก่อนการโหวต เพื่อความยุติธรรม",en:"Keep your picks secret from others until voting opens."},
  {num:"03",th:"กรอกข้อมูลให้ครบทุกช่องที่มีเครื่องหมาย * เพื่อให้ข้อมูลสมบูรณ์และน่าเชื่อถือ",en:"Fill in all required fields marked with * for complete data."},
  {num:"04",th:"สินค้าที่เสนอควรเป็นสินค้าที่สามารถทำ Affiliate ได้จริง และมีลิงก์หรือเว็บไซต์อ้างอิงประกอบ",en:"Products must be viable for affiliate marketing and include a reference link or website."},
  {num:"05",th:"ใส่เหตุผลในช่อง 'ทำไมสินค้านี้ถึงมีโอกาส' ให้ชัดเจนและเป็นรูปธรรมที่สุด ยิ่งชัดยิ่งดี",en:"Explain why this product has potential — be specific and concrete."},
  {num:"06",th:"กด 'บันทึกข้อมูล' ทุกครั้งหลังกรอกเสร็จ ข้อมูลจะถูกเซฟทันทีและไม่หายไปไหน",en:"Press Save after filling in. Data persists automatically."},
  {num:"07",th:"หน้าโหวตจะเปิดให้ใช้งานได้เมื่อสมาชิกทุกคนกรอกครบแล้ว โดย Admin เป็นผู้เปิดระบบโหวต",en:"Voting opens only after all members submit, unlocked by Admin."},
  {num:"08",th:"ในการโหวต สามารถโหวตได้ไม่จำกัดจำนวน และโหวตให้สินค้าของตัวเองได้เช่นกัน ผลลัพธ์จะสะท้อนความคิดเห็นโดยรวมของกลุ่ม",en:"Vote freely with no limits — including for your own picks."},
];

const GAS_URL = "https://script.google.com/macros/s/AKfycbz9njVrvsie_A9Kgo5Dptg-KVk0oNnT5pwbBqjuq89VVwx5xztxy14CcId7mZUubUcc/exec";
const DB_KEY = "ps_main";
const REFRESH_INTERVAL = 20000;
const MAX_RETRIES = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function gasGet() {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const res = await fetch(`${GAS_URL}?key=${DB_KEY}`, { redirect: "follow" });
      const json = await res.json();
      if (json.ok && json.value) return JSON.parse(json.value);
      return null;
    } catch { if (i === MAX_RETRIES - 1) return null; await sleep(500 * (i + 1)); }
  }
}

async function gasSet(data) {
  const payload = { ...data, lastUpdated: new Date().toISOString() };
  const encoded = encodeURIComponent(JSON.stringify(payload));
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      // Use no-cors GET with data in URL param to avoid CORS preflight
      const res = await fetch(`${GAS_URL}?action=set&key=${DB_KEY}&value=${encoded}`, { redirect: "follow" });
      const json = await res.json();
      return json.ok ? { ok: true, ts: payload.lastUpdated } : { ok: false };
    } catch { if (i === MAX_RETRIES - 1) return { ok: false }; await sleep(600 * (i + 1)); }
  }
}

const emptyProduct = () => ({ name:"", category:"", priceRange:"", targetMarkets:[], websiteLink:"", affiliateLink:"", competitor:"", imageUrl:"", imageUrl2:"", imageUrl3:"", whySell:"", thaiMarket:"", intlMarket:"", affiliateStatus:"", viability:"" });
const emptyNominations = () => Object.fromEntries(MEMBERS.map(m => [m, [emptyProduct(), emptyProduct(), emptyProduct()]]));
const defaultActive = () => Object.fromEntries(MEMBERS.map(m => [m, true]));
const defaultDB = () => ({ nominations: emptyNominations(), votes: {}, votingOpen: false, votingRevealed: false, activeMembers: defaultActive(), lastUpdated: "" });

function migrateProduct(p) {
  if (!p) return emptyProduct();
  const targetMarkets = p.targetMarkets?.length > 0 ? p.targetMarkets : p.targetMarket ? [p.targetMarket] : [];
  return { ...emptyProduct(), ...p, targetMarkets, imageUrl2: p.imageUrl2||"", imageUrl3: p.imageUrl3||"" };
}
function migrateDB(data) {
  if (!data) return defaultDB();
  if (data.nominations) Object.keys(data.nominations).forEach(m => { data.nominations[m] = (data.nominations[m]||[]).map(migrateProduct); });
  if (!data.activeMembers) data.activeMembers = defaultActive();
  if (!data.votes) data.votes = {};
  if (!data.lastUpdated) data.lastUpdated = "";
  return data;
}

function useBreakpoint() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => { const fn = () => setW(window.innerWidth); window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn); }, []);
  return { isMobile: w < 640, isTablet: w >= 640 && w < 1024, isDesktop: w >= 1024 };
}

const C = { bg:"#F9F8F5", card:"#FFFFFF", dark:"#18181A", charcoal:"#2C2C2E", rg:"#B76E79", rgLight:"#F7EAEC", rgMid:"#D4959E", muted:"#98989E", border:"#E9E4DE", soft:"#F3F0EB", success:"#3A9E72", danger:"#C0392B", text:"#18181A", sub:"#6B6B70" };
const inp = (big) => ({ width:"100%", border:`1.5px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:16, background:C.card, padding:big?"14px 16px":"12px 14px", fontFamily:"'DM Sans',sans-serif", boxSizing:"border-box", WebkitAppearance:"none", appearance:"none" });
const ghost = (danger) => ({ padding:"8px 14px", border:`1.5px solid ${danger?C.danger:C.border}`, borderRadius:8, background:"transparent", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:13, color:danger?C.danger:C.sub, WebkitTapHighlightColor:"transparent" });
const prime = (full) => ({ width:full?"100%":"auto", padding:"14px 28px", background:C.rg, color:"#fff", border:"none", borderRadius:10, fontSize:15, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" });

function Logo({ size=18, light=false }) {
  const c = light?"#fff":C.rg, cl = light?"rgba(255,255,255,.25)":C.rgLight;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
      <svg width={size+6} height={size+6} viewBox="0 0 30 30" fill="none">
        <circle cx="13" cy="13" r="9.5" stroke={c} strokeWidth="2"/>
        <circle cx="13" cy="13" r="4" fill={cl} stroke={light?"rgba(255,255,255,.6)":C.rgMid} strokeWidth="1.5"/>
        <line x1="20" y1="20" x2="27" y2="27" stroke={c} strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <span style={{ fontFamily:"'Libre Baskerville',serif", fontSize:size, fontWeight:700, color:light?"#fff":C.dark, letterSpacing:-.3 }}>
        Product <em style={{ color:light?"rgba(255,255,255,.65)":C.rg, fontStyle:"italic" }}>Scout</em>
      </span>
    </div>
  );
}

function StatusBar({ lastSaved, fmtTime, refreshing, manualRefresh, synced }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:C.muted }}>
      {lastSaved && <span style={{ whiteSpace:"nowrap" }}>{synced?"☁️":"💾"} {fmtTime(lastSaved)}</span>}
      <button onClick={manualRefresh} style={{ background:"none", border:"none", cursor:"pointer", padding:"4px", color:C.muted, fontSize:16, lineHeight:1, WebkitTapHighlightColor:"transparent" }}>
        <span style={{ display:"inline-block", animation: refreshing?"spin 1s linear infinite":"none" }}>↻</span>
      </button>
    </div>
  );
}

export default function App() {
  const [screen, setScreen]           = useState("login");
  const [user, setUser]               = useState(null);
  const [db, setDb]                   = useState(null);
  const [ready, setReady]             = useState(false);
  const [synced, setSynced]           = useState(false);
  const [activeProd, setActiveProd]   = useState(0);
  const [localProds, setLocalProds]   = useState([emptyProduct(), emptyProduct(), emptyProduct()]);
  const [localVotes, setLocalVotes]   = useState({});
  const [loginName, setLoginName]     = useState("");
  const [loginPin, setLoginPin]       = useState("");
  const [loginErr, setLoginErr]       = useState("");
  const [saveMsg, setSaveMsg]         = useState("");
  const [lastSaved, setLastSaved]     = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const currentUser  = useRef(null);
  const refreshTimer = useRef(null);

  const loadAndSet = useCallback(async () => {
    const remote = await gasGet();
    if (remote) {
      const d = migrateDB(remote);
      setDb(d); setSynced(true);
      if (d.lastUpdated) setLastSaved(d.lastUpdated);
      return d;
    }
    try {
      const local = localStorage.getItem("ps_fallback");
      if (local) { const d = migrateDB(JSON.parse(local)); setDb(d); setSynced(false); return d; }
    } catch {}
    const fresh = defaultDB(); setDb(fresh); return fresh;
  }, []);

  useEffect(() => { loadAndSet().then(() => setReady(true)); }, []);

  useEffect(() => {
    if (!ready) return;
    const tick = async () => { if (currentUser.current && screen !== "form") await loadAndSet(); };
    refreshTimer.current = setInterval(tick, REFRESH_INTERVAL);
    return () => clearInterval(refreshTimer.current);
  }, [ready, screen]);

  const manualRefresh = async () => { setRefreshing(true); await loadAndSet(); setRefreshing(false); };

  const persist = async (updated) => {
    setDb(updated);
    try { localStorage.setItem("ps_fallback", JSON.stringify(updated)); } catch {}
    const res = await gasSet(updated);
    if (res?.ok) { setSynced(true); if (res.ts) setLastSaved(res.ts); }
    else setSynced(false);
    return res;
  };

  const doLogin = () => {
    if (!loginName) { setLoginErr("กรุณาเลือกชื่อของคุณ"); return; }
    if (loginPin !== PINS[loginName]) { setLoginErr("PIN ไม่ถูกต้อง กรุณาลองอีกครั้ง"); return; }
    setLoginErr(""); setUser(loginName); currentUser.current = loginName;
    if (loginName === "Admin") { setScreen("admin"); return; }
    const ex = db.nominations[loginName];
    if (ex) setLocalProds(ex.map(migrateProduct));
    setLocalVotes(db.votes[loginName] || {});
    setScreen("rules");
  };

  const doSave = async () => {
    setSaveMsg("saving");
    try {
      const res = await persist({ ...db, nominations: { ...db.nominations, [user]: localProds } });
      setSaveMsg(res?.ok ? "ok" : "err");
    } catch { setSaveMsg("err"); }
  };

  const doVote = async (key) => {
    const nv = { ...localVotes, [key]: (localVotes[key]||0)+1 };
    setLocalVotes(nv); await persist({ ...db, votes: { ...db.votes, [user]: nv } });
  };
  const doUnvote = async (key) => {
    const nv = { ...localVotes }; if (!nv[key]) return;
    nv[key]--; if (nv[key] <= 0) delete nv[key];
    setLocalVotes(nv); await persist({ ...db, votes: { ...db.votes, [user]: nv } });
  };
  const logout = () => { setUser(null); currentUser.current=null; setLoginPin(""); setLoginName(""); setLoginErr(""); setSaveMsg(""); setScreen("login"); };
  const switchTab = (i) => { setActiveProd(i); setSaveMsg(""); };

  if (!ready) return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", background:C.bg, gap:16 }}>
      <Logo size={22}/>
      <div style={{ fontSize:13, color:C.muted, fontFamily:"'DM Sans',sans-serif" }}>กำลังเชื่อมต่อ Google Sheets...</div>
      <div style={{ display:"flex", gap:6 }}>
        {[0,1,2].map(i => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:C.rg, animation:`pulse 1s ease ${i*.2}s infinite alternate` }}/>)}
      </div>
    </div>
  );

  const active    = db.activeMembers || defaultActive();
  const completed = MEMBERS.filter(m => active[m] && (db.nominations[m]||[]).filter(p => p?.name?.trim()).length === 3);
  const allProds  = MEMBERS.filter(m => active[m]).flatMap(m => (db.nominations[m]||[]).map((p,i) => p?.name?.trim() ? {...p,member:m,key:`${m}_${i}`} : null).filter(Boolean));
  const allVotes  = {}; Object.values(db.votes).forEach(mv => Object.entries(mv).forEach(([k,v]) => { allVotes[k] = (allVotes[k]||0)+v; }));
  const fmtTime   = (iso) => { try { return new Date(iso).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };
  const shared    = { user, db, persist, completed, allProds, allVotes, active, loginName, setLoginName, loginPin, setLoginPin, loginErr, doLogin, localProds, setLocalProds, activeProd, setActiveProd, switchTab, doSave, saveMsg, setSaveMsg, lastSaved, fmtTime, refreshing, manualRefresh, synced, localVotes, doVote, doUnvote, logout, go: setScreen };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans',sans-serif", color:C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{-webkit-text-size-adjust:100%;text-size-adjust:100%;}
        input,select,textarea{font-size:16px!important;-webkit-appearance:none;appearance:none;}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${C.rg}!important;box-shadow:0 0 0 3px ${C.rgLight};}
        ::placeholder{color:#C5C0BA;}
        button{-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
        textarea{resize:vertical;}
        @keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{from{opacity:.3}to{opacity:1}}
        .fade{animation:fi .3s ease;}
        select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='7' viewBox='0 0 11 7'%3E%3Cpath d='M1 1l4.5 4.5L10 1' stroke='%2398989E' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 13px center;padding-right:34px!important;}
        @media(max-width:639px){.grid2{grid-template-columns:1fr!important;}.grid3{grid-template-columns:1fr 1fr!important;}.hide-mobile{display:none!important;}.login-grid{grid-template-columns:1fr!important;}}
        @media(min-width:640px) and (max-width:1023px){.grid3{grid-template-columns:1fr 1fr!important;}}
      `}</style>
      {screen==="login" && <Login {...shared}/>}
      {screen==="rules" && <Rules {...shared}/>}
      {screen==="form"  && <Form  {...shared}/>}
      {screen==="admin" && <Admin {...shared}/>}
      {screen==="vote"  && <Vote  {...shared}/>}
    </div>
  );
}

function Login({ loginName, setLoginName, loginPin, setLoginPin, loginErr, doLogin, completed, lastSaved, fmtTime, refreshing, manualRefresh, synced }) {
  const { isMobile } = useBreakpoint();
  return (
    <div className="login-grid" style={{ minHeight:"100vh", display:"grid", gridTemplateColumns:"1fr 1fr" }}>
      <div className="hide-mobile" style={{ background:`linear-gradient(150deg,${C.charcoal} 0%,#111 100%)`, display:"flex", flexDirection:"column", justifyContent:"space-between", padding:"48px 52px" }}>
        <Logo size={17} light/>
        <div>
          <div style={{ fontSize:10, letterSpacing:5, color:C.rgMid, textTransform:"uppercase", marginBottom:14 }}>Thai Market · Affiliate Scout</div>
          <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:34, color:"#fff", lineHeight:1.25, marginBottom:18 }}>ค้นหาสินค้า<br/>พระเอกของเรา</div>
          <div style={{ fontSize:13, color:"rgba(255,255,255,.4)", lineHeight:1.8, maxWidth:300 }}>A private platform for our group to discover, evaluate, and vote on the most promising affiliate products.</div>
        </div>
        <div>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap", alignItems:"center", marginBottom:10 }}>
            {MEMBERS.map(m => (
              <span key={m} style={{ fontSize:11, padding:"3px 11px", borderRadius:20, background:completed.includes(m)?"rgba(183,110,121,.25)":"rgba(255,255,255,.06)", color:completed.includes(m)?C.rgMid:"rgba(255,255,255,.3)", border:`1px solid ${completed.includes(m)?"rgba(183,110,121,.35)":"rgba(255,255,255,.08)"}` }}>
                {m}{completed.includes(m)?" ✓":""}
              </span>
            ))}
            <span style={{ fontSize:11, color:"rgba(255,255,255,.2)" }}>{completed.length}/6 คน</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:11, color:"rgba(255,255,255,.25)" }}>
            {lastSaved && <span>{synced?"☁️":"💾"} {fmtTime(lastSaved)}</span>}
            <button onClick={manualRefresh} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.3)", fontSize:16, padding:4 }}>
              <span style={{ display:"inline-block", animation:refreshing?"spin 1s linear infinite":"none" }}>↻</span>
            </button>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:isMobile?"24px 20px":"48px", background:C.bg, minHeight:"100vh" }}>
        <div className="fade" style={{ width:"100%", maxWidth:360 }}>
          {isMobile && (
            <div style={{ textAlign:"center", marginBottom:28 }}>
              <Logo size={20}/>
              <div style={{ marginTop:12, display:"flex", gap:6, flexWrap:"wrap", justifyContent:"center" }}>
                {MEMBERS.map(m => (
                  <span key={m} style={{ fontSize:10, padding:"2px 9px", borderRadius:20, background:completed.includes(m)?C.rgLight:C.soft, color:completed.includes(m)?C.rg:C.muted, border:`1px solid ${completed.includes(m)?C.rgMid:C.border}` }}>
                    {m}{completed.includes(m)?" ✓":""}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:22, fontWeight:700, color:C.dark, marginBottom:5 }}>Welcome back</div>
            <div style={{ fontSize:14, color:C.muted }}>เลือกชื่อและใส่ PIN เพื่อเข้าสู่ระบบ</div>
          </div>
          <div style={{ marginBottom:16 }}>
            <FL>ชื่อของคุณ / Your Name</FL>
            <select value={loginName} onChange={e => setLoginName(e.target.value)} style={inp()}>
              <option value="">— เลือกชื่อ —</option>
              {MEMBERS.map(m => <option key={m} value={m}>{m}{completed.includes(m)?" ✓":""}</option>)}
              <option value="Admin">🔑 Admin</option>
            </select>
          </div>
          <div style={{ marginBottom:22 }}>
            <FL>PIN Code</FL>
            <input type="password" inputMode="numeric" maxLength={4} value={loginPin} onChange={e => setLoginPin(e.target.value)} onKeyDown={e => e.key==="Enter" && doLogin()} placeholder="• • • •" style={{ ...inp(), fontSize:24, letterSpacing:14, textAlign:"center" }}/>
          </div>
          {loginErr && <div style={{ background:"#FDF0EF", border:`1.5px solid ${C.danger}`, borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:14, color:C.danger }}>{loginErr}</div>}
          <button onClick={doLogin} style={prime(true)}>เข้าสู่ระบบ →</button>
          <div style={{ marginTop:16, padding:"13px 16px", background:C.soft, borderRadius:9, border:`1px solid ${C.border}` }}>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.7 }}>PIN ของคุณถูกส่งให้โดย Admin เป็นการส่วนตัว<br/>หากลืม PIN กรุณาติดต่อ Donut</div>
          </div>
          <div style={{ marginTop:12, display:"flex", justifyContent:"center" }}>
            <StatusBar lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} manualRefresh={manualRefresh} synced={synced}/>
          </div>
        </div>
      </div>
    </div>
  );
}

function Rules({ user, go }) {
  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px 16px", background:C.bg }}>
      <div className="fade" style={{ width:"100%", maxWidth:620 }}>
        <div style={{ textAlign:"center", marginBottom:24 }}><Logo size={17}/><div style={{ marginTop:18, fontFamily:"'Libre Baskerville',serif", fontSize:24, fontWeight:700, color:C.dark }}>สวัสดี {user} 👋</div><div style={{ fontSize:13, color:C.muted, marginTop:5 }}>กรุณาอ่านกฎก่อนเริ่มกรอกข้อมูล</div></div>
        <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden", boxShadow:"0 4px 28px rgba(0,0,0,0.06)", marginBottom:16 }}>
          <div style={{ background:`linear-gradient(135deg,${C.charcoal},#111)`, padding:"16px 22px", display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ width:30, height:30, borderRadius:7, background:"rgba(183,110,121,.2)", border:"1px solid rgba(183,110,121,.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, flexShrink:0 }}>📋</div>
            <div><div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:15, color:"#fff", fontWeight:700 }}>กฎและวิธีการกรอกข้อมูล</div><div style={{ fontSize:10, color:"rgba(255,255,255,.35)", marginTop:1 }}>Rules & Guidelines</div></div>
          </div>
          <div style={{ padding:"4px 0" }}>
            {RULES.map((r,i) => (
              <div key={r.num} style={{ display:"flex", gap:12, padding:"13px 20px", borderBottom:i<RULES.length-1?`1px solid ${C.border}`:"none" }}>
                <div style={{ flexShrink:0, width:24, height:24, borderRadius:6, background:C.rgLight, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:C.rg }}>{r.num}</div>
                <div><div style={{ fontSize:13, fontWeight:500, color:C.dark, marginBottom:2, lineHeight:1.5 }}>{r.th}</div><div style={{ fontSize:11, color:C.muted, lineHeight:1.5 }}>{r.en}</div></div>
              </div>
            ))}
          </div>
        </div>
        <button onClick={() => go("form")} style={prime(true)}>เข้าใจแล้ว — เริ่มกรอกข้อมูล →</button>
      </div>
    </div>
  );
}

function Form({ user, db, localProds, setLocalProds, activeProd, switchTab, doSave, saveMsg, lastSaved, fmtTime, refreshing, manualRefresh, synced, go, logout }) {
  const { isMobile } = useBreakpoint();
  const [showRules, setShowRules] = useState(false);
  const filled = localProds.filter(p => p.name.trim()).length;
  const p = localProds[activeProd];
  const upd = (f,v) => setLocalProds(prev => prev.map((x,i) => i===activeProd ? {...x,[f]:v} : x));
  const toggleMarket = (m) => { const cur=p.targetMarkets||[]; upd("targetMarkets", cur.includes(m)?cur.filter(x=>x!==m):[...cur,m]); };
  const imgs = [{ f:"imageUrl", label:"🖼 รูปภาพหลัก", sub:"Main Image URL" }, { f:"imageUrl2", label:"🖼 รูปภาพที่ 2", sub:"Optional" }, { f:"imageUrl3", label:"🖼 รูปภาพที่ 3", sub:"Optional" }];
  const px = isMobile ? "16px" : "26px";

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column", background:C.bg }}>
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:`0 ${px}`, height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20, gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
          <Logo size={isMobile?13:14}/>
          {!isMobile && <><div style={{ width:1, height:18, background:C.border, flexShrink:0 }}/><span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}><span style={{ color:C.rg, fontWeight:500 }}>{user}</span> · {filled}/3</span></>}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <StatusBar lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} manualRefresh={manualRefresh} synced={synced}/>
          {db.votingOpen && <button onClick={() => go("vote")} style={{ ...ghost(), color:C.success, borderColor:C.success, fontSize:12 }}>🗳️</button>}
          <button onClick={() => setShowRules(s=>!s)} style={{ ...ghost(), fontSize:12 }}>📋</button>
          <button onClick={logout} style={{ ...ghost(), fontSize:12 }}>{isMobile?"✕":"ออก"}</button>
        </div>
      </div>

      {isMobile && <div style={{ background:C.soft, padding:"7px 16px", fontSize:12, color:C.muted, display:"flex", justifyContent:"space-between", alignItems:"center" }}><span><span style={{ color:C.rg, fontWeight:500 }}>{user}</span> · {filled}/3 สินค้า</span>{db.votingOpen && <button onClick={() => go("vote")} style={{ ...ghost(), color:C.success, borderColor:C.success, fontSize:11 }}>🗳️ โหวต!</button>}</div>}

      {showRules && (
        <div style={{ background:C.rgLight, borderBottom:`1px solid #EDD0D5`, padding:`12px ${px}` }}>
          {RULES.map(r => <div key={r.num} style={{ display:"flex", gap:8, marginBottom:6, fontSize:12 }}><span style={{ color:C.rg, fontWeight:700, flexShrink:0 }}>{r.num}.</span><span style={{ color:C.charcoal, lineHeight:1.5 }}>{r.th}</span></div>)}
        </div>
      )}

      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:`0 ${isMobile?"8px":px}`, display:"flex" }}>
        {["สินค้าที่ 1","สินค้าที่ 2","สินค้าที่ 3"].map((t,i) => (
          <button key={i} onClick={() => switchTab(i)} style={{ flex:isMobile?1:undefined, padding:isMobile?"12px 8px":"14px 20px", border:"none", background:"transparent", borderBottom:activeProd===i?`2px solid ${C.rg}`:"2px solid transparent", color:activeProd===i?C.rg:C.muted, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:isMobile?12:13, fontWeight:activeProd===i?500:400, display:"flex", alignItems:"center", justifyContent:isMobile?"center":"flex-start", gap:5, WebkitTapHighlightColor:"transparent" }}>
            {t}{localProds[i]?.name?.trim() && <span style={{ width:6, height:6, borderRadius:"50%", background:C.success, display:"inline-block", flexShrink:0 }}/>}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:isMobile?`16px 16px 80px`:`24px ${px} 60px` }}>
        <div className="fade" style={{ maxWidth:700, margin:"0 auto" }}>
          <Sec title="ข้อมูลพื้นฐาน" sub="Basic Information">
            <FR><FW label="ชื่อสินค้า *" sub="Product Name" s={2}><input value={p.name} onChange={e=>upd("name",e.target.value)} placeholder="เช่น Konjac Jelly Drink, คอลลาเจน 10000mg..." style={inp(true)}/></FW></FR>
            <FR cols={2}>
              <FW label="หมวดหมู่ *" sub="Category"><select value={p.category} onChange={e=>upd("category",e.target.value)} style={inp()}>{CATEGORIES.map(c=><option key={c} value={c}>{c||"— เลือก —"}</option>)}</select></FW>
              <FW label="ราคาโดยประมาณ" sub="Est. Price (THB)"><input value={p.priceRange} onChange={e=>upd("priceRange",e.target.value)} placeholder="เช่น 150–350 บาท" style={inp()}/></FW>
            </FR>
            <FR cols={2}>
              <FW label="กลุ่มเป้าหมาย" sub="เลือกได้หลายกลุ่ม">
                <div style={{ display:"flex", flexWrap:"wrap", gap:7, paddingTop:4 }}>
                  {TARGET_MARKETS.map(m => { const sel=(p.targetMarkets||[]).includes(m); return (
                    <div key={m} onClick={()=>toggleMarket(m)} style={{ padding:"7px 13px", borderRadius:20, border:`1.5px solid ${sel?C.rg:C.border}`, background:sel?C.rgLight:C.card, color:sel?C.rg:C.sub, fontSize:13, fontWeight:sel?500:400, cursor:"pointer", userSelect:"none", WebkitUserSelect:"none", WebkitTapHighlightColor:"transparent" }}>
                      {sel?"✓ ":""}{m}
                    </div>
                  );})}
                </div>
              </FW>
              <FW label="ความน่าสนใจโดยรวม" sub="Viability"><select value={p.viability} onChange={e=>upd("viability",e.target.value)} style={inp()}>{VIABILITY.map(v=><option key={v} value={v}>{v||"— เลือก —"}</option>)}</select></FW>
            </FR>
          </Sec>
          <Sec title="ลิงก์และอ้างอิง" sub="Links & References">
            <FR><FW label="🌐 เว็บไซต์สินค้า *" sub="Product Website" s={2}><input value={p.websiteLink} onChange={e=>upd("websiteLink",e.target.value)} placeholder="https://..." style={inp()} inputMode="url" autoCapitalize="none"/></FW></FR>
            <FR><FW label="🔗 ลิงก์ Affiliate" sub="Affiliate or Purchase Link" s={2}><input value={p.affiliateLink} onChange={e=>upd("affiliateLink",e.target.value)} placeholder="ลิงก์ affiliate หรือลิงก์ซื้อสินค้า" style={inp()} inputMode="url" autoCapitalize="none"/></FW></FR>
            <FR cols={2}>
              <FW label="🥊 คู่แข่งหลัก" sub="Competitor"><input value={p.competitor} onChange={e=>upd("competitor",e.target.value)} placeholder="เช่น แบรนด์ X" style={inp()}/></FW>
              <FW label="สถานะ Affiliate"><select value={p.affiliateStatus} onChange={e=>upd("affiliateStatus",e.target.value)} style={inp()}>{AFFILIATE_STATUS.map(a=><option key={a} value={a}>{a||"— เลือก —"}</option>)}</select></FW>
            </FR>
            {imgs.map(({f,label,sub}) => (
              <FR key={f}><FW label={label} sub={sub} s={2}><input value={p[f]||""} onChange={e=>upd(f,e.target.value)} placeholder="วางลิงก์รูปภาพที่นี่..." style={inp()} inputMode="url" autoCapitalize="none"/></FW></FR>
            ))}
            {[p.imageUrl,p.imageUrl2,p.imageUrl3].some(Boolean) && (
              <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:4 }}>
                {[p.imageUrl,p.imageUrl2,p.imageUrl3].filter(Boolean).map((url,i) => (
                  <div key={i} style={{ padding:8, background:C.soft, borderRadius:10, border:`1px solid ${C.border}` }}>
                    <img src={url} alt={`preview ${i+1}`} style={{ maxHeight:90, maxWidth:140, objectFit:"contain", borderRadius:6, display:"block" }} onError={e=>{e.target.parentElement.style.display="none"}}/>
                  </div>
                ))}
              </div>
            )}
          </Sec>
          <Sec title="วิเคราะห์โอกาส" sub="Opportunity Analysis — ยิ่งละเอียดยิ่งดี">
            <FR><FW label="💡 ทำไมสินค้านี้ถึงมีโอกาส? *" sub="Why does this product have potential?" s={2}><textarea value={p.whySell} onChange={e=>upd("whySell",e.target.value)} placeholder="อธิบายเหตุผล — กระแส trend, ปัญหาที่แก้ได้, margin ที่คุ้มค่า..." rows={4} style={{...inp(), lineHeight:1.7}}/></FW></FR>
            <FR><FW label="🇹🇭 โอกาสในตลาดไทย" sub="Thai Market Opportunity" s={2}><textarea value={p.thaiMarket} onChange={e=>upd("thaiMarket",e.target.value)} placeholder="กลุ่มลูกค้าในไทยคือใคร? ช่องทางที่เหมาะสม เช่น Shopee, TikTok Shop..." rows={3} style={{...inp(), lineHeight:1.7}}/></FW></FR>
            <FR><FW label="🌍 โอกาสในตลาดต่างประเทศ" sub="International Potential" s={2}><textarea value={p.intlMarket} onChange={e=>upd("intlMarket",e.target.value)} placeholder="ประเทศหรือภูมิภาคที่น่าสนใจ? Amazon, ClickBank..." rows={3} style={{...inp(), lineHeight:1.7}}/></FW></FR>
          </Sec>
          <div style={{ display:"flex", alignItems:"center", gap:12, paddingTop:4, flexWrap:"wrap", paddingBottom:isMobile?20:0 }}>
            <button onClick={doSave} disabled={saveMsg==="saving"} style={{ ...prime(), opacity:saveMsg==="saving"?.7:1 }}>
              {saveMsg==="saving"?"⏳ กำลังบันทึก...":"💾 บันทึกข้อมูล"}
            </button>
            {saveMsg==="ok" && <><span style={{ fontSize:13, color:C.success, fontWeight:500 }}>✓ บันทึกสำเร็จ ☁️</span><button onClick={logout} style={{ ...ghost(), fontSize:13 }}>← หน้าแรก</button></>}
            {saveMsg==="err" && <span style={{ fontSize:13, color:C.danger }}>⚠ บันทึกไม่สำเร็จ — ลองอีกครั้ง</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Admin({ db, persist, completed, allProds, active, lastSaved, fmtTime, refreshing, manualRefresh, synced, go, logout }) {
  const { isMobile } = useBreakpoint();
  const toggle       = async () => await persist({ ...db, votingOpen: !db.votingOpen });
  const reveal       = async () => await persist({ ...db, votingRevealed: true });
  const resetAll     = async () => { if (window.confirm("รีเซ็ตข้อมูลทั้งหมด?")) await persist({ ...defaultDB() }); };
  const toggleMember = async (m) => { const cur = db.activeMembers||defaultActive(); await persist({ ...db, activeMembers: { ...cur, [m]: !cur[m] } }); };
  const px = isMobile ? "16px" : "26px";

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:`0 ${px}`, height:56, display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}><Logo size={isMobile?13:14}/>{!isMobile && <><div style={{ width:1, height:18, background:C.border }}/><span style={{ fontSize:11, background:C.charcoal, color:"#fff", padding:"3px 12px", borderRadius:20 }}>🔑 Admin</span></>}</div>
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          <StatusBar lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} manualRefresh={manualRefresh} synced={synced}/>
          <button onClick={() => go("vote")} style={{ ...ghost(), fontSize:12 }}>🗳️{!isMobile&&" โหวต"}</button>
          <button onClick={logout} style={{ ...ghost(), fontSize:12 }}>{isMobile?"✕":"ออก"}</button>
        </div>
      </div>
      <div style={{ maxWidth:760, margin:"0 auto", padding:`20px ${px}` }}>
        <div className="grid3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:18 }}>
          {[{l:"เข้าร่วม/กรอกครบ",v:`${completed.length}/${Object.values(active).filter(Boolean).length}`,c:C.success},{l:"สินค้าทั้งหมด",v:`${allProds.length}`,c:C.rg},{l:"สถานะโหวต",v:db.votingOpen?"เปิด 🟢":"ปิด 🔴",c:db.votingOpen?C.success:C.muted}].map(s => (
            <div key={s.l} style={{ background:C.card, borderRadius:12, padding:"16px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>{s.l}</div>
              <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:24, fontWeight:700, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
        <div style={{ background:C.card, borderRadius:12, padding:isMobile?"16px":"22px", marginBottom:16, border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
          <SH title="จัดการสมาชิก" sub="คลิกเพื่อเปิด/ปิด · สินค้าของสมาชิกที่ปิดจะไม่แสดงในหน้าโหวต"/>
          <div className="grid3" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {MEMBERS.map(m => {
              const isActive = active[m] !== false;
              const filled   = (db.nominations[m]||[]).filter(p => p?.name?.trim()).length;
              return (
                <div key={m} onClick={() => toggleMember(m)} style={{ padding:"12px", borderRadius:9, background:isActive?(filled===3?"#EDF8F3":C.soft):"#F5F5F5", border:`1.5px solid ${isActive?(filled===3?C.success:C.border):"#DDD"}`, cursor:"pointer", opacity:isActive?1:.55, WebkitTapHighlightColor:"transparent" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:5 }}>
                    <span style={{ fontSize:13, fontWeight:500, color:isActive?C.dark:"#AAA" }}>{m}</span>
                    <div style={{ width:30, height:17, borderRadius:9, background:isActive?C.success:"#CCC", position:"relative", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:1.5, left:isActive?13:1.5, width:14, height:14, borderRadius:"50%", background:"#fff", transition:"left .2s", boxShadow:"0 1px 3px rgba(0,0,0,.2)" }}/>
                    </div>
                  </div>
                  <div style={{ fontSize:11, color:isActive?(filled===3?C.success:C.muted):"#BBB" }}>{isActive?`${filled}/3${filled===3?" ✓":""}` : "ไม่เข้าร่วม"}</div>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ background:C.card, borderRadius:12, padding:isMobile?"16px":"22px", border:`1px solid ${C.border}`, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
          <SH title="ควบคุมการโหวต" sub="Voting Controls"/>
          <div style={{ fontSize:13, color:C.muted, marginBottom:16, padding:"10px 14px", background:C.soft, borderRadius:8, lineHeight:1.6 }}>
            เปิดระบบโหวตเมื่อสมาชิกทุกคนกรอกครบ ({completed.length}/{Object.values(active).filter(Boolean).length} คน)
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <button onClick={toggle} style={{ padding:"12px 20px", borderRadius:9, border:"none", cursor:"pointer", background:db.votingOpen?C.danger:C.success, color:"#fff", fontFamily:"'DM Sans',sans-serif", fontSize:14, fontWeight:500, WebkitTapHighlightColor:"transparent" }}>{db.votingOpen?"🔒 ปิดโหวต":"🔓 เปิดโหวต"}</button>
            {!db.votingRevealed ? <button onClick={reveal} style={{ ...ghost(), fontSize:13, color:C.charcoal, borderColor:C.charcoal }}>🏆 เปิดเผยผล</button> : <span style={{ fontSize:13, color:C.success, fontWeight:500 }}>✓ เปิดเผยผลแล้ว</span>}
            <button onClick={resetAll} style={{ ...ghost(true), fontSize:13, marginLeft:"auto" }}>🗑 Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Vote({ user, db, allProds, localVotes, allVotes, lastSaved, fmtTime, refreshing, manualRefresh, synced, doVote, doUnvote, go }) {
  const { isMobile } = useBreakpoint();
  const myTotal = Object.values(localVotes).reduce((s,v) => s+v, 0);
  const sorted  = db.votingRevealed ? [...allProds].sort((a,b) => (allVotes[b.key]||0)-(allVotes[a.key]||0)) : allProds;
  const maxV    = db.votingRevealed ? Math.max(...allProds.map(p => allVotes[p.key]||0), 1) : 1;
  const px      = isMobile ? "16px" : "26px";

  return (
    <div style={{ minHeight:"100vh", background:C.bg }}>
      <div style={{ background:C.card, borderBottom:`1px solid ${C.border}`, padding:`0 ${px}`, height:56, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:20, gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, minWidth:0 }}>
          <Logo size={isMobile?13:14}/>
          {!isMobile && <><div style={{ width:1, height:18, background:C.border }}/><span style={{ fontSize:12, color:C.muted, whiteSpace:"nowrap" }}><span style={{ color:C.rg, fontWeight:500 }}>{user}</span> · {myTotal} คะแนน</span></>}
        </div>
        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
          <StatusBar lastSaved={lastSaved} fmtTime={fmtTime} refreshing={refreshing} manualRefresh={manualRefresh} synced={synced}/>
          <button onClick={() => go(user==="Admin"?"admin":"form")} style={{ ...ghost(), fontSize:12, whiteSpace:"nowrap" }}>← กลับ</button>
        </div>
      </div>
      {isMobile && <div style={{ background:C.soft, padding:"7px 16px", fontSize:12, color:C.muted }}><span style={{ color:C.rg, fontWeight:500 }}>{user}</span> · โหวตสะสม {myTotal} คะแนน</div>}
      <div style={{ maxWidth:720, margin:"0 auto", padding:`16px ${px} 60px` }}>
        <div style={{ background:C.rgLight, border:`1px solid #EDD0D5`, borderRadius:10, padding:"12px 16px", marginBottom:18, fontSize:13, color:C.rg, lineHeight:1.6 }}>
          <strong>วิธีโหวต:</strong> ไม่ระบุชื่อผู้เสนอ · <strong>＋</strong> เพิ่ม · <strong>—</strong> ถอน · โหวตได้ไม่จำกัด
          {!db.votingRevealed && <span style={{ color:C.muted }}> · ผลรวมเปิดเผยโดย Admin</span>}
        </div>
        {allProds.length === 0 && <div style={{ textAlign:"center", padding:"60px 0", color:C.muted, fontSize:14 }}>ยังไม่มีสินค้าในระบบ</div>}
        <div style={{ display:"grid", gap:12 }}>
          {sorted.map((p,idx) => {
            const mv = localVotes[p.key]||0, tv = allVotes[p.key]||0;
            const isTop = db.votingRevealed && idx===0 && tv>0;
            const targets = (p.targetMarkets||[]).join(", ");
            return (
              <div key={p.key} style={{ background:C.card, borderRadius:14, border:isTop?`2px solid ${C.rg}`:mv>0?`2px solid ${C.rgLight}`:`1px solid ${C.border}`, boxShadow:isTop?"0 4px 20px rgba(183,110,121,.12)":"0 2px 10px rgba(0,0,0,0.04)", overflow:"hidden" }}>
                {isTop && <div style={{ background:`linear-gradient(90deg,${C.rg},${C.rgMid})`, padding:"7px 16px", fontSize:12, color:"#fff", fontWeight:500 }}>🏆 อันดับ 1 — Winner</div>}
                <div style={{ padding:isMobile?"14px":"18px", display:"flex", gap:12, alignItems:"flex-start" }}>
                  {p.imageUrl && !isMobile && <img src={p.imageUrl} alt={p.name} style={{ width:64, height:64, objectFit:"contain", borderRadius:9, background:C.soft, flexShrink:0, border:`1px solid ${C.border}` }} onError={e=>{e.target.style.display="none"}}/>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
                      {p.imageUrl && isMobile && <img src={p.imageUrl} alt={p.name} style={{ width:44, height:44, objectFit:"contain", borderRadius:7, background:C.soft, flexShrink:0, border:`1px solid ${C.border}` }} onError={e=>{e.target.style.display="none"}}/>}
                      <div style={{ minWidth:0, flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:isMobile?14:15, color:C.dark, marginBottom:3 }}>{p.name}</div>
                        <div style={{ fontSize:11, color:C.muted, marginBottom:6 }}>{[p.category,p.priceRange,targets].filter(Boolean).join(" · ")}</div>
                      </div>
                    </div>
                    {p.whySell && <div style={{ fontSize:12, color:C.sub, lineHeight:1.6, padding:"8px 12px", background:C.soft, borderRadius:8, marginBottom:8, marginTop:4 }}>{p.whySell.slice(0,120)}{p.whySell.length>120?"...":""}</div>}
                    <div style={{ display:"flex", gap:12 }}>
                      {p.websiteLink && <a href={p.websiteLink} target="_blank" rel="noreferrer" style={{ fontSize:11, color:C.rg, textDecoration:"none", fontWeight:500 }}>🌐 Website</a>}
                      {p.affiliateLink && <a href={p.affiliateLink} target="_blank" rel="noreferrer" style={{ fontSize:11, color:C.rg, textDecoration:"none", fontWeight:500 }}>🔗 Affiliate</a>}
                    </div>
                    {db.votingRevealed && tv>0 && <div style={{ marginTop:10, height:3, background:C.soft, borderRadius:4, overflow:"hidden" }}><div style={{ height:"100%", width:`${(tv/maxV)*100}%`, background:`linear-gradient(90deg,${C.rg},${C.rgMid})`, borderRadius:4 }}/></div>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:5, flexShrink:0 }}>
                    <button onClick={() => doVote(p.key)} style={{ width:42, height:42, background:C.rg, color:"#fff", border:"none", borderRadius:10, fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 8px rgba(183,110,121,.3)", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>＋</button>
                    <div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:20, fontWeight:700, color:C.dark, minWidth:36, textAlign:"center" }}>{db.votingRevealed?tv:mv>0?`+${mv}`:"—"}</div>
                    {db.votingRevealed && <div style={{ fontSize:10, color:C.muted }}>คะแนน</div>}
                    {mv>0 && <button onClick={() => doUnvote(p.key)} style={{ width:42, height:42, background:C.soft, color:C.muted, border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent", touchAction:"manipulation" }}>—</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Sec({ title, sub, children }) {
  return (
    <div style={{ background:C.card, borderRadius:14, border:`1px solid ${C.border}`, overflow:"hidden", marginBottom:14, boxShadow:"0 2px 10px rgba(0,0,0,0.04)" }}>
      <div style={{ padding:"13px 20px", borderBottom:`1px solid ${C.border}`, background:C.soft }}><div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:15, fontWeight:700, color:C.dark }}>{title}</div>{sub && <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>{sub}</div>}</div>
      <div style={{ padding:"18px 20px" }}>{children}</div>
    </div>
  );
}
function SH({ title, sub }) { return <div style={{ marginBottom:14 }}><div style={{ fontFamily:"'Libre Baskerville',serif", fontSize:15, fontWeight:700, color:C.dark }}>{title}</div>{sub && <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>{sub}</div>}</div>; }
function FR({ children, cols=1 }) { return <div className={cols===2?"grid2":""} style={{ display:"grid", gridTemplateColumns:cols===2?"1fr 1fr":"1fr", gap:12, marginBottom:12 }}>{children}</div>; }
function FW({ label, sub, children, s=1 }) { return <div style={{ gridColumn:s===2?"1/-1":undefined }}><div style={{ marginBottom:6, display:"flex", alignItems:"baseline", gap:5, flexWrap:"wrap" }}><span style={{ fontSize:12, fontWeight:500, color:C.dark }}>{label}</span>{sub && <span style={{ fontSize:11, color:C.muted }}>{sub}</span>}</div>{children}</div>; }
function FL({ children }) { return <div style={{ fontSize:13, fontWeight:500, color:C.dark, marginBottom:6 }}>{children}</div>; }
