const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);function toast(t){let x=$('#toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}
function page(id){$$('.page').forEach(x=>x.classList.toggle('active',x.id==id));$$('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page==id));scrollTo(0,0)}
$$('[data-page]').forEach(x=>x.onclick=()=>page(x.dataset.page));$('#bell').onclick=()=>page('alerts');
$$('.sw').forEach(x=>x.onclick=()=>{x.classList.toggle('on');toast(x.dataset.name+': '+(x.classList.contains('on')?'تشغيل':'إيقاف'))});
$('#mode').onclick=e=>{e.target.textContent=e.target.textContent==='AUTO'?'MANUAL':'AUTO';toast('تم تغيير وضع التحكم')};
$('#clear').onclick=()=>{$('#alertsList').innerHTML='<article class="alert good">🟢 <div><b>لا توجد تنبيهات جديدة</b><small>النظام يعمل بشكل طبيعي</small></div></article>';toast('تم مسح التنبيهات')};
$('#save').onclick=()=>toast('تم حفظ الإعدادات');
[['fan','fo'],['crit','fc'],['pad','po'],['low','lo'],['critical','lc']].forEach(([a,b])=>$('#'+a).oninput=e=>$('#'+b).value=e.target.value);
function chart(id,v){let c=$('#'+id),ctx=c.getContext('2d');function draw(){let r=c.getBoundingClientRect(),d=devicePixelRatio||1;c.width=r.width*d;c.height=r.height*d;ctx.scale(d,d);let w=r.width,h=r.height,p=10,min=Math.min(...v)-1,max=Math.max(...v)+1;ctx.strokeStyle='#dce8e5';for(let i=0;i<4;i++){let y=p+i*(h-2*p)/3;ctx.beginPath();ctx.moveTo(p,y);ctx.lineTo(w-p,y);ctx.stroke()}ctx.strokeStyle='#0b7a70';ctx.lineWidth=3;ctx.beginPath();v.forEach((z,i)=>{let x=p+i*(w-2*p)/(v.length-1),y=h-p-(z-min)/(max-min)*(h-2*p);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke()}draw();addEventListener('resize',draw)}
chart('c1',[25,26,27,29,31,30,28,29,32,31,29,28.4]);chart('c2',[24,26,28,31,34,32,30,29,28,27,29,28]);chart('c3',[95,91,87,84,80,76,72,70,74,78,80,78]);

// ===== Hydro Farm MQTT =====
const MQTT_HOST='99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud';
const MQTT_WS_PORT=8884;
const TOPICS={
  air:'hydrofarm/sensors/air_temperature', humidity:'hydrofarm/sensors/humidity',
  water:'hydrofarm/sensors/water_temperature', level:'hydrofarm/sensors/water_level',
  ph:'hydrofarm/sensors/ph', ec:'hydrofarm/sensors/ec', status:'hydrofarm/status',
  pump:'hydrofarm/control/pump', fan:'hydrofarm/control/fan', pad:'hydrofarm/control/pad'
};
let mqttClient=null;
const mqttState={temp:null,hum:null,wt:null,level:null,ph:null,ec:null};
function setText(id,v,suffix=''){const e=document.getElementById(id);if(e&&v!==null&&v!==undefined)e.textContent=`${v}${suffix}`}
function numberPayload(msg){const n=Number(String(msg).trim());return Number.isFinite(n)?n:null}
function setConnection(online){
  const status=document.querySelector('.status');
  if(status){status.querySelector('span').textContent=online?'●':'○'; status.querySelector('b').textContent=online?'النظام متصل':'غير متصل'; status.querySelector('small').textContent=online?'ESP32 • MQTT • Online':'ESP32 • MQTT • Offline'}
  document.querySelectorAll('#settings .green').forEach((e,i)=>{e.textContent=online?'متصل':'غير متصل';e.classList.toggle('green',online)});
}
function updateSensor(topic,msg){
  const v=numberPayload(msg); if(v===null)return;
  if(topic===TOPICS.air){mqttState.temp=v;setText('temp',v.toFixed(1),'°C');setText('cv',v.toFixed(1),'°C')}
  else if(topic===TOPICS.humidity){mqttState.hum=v;setText('hum',v.toFixed(0),'%')}
  else if(topic===TOPICS.water){mqttState.wt=v;setText('wt',v.toFixed(1),'°C')}
  else if(topic===TOPICS.level){mqttState.level=v;setText('level',v.toFixed(0),'%')}
  else if(topic===TOPICS.ph){mqttState.ph=v;setText('ph',v.toFixed(2))}
  else if(topic===TOPICS.ec){mqttState.ec=v;setText('ec',v.toFixed(2))}
}
function connectMQTT(){
  if(typeof mqtt==='undefined'){toast('مكتبة MQTT لم تُحمّل');return}
  const user=document.getElementById('mqttUser')?.value.trim()||'hydro01';
  const pass=document.getElementById('mqttPass')?.value||'';
  if(!pass){toast('أدخل كلمة مرور MQTT');return}
  try{localStorage.setItem('hydro_mqtt_user',user)}catch(e){}
  if(mqttClient){try{mqttClient.end(true)}catch(e){}}
  const url=`wss://${MQTT_HOST}:${MQTT_WS_PORT}/mqtt`;
  mqttClient=mqtt.connect(url,{username:user,password:pass,clientId:'hydrofarm_'+Math.random().toString(16).slice(2),clean:true,reconnectPeriod:3000,connectTimeout:10000,keepalive:30});
  mqttClient.on('connect',()=>{setConnection(true);toast('تم الاتصال بـ HiveMQ');Object.values(TOPICS).slice(0,7).forEach(t=>mqttClient.subscribe(t,{qos:0}))});
  mqttClient.on('message',(topic,payload)=>updateSensor(topic,payload.toString()));
  mqttClient.on('reconnect',()=>setConnection(false));
  mqttClient.on('offline',()=>setConnection(false));
  mqttClient.on('close',()=>setConnection(false));
  mqttClient.on('error',()=>{setConnection(false);toast('خطأ في اتصال MQTT')});
}
function publishControl(topic,value){if(!mqttClient||!mqttClient.connected){toast('MQTT غير متصل');return false}mqttClient.publish(topic,value,{qos:0,retain:false});return true}
// Override quick switches to send real MQTT commands
$$('.sw').forEach(x=>x.addEventListener('click',()=>{
  const on=x.classList.contains('on'); const n=x.dataset.name||'';
  const topic=n.includes('مضخة')?TOPICS.pump:n.includes('مروحة')?TOPICS.fan:TOPICS.pad;
  publishControl(topic,on?'ON':'OFF');
}));
const oldSave=document.getElementById('save');
oldSave?.addEventListener('click',()=>{connectMQTT()});
const mb=document.getElementById('mqttConnect');mb?.addEventListener('click',connectMQTT);
try{const u=localStorage.getItem('hydro_mqtt_user');if(u&&document.getElementById('mqttUser'))document.getElementById('mqttUser').value=u}catch(e){}
setConnection(false);


/* Hydro Farm MQTT Cloud connection */
(function(){
 const $=id=>document.getElementById(id);
 const host=$("mqttHost"),port=$("mqttPort"),user=$("mqttUsername"),pass=$("mqttPassword");
 const status=$("mqttConnectionStatus"),connectBtn=$("mqttConnectBtn"),disconnectBtn=$("mqttDisconnectBtn"),last=$("mqttLastMessage");
 if(!host||!port||!user||!pass||!connectBtn)return;
 let client=null;
 const topics={air_temperature:"hydrofarm/sensors/air_temperature",humidity:"hydrofarm/sensors/humidity",water_temperature:"hydrofarm/sensors/water_temperature",water_level:"hydrofarm/sensors/water_level",ph:"hydrofarm/sensors/ph",ec:"hydrofarm/sensors/ec",status:"hydrofarm/status",alerts:"hydrofarm/alerts",pump:"hydrofarm/control/pump",fan:"hydrofarm/control/fan",pad:"hydrofarm/control/pad"};
 try{host.value=localStorage.getItem("hf_mqtt_host")||host.value;port.value=localStorage.getItem("hf_mqtt_port")||port.value;user.value=localStorage.getItem("hf_mqtt_user")||user.value}catch(e){}
 function st(x){status.textContent=x}
 function save(){try{localStorage.setItem("hf_mqtt_host",host.value.trim());localStorage.setItem("hf_mqtt_port",port.value.trim());localStorage.setItem("hf_mqtt_user",user.value.trim())}catch(e){}}
 function connect(){
   if(!window.mqtt){st("🔴 مكتبة MQTT غير متاحة");return}
   const h=host.value.trim(),p=Number(port.value)||8884,u=user.value.trim(),pw=pass.value;
   if(!h||!u||!pw){st("🟠 أدخل Host وUsername وPassword");return}
   save(); if(client)try{client.end(true)}catch(e){}
   st("🟡 جاري الاتصال...");
   client=mqtt.connect("wss://"+h+":"+p+"/mqtt",{username:u,password:pw,clientId:"hydrofarm_"+Math.random().toString(16).slice(2),clean:true,connectTimeout:10000,reconnectPeriod:3000,keepalive:30});
   client.on("connect",()=>{st("🟢 MQTT متصل");client.subscribe(Object.values(topics).filter(t=>!t.includes("/control/")));last.textContent="تم الاتصال بـ HiveMQ Cloud.";});
   client.on("reconnect",()=>st("🟡 إعادة الاتصال..."));client.on("offline",()=>st("🟠 غير متصل"));client.on("close",()=>st("🔴 غير متصل"));
   client.on("error",e=>{console.error(e);st("🔴 خطأ في MQTT");last.textContent=e.message||"تعذر الاتصال";});
   client.on("message",(topic,payload)=>{const value=payload.toString();last.textContent="آخر رسالة: "+topic+" = "+value;window.dispatchEvent(new CustomEvent("hydrofarm:mqtt-message",{detail:{topic,value}}));});
 }
 function disconnect(){if(client){client.end(true);client=null}st("🔴 غير متصل")}
 function publish(topic,value){if(!client||!client.connected){st("🟠 MQTT غير متصل");return false}client.publish(topic,String(value));return true}
 connectBtn.onclick=connect;if(disconnectBtn)disconnectBtn.onclick=disconnect;
 window.HydroFarmMQTT={connect,disconnect,publish,pump:v=>publish(topics.pump,v?"ON":"OFF"),fan:v=>publish(topics.fan,v?"ON":"OFF"),pad:v=>publish(topics.pad,v?"ON":"OFF"),topics};
})();
