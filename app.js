const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

function toast(t){
  const x = $('#toast');
  if(!x) return;
  x.textContent = t;
  x.classList.add('show');
  setTimeout(() => x.classList.remove('show'), 1800);
}


/* =========================================================
   NAVIGATION
========================================================= */

function page(id){
  $$('.page').forEach(x =>
    x.classList.toggle('active', x.id === id)
  );

  $$('nav button').forEach(x =>
    x.classList.toggle('active', x.dataset.page === id)
  );

  scrollTo(0,0);
}

$$('[data-page]').forEach(x =>
  x.onclick = () => page(x.dataset.page)
);

$('#bell')?.addEventListener('click', () => page('alerts'));


/* =========================================================
   SETTINGS SLIDERS
========================================================= */

[
  ['fan','fo'],
  ['crit','fc'],
  ['pad','po'],
  ['low','lo'],
  ['critical','lc']
].forEach(([a,b]) => {

  const input = $('#'+a);
  const output = $('#'+b);

  if(input && output){
    input.oninput = e => {
      output.value = e.target.value;
    };
  }

});


/* =========================================================
   MODE
========================================================= */

$('#mode')?.addEventListener('click', e => {

  const mode =
    e.target.textContent.trim() === 'AUTO'
      ? 'MANUAL'
      : 'AUTO';

  e.target.textContent = mode;

  const homeMode = $('#homeMode');
  if(homeMode) homeMode.textContent = mode;

  toast('تم تغيير وضع التحكم');
});


/* =========================================================
   ALERTS
========================================================= */

$('#clear')?.addEventListener('click', () => {

  const list = $('#alertsList');

  if(list){
    list.innerHTML = `
      <article class="alert good">
        🟢
        <div>
          <b>لا توجد تنبيهات جديدة</b>
          <small>النظام يعمل بشكل طبيعي</small>
        </div>
      </article>
    `;
  }

  toast('تم مسح التنبيهات');
});


function addAlert(cls,title,small){

  const list = $('#alertsList');

  if(!list) return;

  const article = document.createElement('article');

  article.className = `alert ${cls}`;

  article.innerHTML = `
    🔔
    <div>
      <b>${title}</b>
      <small>${small}</small>
    </div>
  `;

  list.prepend(article);
}


function notification(title,body){

  if(!('Notification' in window)) return;

  if(Notification.permission === 'granted'){

    try{

      new Notification(title,{
        body,
        icon:'icons/icon-192.png',
        tag:'hydrofarm-alert'
      });

    }catch(e){}

  }
}


function
  handleRemoteAlert(data){

  if(!data) return;

  const severity =
    String(data.severity || 'WARNING').toUpperCase();

  const cls =
    severity === 'HIGH' ||
    severity === 'CRITICAL'
      ? 'danger'
      : 'warning';

  const title =
    data.message ||
    data.type ||
    'تنبيه من البيت المحمي';

  const detail =
    data.value !== undefined
      ? `القيمة: ${data.value}${
          data.limit !== undefined
            ? ' — الحد '+data.limit
            : ''
        }`
      : 'تنبيه MQTT';

  addAlert(cls,title,detail);

  notification(
    `Hydro Farm — ${severity}`,
    `${title} ${detail}`
  );
}


/* =========================================================
   CHART
========================================================= */

function chart(id,v){

  const c = $('#'+id);

  if(!c) return;

  const ctx = c.getContext('2d');

  function draw(){

    const r = c.getBoundingClientRect();

    const d = window.devicePixelRatio || 1;

    c.width = r.width*d;
    c.height = r.height*d;

    ctx.setTransform(d,0,0,d,0,0);

    const w = r.width;
    const h = r.height;

    const p = 10;

    let min = Math.min(...v)-1;
    let max = Math.max(...v)+1;

    if(max === min) max = min+1;

    ctx.strokeStyle = '#dce8e5';

    for(let i=0;i<4;i++){

      const y =
        p+i*(h-2*p)/3;

      ctx.beginPath();
      ctx.moveTo(p,y);
      ctx.lineTo(w-p,y);
      ctx.stroke();

    }

    ctx.strokeStyle = '#0b7a70';
    ctx.lineWidth = 3;

    ctx.beginPath();

    v.forEach((z,i)=>{

      const x =
        p+i*(w-2*p)/(v.length-1);

      const y =
        h-p-
        (z-min)/(max-min)*(h-2*p);

      if(i)
        ctx.lineTo(x,y);
      else
        ctx.moveTo(x,y);

    });

    ctx.stroke();

  }

  draw();

  addEventListener('resize',draw);
}


chart('c1',[25,26,27,29,31,30,28,29,32,31,29,28.4]);
chart('c2',[24,26,28,31,34,32,30,29,28,27,29,28]);
chart('c3',[95,91,87,84,80,76,72,70,74,78,80,78]);


/* =========================================================
   MQTT CONFIGURATION
========================================================= */

const MQTT_HOST =
  '99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud';

const MQTT_WS_PORT = 8884;

const GREENHOUSE_ID = 'GH001';


const TOPICS = {

  root:
    `greenhouse/${GREENHOUSE_ID}`,

  telemetry:
    `greenhouse/${GREENHOUSE_ID}/telemetry`,

  sensors:
    `greenhouse/${GREENHOUSE_ID}/sensors/#`,

  actuatorState:
    `greenhouse/${GREENHOUSE_ID}/actuators/+/state`,

  alerts:
    `greenhouse/${GREENHOUSE_ID}/alerts`,

  status:
    `greenhouse/${GREENHOUSE_ID}/status`,

  config:
    `greenhouse/${GREENHOUSE_ID}/config/#`,

  control:
    actuator =>
      `greenhouse/${GREENHOUSE_ID}/control/${actuator}/set`,

  automation:
    device =>
      `greenhouse/${GREENHOUSE_ID}/automation/${device}/set`

};


let mqttClient = null;


const mqttState = {

  temp:null,
  hum:null,
  wt:null,
  level:null,
  ph:null,
  ec:null,

  pump:false,
  fan:false,
  pad:false,

  auto:true

};


/* =========================================================
   UI VALUE UPDATE
========================================================= */

function setText(id,v,suffix=''){

  const e = document.getElementById(id);

  if(
    e &&
    v !== null &&
    v !== undefined &&
    Number.isFinite(Number(v))
  ){

    e.textContent =
      `${v}${suffix}`;

  }

}


/* =========================================================
   CONNECTION STATUS
========================================================= */

function setConnection(online){

  const dot = $('#mqttDot');
  const state = $('#mqttState');
  const sub = $('#mqttSub');

  if(dot)
    dot.textContent = online ? '●' : '○';

  if(state)
    state.textContent =
      online
        ? 'النظام متصل'
        : 'النظام غير متصل';

  if(sub)
    sub.textContent =
      online
        ? 'ESP32 • MQTT • Online'
        : 'ESP32 • MQTT • Offline';


  const mqttStatus = $('#mqttStatus');

  if(mqttStatus){

    mqttStatus.textContent =
      online
        ? 'متصل'
        : 'غير متصل';

    mqttStatus.className =
      online ? 'green' : '';

  }


  const espStatus = $('#espStatus');

  if(espStatus){

    espStatus.textContent =
      online
        ? 'Online'
        : 'Offline';

    espStatus.className =
      online ? 'green' : '';

  }


  const alertConnection =
    $('#alertConnection');

  if(alertConnection){

    alertConnection.textContent =
      online
        ? 'HiveMQ Cloud • GH001 • متصل'
        : 'HiveMQ Cloud • GH001 • غير متصل';

  }

}


/* =========================================================
   UPDATE DEVICE STATES
========================================================= */

function updateSwitch(id,on){

  const e = $('#'+id);

  if(!e) return;

  e.classList.toggle('on',!!on);

}


function
  updateDeviceState(device,state){

  const on =
    String(state).toUpperCase() === 'ON';

  if(device === 'pump'){

    mqttState.pump = on;

    updateSwitch('pumpSwitch',on);

    const e = $('#systemPump');

    if(e)
      e.textContent =
        `المضخة ${on?'ON':'OFF'}`;

  }


  if(device === 'fan'){

    mqttState.fan = on;

    updateSwitch('fanSwitch',on);

    const e = $('#systemFanState');

    if(e)
      e.textContent =
        on
          ? 'تشغيل'
          : 'إيقاف';

  }


  if(
    device === 'pad' ||
    device === 'pad_cooling'
  ){

    mqttState.pad = on;

    updateSwitch('padSwitch',on);
    updateSwitch('systemPadSwitch',on);

  }

}


/* =========================================================
   SENSOR DATA
========================================================= */

function updateSensor(topic,msg){

  let data = null;

  try{

    data = JSON.parse(msg);

  }catch(e){

    data = null;

  }


  /* ============================================
     TELEMETRY JSON
  ============================================ */

  if(
    data &&
    typeof data === 'object' &&
    topic === TOPICS.telemetry
  ){

    /* Temperature */

    if(Number.isFinite(Number(data.temperature))){

      mqttState.temp =
        Number(data.temperature);

      setText(
        'temp',
        mqttState.temp.toFixed(1),
        '°C'
      );

      setText(
        'cv',
        mqttState.temp.toFixed(1),
        '°C'
      );

      setText(
        'systemTemp',
        mqttState.temp.toFixed(1),
        '°C'
      );

    }


    /* Humidity */

    if(Number.isFinite(Number(data.humidity))){

      mqttState.hum =
        Number(data.humidity);

      setText(
        'hum',
        mqttState.hum.toFixed(0),
        '%'
      );

      setText(
        'dataHum',
        mqttState.hum.toFixed(0),
        '%'
      );

    }


    /* Water temperature */

    if(
      Number.isFinite(
        Number(data.water_temperature)
      )
    ){

      mqttState.wt =
        Number(data.water_temperature);

      setText(
        'wt',
        mqttState.wt.toFixed(1),
        '°C'
      );

      setText(
        'dataWt',
        mqttState.wt.toFixed(1),
        '°C'
      );

      setText(
        'systemWaterTemp',
        mqttState.wt.toFixed(1),
        '°C'
      );

    }


    /* Water level */

    if(
      Number.isFinite(
        Number(data.water_level)
      )
    ){

      mqttState.level =
        Number(data.water_level);

      setText(
        'level',
        mqttState.level.toFixed(0),
        '%'
      );

      setText(
        'systemTank',
        `الخزان ${mqttState.level.toFixed(0)}%`
      );

    }


    /* pH */

    if(Number.isFinite(Number(data.ph))){

      mqttState.ph =
        Number(data.ph);

      setText(
        'ph',
        mqttState.ph.toFixed(2)
      );

      setText(
        'dataPh',
        mqttState.ph.toFixed(2)
      );

    }


    /* EC */

    if(Number.isFinite(Number(data.ec))){

      mqttState.ec =
        Number(data.ec);

      setText(
        'ec',
        mqttState.ec.toFixed(2)
      );

      setText(
        'dataEc',
        mqttState.ec.toFixed(2)
      );

    }


    /* Pump */

    if(data.pump !== undefined)
      updateDeviceState(
        'pump',
        data.pump ? 'ON':'OFF'
      );


    if(data.pump1 !== undefined)
      updateDeviceState(
        'pump',
        data.pump1 ? 'ON':'OFF'
      );


    /* Fan */

    if(data.fan !== undefined)
      updateDeviceState(
        'fan',
        data.fan ? 'ON':'OFF'
      );


    if(data.fan1 !== undefined)
      updateDeviceState(
        'fan',
        data.fan1 ? 'ON':'OFF'
      );


    /* Auto */

    if(data.auto !== undefined){

      mqttState.auto =
        !!data.auto;

      const mode =
        mqttState.auto
          ? 'AUTO'
          : 'MANUAL';

      if($('#homeMode'))
        $('#homeMode').textContent = mode;

      if($('#mode'))
        $('#mode').textContent = mode;

    }


    checkAlerts(data);

    return;

  }


  /* ============================================
     ACTUATOR STATE
  ============================================ */

  if(
    topic.startsWith(
      `greenhouse/${GREENHOUSE_ID}/actuators/`
    )
  ){

    const parts =
      topic.split('/');

    const device =
      parts[3];

    try{

      const stateData =
        JSON.parse(msg);

      updateDeviceState(
        device,
        stateData.state
      );

    }catch(e){

      updateDeviceState(
        device,
        msg
      );

    }

    return;

  }


  /* ============================================
     ALERT
  ============================================ */

  if(topic === TOPICS.alerts){

    if(data)
      handleRemoteAlert(data);

    return;

  }


  /* ============================================
     INDIVIDUAL SENSOR TOPICS
  ============================================ */

  const v =
    Number(String(msg).trim());

  if(!Number.isFinite(v))
    return;


  if(topic.includes('/temperature')){

    mqttState.temp = v;

    setText('temp',v.toFixed(1),'°C');
    setText('cv',v.toFixed(1),'°C');
    setText('systemTemp',v.toFixed(1),'°C');

  }

  else if(topic.includes('/humidity')){

    mqttState.hum = v;

    setText('hum',v.toFixed(0),'%');
    setText('dataHum',v.toFixed(0),'%');

  }

  else if(topic.includes('/water_temperature')){

    mqttState.wt = v;

    setText('wt',v.toFixed(1),'°C');
    setText('dataWt',v.toFixed(1),'°C');
    setText('systemWaterTemp',v.toFixed(1),'°C');

  }

  else if(topic.includes('/water_level')){

    mqttState.level = v;

    setText('level',v.toFixed(0),'%');
    setText('systemTank',`الخزان ${v.toFixed(0)}%`);

  }

  else if(topic.includes('/ph')){

    mqttState.ph = v;

    setText('ph',v.toFixed(2));
    setText('dataPh',v.toFixed(2));

  }

  else if(topic.includes('/ec')){

    mqttState.ec = v;

    setText('ec',v.toFixed(2));
    setText('dataEc',v.toFixed(2));

  }

}


/* =========================================================
   ALERT CHECK
========================================================= */

function checkAlerts(d){

  const t =
    Number(d.temperature);

  const l =
    Number(d.water_level);

  const warning =
    Number($('#fan')?.value || 30);

  const critical =
    Number($('#crit')?.value || 33);

  const low =
    Number($('#low')?.value || 20);

  const criticalLow =
    Number($('#critical')?.value || 10);


  if(
    Number.isFinite(t) &&
    t >= critical
  ){

    notification(
      'Hydro Farm — حرارة حرجة',
      `درجة الحرارة ${t}°C تجاوزت الحد ${critical}°C`
    );

  }

  else if(
    Number.isFinite(t) &&
    t >= warning
  ){

    notification(
      'Hydro Farm — حرارة مرتفعة',
      `درجة الحرارة ${t}°C تجاوزت حد التحذير ${warning}°C`
    );

  }


  if(
    Number.isFinite(l) &&
    l <= criticalLow
  ){

    notification(
      'Hydro Farm — مستوى ماء حرج',
      `مستوى الخزان ${l}%`
    );

  }

  else if(
    Number.isFinite(l) &&
    l <= low
  ){

    notification(
      'Hydro Farm — مستوى الماء منخفض',
      `مستوى الخزان ${l}%`
    );

  }

}


/* =========================================================
   MQTT CONNECT
========================================================= */

function connectMQTT(){

  if(typeof mqtt === 'undefined'){

    toast('مكتبة MQTT لم تُحمّل');

    return;

  }


  const user =
    $('#mqttUser')?.value.trim() ||
    localStorage.getItem('hydro_mqtt_user') ||
    'hydro01';


  const passField =
    $('#mqttPass');

  const typed =
    passField?.value || '';

  const pass =
    typed ||
    localStorage.getItem(
      'hydro_mqtt_password'
    ) ||
    '';


  if(!pass){

    toast(
      'أدخل كلمة مرور MQTT مرة واحدة'
    );

    page('settings');

    return;

  }


  /* Save credentials locally */

  localStorage.setItem(
    'hydro_mqtt_user',
    user
  );

  localStorage.setItem(
    'hydro_mqtt_password',
    pass
  );

  localStorage.setItem(
    'hydro_mqtt_autoconnect',
    '1'
  );


  if(
    'Notification' in window &&
    Notification.permission === 'default'
  ){

    Notification.requestPermission()
      .catch(()=>{});

  }


  /* Close previous connection */

  if(mqttClient){

    try{
      mqttClient.end(true);
    }catch(e){}

    mqttClient = null;

  }


  /* Connect */

  mqttClient =
    mqtt.connect(
      `wss://${MQTT_HOST}:${MQTT_WS_PORT}/mqtt`,
      {
        username:user,
        password:pass,

        clientId:
          'hydrofarm_GH001_' +
          Math.random()
            .toString(16)
            .slice(2),

        clean:true,

        reconnectPeriod:3000,

        connectTimeout:10000,

        keepalive:30
      }
    );


  /* ============================================
     CONNECTED
  ============================================ */

  mqttClient.on('connect',()=>{

    setConnection(true);

    toast(
      'تم الاتصال بـ HiveMQ GH001'
    );


    /*
      Subscribe to the entire GH001 tree.

      Permission:
      greenhouse/GH001/#
    */

    mqttClient.subscribe(
      `greenhouse/${GREENHOUSE_ID}/#`,
      {qos:0},
      err => {

        if(err){

          console.error(
            'MQTT subscribe error:',
            err
          );

          toast(
            'فشل الاشتراك في GH001'
          );

        }else{

          console.log(
            'MQTT subscribed:',
            `greenhouse/${GREENHOUSE_ID}/#`
          );

        }

      }
    );

  });


  /* ============================================
     MESSAGE
  ============================================ */

  mqttClient.on(
    'message',
    (topic,payload)=>{

      console.log(
        'MQTT RX:',
        topic,
        payload.toString()
      );

      updateSensor(
        topic,
        payload.toString()
      );

    }
  );


  mqttClient.on(
    'reconnect',
    ()=>{
      setConnection(false);
    }
  );


  mqttClient.on(
    'offline',
    ()=>{
      setConnection(false);
    }
  );


  mqttClient.on(
    'close',
    ()=>{
      setConnection(false);
    }
  );


  mqttClient.on(
    'error',
    err => {

      console.error(
        'MQTT ERROR:',
        err
      );

      setConnection(false);

      toast(
        'خطأ في اتصال MQTT'
      );

    }
  );

}


/* =========================================================
   PUBLISH CONTROL
========================================================= */

function publishControl(
  actuator,
  payload
){

  if(
    !mqttClient ||
    !mqttClient.connected
  ){

    toast(
      'MQTT غير متصل'
    );

    return false;

  }


  const topic =
    TOPICS.control(actuator);


  console.log(
    'MQTT TX:',
    topic,
    payload
  );


  mqttClient.publish(
    topic,
    JSON.stringify(payload),
    {
      qos:0,
      retain:false
    }
  );

  return true;

}


function publishSimpleControl(
  actuator,
  on
){

  return publishControl(
    actuator,
    {
      command:
        on ? 'ON':'OFF',

      request_id:
        'hf_' +
        Date.now().toString(36)
    }
  );

}


/* =========================================================
   UI SWITCHES
========================================================= */

$$('.sw').forEach(
  x => {

    x.addEventListener(
      'click',
      event => {

        /*
          Prevent duplicate handlers.
        */

        event.stopPropagation();


        x.classList.toggle(
          'on'
        );


        const on =
          x.classList.contains('on');


        const device =
          x.dataset.device ||
          (
            x.dataset.name === 'المضخة'
              ? 'pump'
              : x.dataset.name === 'المروحة'
                ? 'fan'
                : 'pad_cooling'
          );


        const ok =
          publishSimpleControl(
            device === 'pad_cooling'
              ? 'pad'
              : device,
            on
          );


        if(ok){

          toast(
            `${x.dataset.name}: ` +
            (on ? 'تشغيل':'إيقاف')
          );

        }

      }
    );

  }
);


/* =========================================================
   MQTT BUTTON
========================================================= */

$('#mqttConnect')
  ?.addEventListener(
    'click',
    connectMQTT
  );


/* =========================================================
   SAVE
========================================================= */

$('#save')
  ?.addEventListener(
    'click',
    ()=>{

      const p =
        $('#mqttPass')?.value || '';

      if(p){

        localStorage.setItem(
          'hydro_mqtt_password',
          p
        );

      }


      const u =
        $('#mqttUser')?.value.trim();

      if(u){

        localStorage.setItem(
          'hydro_mqtt_user',
          u
        );

      }


      localStorage.setItem(
        'hydro_mqtt_autoconnect',
        '1'
      );


      toast(
        'تم حفظ الإعدادات'
      );

    }
  );


/* =========================================================
   LOAD SAVED USER
========================================================= */

try{

  const u =
    localStorage.getItem(
      'hydro_mqtt_user'
    );

  if(
    u &&
    $('#mqttUser')
  ){

    $('#mqttUser').value = u;

  }

}catch(e){}


/* =========================================================
   INITIAL STATE
========================================================= */

setConnection(false);


/* =========================================================
   AUTO CONNECT
========================================================= */

document.addEventListener(
  'DOMContentLoaded',
  ()=>{

    const saved =
      localStorage.getItem(
        'hydro_mqtt_password'
      );

    const auto =
      localStorage.getItem(
        'hydro_mqtt_autoconnect'
      ) !== '0';


    /*
      If the password was previously saved,
      connect automatically.
    */

    if(
      saved &&
      auto
    ){

      setTimeout(
        connectMQTT,
        700
      );

    }

  }
);
