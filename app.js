/* =========================================================
   HYDRO FARM GH001
   PHASE 2
   MQTT + TELEMETRY + CONTROL
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const HYDRO_CONFIG = {

  greenhouseId: "GH001",

  mqtt: {

    host:
      "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud",

    port: 8884,

    protocol: "wss",

    path: "/mqtt"

  },


  topics: {

    telemetry:
      "greenhouse/GH001/telemetry",

    controlPump:
      "greenhouse/GH001/control/pump/set",

    controlFan:
      "greenhouse/GH001/control/fan/set",

    controlPad:
      "greenhouse/GH001/control/pad_cooling/set",

    controlMode:
      "greenhouse/GH001/control/mode/set",

    actuatorState:
      "greenhouse/GH001/actuators/+/state",

    status:
      "greenhouse/GH001/status",

    alerts:
      "greenhouse/GH001/alerts"

  },


  /*
     مستوى الخزان القادم من ADC.

     إذا كان ESP32 يرسل نسبة 0..100
     فسيتم استعمالها مباشرة.

     إذا كان يرسل ADC 0..4095
     يتم تحويله إلى نسبة.

     عدّل EMPTY/FULL لاحقًا إذا كان
     حساس مستوى الماء يعمل بالعكس.
  */

  levelADC: {

    empty: 0,

    full: 4095

  }

};


/* =========================================================
   GLOBAL STATE
========================================================= */

const hydroState = {

  mqttConnected: false,

  espOnline: false,

  mode: "AUTO",

  lastTelemetry: null,

  lastTelemetryTime: 0,

  values: {

    airTemperature: null,

    airHumidity: null,

    waterTemperature: null,

    waterLevel: null,

    ec: null,

    ph: null

  },

  actuators: {

    pump: false,

    fan: false,

    pad_cooling: false

  },

  actuatorModes: {

    pump: "AUTO",

    fan: "AUTO",

    pad_cooling: "AUTO"

  },

  history: {

    temperature: [],

    level: []

  },

  alerts: []

};


/* =========================================================
   MQTT CLIENT
========================================================= */

let hydroMQTT = null;


/* =========================================================
   DOM HELPERS
========================================================= */

function $(id) {

  return document.getElementById(id);

}


function setText(id, value) {

  const element = $(id);

  if(element) {

    element.textContent = value;

  }

}


function showToast(message) {

  const toast = $("toast");

  if(!toast)
    return;

  toast.textContent = message;

  toast.classList.add("show");

  clearTimeout(showToast.timer);

  showToast.timer =
    setTimeout(() => {

      toast.classList.remove("show");

    }, 2500);

}


/* =========================================================
   MQTT URL
========================================================= */

function getMQTTURL() {

  return (
    `${HYDRO_CONFIG.mqtt.protocol}://` +
    `${HYDRO_CONFIG.mqtt.host}:` +
    `${HYDRO_CONFIG.mqtt.port}` +
    `${HYDRO_CONFIG.mqtt.path}`
  );

}


/* =========================================================
   MQTT STATUS UI
========================================================= */

function updateMQTTStatus(connected) {

  hydroState.mqttConnected = connected;


  const dot = $("mqttDot");

  const state = $("mqttState");

  const sub = $("mqttSub");

  const mqttStatus = $("mqttStatus");


  if(connected) {

    if(dot)
      dot.style.color = "#22c55e";

    if(state)
      state.textContent = "MQTT متصل";

    if(sub)
      sub.textContent =
        "ESP32 • MQTT • Online";

    if(mqttStatus) {

      mqttStatus.textContent =
        "متصل";

      mqttStatus.className =
        "green";

    }

  } else {

    if(dot)
      dot.style.color = "#ef4444";

    if(state)
      state.textContent =
        "MQTT غير متصل";

    if(sub)
      sub.textContent =
        "ESP32 • MQTT • Offline";

    if(mqttStatus) {

      mqttStatus.textContent =
        "غير متصل";

      mqttStatus.className =
        "";

    }

  }

}


/* =========================================================
   ESP32 STATUS UI
========================================================= */

function updateESPStatus(online) {

  hydroState.espOnline = online;


  const espStatus = $("espStatus");

  const alertConnection =
    $("alertConnection");


  if(online) {

    if(espStatus) {

      espStatus.textContent =
        "Online";

      espStatus.className =
        "green";

    }

    if(alertConnection)
      alertConnection.textContent =
        "ESP32 متصل";

  } else {

    if(espStatus) {

      espStatus.textContent =
        "Offline";

      espStatus.className =
        "";

    }

    if(alertConnection)
      alertConnection.textContent =
        "ESP32 غير متصل";

  }

}


/* =========================================================
   MODE UI
========================================================= */

function updateModeUI(mode) {

  mode =
    String(mode || "AUTO")
      .toUpperCase();


  if(mode !== "AUTO" && mode !== "MANUAL")
    mode = "AUTO";


  hydroState.mode = mode;


  setText("homeMode", mode);

  setText("pumpMode", mode);

  setText("fanMode", mode);

  setText("padMode", mode);

  setText("systemPumpMode", mode);


  const modeButton = $("mode");

  if(modeButton)
    modeButton.textContent = mode;

}


/* =========================================================
   LEVEL CONVERSION
========================================================= */

function convertWaterLevel(value) {

  if(value === null || value === undefined)
    return null;


  const number =
    Number(value);


  if(!Number.isFinite(number))
    return null;


  /*
     إذا كان ESP32 يرسل نسبة مباشرة.
  */

  if(number >= 0 && number <= 100)
    return number;


  /*
     إذا كان ESP32 يرسل ADC.
  */

  const empty =
    HYDRO_CONFIG.levelADC.empty;

  const full =
    HYDRO_CONFIG.levelADC.full;


  if(full <= empty)
    return null;


  let percent =
    ((number - empty) /
    (full - empty)) * 100;


  percent =
    Math.max(
      0,
      Math.min(100, percent)
    );


  return percent;

}


/* =========================================================
   FORMAT NUMBER
========================================================= */

function formatNumber(value, decimals = 1) {

  if(value === null || value === undefined)
    return "--";


  const number =
    Number(value);


  if(!Number.isFinite(number))
    return "--";


  return number.toFixed(decimals);

}


/* =========================================================
   UPDATE TELEMETRY UI
========================================================= */

function updateTelemetryUI(data) {

  const airTemperature =
    Number(
      data.airTemperature ??
      data.temperature ??
      data.temp
    );


  const airHumidity =
    Number(
      data.airHumidity ??
      data.humidity ??
      data.hum
    );


  const waterTemperature =
    Number(
      data.waterTemperature ??
      data.waterTemp ??
      data.wt
    );


  const rawLevel =
    data.waterLevel ??
    data.level ??
    data.water_level;


  const level =
    convertWaterLevel(rawLevel);


  const ec =
    data.ec ??
    data.EC ??
    data.ECValue;


  const ph =
    data.ph ??
    data.pH ??
    data.PH;


  if(Number.isFinite(airTemperature))
    hydroState.values.airTemperature =
      airTemperature;


  if(Number.isFinite(airHumidity))
    hydroState.values.airHumidity =
      airHumidity;


  if(Number.isFinite(waterTemperature))
    hydroState.values.waterTemperature =
      waterTemperature;


  if(level !== null)
    hydroState.values.waterLevel =
      level;


  if(ec !== undefined &&
     ec !== null &&
     Number.isFinite(Number(ec))) {

    hydroState.values.ec =
      Number(ec);

  }


  if(ph !== undefined &&
     ph !== null &&
     Number.isFinite(Number(ph))) {

    hydroState.values.ph =
      Number(ph);

  }


  const v =
    hydroState.values;


  /* ---------------- HOME ---------------- */

  if(v.airTemperature !== null) {

    setText(
      "temp",
      `${formatNumber(v.airTemperature)}°C`
    );

    setText(
      "cv",
      `${formatNumber(v.airTemperature)}°C`
    );

    setText(
      "tempStatus",
      "متصل"
    );

  }


  if(v.airHumidity !== null) {

    setText(
      "hum",
      `${formatNumber(v.airHumidity)}%`
    );

    setText(
      "humStatus",
      "متصل"
    );

  }


  if(v.waterTemperature !== null) {

    setText(
      "wt",
      `${formatNumber(v.waterTemperature)}°C`
    );

    setText(
      "dataWt",
      `${formatNumber(v.waterTemperature)}°C`
    );

    setText(
      "systemWaterTemp",
      `${formatNumber(v.waterTemperature)}°C`
    );

    setText(
      "wtStatus",
      "متصل"
    );

  }


  if(v.waterLevel !== null) {

    setText(
      "level",
      `${formatNumber(v.waterLevel, 0)}%`
    );

    setText(
      "levelStatus",
      "متصل"
    );

    setText(
      "systemTank",
      `الخزان ${formatNumber(v.waterLevel, 0)}%`
    );

  }


  if(v.ec !== null) {

    setText(
      "ec",
      formatNumber(v.ec, 2)
    );

    setText(
      "dataEc",
      formatNumber(v.ec, 2)
    );

    setText(
      "ecStatus",
      "mS/cm"
    );

  }


  if(v.ph !== null) {

    setText(
      "ph",
      formatNumber(v.ph, 2)
    );

    setText(
      "dataPh",
      formatNumber(v.ph, 2)
    );

    setText(
      "phStatus",
      "متصل"
    );

  }


  /* ---------------- DATA ---------------- */

  if(v.airHumidity !== null) {

    setText(
      "dataHum",
      `${formatNumber(v.airHumidity)}%`
    );

  }


  /* ---------------- SYSTEM ---------------- */

  if(v.airTemperature !== null) {

    setText(
      "systemTemp",
      `${formatNumber(v.airTemperature)}°C`
    );

  }


  /*
     حفظ البيانات للرسم البياني.
  */

  if(v.airTemperature !== null) {

    hydroState.history.temperature.push({

      time: Date.now(),

      value: v.airTemperature

    });

  }


  if(v.waterLevel !== null) {

    hydroState.history.level.push({

      time: Date.now(),

      value: v.waterLevel

    });

  }


  /*
     نحتفظ بآخر 100 نقطة فقط.
  */

  hydroState.history.temperature =
    hydroState.history.temperature.slice(-100);

  hydroState.history.level =
    hydroState.history.level.slice(-100);


  hydroState.lastTelemetry =
    data;

  hydroState.lastTelemetryTime =
    Date.now();


  updateESPStatus(true);

}


/* =========================================================
   EXTRACT ACTUATOR STATES FROM TELEMETRY
========================================================= */

function updateActuatorsFromTelemetry(data) {

  /*
     Pump:
     نستخدم pump1 كافتراضي.

     يمكن تغيير ذلك لاحقًا حسب
     مخارج ESP32 الحقيقية.
  */

  if(data.pump !== undefined) {

    hydroState.actuators.pump =
      Boolean(Number(data.pump));

  }
  else if(data.pump1 !== undefined) {

    hydroState.actuators.pump =
      Boolean(Number(data.pump1));

  }


  /*
     Fan
  */

  if(data.fan !== undefined) {

    hydroState.actuators.fan =
      Boolean(Number(data.fan));

  }
  else if(data.fan1 !== undefined) {

    hydroState.actuators.fan =
      Boolean(Number(data.fan1));

  }


  /*
     Pad Cooling

     ندعم عدة أسماء حتى يكون النظام
     مرنًا مع ESP32.
  */

  if(data.pad_cooling !== undefined) {

    hydroState.actuators.pad_cooling =
      Boolean(Number(data.pad_cooling));

  }
  else if(data.padCooling !== undefined) {

    hydroState.actuators.pad_cooling =
      Boolean(Number(data.padCooling));

  }
  else if(data.pump3 !== undefined) {

    /*
       حسب بياناتك السابقة كان pump3
       موجودًا في Telemetry.

       إذا كان pump3 هو Pad Cooling
       فهذا السطر مناسب.

       إذا لم يكن كذلك سنغيره لاحقًا.
    */

    hydroState.actuators.pad_cooling =
      Boolean(Number(data.pump3));

  }


  updateSwitchUI();

}


/* =========================================================
   SWITCH UI
========================================================= */

function setSwitch(id, state) {

  const button =
    $(id);

  if(!button)
    return;


  button.classList.toggle(
    "on",
    Boolean(state)
  );

}


function updateSwitchUI() {

  setSwitch(
    "pumpSwitch",
    hydroState.actuators.pump
  );


  setSwitch(
    "fanSwitch",
    hydroState.actuators.fan
  );


  setSwitch(
    "padSwitch",
    hydroState.actuators.pad_cooling
  );


  setSwitch(
    "systemPadSwitch",
    hydroState.actuators.pad_cooling
  );


  setText(
    "systemPump",
    hydroState.actuators.pump
      ? "المضخة ON"
      : "المضخة OFF"
  );


  setText(
    "systemFan",
    hydroState.actuators.fan
      ? "المروحة ON"
      : "المروحة OFF"
  );


  setText(
    "systemFanState",
    hydroState.actuators.fan
      ? "تعمل"
      : "متوقفة"
  );

}


/* =========================================================
   PARSE MQTT PAYLOAD
========================================================= */

function parsePayload(message) {

  const text =
    message.toString();


  try {

    return JSON.parse(text);

  }
  catch(error) {

    /*
       إذا كانت الرسالة مجرد:
       ON / OFF
    */

    return {
      value: text
    };

  }

}


/* =========================================================
   MQTT MESSAGE HANDLER
========================================================= */

function handleMQTTMessage(topic, message) {

  console.log(
    "MQTT RX:",
    topic,
    message.toString()
  );


  const data =
    parsePayload(message);


  /* -----------------------------------------
     TELEMETRY
  ----------------------------------------- */

  if(
    topic ===
    HYDRO_CONFIG.topics.telemetry
  ) {

    updateTelemetryUI(data);

    updateActuatorsFromTelemetry(data);

    /*
       إذا كانت Telemetry تحتوي auto:
    */

    if(data.auto !== undefined) {

      updateModeUI(
        Number(data.auto)
          ? "AUTO"
          : "MANUAL"
      );

    }

    return;

  }


  /* -----------------------------------------
     ESP32 STATUS
  ----------------------------------------- */

  if(
    topic ===
    HYDRO_CONFIG.topics.status
  ) {

    handleESPStatus(data);

    return;

  }


  /* -----------------------------------------
     ACTUATOR STATE
  ----------------------------------------- */

  if(
    topic.startsWith(
      "greenhouse/GH001/actuators/"
    )
  ) {

    handleActuatorState(
      topic,
      data
    );

    return;

  }


  /* -----------------------------------------
     ALERTS
  ----------------------------------------- */

  if(
    topic ===
    HYDRO_CONFIG.topics.alerts
  ) {

    handleMQTTAlert(data);

    return;

  }

}


/* =========================================================
   ESP STATUS
========================================================= */

function handleESPStatus(data) {

  let online = false;


  if(typeof data === "string") {

    online =
      data.toUpperCase() ===
      "ONLINE";

  }
  else {

    if(
      data.status !== undefined
    ) {

      online =
        String(data.status)
          .toUpperCase() ===
          "ONLINE";

    }

    if(data.online !== undefined) {

      online =
        Boolean(data.online);

    }

  }


  updateESPStatus(online);

}


/* =========================================================
   ACTUATOR STATE
========================================================= */

function handleActuatorState(
  topic,
  data
) {

  const prefix =
    "greenhouse/GH001/actuators/";


  let device =
    topic.substring(
      prefix.length
    );


  device =
    device.replace(
      "/state",
      ""
    );


  let state = false;


  if(typeof data === "boolean") {

    state = data;

  }
  else if(typeof data === "number") {

    state =
      data !== 0;

  }
  else if(typeof data === "string") {

    state =
      ["ON", "1", "TRUE"]
        .includes(
          data.toUpperCase()
        );

  }
  else {

    if(data.state !== undefined) {

      state =
        ["ON", "1", "TRUE"]
          .includes(
            String(data.state)
              .toUpperCase()
          );

    }

    if(data.value !== undefined) {

      state =
        ["ON", "1", "TRUE"]
          .includes(
            String(data.value)
              .toUpperCase()
          );

    }

  }


  if(
    device === "pump" ||
    device === "pump1"
  ) {

    hydroState.actuators.pump =
      state;

  }


  if(
    device === "fan" ||
    device === "fan1"
  ) {

    hydroState.actuators.fan =
      state;

  }


  if(
    device === "pad_cooling" ||
    device === "padCooling"
  ) {

    hydroState.actuators.pad_cooling =
      state;

  }


  updateSwitchUI();

}


/* =========================================================
   MQTT ALERT
========================================================= */

function handleMQTTAlert(data) {

  const title =
    data.title ||
    "تنبيه Hydro Farm";


  const body =
    data.body ||
    data.message ||
    "تم استلام تنبيه من ESP32";


  addHydroAlert(
    title,
    body
  );

}


/* =========================================================
   ADD ALERT
========================================================= */

function addHydroAlert(
  title,
  body
) {

  hydroState.alerts.unshift({

    title,
    body,

    time: Date.now()

  });


  hydroState.alerts =
    hydroState.alerts.slice(0, 50);


  const list =
    $("alertsList");


  if(!list)
    return;


  const article =
    document.createElement("article");


  article.className =
    "alert warning";


  article.innerHTML = `

    ⚠️

    <div>

      <b></b>

      <small></small>

    </div>

  `;


  article.querySelector("b")
    .textContent = title;


  article.querySelector("small")
    .textContent = body;


  list.prepend(article);

}


/* =========================================================
   MQTT CONNECT
========================================================= */

async function connectHydroMQTT() {

  if(typeof mqtt === "undefined") {

    showToast(
      "مكتبة MQTT غير موجودة"
    );

    console.error(
      "MQTT.js library is not loaded"
    );

    return;

  }


  const usernameInput =
    $("mqttUser");


  const passwordInput =
    $("mqttPass");


  const hostInput =
    $("mqttHost");


  const portInput =
    $("mqttPort");


  const username =
    usernameInput
      ? usernameInput.value.trim()
      : "";


  const password =
    passwordInput
      ? passwordInput.value
      : "";


  const host =
    hostInput?.value.trim() ||
    HYDRO_CONFIG.mqtt.host;


  const port =
    Number(
      portInput?.value ||
      HYDRO_CONFIG.mqtt.port
    );


  if(!username) {

    showToast(
      "أدخل MQTT Username"
    );

    return;

  }


  if(!password) {

    showToast(
      "أدخل MQTT Password"
    );

    return;

  }


  /*
     أغلق الاتصال السابق.
  */

  if(hydroMQTT) {

    try {

      hydroMQTT.end(
        true
      );

    }
    catch(error) {}

  }


  const url =
    `wss://${host}:${port}/mqtt`;


  console.log(
    "Connecting to:",
    url
  );


  showToast(
    "جاري الاتصال بـ MQTT..."
  );


  try {

    hydroMQTT =
      mqtt.connect(
        url,
        {

          username:
            username,

          password:
            password,

          clean:
            true,

          reconnectPeriod:
            5000,

          connectTimeout:
            10000,

          keepalive:
            60,

          clientId:
            "HydroFarmWeb_" +
            Math.random()
              .toString(16)
              .substring(2, 10)

        }
      );


  }
  catch(error) {

    console.error(
      "MQTT connection error:",
      error
    );

    updateMQTTStatus(false);

    showToast(
      "فشل إنشاء اتصال MQTT"
    );

    return;

  }


  /* =======================================================
     CONNECT
  ======================================================= */

  hydroMQTT.on(
    "connect",
    () => {

      console.log(
        "HYDRO FARM MQTT CONNECTED"
      );


      updateMQTTStatus(true);


      showToast(
        "تم الاتصال بـ MQTT"
      );


      subscribeHydroTopics();

    }
  );


  /* =======================================================
     MESSAGE
  ======================================================= */

  hydroMQTT.on(
    "message",
    (
      topic,
      message
    ) => {

      handleMQTTMessage(
        topic,
        message
      );

    }
  );


  /* =======================================================
     ERROR
  ======================================================= */

  hydroMQTT.on(
    "error",
    error => {

      console.error(
        "MQTT ERROR:",
        error
      );


      updateMQTTStatus(false);


      showToast(
        "خطأ في اتصال MQTT"
      );

    }
  );


  /* =======================================================
     CLOSE
  ======================================================= */

  hydroMQTT.on(
    "close",
    () => {

      console.log(
        "MQTT connection closed"
      );


      updateMQTTStatus(false);

    }
  );


  /* =======================================================
     OFFLINE
  ======================================================= */

  hydroMQTT.on(
    "offline",
    () => {

      console.log(
        "MQTT offline"
      );


      updateMQTTStatus(false);

    }
  );


  /* =======================================================
     RECONNECT
  ======================================================= */

  hydroMQTT.on(
    "reconnect",
    () => {

      console.log(
        "MQTT reconnecting..."
      );


      const state =
        $("mqttState");


      if(state)
        state.textContent =
          "إعادة الاتصال بـ MQTT...";

    }
  );

}


/* =========================================================
   SUBSCRIBE TO TOPICS
========================================================= */

function subscribeHydroTopics() {

  if(
    !hydroMQTT ||
    !hydroMQTT.connected
  )
    return;


  const topics = [

    HYDRO_CONFIG.topics.telemetry,

    HYDRO_CONFIG.topics.actuatorState,

    HYDRO_CONFIG.topics.status,

    HYDRO_CONFIG.topics.alerts

  ];


  hydroMQTT.subscribe(
    topics,
    {
      qos: 0
    },
    error => {

      if(error) {

        console.error(
          "MQTT subscribe error:",
          error
        );

        showToast(
          "فشل الاشتراك في Topics"
        );

        return;

      }


      console.log(
        "Subscribed to:",
        topics
      );

    }
  );

}


/* =========================================================
   PUBLISH CONTROL
========================================================= */

function publishHydroControl(
  device,
  state
) {

  if(
    !hydroMQTT ||
    !hydroMQTT.connected
  ) {

    showToast(
      "MQTT غير متصل"
    );

    return false;

  }


  let topic = null;


  if(device === "pump") {

    topic =
      HYDRO_CONFIG.topics.controlPump;

  }


  if(device === "fan") {

    topic =
      HYDRO_CONFIG.topics.controlFan;

  }


  if(device === "pad_cooling") {

    topic =
      HYDRO_CONFIG.topics.controlPad;

  }


  if(!topic) {

    console.error(
      "Unknown MQTT device:",
      device
    );

    return false;

  }


  const payload =
    JSON.stringify({

      state:
        state ? "ON" : "OFF",

      value:
        state ? 1 : 0,

      mode:
        hydroState.mode,

      greenhouse:
        HYDRO_CONFIG.greenhouseId,

      timestamp:
        Date.now()

    });


  hydroMQTT.publish(
    topic,
    payload,
    {
      qos: 0,
      retain: false
    },
    error => {

      if(error) {

        console.error(
          "MQTT publish error:",
          error
        );

        showToast(
          "فشل إرسال أمر التحكم"
        );

      }
      else {

        console.log(
          "MQTT TX:",
          topic,
          payload
        );

        showToast(
          state
            ? "تم إرسال أمر التشغيل"
            : "تم إرسال أمر الإيقاف"
        );

      }

    }
  );


  return true;

}


/* =========================================================
   DEVICE SWITCH
========================================================= */

function handleDeviceSwitch(
  button
) {

  if(!button)
    return;


  const device =
    button.dataset.device;


  if(!device)
    return;


  /*
     التحكم اليدوي يجب أن يكون
     في MANUAL.

     لذلك إذا كان AUTO،
     نمنع التحكم المباشر.
  */

  if(
    hydroState.mode !==
    "MANUAL"
  ) {

    showToast(
      "غيّر الوضع إلى MANUAL أولاً"
    );

    return;

  }


  let currentState = false;


  if(device === "pump") {

    currentState =
      hydroState.actuators.pump;

  }


  if(device === "fan") {

    currentState =
      hydroState.actuators.fan;

  }


  if(device === "pad_cooling") {

    currentState =
      hydroState.actuators.pad_cooling;

  }


  const newState =
    !currentState;


  /*
     لا نغير الحالة محليًا قبل تأكيد ESP32.
     نرسل الأمر وننتظر actuator/state.
  */

  publishHydroControl(
    device,
    newState
  );

}


/* =========================================================
   MODE CONTROL
========================================================= */

function toggleHydroMode() {

  const newMode =
    hydroState.mode ===
    "AUTO"
      ? "MANUAL"
      : "AUTO";


  if(
    !hydroMQTT ||
    !hydroMQTT.connected
  ) {

    showToast(
      "MQTT غير متصل"
    );

    return;

  }


  const payload =
    JSON.stringify({

      mode:
        newMode,

      value:
        newMode === "AUTO"
          ? 1
          : 0,

      greenhouse:
        HYDRO_CONFIG.greenhouseId,

      timestamp:
        Date.now()

    });


  hydroMQTT.publish(
    HYDRO_CONFIG.topics.controlMode,
    payload,
    {
      qos: 0,
      retain: false
    },
    error => {

      if(error) {

        console.error(
          "Mode publish error:",
          error
        );

        showToast(
          "فشل إرسال الوضع"
        );

        return;

      }


      console.log(
        "MQTT MODE TX:",
        payload
      );


      /*
         نعرض الوضع المطلوب مؤقتًا.
         ESP32 يجب أن يعيد الحالة الحقيقية
         في telemetry/status.
      */

      updateModeUI(
        newMode
      );


      showToast(
        `تم تغيير الوضع إلى ${newMode}`
      );

    }
  );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

  document
    .querySelectorAll(
      "nav button[data-page]"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const page =
            button.dataset.page;


          document
            .querySelectorAll(
              ".page"
            )
            .forEach(section => {

              section.classList.toggle(
                "active",
                section.id === page
              );

            });


          document
            .querySelectorAll(
              "nav button"
            )
            .forEach(navButton => {

              navButton.classList.toggle(
                "active",
                navButton === button
              );

            });

        }
      );

    });

}


/* =========================================================
   CONTROL BUTTONS
========================================================= */

function setupControls() {

  const switches =
    document.querySelectorAll(
      ".sw[data-device]"
    );


  switches.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        handleDeviceSwitch(
          button
        );

      }
    );

  });


  const modeButton =
    $("mode");


  if(modeButton) {

    modeButton.addEventListener(
      "click",
      () => {

        toggleHydroMode();

      }
    );

  }


  const connectButton =
    $("mqttConnect");


  if(connectButton) {

    connectButton.addEventListener(
      "click",
      () => {

        connectHydroMQTT();

      }
    );

  }


  const clearButton =
    $("clear");


  if(clearButton) {

    clearButton.addEventListener(
      "click",
      () => {

        hydroState.alerts = [];


        const list =
          $("alertsList");


        if(list)
          list.innerHTML = "";


        showToast(
          "تم مسح التنبيهات"
        );

      }
    );

  }

}


/* =========================================================
   RANGE SETTINGS UI
========================================================= */

function setupRangeSettings() {

  const pairs = [

    ["fan", "fo"],

    ["crit", "fc"],

    ["pad", "po"],

    ["low", "lo"],

    ["critical", "lc"]

  ];


  pairs.forEach(
    ([inputId, outputId]) => {

      const input =
        $(inputId);

      const output =
        $(outputId);


      if(!input || !output)
        return;


      const update = () => {

        output.textContent =
          input.value;

      };


      input.addEventListener(
        "input",
        update
      );


      update();

    }
  );

}


/* =========================================================
   AUTO ESP32 OFFLINE WATCHDOG
========================================================= */

function startESPWatchdog() {

  setInterval(
    () => {

      if(
        !hydroState.lastTelemetryTime
      )
        return;


      const elapsed =
        Date.now() -
        hydroState.lastTelemetryTime;


      /*
         إذا لم تصل Telemetry
         لمدة 30 ثانية نعتبر ESP32
         غير متصل.
      */

      if(elapsed > 30000) {

        updateESPStatus(false);

      }

    },
    5000
  );

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

function saveHydroSettings() {

  const settings = {

    fanWarning:
      $("fan")?.value,

    temperatureCritical:
      $("crit")?.value,

    padCooling:
      $("pad")?.value,

    levelWarning:
      $("low")?.value,

    levelCritical:
      $("critical")?.value

  };


  try {

    localStorage.setItem(
      "hydroFarmSettings",
      JSON.stringify(settings)
    );


    showToast(
      "تم حفظ الإعدادات"
    );

  }
  catch(error) {

    console.error(
      "Settings save error:",
      error
    );

  }

}


/* =========================================================
   LOAD SETTINGS
========================================================= */

function loadHydroSettings() {

  try {

    const raw =
      localStorage.getItem(
        "hydroFarmSettings"
      );


    if(!raw)
      return;


    const settings =
      JSON.parse(raw);


    if(
      settings.fanWarning &&
      $("fan")
    )
      $("fan").value =
        settings.fanWarning;


    if(
      settings.temperatureCritical &&
      $("crit")
    )
      $("crit").value =
        settings.temperatureCritical;


    if(
      settings.padCooling &&
      $("pad")
    )
      $("pad").value =
        settings.padCooling;


    if(
      settings.levelWarning &&
      $("low")
    )
      $("low").value =
        settings.levelWarning;


    if(
      settings.levelCritical &&
      $("critical")
    )
      $("critical").value =
        settings.levelCritical;


  }
  catch(error) {

    console.error(
      "Settings load error:",
      error
    );

  }

}


/* =========================================================
   SAVE BUTTON
========================================================= */

function setupSaveButton() {

  const save =
    $("save");


  if(save) {

    save.addEventListener(
      "click",
      saveHydroSettings
    );

  }

}


/* =========================================================
   INITIALIZATION
========================================================= */

function initHydroFarm() {

  console.log(
    "================================="
  );

  console.log(
    "HYDRO FARM GH001"
  );

  console.log(
    "MQTT PHASE 2"
  );

  console.log(
    "================================="
  );


  setupNavigation();

  setupControls();

  setupRangeSettings();

  setupSaveButton();

  loadHydroSettings();

  updateMQTTStatus(false);

  updateESPStatus(false);

  updateModeUI("AUTO");

  updateSwitchUI();

  startESPWatchdog();


  /*
     لا نتصل تلقائيًا في هذه المرحلة.

     المستخدم يضغط:
     اتصال MQTT

     من صفحة الإعدادات.
  */


  console.log(
    "Hydro Farm application initialized"
  );

}


/* =========================================================
   START
========================================================= */

if(
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initHydroFarm
  );

}
else {

  initHydroFarm();

}


/* =========================================================
   GLOBAL API
========================================================= */

window.HydroFarm = {

  state:
    hydroState,

  config:
    HYDRO_CONFIG,

  connectMQTT:
    connectHydroMQTT,

  publishControl:
    publishHydroControl,

  setMode:
    updateModeUI,

  addAlert:
    addHydroAlert

};


/* =========================================================
   COMPATIBILITY FUNCTIONS
   Used by firebase.js / pwa.js later
========================================================= */

window.addHydroAlert =
  addHydroAlert;


window.showHydroNotification =
  function(title, body) {

    /*
       Firebase/FCM سيستعمل هذه الدالة
       في المرحلة 3.

       في الوقت الحالي نعرض Toast فقط.
    */

    showToast(
      `${title}: ${body}`
    );

  };
