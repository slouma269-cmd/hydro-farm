/* =========================================================
   HYDRO FARM GH001 — PHASE 2
   HiveMQ Cloud + Telemetry + Pump/Fan/Pad + AUTO/MANUAL
========================================================= */

const GH = "GH001";
const MQTT_HOST_DEFAULT = "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud";
const MQTT_PORT_DEFAULT = 8884;

const TOPICS = {
  telemetry: `greenhouse/${GH}/telemetry`,
  control: device => `greenhouse/${GH}/control/${device}/set`,
  actuator: device => `greenhouse/${GH}/actuators/${device}/state`,
  status: `greenhouse/${GH}/status`,
  alerts: `greenhouse/${GH}/alerts`
};

let client = null;
let connected = false;
let mode = localStorage.getItem("hydroMode") || "AUTO";
let history = JSON.parse(localStorage.getItem("hydroHistory") || "[]");
let state = {
  airTemperature:null, airHumidity:null, waterTemperature:null,
  waterLevel:null, ec:null, ph:null,
  pump:false, fan:false, pad_cooling:false
};

const $ = id => document.getElementById(id);
const toast = msg => {
  const el=$("toast"); if(!el) return;
  el.textContent=msg; el.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>el.classList.remove("show"),2200);
};

function setMQTTUI(ok){
  connected=ok;
  $("mqttDot").style.color=ok?"#22c55e":"#ef4444";
  $("mqttState").textContent=ok?"MQTT متصل":"MQTT غير متصل";
  $("mqttSub").textContent=ok?"HiveMQ Cloud • GH001":"HiveMQ Cloud • Offline";
  $("mqttStatus").textContent=ok?"متصل":"غير متصل";
  $("mqttStatus").className=ok?"green":"red";
  if(ok) $("status")?.classList.add("connected");
}

function setText(id,value){ const e=$(id); if(e) e.textContent=value; }

function updateModeUI(){
  setText("homeMode",mode); setText("mode",mode);
  ["pump","fan","pad"].forEach(d=>setText(d+"Mode",mode));
  setText("systemPumpMode",mode);
  setText("systemFanState",mode);
  const modeBtn=$("mode"); if(modeBtn) modeBtn.textContent=mode;
}
updateModeUI();

function setSwitch(device,on){
  const ids = device==="pump"?["pumpSwitch"]:
              device==="fan"?["fanSwitch"]:
              ["padSwitch","systemPadSwitch"];
  ids.forEach(id=>$(id)?.classList.toggle("on",!!on));
}
function updateActuators(){
  setSwitch("pump",state.pump); setSwitch("fan",state.fan); setSwitch("pad_cooling",state.pad_cooling);
  setText("systemPump",`المضخة ${state.pump?"ON":"OFF"}`);
  setText("systemFan",`المروحة ${state.fan?"ON":"OFF"}`);
}

function updateTelemetryUI(){
  if(state.airTemperature!=null){
    const v=Number(state.airTemperature);
    setText("temp",v.toFixed(1)+"°C"); setText("cv",v.toFixed(1)+"°C");
    setText("systemTemp",v.toFixed(1)+"°C");
  }
  if(state.airHumidity!=null){
    setText("hum",Number(state.airHumidity).toFixed(1)+"%");
    setText("dataHum",Number(state.airHumidity).toFixed(1)+"%");
  }
  if(state.waterTemperature!=null){
    setText("wt",Number(state.waterTemperature).toFixed(1)+"°C");
    setText("dataWt",Number(state.waterTemperature).toFixed(1)+"°C");
    setText("systemWaterTemp",Number(state.waterTemperature).toFixed(1)+"°C");
  }
  if(state.waterLevel!=null){
    const raw=Number(state.waterLevel);
    const pct=raw<=100?raw:Math.max(0,Math.min(100,(raw/4095)*100));
    setText("level",pct.toFixed(0)+"%");
    setText("systemTank","الخزان "+pct.toFixed(0)+"%");
  }
  if(state.ec!=null) setText("ec",Number(state.ec).toFixed(2)), setText("dataEc",Number(state.ec).toFixed(2));
  if(state.ph!=null) setText("ph",Number(state.ph).toFixed(2)), setText("dataPh",Number(state.ph).toFixed(2));

  const now=Date.now();
  if(state.airTemperature!=null){
    history.push({t:now,temp:Number(state.airTemperature),level:state.waterLevel});
    history=history.slice(-120);
    localStorage.setItem("hydroHistory",JSON.stringify(history));
  }
  setText("lastData",new Date().toLocaleTimeString("ar-TN"));
  setText("espStatus","Online");
  drawAllCharts();
}

function normalizeTelemetry(o){
  if(!o || typeof o!=="object") return;
  const pick=(...keys)=>{for(const k of keys) if(o[k]!==undefined && o[k]!==null) return o[k]; return null;};
  state.airTemperature=pick("airTemperature","temperature","temp","air_temp");
  state.airHumidity=pick("airHumidity","humidity","hum","air_humidity");
  state.waterTemperature=pick("waterTemperature","waterTemp","wt");
  state.waterLevel=pick("waterLevel","level","tankLevel");
  state.ec=pick("ec","EC");
  state.ph=pick("ph","pH","PH");

  const p=pick("pump","pump1"); const f=pick("fan","fan1"); const pad=pick("pad_cooling","padCooling","pad");
  if(p!==null) state.pump=!!Number(p);
  if(f!==null) state.fan=!!Number(f);
  if(pad!==null) state.pad_cooling=!!Number(pad);
  updateTelemetryUI(); updateActuators();
}

function addAlert(title,body,type="good"){
  const list=$("alertsList"); if(!list) return;
  const a=document.createElement("article"); a.className=`alert ${type}`;
  a.innerHTML=`🟢<div><b></b><small></small></div>`;
  a.querySelector("b").textContent=title; a.querySelector("small").textContent=body;
  list.prepend(a);
  while(list.children.length>20) list.lastElementChild.remove();
  setText("bellCount",Math.min(99,list.children.length));
}

function publish(topic,payload){
  if(!client || !connected){toast("MQTT غير متصل"); return false;}
  client.publish(topic,String(payload),{qos:0,retain:false},err=>{
    if(err) toast("فشل إرسال الأمر"); else toast("تم إرسال الأمر");
  });
  return true;
}

function toggleDevice(device){
  if(mode!=="MANUAL"){
    toast("غيّر الوضع إلى MANUAL أولاً");
    return;
  }
  const next = !state[device==="pad_cooling"?"pad_cooling":device];
  publish(TOPICS.control(device),next?"ON":"OFF");
}

function connectMQTT(){
  if(typeof mqtt==="undefined"){toast("مكتبة MQTT غير موجودة"); return;}
  if(client){ try{client.end(true);}catch(e){} client=null; }
  const host=$("mqttHost").value.trim() || MQTT_HOST_DEFAULT;
  const port=Number($("mqttPort").value)||MQTT_PORT_DEFAULT;
  const username=$("mqttUser").value.trim();
  const password=$("mqttPass").value;
  if(!username || !password){toast("أدخل Username و Password"); return;}

  const url=`wss://${host}:${port}/mqtt`;
  setText("mqttStatus","جار الاتصال...");
  toast("جاري الاتصال بـ HiveMQ...");

  client=mqtt.connect(url,{
    username,password,
    clean:true,
    connectTimeout:10000,
    reconnectPeriod:3000,
    clientId:`hydro-web-${GH}-${Math.random().toString(16).slice(2)}`
  });

  client.on("connect",()=>{
    setMQTTUI(true);
    client.subscribe([TOPICS.telemetry,TOPICS.status,TOPICS.alerts,"greenhouse/"+GH+"/actuators/+/state"],{qos:0});
    toast("تم الاتصال بـ HiveMQ Cloud");
    addAlert("اتصال MQTT","HiveMQ Cloud متصل","good");
  });
  client.on("reconnect",()=>{setMQTTUI(false);setText("mqttStatus","إعادة الاتصال...");});
  client.on("close",()=>setMQTTUI(false));
  client.on("offline",()=>setMQTTUI(false));
  client.on("error",e=>{console.error(e);setMQTTUI(false);toast("خطأ MQTT — تحقق من البيانات");});
  client.on("message",(topic,msg)=>{
    const text=msg.toString();
    try{
      const data=JSON.parse(text);
      if(topic===TOPICS.telemetry) normalizeTelemetry(data);
      else if(topic===TOPICS.status){
        const online = data.online ?? data.status === "online";
        setText("espStatus",online?"Online":"Offline");
      } else if(topic===TOPICS.alerts){
        addAlert(data.title||"تنبيه GH001",data.body||data.message||text,
          String(data.severity||"").toUpperCase()==="CRITICAL"?"danger":"warning");
      } else if(topic.includes("/actuators/")){
        const device=topic.split("/")[4];
        const val=data.state ?? data.value ?? data;
        if(device==="pump") state.pump=String(val).toUpperCase()==="ON" || Number(val)===1;
        if(device==="fan") state.fan=String(val).toUpperCase()==="ON" || Number(val)===1;
        if(device==="pad_cooling") state.pad_cooling=String(val).toUpperCase()==="ON" || Number(val)===1;
        updateActuators();
      }
    }catch(e){
      console.warn("Non-JSON MQTT message",topic,text);
    }
  });
}

function setMode(next){
  mode=next==="MANUAL"?"MANUAL":"AUTO";
  localStorage.setItem("hydroMode",mode);
  updateModeUI();
  publish(TOPICS.control("mode"),mode);
  addAlert("الوضع",`تم اختيار ${mode}`,"good");
}
function toggleMode(){ setMode(mode==="AUTO"?"MANUAL":"AUTO"); }

document.querySelectorAll("nav button").forEach(btn=>{
  btn.addEventListener("click",()=>{
    const id=btn.dataset.page;
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
    document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("active",b===btn));
    window.scrollTo({top:0,behavior:"smooth"});
  });
});

document.querySelectorAll(".sw").forEach(btn=>{
  btn.addEventListener("click",()=>toggleDevice(btn.dataset.device));
});
$("mode").addEventListener("click",toggleMode);
$("mqttConnect").addEventListener("click",connectMQTT);
$("clear").addEventListener("click",()=>{$("alertsList").innerHTML="";setText("bellCount","0");});
$("bell").addEventListener("click",()=>document.querySelector('nav button[data-page="alerts"]').click());

document.querySelectorAll(".ranges button").forEach(b=>{
  b.addEventListener("click",()=>{
    document.querySelectorAll(".ranges button").forEach(x=>x.classList.remove("sel"));
    b.classList.add("sel"); drawAllCharts();
  });
});

function drawChart(id,values,min,max){
  const c=$(id); if(!c) return;
  const rect=c.getBoundingClientRect(), dpr=devicePixelRatio||1;
  const w=Math.max(280,rect.width), h=145;
  c.width=w*dpr;c.height=h*dpr;
  const x=c.getContext("2d"); x.scale(dpr,dpr);x.clearRect(0,0,w,h);
  if(values.length<2){x.fillStyle="#8a9895";x.font="12px system-ui";x.fillText("لا توجد بيانات كافية",10,30);return;}
  min=min??Math.min(...values); max=max??Math.max(...values); if(max===min){max+=1;min-=1;}
  x.beginPath();
  values.forEach((v,i)=>{const px=8+i*(w-16)/(values.length-1),py=h-10-(Number(v)-min)/(max-min)*(h-25);i?x.lineTo(px,py):x.moveTo(px,py);});
  x.strokeStyle="#0b7a70";x.lineWidth=2;x.stroke();
}
function drawAllCharts(){
  const temps=history.map(x=>x.temp).filter(Number.isFinite);
  const levels=history.map(x=>x.level).filter(Number.isFinite);
  drawChart("c1",temps);drawChart("c2",temps);drawChart("c3",levels.length?levels:[]);
}
window.addEventListener("resize",drawAllCharts);
drawAllCharts();
setMQTTUI(false);
