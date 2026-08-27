/* =========================================================
HYDRO FARM
المرحلة 1 — واجهة المستخدم فقط

لا يوجد MQTT أو Firebase هنا.
سيتم ربطهما في المراحل القادمة.
========================================================= */

"use strict";

/* =========================================================
GLOBAL STATE
========================================================= */

const HydroUI = {

page: "home",

mode: "AUTO",

devices: {
pump: true,
fan: true,
pad_cooling: false
},

settings: {
fanWarning: 30,
fanCritical: 33,
padTemperature: 32,
levelWarning: 20,
levelCritical: 10
},

sensorData: {
temperature: null,
humidity: null,
waterTemperature: null,
waterLevel: null,
ec: null,
ph: null
}

};

/* =========================================================
DOM HELPER
========================================================= */

function $(id) {
return document.getElementById(id);
}

/* =========================================================
TOAST
========================================================= */

let toastTimer = null;

function showToast(message) {

const toast = $("toast");

if (!toast)
return;

toast.textContent = message;

toast.classList.add("show");

clearTimeout(toastTimer);

toastTimer = setTimeout(() => {

toast.classList.remove("show");

}, 2200);

}

/* =========================================================
PAGE NAVIGATION
========================================================= */

function initNavigation() {

const buttons =
document.querySelectorAll(
"nav button[data-page]"
);

const pages =
document.querySelectorAll(
".page"
);

buttons.forEach(button => {

button.addEventListener(
  "click",
  () => {

    const pageName =
      button.dataset.page;

    if (!pageName)
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
