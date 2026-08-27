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
        "HYDRO FARM MQTT CONNE    if (!pageName)
      return;


    HydroUI.page = pageName;


    pages.forEach(page => {

      page.classList.toggle(
        "active",
        page.id === pageName
      );

    });


    buttons.forEach(navButton => {

      navButton.classList.toggle(
        "active",
        navButton === button
      );

    });


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }
);

});

}

/* =========================================================
DEVICE SWITCHES
========================================================= */

function setDeviceState(
device,
state,
showMessage = true
) {

if (!(device in HydroUI.devices))
return;

HydroUI.devices[device] =
Boolean(state);

updateDeviceSwitches();

if (showMessage) {

const names = {

  pump: "المضخة",

  fan: "المروحة",

  pad_cooling: "Pad Cooling"

};


showToast(
  `${names[device] || device}: ${
    state ? "تشغيل" : "إيقاف"
  }`
);

}

}

function updateDeviceSwitches() {

document
.querySelectorAll(
'.sw[data-device]'
)
.forEach(button => {

  const device =
    button.dataset.device;

  const state =
    Boolean(
      HydroUI.devices[device]
    );


  button.classList.toggle(
    "on",
    state
  );

});

updateDeviceModes();

}

function initDeviceSwitches() {

document
.querySelectorAll(
'.sw[data-device]'
)
.forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const device =
        button.dataset.device;

      if (!device)
        return;


      const current =
        Boolean(
          HydroUI.devices[device]
        );


      setDeviceState(
        device,
        !current
      );

    }
  );

});

updateDeviceSwitches();

}

/* =========================================================
DEVICE MODE DISPLAY
========================================================= */

function updateDeviceModes() {

const pumpMode =
$("pumpMode");

const fanMode =
$("fanMode");

const padMode =
$("padMode");

const systemPumpMode =
$("systemPumpMode");

if (pumpMode)
pumpMode.textContent =
HydroUI.mode;

if (fanMode)
fanMode.textContent =
HydroUI.mode;

if (padMode)
padMode.textContent =
HydroUI.mode;

if (systemPumpMode)
systemPumpMode.textContent =
HydroUI.mode;

const systemPump =
$("systemPump");

if (systemPump) {

systemPump.textContent =
  `المضخة ${
    HydroUI.devices.pump
      ? "ON"
      : "OFF"
  }`;

}

const systemFan =
$("systemFan");

if (systemFan) {

systemFan.textContent =
  HydroUI.devices.fan
    ? "المروحة ON"
    : "المروحة OFF";

}

}

/* =========================================================
AUTO / MANUAL MODE
========================================================= */

function updateModeButton() {

const modeButton =
$("mode");

const homeMode =
$("homeMode");

if (modeButton)
modeButton.textContent =
HydroUI.mode;

if (homeMode)
homeMode.textContent =
HydroUI.mode;

updateDeviceModes();

}

function initMode() {

const button =
$("mode");

if (!button)
return;

button.addEventListener(
"click",
() => {

  HydroUI.mode =
    HydroUI.mode === "AUTO"
      ? "MANUAL"
      : "AUTO";


  updateModeButton();


  showToast(
    `الوضع: ${HydroUI.mode}`
  );

}

);

updateModeButton();

}

/* =========================================================
RANGE INPUTS
========================================================= */

const rangeMap = {

fan: "fo",

crit: "fc",

pad: "po",

low: "lo",

critical: "lc"

};

function initRanges() {

Object.entries(rangeMap)
.forEach(([inputId, outputId]) => {

  const input =
    $(inputId);

  const output =
    $(outputId);


  if (!input || !output)
    return;


  function update() {

    output.textContent =
      input.value;


    updateSettingValue(
      inputId,
      input.value
    );

  }


  input.addEventListener(
    "input",
    update
  );


  update();

});

}

function updateSettingValue(
inputId,
value
) {

const number =
Number(value);

switch (inputId) {

case "fan":
  HydroUI.settings.fanWarning =
    number;
  break;

case "crit":
  HydroUI.settings.fanCritical =
    number;
  break;

case "pad":
  HydroUI.settings.padTemperature =
    number;
  break;

case "low":
  HydroUI.settings.levelWarning =
    number;
  break;

case "critical":
  HydroUI.settings.levelCritical =
    number;
  break;

}

}

/* =========================================================
RANGE BUTTONS
========================================================= */

function initRangeButtons() {

const buttons =
document.querySelectorAll(
".ranges button"
);

buttons.forEach(button => {

button.addEventListener(
  "click",
  () => {

    buttons.forEach(item => {

      item.classList.remove(
        "sel"
      );

    });


    button.classList.add(
      "sel"
    );


    showToast(
      `الفترة: ${button.textContent}`
    );

  }
);

});

}

/* =========================================================
SAVE SETTINGS
========================================================= */

function saveSettings() {

try {

localStorage.setItem(
  "hydroFarmSettings",
  JSON.stringify(
    HydroUI.settings
  )
);

localStorage.setItem(
  "hydroFarmMode",
  HydroUI.mode
);


showToast(
  "تم حفظ الإعدادات"
);

} catch(error) {

console.error(
  "Settings save error:",
  error
);

showToast(
  "تعذر حفظ الإعدادات"
);

}

}

/* =========================================================
LOAD SETTINGS
========================================================= */

function loadSettings() {

try {

const saved =
  localStorage.getItem(
    "hydroFarmSettings"
  );


if (saved) {

  const data =
    JSON.parse(saved);


  HydroUI.settings = {
    ...HydroUI.settings,
    ...data
  };

}


const savedMode =
  localStorage.getItem(
    "hydroFarmMode"
  );


if (
  savedMode === "AUTO" ||
  savedMode === "MANUAL"
) {

  HydroUI.mode =
    savedMode;

}

} catch(error) {

console.error(
  "Settings load error:",
  error
);

}

applySettingsToInputs();

updateModeButton();

}

function applySettingsToInputs() {

const values = {

fan:
  HydroUI.settings.fanWarning,

crit:
  HydroUI.settings.fanCritical,

pad:
  HydroUI.settings.padTemperature,

low:
  HydroUI.settings.levelWarning,

critical:
  HydroUI.settings.levelCritical

};

Object.entries(values)
.forEach(([id, value]) => {

  const input = $(id);

  const output =
    $(rangeMap[id]);


  if (input)
    input.value = value;


  if (output)
    output.textContent = value;

});

}

/* =========================================================
SAVE BUTTON
========================================================= */

function initSaveButton() {

const button =
$("save");

if (!button)
return;

button.addEventListener(
"click",
saveSettings
);

}

/* =========================================================
CLEAR ALERTS
========================================================= */

function initClearAlerts() {

const button =
$("clear");

if (!button)
return;

button.addEventListener(
"click",
() => {

  const list =
    $("alertsList");

  if (!list)
    return;


  list.innerHTML = `

    <article class="alert good">

      🟢

      <div>

        <b>
          لا توجد تنبيهات
        </b>

        <small>
          النظام يعمل بشكل طبيعي
        </small>

      </div>

    </article>

  `;


  showToast(
    "تم مسح التنبيهات"
  );

}

);

}

/* =========================================================
BELL
========================================================= */

function initBell() {

const bell =
$("bell");

if (!bell)
return;

bell.addEventListener(
"click",
() => {

  const alertButton =
    document.querySelector(
      'nav button[data-page="alerts"]'
    );


  if (alertButton)
    alertButton.click();

}

);

}

/* =========================================================
DEMO SENSOR DATA

هذه البيانات مؤقتة فقط لاختبار الواجهة.

في المرحلة التالية سيتم استبدالها
ببيانات MQTT القادمة من ESP32.
========================================================= */

function updateDemoData() {

const data = {

temperature:
  28.4 +
  Math.sin(Date.now() / 10000) * 1.2,

humidity:
  68,

waterTemperature:
  25.8,

waterLevel:
  82,

ec:
  1.42,

ph:
  6.1

};

HydroUI.sensorData = data;

updateSensorDisplay();

}

function updateSensorDisplay() {

const data =
HydroUI.sensorData;

if (data.temperature !== null) {

setText(
  "temp",
  `${data.temperature.toFixed(1)}°C`
);

setText(
  "cv",
  `${data.temperature.toFixed(1)}°C`
);

setText(
  "systemTemp",
  `${data.temperature.toFixed(1)}°C`
);

}

if (data.humidity !== null) {

setText(
  "hum",
  `${data.humidity.toFixed(0)}%`
);

setText(
  "dataHum",
  `${data.humidity.toFixed(0)}%`
);

}

if (data.waterTemperature !== null) {

setText(
  "wt",
  `${data.waterTemperature.toFixed(1)}°C`
);

setText(
  "dataWt",
  `${data.waterTemperature.toFixed(1)}°C`
);

setText(
  "systemWaterTemp",
  `${data.waterTemperature.toFixed(1)}°C`
);

}

if (data.waterLevel !== null) {

setText(
  "level",
  `${data.waterLevel.toFixed(0)}%`
);

setText(
  "systemTank",
  `الخزان ${data.waterLevel.toFixed(0)}%`
);

}

if (data.ec !== null) {

setText(
  "ec",
  data.ec.toFixed(2)
);

setText(
  "dataEc",
  data.ec.toFixed(2)
);

}

if (data.ph !== null) {

setText(
  "ph",
  data.ph.toFixed(2)
);

setText(
  "dataPh",
  data.ph.toFixed(2)
);

}

updateSensorStatuses();

}

function setText(id, value) {

const element = $(id);

if (element)
element.textContent = value;

}

/* =========================================================
SENSOR STATUS
========================================================= */

function updateSensorStatuses() {

const temp =
HydroUI.sensorData.temperature;

const level =
HydroUI.sensorData.waterLevel;

if (temp !== null) {

let status =
  "طبيعي";

if (
  temp >=
  HydroUI.settings.fanCritical
) {

  status =
    "حرارة مرتفعة";

} else if (
  temp >=
  HydroUI.settings.fanWarning
) {

  status =
    "تحذير الحرارة";

}


setText(
  "tempStatus",
  status
);

}

if (level !== null) {

let status =
  "طبيعي";


if (
  level <=
  HydroUI.settings.levelCritical
) {

  status =
    "مستوى حرج";

} else if (
  level <=
  HydroUI.settings.levelWarning
) {

  status =
    "مستوى منخفض";

}


setText(
  "levelStatus",
  status
);

}

setText(
"humStatus",
"طبيعي"
);

setText(
"wtStatus",
"طبيعي"
);

setText(
"ecStatus",
"mS/cm"
);

setText(
"phStatus",
"طبيعي"
);

}

/* =========================================================
SIMPLE DEMO CHART
========================================================= */

function drawChart(
canvasId,
values,
min,
max
) {

const canvas =
$(canvasId);

if (!canvas)
return;

const ctx =
canvas.getContext("2d");

if (!ctx)
return;

const rect =
canvas.getBoundingClientRect();

const dpr =
window.devicePixelRatio || 1;

canvas.width =
rect.width * dpr;

canvas.height =
rect.height * dpr;

ctx.setTransform(
dpr,
0,
0,
dpr,
0,
0
);

const width =
rect.width;

const height =
rect.height;

ctx.clearRect(
0,
0,
width,
height
);

/* Grid */

ctx.strokeStyle =
"#e8efed";

ctx.lineWidth = 1;

for (
let y = 20;
y < height;
y += 30
) {

ctx.beginPath();

ctx.moveTo(0, y);

ctx.lineTo(width, y);

ctx.stroke();

}

if (
!values ||
values.length < 2
)
return;

const range =
max - min || 1;

ctx.beginPath();

values.forEach(
(value, index) => {

  const x =
    index *
    (width / (values.length - 1));


  const normalized =
    (value - min) /
    range;


  const y =
    height -
    normalized * height;


  if (index === 0)
    ctx.moveTo(x, y);
  else
    ctx.lineTo(x, y);

}

);

ctx.strokeStyle =
"#0b7a70";

ctx.lineWidth = 2;

ctx.stroke();

/* Current point */

const last =
values[values.length - 1];

const lastX =
width;

const lastY =
height -
((last - min) / range) *
height;

ctx.beginPath();

ctx.arc(
lastX,
lastY,
4,
0,
Math.PI * 2
);

ctx.fillStyle =
"#0b7a70";

ctx.fill();

}

function drawDemoCharts() {

const temperatureValues = [];

const levelValues = [];

for (
let i = 0;
i < 24;
i++
) {

temperatureValues.push(
  26 +
  Math.sin(i / 3) * 3 +
  Math.random()
);


levelValues.push(
  75 +
  Math.sin(i / 4) * 5 +
  Math.random() * 3
);

}

drawChart(
"c1",
temperatureValues,
20,
40
);

drawChart(
"c2",
temperatureValues,
20,
40
);

drawChart(
"c3",
levelValues,
0,
100
);

}

/* =========================================================
MQTT PLACEHOLDER

لا يتم الاتصال بـ HiveMQ في المرحلة 1.

سنضع MQTT الحقيقي هنا في المرحلة التالية.
========================================================= */

window.HydroMQTT = {

connected: false,

connect() {

console.log(
  "MQTT will be enabled in the next phase."
);

showToast(
  "MQTT سيتم تفعيله في المرحلة التالية"
);

},

disconnect() {

console.log(
  "MQTT disconnect placeholder"
);

},

publish(device, state) {

console.log(
  "MQTT publish placeholder:",
  device,
  state
);

}

};

/* =========================================================
INITIALIZE
========================================================= */

function initHydroFarmUI() {

console.log(
"Hydro Farm UI — Phase 1"
);

loadSettings();

initNavigation();

initDeviceSwitches();

initMode();

initRanges();

initRangeButtons();

initSaveButton();

initClearAlerts();

initBell();

updateDemoData();

drawDemoCharts();

window.addEventListener(
"resize",
drawDemoCharts
);

/*
Demo refresh.

سيتم حذفه عندما نربط MQTT الحقيقي.

*/

setInterval(
updateDemoData,
5000
);

}

/* =========================================================
START
========================================================= */

if (
document.readyState ===
"loading"
) {

document.addEventListener(
"DOMContentLoaded",
initHydroFarmUI
);

} else {

initHydroFarmUI();

   }
