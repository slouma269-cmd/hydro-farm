/* =========================================================
   HYDRO FARM
   MQTT + Dashboard + Alerts + Controls
========================================================= */


/* =========================================================
   MQTT CONFIG
========================================================= */

const MQTT_HOST =
  "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud";

const MQTT_PORT =
  8884;

const MQTT_WS_URL =
  `wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`;


/* =========================================================
   MQTT TOPICS
========================================================= */

const TOPIC_TELEMETRY =
  "greenhouse/GH001/telemetry";

const TOPIC_STATUS =
  "greenhouse/GH001/status";

const TOPIC_ALERTS =
  "greenhouse/GH001/alerts";

const TOPIC_CONTROL =
  "greenhouse/GH001/control";

const TOPIC_ACTUATORS =
  "greenhouse/GH001/actuators";


/* =========================================================
   GLOBAL STATE
========================================================= */

let mqttClient =
  null;


let mqttConnected =
  false;


let hydroMode =
  "AUTO";


let latestData = {

  waterLevel:
    null,

  airTemperature:
    null,

  airHumidity:
    null,

  waterTemperature:
    null,

  ec:
    null,

  ph:
    null,

  fan1:
    0,

  fan2:
    0,

  pump1:
    0,

  pump2:
    0,

  pump3:
    0,

  pump4:
    0,

  padCooling:
    0,

  auto:
    1

};


/* =========================================================
   HISTORY
========================================================= */

const temperatureHistory =
  [];

const levelHistory =
  [];


const MAX_HISTORY =
  60;


/* =========================================================
   DOM HELPERS
========================================================= */

function el(id){

  return document.getElementById(id);

}


function setText(
  id,
  value
){

  const element =
    el(id);

  if(element){

    element.textContent =
      value;

  }

}


/* =========================================================
   TOAST
========================================================= */

function showHydroToast(
  message
){

  const toast =
    el("toast");


  if(!toast)
    return;


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );

    },
    2500
  );

}


window.showHydroToast =
  showHydroToast;


/* =========================================================
   MQTT STATUS UI
========================================================= */

function setMQTTStatus(
  connected
){

  mqttConnected =
    connected;


  const dot =
    el("mqttDot");

  const state =
    el("mqttState");

  const sub =
    el("mqttSub");

  const status =
    el("mqttStatus");

  const esp =
    el("espStatus");

  const connectionAlert =
    el("alertConnection");


  if(connected){

    if(dot)
      dot.textContent = "●";


    if(state)
      state.textContent =
        "النظام متصل";


    if(sub)
      sub.textContent =
        "ESP32 • MQTT • Online";


    if(status){

      status.textContent =
        "متصل";

      status.className =
        "green";

    }


    if(esp){

      esp.textContent =
        "Online";

      esp.className =
        "green";

    }


    if(connectionAlert){

      connectionAlert.textContent =
        "MQTT متصل";

    }

  }else{

    if(dot)
      dot.textContent = "●";


    if(state)
      state.textContent =
        "النظام غير متصل";


    if(sub)
      sub.textContent =
        "ESP32 • MQTT • Offline";


    if(status){

      status.textContent =
        "غير متصل";

      status.className =
        "";

    }


    if(esp){

      esp.textContent =
        "Offline";

      esp.className =
        "";

    }


    if(connectionAlert){

      connectionAlert.textContent =
        "MQTT غير متصل";

    }

  }

}


/* =========================================================
   MQTT CONNECT
========================================================= */

function connectMQTT(){

  if(
    typeof mqtt ===
    "undefined"
  ){

    showHydroToast(
      "مكتبة MQTT غير موجودة"
    );

    return;

  }


  const username =
    el("mqttUser")?.value ||
    "hydro01";


  const password =
    el("mqttPass")?.value ||
    "";


  if(!password){

    showHydroToast(
      "أدخل كلمة مرور HiveMQ أولاً"
    );

    return;

  }


  if(mqttClient){

    try{

      mqttClient.end(
        true
      );

    }catch(error){}

  }


  setMQTTStatus(
    false
  );


  showHydroToast(
    "جاري الاتصال بـ HiveMQ..."
  );


  const clientId =
    "hydro-gh001-" +
    Math.random()
      .toString(16)
      .substring(2,10);


  mqttClient =
    mqtt.connect(
      MQTT_WS_URL,
      {

        clientId:
          clientId,

        username:
          username,

        password:
          password,

        clean:
          true,

        connectTimeout:
          10000,

        reconnectPeriod:
          5000,

        keepalive:
          30,

        protocol:
          "wss"

      }
    );


  mqttClient.on(
    "connect",
    () => {

      console.log(
        "MQTT CONNECTED"
      );


      setMQTTStatus(
        true
      );


      mqttClient.subscribe(
        [
          TOPIC_TELEMETRY,
          TOPIC_STATUS,
          TOPIC_ALERTS,
          `${TOPIC_ACTUATORS}/+/state`
        ],
        error => {

          if(error){

            console.error(
              "MQTT subscribe error",
              error
            );

          }else{

            console.log(
              "MQTT subscriptions active"
            );

          }

        }
      );


      showHydroToast(
        "تم الاتصال بـ HiveMQ"
      );

    }
  );


  mqttClient.on(
    "message",
    (
      topic,
      message
    ) => {

      handleMQTTMessage(
        topic,
        message.toString()
      );

    }
  );


  mqttClient.on(
    "error",
    error => {

      console.error(
        "MQTT error:",
        error
      );

      setMQTTStatus(
        false
      );

    }
  );


  mqttClient.on(
    "close",
    () => {

      console.log(
        "MQTT connection closed"
      );

      setMQTTStatus(
        false
      );

    }
  );


  mqttClient.on(
    "offline",
    () => {

      setMQTTStatus(
        false
      );

    }
  );

}


/* =========================================================
   MQTT MESSAGE
========================================================= */

function handleMQTTMessage(
  topic,
  payload
){

  console.log(
    "MQTT:",
    topic,
    payload
  );


  let data = {};


  try{

    data =
      JSON.parse(
        payload
      );

  }catch(error){

    console.warn(
      "Invalid JSON MQTT payload"
    );

    return;

  }


  if(
    topic ===
    TOPIC_TELEMETRY
  ){

    processTelemetry(
      data
    );

    return;

  }


  if(
    topic ===
    TOPIC_STATUS
  ){

    processStatus(
      data
    );

    return;

  }


  if(
    topic ===
    TOPIC_ALERTS
  ){

    processMQTTAlert(
      data
    );

    return;

  }


  if(
    topic.startsWith(
      `${TOPIC_ACTUATORS}/`
    )
  ){

    processActuatorState(
      topic,
      data
    );

  }

}


/* =========================================================
   TELEMETRY
========================================================= */

function processTelemetry(
  data
){

  latestData =
    {

      ...latestData,

      ...data

    };


  const temperature =
    numberValue(
      data.airTemperature ??
      data.temperature
    );


  const humidity =
    numberValue(
      data.airHumidity ??
      data.humidity
    );


  const waterTemperature =
    numberValue(
      data.waterTemperature ??
      data.waterTemp
    );


  const rawLevel =
    numberValue(
      data.waterLevel ??
      data.level
    );


  const level =
    convertLevelToPercent(
      rawLevel
    );


  const ec =
    numberValue(
      data.ec ??
      data.EC
    );


  const ph =
    numberValue(
      data.ph ??
      data.pH
    );


  if(
    temperature !==
    null
  ){

    latestData.airTemperature =
      temperature;

  }


  if(
    humidity !==
    null
  ){

    latestData.airHumidity =
      humidity;

  }


  if(
    waterTemperature !==
    null
  ){

    latestData.waterTemperature =
      waterTemperature;

  }


  if(
    level !==
    null
  ){

    latestData.waterLevel =
      level;

  }


  if(
    ec !==
    null
  ){

    latestData.ec =
      ec;

  }


  if(
    ph !==
    null
  ){

    latestData.ph =
      ph;

  }


  /*
    Actuator states can be sent
    inside telemetry as well.
  */

  copyActuatorData(
    data
  );


  updateDashboard();


  addHistoryPoint();


  checkAutomaticAlerts();

}


/* =========================================================
   NUMBER
========================================================= */

function numberValue(
  value
){

  if(
    value ===
    null ||
    value ===
    undefined ||
    value ===
    ""
  ){

    return null;

  }


  const number =
    Number(value);


  if(
    Number.isNaN(
      number
    )
  ){

    return null;

  }


  return number;

}


/* =========================================================
   LEVEL CONVERSION
========================================================= */

function convertLevelToPercent(
  value
){

  if(value === null)
    return null;


  /*
    If ESP32 already sends percentage,
    use it directly.
  */

  if(
    value >= 0 &&
    value <= 100
  ){

    return value;

  }


  /*
    Your previous ESP32 data showed values
    around 351/353.

    Until the exact ST045 calibration range
    is supplied, we do not invent a physical
    calibration.

    Therefore values >100 are kept as a
    percentage-like value only if possible.
  */

  return Math.max(
    0,
    Math.min(
      100,
      value
    )
  );

}


/* =========================================================
   ACTUATOR DATA
========================================================= */

function copyActuatorData(
  data
){

  const keys =
    Object.keys(
      data
    );


  for(
    const key of keys
  ){

    const value =
      data[key];


    if(
      key.toLowerCase()
        .includes("fan")
    ){

      latestData[key] =
        value;

    }


    if(
      key.toLowerCase()
        .includes("pump")
    ){

      latestData[key] =
        value;

    }


    if(
      key ===
      "padCooling"
    ){

      latestData.padCooling =
        value;

    }

  }

}


/* =========================================================
   UPDATE DASHBOARD
========================================================= */

function updateDashboard(){

  const temp =
    latestData.airTemperature;


  const hum =
    latestData.airHumidity;


  const wt =
    latestData.waterTemperature;


  const level =
    latestData.waterLevel;


  const ec =
    latestData.ec;


  const ph =
    latestData.ph;


  if(temp !== null){

    setText(
      "temp",
      temp.toFixed(1) +
      "°C"
    );

    setText(
      "cv",
      temp.toFixed(1) +
      "°C"
    );

    setText(
      "systemTemp",
      temp.toFixed(1) +
      "°C"
    );

  }


  if(hum !== null){

    setText(
      "hum",
      hum.toFixed(0) +
      "%"
    );

    setText(
      "dataHum",
      hum.toFixed(0) +
      "%"
    );

  }


  if(wt !== null){

    setText(
      "wt",
      wt.toFixed(1) +
      "°C"
    );

    setText(
      "dataWt",
      wt.toFixed(1) +
      "°C"
    );

    setText(
      "systemWaterTemp",
      wt.toFixed(1) +
      "°C"
    );

  }


  if(level !== null){

    setText(
      "level",
      level.toFixed(0) +
      "%"
    );

    setText(
      "systemTank",
      "الخزان " +
      level.toFixed(0) +
      "%"
    );

  }


  if(ec !== null){

    setText(
      "ec",
      ec.toFixed(2)
    );

    setText(
      "dataEc",
      ec.toFixed(2)
    );

  }


  if(ph !== null){

    setText(
      "ph",
      ph.toFixed(2)
    );

    setText(
      "dataPh",
      ph.toFixed(2)
    );

  }


  updateStatusTexts();


  updateSystem();

}


/* =========================================================
   STATUS TEXTS
========================================================= */

function updateStatusTexts(){

  const temp =
    latestData.airTemperature;


  const level =
    latestData.waterLevel;


  if(temp !== null){

    const warning =
      Number(
        localStorage.getItem(
          "hydro_warning_temp"
        ) ||
        30
      );


    const critical =
      Number(
        localStorage.getItem(
          "hydro_critical_temp"
        ) ||
        33
      );


    if(
      temp >=
      critical
    ){

      setText(
        "tempStatus",
        "حرارة حرجة"
      );

    }

    else if(
      temp >=
      warning
    ){

      setText(
        "tempStatus",
        "حرارة مرتفعة"
      );

    }

    else{

      setText(
        "tempStatus",
        "طبيعية"
      );

    }

  }


  if(level !== null){

    const warning =
      Number(
        localStorage.getItem(
          "hydro_warning_level"
        ) ||
        20
      );


    const critical =
      Number(
        localStorage.getItem(
          "hydro_critical_level"
        ) ||
        10
      );


    if(
      level <=
      critical
    ){

      setText(
        "levelStatus",
        "مستوى حرج"
      );

    }

    else if(
      level <=
      warning
    ){

      setText(
        "levelStatus",
        "مستوى منخفض"
      );

    }

    else{

      setText(
        "levelStatus",
        "طبيعي"
      );

    }

  }

}


/* =========================================================
   SYSTEM
========================================================= */

function updateSystem(){

  const fanOn =
    Number(
      latestData.fan1 ||
      latestData.fan2 ||
      0
    );


  const pumpOn =
    Number(
      latestData.pump1 ||
      latestData.pump2 ||
      latestData.pump3 ||
      latestData.pump4 ||
      0
    );


  const padOn =
    Number(
      latestData.padCooling ||
      0
    );


  setText(
    "systemFan",
    fanOn
      ? "المروحة ON"
      : "المروحة OFF"
  );


  setText(
    "systemFanState",
    fanOn
      ? "تعمل"
      : "متوقفة"
  );


  setText(
    "systemPump",
    pumpOn
      ? "المضخة ON"
      : "المضخة OFF"
  );


  setText(
    "systemPumpMode",
    hydroMode
  );


  updateSwitch(
    "pumpSwitch",
    Boolean(pumpOn)
  );


  updateSwitch(
    "fanSwitch",
    Boolean(fanOn)
  );


  updateSwitch(
    "padSwitch",
    Boolean(padOn)
  );


  updateSwitch(
    "systemPadSwitch",
    Boolean(padOn)
  );

}


/* =========================================================
   SWITCH UI
========================================================= */

function updateSwitch(
  id,
  state
){

  const button =
    el(id);


  if(!button)
    return;


  button.classList.toggle(
    "on",
    state
  );

}


/* =========================================================
   MQTT CONTROL
========================================================= */

function sendControl(
  device,
  state
){

  if(
    !mqttClient ||
    !mqttConnected
  ){

    showHydroToast(
      "MQTT غير متصل"
    );

    return false;

  }


  const topic =
    `${TOPIC_CONTROL}/${device}/set`;


  const payload =
    JSON.stringify({

      state:
        state ? 1 : 0,

      mode:
        hydroMode,

      greenhouse:
        "GH001",

      timestamp:
        Date.now()

    });


  mqttClient.publish(
    topic,
    payload,
    {
      qos: 1,
      retain: false
    },
    error => {

      if(error){

        console.error(
          "MQTT publish error",
          error
        );

        showHydroToast(
          "فشل إرسال الأمر"
        );

      }else{

        console.log(
          "CONTROL:",
          topic,
          payload
        );

      }

    }
  );


  return true;

}


/* =========================================================
   DEVICE SWITCH
========================================================= */

function setupSwitches(){

  const switches =
    document.querySelectorAll(
      ".sw[data-device]"
    );


  switches.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const device =
            button.dataset.device;


          const state =
            !button.classList.contains(
              "on"
            );


          /*
            UI is updated optimistically.
          */

          updateSwitch(
            button.id,
            state
          );


          if(
            sendControl(
              device,
              state
            )
          ){

            showHydroToast(
              `${button.dataset.name || device}: ${
                state
                  ? "تشغيل"
                  : "إيقاف"
              }`
            );

          }

        }
      );

    }
  );

}


/* =========================================================
   MODE
========================================================= */

function setupMode(){

  const button =
    el("mode");


  if(!button)
    return;


  button.addEventListener(
    "click",
    () => {

      hydroMode =
        hydroMode ===
        "AUTO"
          ? "MANUAL"
          : "AUTO";


      button.textContent =
        hydroMode;


      setText(
        "homeMode",
        hydroMode
      );


      setText(
        "pumpMode",
        hydroMode
      );


      setText(
        "fanMode",
        hydroMode
      );


      setText(
        "padMode",
        hydroMode
      );


      setText(
        "systemPumpMode",
        hydroMode
      );


      if(
        mqttClient &&
        mqttConnected
      ){

        mqttClient.publish(

          `${TOPIC_CONTROL}/mode/set`,

          JSON.stringify({

            mode:
              hydroMode

          }),

          {
            qos: 1,
            retain: false
          }

        );

      }


      showHydroToast(
        "الوضع: " +
        hydroMode
      );

    }
  );

}


/* =========================================================
   MQTT STATUS MESSAGE
========================================================= */

function processStatus(
  data
){

  const online =
    data.online ??
    data.connected ??
    data.status === "online";


  if(
    online
  ){

    setMQTTStatus(
      true
    );

  }


  if(
    data.mode
  ){

    hydroMode =
      String(
        data.mode
      ).toUpperCase();


    setText(
      "homeMode",
      hydroMode
    );

  }

}


/* =========================================================
   ACTUATOR STATE
========================================================= */

function processActuatorState(
  topic,
  data
){

  const parts =
    topic.split("/");


  const device =
    parts[
      parts.length - 2
    ];


  const state =
    Number(
      data.state ??
      data.value ??
      data.on ??
      0
    );


  if(
    device ===
    "pump"
  ){

    latestData.pump1 =
      state;

  }


  if(
    device ===
    "fan"
  ){

    latestData.fan1 =
      state;

  }


  if(
    device ===
    "pad_cooling"
  ){

    latestData.padCooling =
      state;

  }


  updateDashboard();

}


/* =========================================================
   MQTT ALERT
========================================================= */

function processMQTTAlert(
  data
){

  const title =
    data.title ||
    "تنبيه Hydro Farm";


  const body =
    data.body ||
    data.message ||
    "يوجد تنبيه جديد";


  const severity =
    data.severity ||
    "INFO";


  addHydroAlert(
    title,
    body,
    severity
  );


  /*
    MQTT alert is local.
    FCM notification is handled by
    Firebase when the backend sends FCM.
  */

}


/* =========================================================
   LOCAL ALERT
========================================================= */

function addHydroAlert(
  title,
  body,
  seve
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
/* =========================================================
   HYDRO FARM
   MQTT + Dashboard + Alerts + Controls
========================================================= */


/* =========================================================
   MQTT CONFIG
========================================================= */

const MQTT_HOST =
  "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud";

const MQTT_PORT =
  8884;

const MQTT_WS_URL =
  `wss://${MQTT_HOST}:${MQTT_PORT}/mqtt`;


/* =========================================================
   MQTT TOPICS
========================================================= */

const TOPIC_TELEMETRY =
  "greenhouse/GH001/telemetry";

const TOPIC_STATUS =
  "greenhouse/GH001/status";

const TOPIC_ALERTS =
  "greenhouse/GH001/alerts";

const TOPIC_CONTROL =
  "greenhouse/GH001/control";

const TOPIC_ACTUATORS =
  "greenhouse/GH001/actuators";


/* =========================================================
   GLOBAL STATE
========================================================= */

let mqttClient =
  null;


let mqttConnected =
  false;


let hydroMode =
  "AUTO";


let latestData = {

  waterLevel:
    null,

  airTemperature:
    null,

  airHumidity:
    null,

  waterTemperature:
    null,

  ec:
    null,

  ph:
    null,

  fan1:
    0,

  fan2:
    0,

  pump1:
    0,

  pump2:
    0,

  pump3:
    0,

  pump4:
    0,

  padCooling:
    0,

  auto:
    1

};


/* =========================================================
   HISTORY
========================================================= */

const temperatureHistory =
  [];

const levelHistory =
  [];


const MAX_HISTORY =
  60;


/* =========================================================
   DOM HELPERS
========================================================= */

function el(id){

  return document.getElementById(id);

}


function setText(
  id,
  value
){

  const element =
    el(id);

  if(element){

    element.textContent =
      value;

  }

}


/* =========================================================
   TOAST
========================================================= */

function showHydroToast(
  message
){

  const toast =
    el("toast");


  if(!toast)
    return;


  toast.textContent =
    message;


  toast.classList.add(
    "show"
  );


  setTimeout(
    () => {

      toast.classList.remove(
        "show"
      );

    },
    2500
  );

}


window.showHydroToast =
  showHydroToast;


/* =========================================================
   MQTT STATUS UI
========================================================= */

function setMQTTStatus(
  connected
){

  mqttConnected =
    connected;


  const dot =
    el("mqttDot");

  const state =
    el("mqttState");

  const sub =
    el("mqttSub");

  const status =
    el("mqttStatus");

  const esp =
    el("espStatus");

  const connectionAlert =
    el("alertConnection");


  if(connected){

    if(dot)
      dot.textContent = "●";


    if(state)
      state.textContent =
        "النظام متصل";


    if(sub)
      sub.textContent =
        "ESP32 • MQTT • Online";


    if(status){

      status.textContent =
        "متصل";

      status.className =
        "green";

    }


    if(esp){

      esp.textContent =
        "Online";

      esp.className =
        "green";

    }


    if(connectionAlert){

      connectionAlert.textContent =
        "MQTT متصل";

    }

  }else{

    if(dot)
      dot.textContent = "●";


    if(state)
      state.textContent =
        "النظام غير متصل";


    if(sub)
      sub.textContent =
        "ESP32 • MQTT • Offline";


    if(status){

      status.textContent =
        "غير متصل";

      status.className =
        "";

    }


    if(esp){

      esp.textContent =
        "Offline";

      esp.className =
        "";

    }


    if(connectionAlert){

      connectionAlert.textContent =
        "MQTT غير متصل";

    }

  }

}


/* =========================================================
   MQTT CONNECT
========================================================= */

function connectMQTT(){

  if(
    typeof mqtt ===
    "undefined"
  ){

    showHydroToast(
      "مكتبة MQTT غير موجودة"
    );

    return;

  }


  const username =
    el("mqttUser")?.value ||
    "hydro01";


  const password =
    el("mqttPass")?.value ||
    "";


  if(!password){

    showHydroToast(
      "أدخل كلمة مرور HiveMQ أولاً"
    );

    return;

  }


  if(mqttClient){

    try{

      mqttClient.end(
        true
      );

    }catch(error){}

  }


  setMQTTStatus(
    false
  );


  showHydroToast(
    "جاري الاتصال بـ HiveMQ..."
  );


  const clientId =
    "hydro-gh001-" +
    Math.random()
      .toString(16)
      .substring(2,10);


  mqttClient =
    mqtt.connect(
      MQTT_WS_URL,
      {

        clientId:
          clientId,

        username:
          username,

        password:
          password,

        clean:
          true,

        connectTimeout:
          10000,

        reconnectPeriod:
          5000,

        keepalive:
          30,

        protocol:
          "wss"

      }
    );


  mqttClient.on(
    "connect",
    () => {

      console.log(
        "MQTT CONNECTED"
      );


      setMQTTStatus(
        true
      );


      mqttClient.subscribe(
        [
          TOPIC_TELEMETRY,
          TOPIC_STATUS,
          TOPIC_ALERTS,
          `${TOPIC_ACTUATORS}/+/state`
        ],
        error => {

          if(error){

            console.error(
              "MQTT subscribe error",
              error
            );

          }else{

            console.log(
              "MQTT subscriptions active"
            );

          }

        }
      );


      showHydroToast(
        "تم الاتصال بـ HiveMQ"
      );

    }
  );


  mqttClient.on(
    "message",
    (
      topic,
      message
    ) => {

      handleMQTTMessage(
        topic,
        message.toString()
      );

    }
  );


  mqttClient.on(
    "error",
    error => {

      console.error(
        "MQTT error:",
        error
      );

      setMQTTStatus(
        false
      );

    }
  );


  mqttClient.on(
    "close",
    () => {

      console.log(
        "MQTT connection closed"
      );

      setMQTTStatus(
        false
      );

    }
  );


  mqttClient.on(
    "offline",
    () => {

      setMQTTStatus(
        false
      );

    }
  );

}


/* =========================================================
   MQTT MESSAGE
========================================================= */

function handleMQTTMessage(
  topic,
  payload
){

  console.log(
    "MQTT:",
    topic,
    payload
  );


  let data = {};


  try{

    data =
      JSON.parse(
        payload
      );

  }catch(error){

    console.warn(
      "Invalid JSON MQTT payload"
    );

    return;

  }


  if(
    topic ===
    TOPIC_TELEMETRY
  ){

    processTelemetry(
      data
    );

    return;

  }


  if(
    topic ===
    TOPIC_STATUS
  ){

    processStatus(
      data
    );

    return;

  }


  if(
    topic ===
    TOPIC_ALERTS
  ){

    processMQTTAlert(
      data
    );

    return;

  }


  if(
    topic.startsWith(
      `${TOPIC_ACTUATORS}/`
    )
  ){

    processActuatorState(
      topic,
      data
    );

  }

}


/* =========================================================
   TELEMETRY
========================================================= */

function processTelemetry(
  data
){

  latestData =
    {

      ...latestData,

      ...data

    };


  const temperature =
    numberValue(
      data.airTemperature ??
      data.temperature
    );


  const humidity =
    numberValue(
      data.airHumidity ??
      data.humidity
    );


  const waterTemperature =
    numberValue(
      data.waterTemperature ??
      data.waterTemp
    );


  const rawLevel =
    numberValue(
      data.waterLevel ??
      data.level
    );


  const level =
    convertLevelToPercent(
      rawLevel
    );


  const ec =
    numberValue(
      data.ec ??
      data.EC
    );


  const ph =
    numberValue(
      data.ph ??
      data.pH
    );


  if(
    temperature !==
    null
  ){

    latestData.airTemperature =
      temperature;

  }


  if(
    humidity !==
    null
  ){

    latestData.airHumidity =
      humidity;

  }


  if(
    waterTemperature !==
    null
  ){

    latestData.waterTemperature =
      waterTemperature;

  }


  if(
    level !==
    null
  ){

    latestData.waterLevel =
      level;

  }


  if(
    ec !==
    null
  ){

    latestData.ec =
      ec;

  }


  if(
    ph !==
    null
  ){

    latestData.ph =
      ph;

  }


  /*
    Actuator states can be sent
    inside telemetry as well.
  */

  copyActuatorData(
    data
  );


  updateDashboard();


  addHistoryPoint();


  checkAutomaticAlerts();

}


/* =========================================================
   NUMBER
========================================================= */

function numberValue(
  value
){

  if(
    value ===
    null ||
    value ===
    undefined ||
    value ===
    ""
  ){

    return null;

  }


  const number =
    Number(value);


  if(
    Number.isNaN(
      number
    )
  ){

    return null;

  }


  return number;

}


/* =========================================================
   LEVEL CONVERSION
========================================================= */

function convertLevelToPercent(
  value
){

  if(value === null)
    return null;


  /*
    If ESP32 already sends percentage,
    use it directly.
  */

  if(
    value >= 0 &&
    value <= 100
  ){

    return value;

  }


  /*
    Your previous ESP32 data showed values
    around 351/353.

    Until the exact ST045 calibration range
    is supplied, we do not invent a physical
    calibration.

    Therefore values >100 are kept as a
    percentage-like value only if possible.
  */

  return Math.max(
    0,
    Math.min(
      100,
      value
    )
  );

}


/* =========================================================
   ACTUATOR DATA
========================================================= */

function copyActuatorData(
  data
){

  const keys =
    Object.keys(
      data
    );


  for(
    const key of keys
  ){

    const value =
      data[key];


    if(
      key.toLowerCase()
        .includes("fan")
    ){

      latestData[key] =
        value;

    }


    if(
      key.toLowerCase()
        .includes("pump")
    ){

      latestData[key] =
        value;

    }


    if(
      key ===
      "padCooling"
    ){

      latestData.padCooling =
        value;

    }

  }

}


/* =========================================================
   UPDATE DASHBOARD
========================================================= */

function updateDashboard(){

  const temp =
    latestData.airTemperature;


  const hum =
    latestData.airHumidity;


  const wt =
    latestData.waterTemperature;


  const level =
    latestData.waterLevel;


  const ec =
    latestData.ec;


  const ph =
    latestData.ph;


  if(temp !== null){

    setText(
      "temp",
      temp.toFixed(1) +
      "°C"
    );

    setText(
      "cv",
      temp.toFixed(1) +
      "°C"
    );

    setText(
      "systemTemp",
      temp.toFixed(1) +
      "°C"
    );

  }


  if(hum !== null){

    setText(
      "hum",
      hum.toFixed(0) +
      "%"
    );

    setText(
      "dataHum",
      hum.toFixed(0) +
      "%"
    );

  }


  if(wt !== null){

    setText(
      "wt",
      wt.toFixed(1) +
      "°C"
    );

    setText(
      "dataWt",
      wt.toFixed(1) +
      "°C"
    );

    setText(
      "systemWaterTemp",
      wt.toFixed(1) +
      "°C"
    );

  }


  if(level !== null){

    setText(
      "level",
      level.toFixed(0) +
      "%"
    );

    setText(
      "systemTank",
      "الخزان " +
      level.toFixed(0) +
      "%"
    );

  }


  if(ec !== null){

    setText(
      "ec",
      ec.toFixed(2)
    );

    setText(
      "dataEc",
      ec.toFixed(2)
    );

  }


  if(ph !== null){

    setText(
      "ph",
      ph.toFixed(2)
    );

    setText(
      "dataPh",
      ph.toFixed(2)
    );

  }


  updateStatusTexts();


  updateSystem();

}


/* =========================================================
   STATUS TEXTS
========================================================= */

function updateStatusTexts(){

  const temp =
    latestData.airTemperature;


  const level =
    latestData.waterLevel;


  if(temp !== null){

    const warning =
      Number(
        localStorage.getItem(
          "hydro_warning_temp"
        ) ||
        30
      );


    const critical =
      Number(
        localStorage.getItem(
          "hydro_critical_temp"
        ) ||
        33
      );


    if(
      temp >=
      critical
    ){

      setText(
        "tempStatus",
        "حرارة حرجة"
      );

    }

    else if(
      temp >=
      warning
    ){

      setText(
        "tempStatus",
        "حرارة مرتفعة"
      );

    }

    else{

      setText(
        "tempStatus",
        "طبيعية"
      );

    }

  }


  if(level !== null){

    const warning =
      Number(
        localStorage.getItem(
          "hydro_warning_level"
        ) ||
        20
      );


    const critical =
      Number(
        localStorage.getItem(
          "hydro_critical_level"
        ) ||
        10
      );


    if(
      level <=
      critical
    ){

      setText(
        "levelStatus",
        "مستوى حرج"
      );

    }

    else if(
      level <=
      warning
    ){

      setText(
        "levelStatus",
        "مستوى منخفض"
      );

    }

    else{

      setText(
        "levelStatus",
        "طبيعي"
      );

    }

  }

}


/* =========================================================
   SYSTEM
========================================================= */

function updateSystem(){

  const fanOn =
    Number(
      latestData.fan1 ||
      latestData.fan2 ||
      0
    );


  const pumpOn =
    Number(
      latestData.pump1 ||
      latestData.pump2 ||
      latestData.pump3 ||
      latestData.pump4 ||
      0
    );


  const padOn =
    Number(
      latestData.padCooling ||
      0
    );


  setText(
    "systemFan",
    fanOn
      ? "المروحة ON"
      : "المروحة OFF"
  );


  setText(
    "systemFanState",
    fanOn
      ? "تعمل"
      : "متوقفة"
  );


  setText(
    "systemPump",
    pumpOn
      ? "المضخة ON"
      : "المضخة OFF"
  );


  setText(
    "systemPumpMode",
    hydroMode
  );


  updateSwitch(
    "pumpSwitch",
    Boolean(pumpOn)
  );


  updateSwitch(
    "fanSwitch",
    Boolean(fanOn)
  );


  updateSwitch(
    "padSwitch",
    Boolean(padOn)
  );


  updateSwitch(
    "systemPadSwitch",
    Boolean(padOn)
  );

}


/* =========================================================
   SWITCH UI
========================================================= */

function updateSwitch(
  id,
  state
){

  const button =
    el(id);


  if(!button)
    return;


  button.classList.toggle(
    "on",
    state
  );

}


/* =========================================================
   MQTT CONTROL
========================================================= */

function sendControl(
  device,
  state
){

  if(
    !mqttClient ||
    !mqttConnected
  ){

    showHydroToast(
      "MQTT غير متصل"
    );

    return false;

  }


  const topic =
    `${TOPIC_CONTROL}/${device}/set`;


  const payload =
    JSON.stringify({

      state:
        state ? 1 : 0,

      mode:
        hydroMode,

      greenhouse:
        "GH001",

      timestamp:
        Date.now()

    });


  mqttClient.publish(
    topic,
    payload,
    {
      qos: 1,
      retain: false
    },
    error => {

      if(error){

        console.error(
          "MQTT publish error",
          error
        );

        showHydroToast(
          "فشل إرسال الأمر"
        );

      }else{

        console.log(
          "CONTROL:",
          topic,
          payload
        );

      }

    }
  );


  return true;

}


/* =========================================================
   DEVICE SWITCH
========================================================= */

function setupSwitches(){

  const switches =
    document.querySelectorAll(
      ".sw[data-device]"
    );


  switches.forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          const device =
            button.dataset.device;


          const state =
            !button.classList.contains(
              "on"
            );


          /*
            UI is updated optimistically.
          */

          updateSwitch(
            button.id,
            state
          );


          if(
            sendControl(
              device,
              state
            )
          ){

            showHydroToast(
              `${button.dataset.name || device}: ${
                state
                  ? "تشغيل"
                  : "إيقاف"
              }`
            );

          }

        }
      );

    }
  );

}


/* =========================================================
   MODE
========================================================= */

function setupMode(){

  const button =
    el("mode");


  if(!button)
    return;


  button.addEventListener(
    "click",
    () => {

      hydroMode =
        hydroMode ===
        "AUTO"
          ? "MANUAL"
          : "AUTO";


      button.textContent =
        hydroMode;


      setText(
        "homeMode",
        hydroMode
      );


      setText(
        "pumpMode",
        hydroMode
      );


      setText(
        "fanMode",
        hydroMode
      );


      setText(
        "padMode",
        hydroMode
      );


      setText(
        "systemPumpMode",
        hydroMode
      );


      if(
        mqttClient &&
        mqttConnected
      ){

        mqttClient.publish(

          `${TOPIC_CONTROL}/mode/set`,

          JSON.stringify({

            mode:
              hydroMode

          }),

          {
            qos: 1,
            retain: false
          }

        );

      }


      showHydroToast(
        "الوضع: " +
        hydroMode
      );

    }
  );

}


/* =========================================================
   MQTT STATUS MESSAGE
========================================================= */

function processStatus(
  data
){

  const online =
    data.online ??
    data.connected ??
    data.status === "online";


  if(
    online
  ){

    setMQTTStatus(
      true
    );

  }


  if(
    data.mode
  ){

    hydroMode =
      String(
        data.mode
      ).toUpperCase();


    setText(
      "homeMode",
      hydroMode
    );

  }

}


/* =========================================================
   ACTUATOR STATE
========================================================= */

function processActuatorState(
  topic,
  data
){

  const parts =
    topic.split("/");


  const device =
    parts[
      parts.length - 2
    ];


  const state =
    Number(
      data.state ??
      data.value ??
      data.on ??
      0
    );


  if(
    device ===
    "pump"
  ){

    latestData.pump1 =
      state;

  }


  if(
    device ===
    "fan"
  ){

    latestData.fan1 =
      state;

  }


  if(
    device ===
    "pad_cooling"
  ){

    latestData.padCooling =
      state;

  }


  updateDashboard();

}


/* =========================================================
   MQTT ALERT
========================================================= */

function processMQTTAlert(
  data
){

  const title =
    data.title ||
    "تنبيه Hydro Farm";


  const body =
    data.body ||
    data.message ||
    "يوجد تنبيه جديد";


  const severity =
    data.severity ||
    "INFO";


  addHydroAlert(
    title,
    body,
    severity
  );


  /*
    MQTT alert is local.
    FCM notification is handled by
    Firebase when the backend sends FCM.
  */

}


/* =========================================================
   LOCAL ALERT
========================================================= */

function addHydroAlert(
  title,
  body,
  seve
