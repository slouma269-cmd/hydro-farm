// ==========================================
// 1. الإعدادات والمتغيرات العامة
// ==========================================
const MQTT_CONFIG = {
  host: "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud",
  port: 8884,
  clientId: "HydroWebApp_" + Math.random().toString(16).substr(2, 8),
  username: "hydro01-test",
  password: "",
  topicTelemetry: "greenhouse/GH001/telemetry",
  topicStatus: "greenhouse/GH001/status",
  topicCmd: "greenhouse/GH001/command"
};

let client = null;
let isAuto = true;

// متغيرات الرسوم البيانية
let airTempChart = null;
let tankLevelChart = null;
const maxDataPoints = 15;

// ==========================================
// 2. إدارة الاتصال والتخزين المحلي (localStorage)
// ==========================================

// حفظ البيانات في ذاكرة الهاتف/المتصفح
function saveSettingsToLocalStorage(host, port, username, password, gh) {
  try {
    localStorage.setItem('mqtt_host', host);
    localStorage.setItem('mqtt_port', port);
    localStorage.setItem('mqtt_user', username);
    localStorage.setItem('mqtt_pass', password);
    localStorage.setItem('mqtt_gh', gh);
    logDebug("💾 تم حفظ بيانات الاتصال كلمة المرور في الذاكرة المحلية بنجاح.");
  } catch (e) {
    console.error("فشل حفظ البيانات في localStorage", e);
  }
}

// استرجاع البيانات المحفوظة عند فتح التطبيق
function loadSettingsFromLocalStorage() {
  const savedHost = localStorage.getItem('mqtt_host');
  const savedPort = localStorage.getItem('mqtt_port');
  const savedUser = localStorage.getItem('mqtt_user');
  const savedPass = localStorage.getItem('mqtt_pass');
  const savedGh = localStorage.getItem('mqtt_gh');

  if (savedHost) {
    const el = document.getElementById('mqtt-server');
    if (el) el.value = savedHost;
  }
  if (savedPort) {
    const el = document.getElementById('mqtt-port');
    if (el) el.value = savedPort;
  }
  if (savedUser) {
    const el = document.getElementById('mqtt-user');
    if (el) el.value = savedUser;
  }
  if (savedPass) {
    const el = document.getElementById('mqtt-pass');
    if (el) el.value = savedPass;
  }
  if (savedGh) {
    const el = document.getElementById('mqtt-gh');
    if (el) el.value = savedGh;
  }

  // إرجاع القيم المسترجعة أو الافتراضية
  return {
    host: savedHost || MQTT_CONFIG.host,
    port: parseInt(savedPort) || MQTT_CONFIG.port,
    username: savedUser || MQTT_CONFIG.username,
    password: savedPass || MQTT_CONFIG.password,
    gh: savedGh || "GH001"
  };
}

function connectMQTT() {
  logDebug("جاري بدء الاتصال بسيرفر HiveMQ Cloud...");

  // جلب القيم المسترجعة أو إدخال المستخدم الحالي
  const settings = loadSettingsFromLocalStorage();

  const host = document.getElementById('mqtt-server')?.value.trim() || settings.host;
  const port = parseInt(document.getElementById('mqtt-port')?.value) || settings.port;
  const username = document.getElementById('mqtt-user')?.value.trim() || settings.username;
  const password = document.getElementById('mqtt-pass')?.value || settings.password;
  const gh = document.getElementById('mqtt-gh')?.value.trim() || settings.gh;

  // حفظ التغييرات الحالية دائماً لاستخدامها المرة القادمة تلقائياً
  saveSettingsToLocalStorage(host, port, username, password, gh);

  MQTT_CONFIG.topicTelemetry = `greenhouse/${gh}/telemetry`;
  MQTT_CONFIG.topicStatus = `greenhouse/${gh}/status`;
  MQTT_CONFIG.topicCmd = `greenhouse/${gh}/command`;

  if (client && client.isConnected()) {
    try {
      client.disconnect();
    } catch (e) {
      console.log(e);
    }
  }

  const clientId = "HydroWebApp_" + Math.random().toString(16).substr(2, 8);
  client = new Paho.MQTT.Client(host, port, clientId);

  client.onConnectionLost = onConnectionLost;
  client.onMessageArrived = onMessageArrived;

  const options = {
    useSSL: true,
    userName: username,
    password: password,
    onSuccess: onConnectSuccess,
    onFailure: onConnectFailure,
    keepAliveInterval: 30
  };

  try {
    client.connect(options);
  } catch (err) {
    logDebug(`🔴 خطأ أثناء الاتصال: ${err.message}`);
  }
}

function onConnectSuccess() {
  logDebug("🟢 تم الاتصال بنجاح بـ HiveMQ Cloud!");
  updateConnectionBadges(true);

  client.subscribe(MQTT_CONFIG.topicTelemetry);
  client.subscribe(MQTT_CONFIG.topicStatus);
  logDebug(`تم الاشتراك في الموضوع: ${MQTT_CONFIG.topicTelemetry}`);
}

function onConnectFailure(response) {
  logDebug(`🔴 فشل الاتصال: ${response.errorMessage}`);
  updateConnectionBadges(false);
}

function onConnectionLost(response) {
  if (response.errorCode !== 0) {
    logDebug(`🔴 انقطع الاتصال: ${response.errorMessage}`);
    updateConnectionBadges(false);
  }
}

// ==========================================
// ==========================================
// 3. استقبال البيانات وتحديث الواجهة والرسوم البيانية
// ==========================================
function onMessageArrived(message) {
  try {
    const payload = JSON.parse(message.payloadString);
    logDebug(`بيانات جديدة: ${message.payloadString}`);

    const currentTime = new Date().toLocaleTimeString('ar-TN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });

    // 1. استدعاءات العدادات الدائرية (Gauges)
    if (payload.air_temp !== undefined) {
      updateGauge('gauge-air-temp', 'val-air-temp', payload.air_temp, 0, 50, '°C');
      const sysAir = document.getElementById('sys-air-t');
      if (sysAir) sysAir.innerText = `${payload.air_temp}°C`;
      addChartData(airTempChart, currentTime, payload.air_temp);
    }

    if (payload.air_hum !== undefined) {
      updateGauge('gauge-air-hum', 'val-air-hum', payload.air_hum, 0, 100, '%');
    }

    // 2. تحديث باقي البيانات العادية
    if (payload.water_temp !== undefined) {
      updateValue('val-water-temp', 'd-water-temp', `${payload.water_temp} <small>°C</small>`, `${payload.water_temp}°C`);
    }
    if (payload.tank_level !== undefined) {
      updateValue('val-tank', 'd-tank', `${payload.tank_level} <small>%</small>`, `${payload.tank_level}%`);
      addChartData(tankLevelChart, currentTime, payload.tank_level);
    }
    if (payload.ec !== undefined) {
      updateValue('val-ec', 'd-ec', `${payload.ec} <small>mS/cm</small>`, `${payload.ec}`);
    }
    if (payload.ph !== undefined) {
      updateValue('val-ph', 'd-ph', payload.ph, payload.ph);
    }

    // 3. تحديث حالات المشغلات والأوضاع
    if (payload.mode !== undefined) {
      setSystemModeUI(payload.mode === "AUTO");
    }
    if (payload.pump !== undefined) {
      const btnPump = document.getElementById('btn-pump');
      if (btnPump) btnPump.checked = payload.pump === "ON";
    }
    if (payload.fan !== undefined) {
      const btnFan = document.getElementById('btn-fan');
      if (btnFan) btnFan.checked = payload.fan === "ON";
    }
    if (payload.pad !== undefined) {
      const btnPad = document.getElementById('btn-pad');
      if (btnPad) btnPad.checked = payload.pad === "ON";
    }

  } catch (e) {
    logDebug(`رسالة نصية: ${message.payloadString}`);
  }
}


function updateGauge(gaugeId, valId, value, minVal, maxVal, unit) {
  const gaugeEl = document.getElementById(gaugeId);
  const valEl = document.getElementById(valId);
  
  if (valEl) {
    valEl.innerHTML = `${value} <small>${unit}</small>`;
  }

  if (gaugeEl) {
    // حساب النسبة المئوية للحرارة أو الرطوبة وتجميع زاوية الدرجة
    const percentage = Math.min(Math.max((value - minVal) / (maxVal - minVal), 0), 1);
    const degrees = percentage * 360;
    
    // تحديث التعبئة الدائرية بحركة انسيابية
    gaugeEl.style.background = `conic-gradient(#00d2ff ${degrees}deg, #1e293b ${degrees}deg)`;
  }
}

// ==========================================
// 4. تهيئة وتحديث الرسوم البيانية (Charts)
// ==========================================
function initCharts() {
  if (typeof Chart === 'undefined') {
    logDebug("⚠️ مكتبة Chart.js غير محمّلة في index.html");
    return;
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { color: 'rgba(29, 51, 104, 0.4)' }, ticks: { color: '#8ca0c8', font: { size: 9 } } },
      y: { grid: { color: 'rgba(29, 51, 104, 0.4)' }, ticks: { color: '#8ca0c8', font: { size: 9 } } }
    },
    plugins: { legend: { display: false } }
  };

  const ctxTemp = document.getElementById('airTempChart')?.getContext('2d');
  if (ctxTemp) {
    airTempChart = new Chart(ctxTemp, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'حرارة الهواء',
          data: [],
          borderColor: '#00d2ff',
          backgroundColor: 'rgba(0, 210, 255, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: chartOptions
    });
  }

  const ctxTank = document.getElementById('tankLevelChart')?.getContext('2d');
  if (ctxTank) {
    tankLevelChart = new Chart(ctxTank, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'مستوى الخزان',
          data: [],
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: chartOptions
    });
  }
}

function addChartData(chart, label, data) {
  if (!chart) return;
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(data);

  if (chart.data.labels.length > maxDataPoints) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update();
}

// ==========================================
// 5. إرسال الأوامر والتحكم (Commands)
// ==========================================
function sendCommand(device, state) {
  if (isAuto) {
    alert("النظام حالياً في وضع AUTO! قُم بالتحويل إلى MANUAL للتحكم اليدوي.");
    return;
  }
  if (!client || !client.isConnected()) {
    alert("MQTT غير متصل!");
    return;
  }

  const payload = JSON.stringify({
    device: device,
    action: state ? "ON" : "OFF",
    timestamp: Date.now()
  });

  const message = new Paho.MQTT.Message(payload);
  message.destinationName = MQTT_CONFIG.topicCmd;
  client.send(message);

  logDebug(`إرسال أمر [${device}]: ${state ? "ON" : "OFF"}`);
}

// ==========================================
// 6. إدارة عناصر الواجهة وتغيير الصفحات
// ==========================================
function showTab(tabName, btnElement) {
  const tabs = document.querySelectorAll('.page-tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(`page-${tabName}`);
  if (targetTab) targetTab.classList.add('active');
  if (btnElement) btnElement.classList.add('active');

  logDebug(`الانتقال إلى تبويب: ${tabName}`);
}

function updateConnectionBadges(isConnected) {
  const sysStatus = document.getElementById('sys-status');
  const mqttStatus = document.getElementById('mqtt-status');
  const espStatus = document.getElementById('esp-status');

  if (isConnected) {
    if (sysStatus) { sysStatus.className = "badge green"; sysStatus.innerText = "🟢 متصل"; }
    if (mqttStatus) { mqttStatus.innerText = "Online"; mqttStatus.style.color = "#22c55e"; }
    if (espStatus) { espStatus.innerText = "Online"; espStatus.style.color = "#22c55e"; }
  } else {
    if (sysStatus) { sysStatus.className = "badge red"; sysStatus.innerText = "🔴 غير متصل"; }
    if (mqttStatus) { mqttStatus.innerText = "Offline"; mqttStatus.style.color = "#ef4444"; }
    if (espStatus) { espStatus.innerText = "Offline"; espStatus.style.color = "#ef4444"; }
  }
}

function toggleSystemMode() {
  setSystemModeUI(!isAuto);
  
  if (client && client.isConnected()) {
    const payload = JSON.stringify({ mode: isAuto ? "AUTO" : "MANUAL" });
    const message = new Paho.MQTT.Message(payload);
    message.destinationName = MQTT_CONFIG.topicCmd;
    client.send(message);
    logDebug(`تم تغيير وضع النظام إلى: ${isAuto ? "AUTO" : "MANUAL"}`);
  }
}

function setSystemModeUI(autoMode) {
  isAuto = autoMode;
  const modeBtn = document.getElementById('toggle-sys-mode');
  const sysModeText = document.getElementById('sys-mode');
  const modeText = isAuto ? '[ AUTO ]' : '[ MANUAL ]';

  if (modeBtn) modeBtn.innerText = modeText;
  if (sysModeText) sysModeText.innerText = isAuto ? 'AUTO' : 'MANUAL';

  const btnPump = document.getElementById('btn-pump');
  const btnFan = document.getElementById('btn-fan');
  const btnPad = document.getElementById('btn-pad');

  if (btnPump) btnPump.disabled = isAuto;
  if (btnFan) btnFan.disabled = isAuto;
  if (btnPad) btnPad.disabled = isAuto;
}

// ==========================================
// 7. تشخيص النظام والاختبارات
// ==========================================
function logDebug(message) {
  const consoleBox = document.getElementById('debug-console');
  if (consoleBox) {
    const time = new Date().toLocaleTimeString('ar-TN');
    consoleBox.innerHTML += `<br>[${time}] ${message}`;
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }
}

function clearLogs() {
  const consoleBox = document.getElementById('debug-console');
  if (consoleBox) consoleBox.innerHTML = '[System] تم مسح السجل.';
}

// ==========================================
// 8. أحداث البدء عند تحميل الصفحة
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  logDebug("بدء تشغيل التطبيق...");

  // تحميل الإعدادات المحفوظة ساباقاً في ذاكرة الجهاز
  loadSettingsFromLocalStorage();

  // تهيئة الرسوم البيانية
  initCharts();

  // ربط أزرار التحكم اليدوي
  document.getElementById('btn-pump')?.addEventListener('change', (e) => sendCommand('pump', e.target.checked));
  document.getElementById('btn-fan')?.addEventListener('change', (e) => sendCommand('fan', e.target.checked));
  document.getElementById('btn-pad')?.addEventListener('change', (e) => sendCommand('pad', e.target.checked));

  // بدء الاتصال تلقائياً باستخدام البيانات المحفوظة
  connectMQTT();
});
        
