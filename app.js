/* Hydroponic Farm - MQTT client
   ESP32 publishes JSON on: hydroponic/sensors
   App publishes commands on: hydroponic/control
*/
let client=null, mode="AUTO";
const state={pump1:0,pump2:0,pump3:0,pump4:0,fan1:0,fan2:0,cooling:0};

const $=id=>document.getElementById(id);
function num(v,d="--"){return v===undefined||v===null||v===""?d:v}
function setText(id,v){$(id).textContent=num(v)}
function setOnline(on){
  const el=$("connection"), st=$("mqttState");
  el.className="status "+(on?"online":"offline");
  el.innerHTML=`<span></span> ${on?"متصل":"غير متصل"}`;
  st.textContent=on?"متصل":"غير متصل";
}
function updateSensors(d){
  setText("airTemperature", d.airTemperature);
  setText("airHumidity", d.airHumidity);
  setText("waterLevel", d.waterLevel);
  setText("waterTemperature", d.waterTemperature);
  setText("ec", d.ec ?? d.tds);
  setText("ph", d.ph);
  ["pump1","pump2","pump3","pump4","fan1","fan2","cooling"].forEach(k=>{
    if(d[k]!==undefined){state[k]=Number(!!d[k]); updateToggle(k)}
  });
  $("lastUpdate").textContent="آخر تحديث: "+new Date().toLocaleTimeString("ar-TN");
  checkAlerts(d);
}
function updateToggle(device){
  const b=document.querySelector(`[data-device="${device}"]`);
  if(!b)return;
  b.classList.toggle("on",!!state[device]);
  b.textContent=state[device]?"ON":"OFF";
}
function publishControl(device,value){
  state[device]=Number(value);
  updateToggle(device);
  if(client?.connected){
    const topic=(localStorage.topic||"hydroponic")+"/control";
    client.publish(topic,JSON.stringify({device,value:Number(value),auto:mode==="AUTO"}),{qos:1});
  }
}
document.querySelectorAll(".toggle").forEach(b=>b.addEventListener("click",()=>{
  if(mode==="AUTO"){addAlert("انتقل إلى MANUAL قبل التحكم اليدوي.");return}
  publishControl(b.dataset.device,!state[b.dataset.device]);
}));
$("modeBtn").addEventListener("click",()=>{
  mode=mode==="AUTO"?"MANUAL":"AUTO";
  const b=$("modeBtn"); b.textContent=mode; b.className="mode "+(mode==="AUTO"?"auto":"manual");
  $("controlHint").textContent=mode==="AUTO"?"الوضع التلقائي":"الوضع اليدوي";
  if(client?.connected)client.publish((localStorage.topic||"hydroponic")+"/control",JSON.stringify({auto:mode==="AUTO"}),{qos:1});
});
function rangePair(id,out){const e=$(id),o=$(out);e.addEventListener("input",()=>o.textContent=e.value);e.addEventListener("change",sendSettings)}
["waterTarget","airTarget","highTemp"].forEach((x,i)=>rangePair(x,["waterTargetOut","airTargetOut","highTempOut"][i]));
function sendSettings(){
  if(!client?.connected)return;
  client.publish((localStorage.topic||"hydroponic")+"/settings",JSON.stringify({
    waterTarget:+$("waterTarget").value,airTarget:+$("airTarget").value,highTemp:+$("highTemp").value
  }),{qos:1});
}
function addAlert(text){
  const box=$("alerts"), empty=box.querySelector(".empty"); if(empty)empty.remove();
  const p=document.createElement("p");p.className="alert";p.textContent="⚠️ "+text;box.prepend(p);
}
function checkAlerts(d){
  if(d.airTemperature!=null && d.airTemperature>=+$("highTemp").value)addAlert("درجة حرارة الهواء مرتفعة: "+d.airTemperature+"°C");
  if(d.waterTemperature!=null && d.waterTemperature>=+$("waterTarget").value+5)addAlert("درجة حرارة الماء مرتفعة: "+d.waterTemperature+"°C");
  if(d.waterLevel!=null && Number(d.waterLevel)<100)addAlert("مستوى الماء منخفض.");
}
$("clearAlerts").onclick=()=>$("alerts").innerHTML='<p class="empty">لا توجد تنبيهات.</p>';

function connectMQTT(){
  const url=$("mqttUrl").value.trim(), user=$("mqttUser").value, pass=$("mqttPass").value;
  if(!url||url.includes("YOUR-HIVEMQ")){addAlert("ضع عنوان WebSocket الصحيح الخاص بـ HiveMQ Cloud.");return}
  localStorage.topic=$("mqttTopic").value.trim()||"hydroponic";
  localStorage.setItem("mqttUrl",url);localStorage.setItem("mqttUser",user);localStorage.setItem("mqttPass",pass);
  $("connectBtn").textContent="جاري الاتصال...";
  try{
    client=mqtt.connect(url,{username:user,password:pass,clientId:"hydro-app-"+Math.random().toString(16).slice(2),clean:true,reconnectPeriod:3000});
    client.on("connect",()=>{
      setOnline(true);$("connectBtn").textContent="متصل ✓";
      client.subscribe((localStorage.topic||"hydroponic")+"/sensors",{qos:1});
      client.subscribe((localStorage.topic||"hydroponic")+"/status",{qos:1});
    });
    client.on("message",(topic,payload)=>{
      try{
        const d=JSON.parse(payload.toString());
        if(topic.endsWith("/sensors"))updateSensors(d);
      }catch(e){console.warn("Bad MQTT JSON",e)}
    });
    client.on("close",()=>setOnline(false));
    client.on("error",()=>setOnline(false));
  }catch(e){setOnline(false);addAlert("تعذر إنشاء اتصال MQTT.");console.error(e)}
}
$("connectBtn").onclick=connectMQTT;
(function restore(){
  $("mqttUrl").value=localStorage.mqttUrl||$("mqttUrl").value;
  $("mqttUser").value=localStorage.mqttUser||"";
  $("mqttPass").value=localStorage.mqttPass||"";
  $("mqttTopic").value=localStorage.topic||"hydroponic";
  ["waterTarget","airTarget","highTemp"].forEach((id)=>{
    const v=localStorage[id]; if(v)$(id).value=v;
  });
})();
["waterTarget","airTarget","highTemp"].forEach(id=>$(id).addEventListener("change",()=>localStorage[id]=$(id).value));

if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("service-worker.js").catch(console.warn));
