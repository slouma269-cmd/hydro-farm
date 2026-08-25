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

// ===== Hydro Farm MQTT — GH001 organized architecture =====
const MQTT_HOST='99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud';
const MQTT_WS_PORT=8884;
const GREENHOUSE_ID='GH001';

const TOPICS={
  telemetry:`greenhouse/${GREENHOUSE_ID}/telemetry`,
  sensors:`greenhouse/${GREENHOUSE_ID}/sensors/#`,
  actuatorState:`greenhouse/${GREENHOUSE_ID}/actuators/+/state`,
  alerts:`greenhouse/${GREENHOUSE_ID}/alerts`,
  status:`greenhouse/${GREENHOUSE_ID}/status`,
  config:`greenhouse/${GREENHOUSE_ID}/config/#`,
  control:(a)=>`greenhouse/${GREENHOUSE_ID}/control/${a}/set`,
  automation:(d)=>`greenhouse/${GREENHOUSE_ID}/automation/${d}/set`
};

let mqttClient=null;
const mqttState={temp:null,hum:null,wt:null,level:null,ph:null,ec:null};

function setText(id,v,suffix=''){
  const e=document.getElementById(id);
  if(e&&v!==null&&v!==undefined)e.textContent=`${v}${suffix}`;
}

function setConnection(online){
  const status=document.querySelector('.status');
  if(status){
    status.querySelector('span').textContent=online?'●':'○';
    status.querySelector('b').textContent=online?'النظام متصل':'غير متصل';
    status.querySelector('small').textContent=online?'ESP32 • MQTT • Online':'ESP32 • MQTT • Offline';
  }
  const green=document.querySelectorAll('#settings .green');
  green.forEach(e=>e.textContent=online?'متصل':'غير متصل');
}

function updateSensor(topic,msg){
  let data;
  try{data=JSON.parse(msg)}catch(e){data=null}
  if(data && typeof data==='object'){
    if(topic===TOPICS.telemetry){
      if(Number.isFinite(Number(data.temperature))){mqttState.temp=Number(data.temperature);setText('temp',mqttState.temp.toFixed(1),'°C');setText('cv',mqttState.temp.toFixed(1),'°C')}
      if(Number.isFinite(Number(data.humidity))){mqttState.hum=Number(data.humidity);setText('hum',mqttState.hum.toFixed(0),'%')}
      if(Number.isFinite(Number(data.water_temperature))){mqttState.wt=Number(data.water_temperature);setText('wt',mqttState.wt.toFixed(1),'°C')}
      if(Number.isFinite(Number(data.water_level))){mqttState.level=Number(data.water_level);setText('level',mqttState.level.toFixed(0),'%')}
      if(Number.isFinite(Number(data.ph))){mqttState.ph=Number(data.ph);setText('ph',mqttState.ph.toFixed(2))}
      if(Number.isFinite(Number(data.ec))){mqttState.ec=Number(data.ec);setText('ec',mqttState.ec.toFixed(2))}
      checkAlerts(data);
      return;
    }
    if(topic===TOPICS.alerts) handleRemoteAlert(data);
    return;
  }
  const v=Number(String(msg).trim());
  if(!Number.isFinite(v))return;
  if(topic.includes('/temperature')){mqttState.temp=v;setText('temp',v.toFixed(1),'°C');setText('cv',v.toFixed(1),'°C')}
  else if(topic.includes('/humidity')){mqttState.hum=v;setText('hum',v.toFixed(0),'%')}
  else if(topic.includes('/water_temperature')){mqttState.wt=v;setText('wt',v.toFixed(1),'°C')}
  else if(topic.includes('/water_level')){mqttState.level=v;setText('level',v.toFixed(0),'%')}
  else if(topic.includes('/ph')){mqttState.ph=v;setText('ph',v.toFixed(2))}
  else if(topic.includes('/ec')){mqttState.ec=v;setText('ec',v.toFixed(2))}
}

function notification(title,body){
  if(!('Notification' in window))return;
  if(Notification.permission==='granted'){
    try{new Notification(title,{body,icon:'icons/icon-192.png',tag:'hydrofarm-alert'})}catch(e){}
  }
}

function addAlert(cls,title,small){
  const list=document.getElementById('alertsList');
  if(!list)return;
  const article=document.createElement('article');
  article.className=`alert ${cls}`;
  article.innerHTML=`🔔 <div><b>${title}</b><small>${small}</small></div>`;
  list.prepend(article);
}

function handleRemoteAlert(data){
  if(!data)return;
  const severity=String(data.severity||'WARNING').toUpperCase();
  const cls=severity==='HIGH'||severity==='CRITICAL'?'danger':'warning';
  const title=data.message||data.type||'تنبيه من البيت المحمي';
  const detail=data.value!==undefined?`القيمة: ${data.value}${data.limit!==undefined?' — الحد '+data.limit:''}`:'تنبيه MQTT';
  addAlert(cls,title,detail);
  notification(`Hydro Farm — ${severity}`,`${title} ${detail}`);
}

function checkAlerts(d){
  const t=Number(d.temperature), l=Number(d.water_level);
  const warning=Number(document.getElementById('fan')?.value||30);
  const critical=Number(document.getElementById('crit')?.value||33);
  const low=Number(document.getElementById('low')?.value||20);
  const criticalLow=Number(document.getElementById('critical')?.value||10);

  if(Number.isFinite(t) && t>=critical){
    notification('Hydro Farm — حرارة حرجة',`درجة الحرارة ${t}°C تجاوزت الحد ${critical}°C`);
  }else if(Number.isFinite(t) && t>=warning){
    notification('Hydro Farm — حرارة مرتفعة',`درجة الحرارة ${t}°C تجاوزت حد التحذير ${warning}°C`);
  }
  if(Number.isFinite(l) && l<=criticalLow){
    notification('Hydro Farm — مستوى ماء حرج',`مستوى الخزان ${l}%`);
  }else if(Number.isFinite(l) && l<=low){
    notification('Hydro Farm — مستوى الماء منخفض',`مستوى الخزان ${l}%`);
  }
}

function connectMQTT(){
  if(typeof mqtt==='undefined'){toast('مكتبة MQTT لم تُحمّل');return}
  const user=document.getElementById('mqttUser')?.value.trim()||localStorage.getItem('hydro_mqtt_user')||'hydro01';
  const passField=document.getElementById('mqttPass');
  const typed=passField?.value||'';
  const pass=typed || localStorage.getItem('hydro_mqtt_password') || '';

  if(!pass){toast('أدخل كلمة مرور MQTT مرة واحدة');return}

  localStorage.setItem('hydro_mqtt_user',user);
  localStorage.setItem('hydro_mqtt_password',pass);
  localStorage.setItem('hydro_mqtt_autoconnect','1');

  if('Notification' in window && Notification.permission==='default')
    Notification.requestPermission().catch(()=>{});

  if(mqttClient){try{mqttClient.end(true)}catch(e){}}

  mqttClient=mqtt.connect(`wss://${MQTT_HOST}:${MQTT_WS_PORT}/mqtt`,{
    username:user,password:pass,
    clientId:'hydrofarm_GH001_'+Math.random().toString(16).slice(2),
    clean:true,reconnectPeriod:3000,connectTimeout:10000,keepalive:30
  });

  mqttClient.on('connect',()=>{
    setConnection(true);
    toast('تم الاتصال بـ HiveMQ');
    mqttClient.subscribe([
      TOPICS.telemetry,
      TOPICS.sensors,
      TOPICS.actuatorState,
      TOPICS.alerts,
      TOPICS.status,
      TOPICS.config
    ],{qos:0});
  });
  mqttClient.on('message',(topic,payload)=>updateSensor(topic,payload.toString()));
  mqttClient.on('reconnect',()=>setConnection(false));
  mqttClient.on('offline',()=>setConnection(false));
  mqttClient.on('close',()=>setConnection(false));
  mqttClient.on('error',()=>{setConnection(false);toast('خطأ في اتصال MQTT')});
}

function publishControl(actuator,payload){
  if(!mqttClient||!mqttClient.connected){toast('MQTT غير متصل');return false}
  mqttClient.publish(TOPICS.control(actuator),JSON.stringify(payload),{qos:0,retain:false});
  return true;
}

function publishSimpleControl(actuator,on){
  return publishControl(actuator,{
    command:on?'ON':'OFF',
    request_id:'hf_'+Date.now().toString(36)
  });
}

// The existing UI switches remain unchanged; only their MQTT behavior is added.
$$('.sw').forEach(x=>x.addEventListener('click',()=>{
  const on=x.classList.contains('on');
  const n=x.dataset.name||'';
  const actuator=n.includes('مضخة')?'pump':n.includes('مروحة')?'fan':'pad';
  publishSimpleControl(actuator,on);
}));

document.getElementById('mqttConnect')?.addEventListener('click',connectMQTT);

const saveButton=document.getElementById('save');
saveButton?.addEventListener('click',()=>{
  const p=document.getElementById('mqttPass')?.value||'';
  if(p)localStorage.setItem('hydro_mqtt_password',p);
  localStorage.setItem('hydro_mqtt_autoconnect','1');
  toast('تم حفظ الإعدادات');
});

try{
  const u=localStorage.getItem('hydro_mqtt_user');
  if(u&&document.getElementById('mqttUser'))document.getElementById('mqttUser').value=u;
}catch(e){}

setConnection(false);

// Automatic connection after the first successful setup.
document.addEventListener('DOMContentLoaded',()=>{
  const saved=localStorage.getItem('hydro_mqtt_password');
  const auto=localStorage.getItem('hydro_mqtt_autoconnect')!=='0';
  if(saved&&auto)setTimeout(connectMQTT,700);
});
