// ==========================================
// 1. إعدادات المتغيرات و MQTT
// ==========================================
const MQTT_CONFIG = {
  host: "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud",
  port: 8884, // منفذ WSS (Secure WebSockets)
  clientId: "HydroWebApp_" + Math.random().toString(16).substr(2, 8),
  username: "hydro01-test",
  password: "", // أضف كلمة المرور الخاصة بك هنا إذا كان الحساب يتطلب كلمة مرور
  topicTelemetry: "greenhouse/GH001/telemetry",
  topicStatus: "greenhouse/GH001/status",
  topicCmd: "greenhouse/GH001/command"
};

let client = null;
let isAuto = true;

// ==========================================
// 2. إدارة الاتصال بـ MQTT Server
// ==========================================
function connectMQTT() {
  logDebug("جاري بدء الاتصال بسيرفر HiveMQ Cloud...");

  // قراءة القيم المدخلة في صفحة الإعدادات
  const host = document.getElementById('mqtt-server')?.value.trim() || MQTT_CONFIG.host;
  const port = parseInt(document.getElementById('mqtt-port')?.value) || MQTT_CONFIG.port;
  const username = document.getElementById('mqtt-user')?.value.trim() || MQTT_CONFIG.username;
  const password = document.getElementById('mqtt-pass')?.value || "";
  const gh = document.getElementById('mqtt-gh')?.value.trim() || "GH001";

  // تحديث الموضوعات بناءً على اسم البيوت المحمية (Greenhouse)
  MQTT_CONFIG.topicTelemetry = `greenhouse/${gh}/telemetry`;
  MQTT_CONFIG.topicStatus = `greenhouse/${gh}/status`;
  MQTT_CONFIG.topicCmd = `greenhouse/${gh}/command`;

  // قطع أي اتصال سابق إن وجد
  if (client && client.isConnected()) {
    client.disconnect();
  }

  // إنشاء عميل جديد
  const clientId = "HydroWebApp_" + Math.random().toString(16).substr(2, 8);
  client = new Paho.MQTT.Client(host, port, clientId);

  client.onConnectionLost = onConnectionLost;
  client.onMessageArrived = onMessageArrived;

  const options = {
    useSSL: true, // مهم جداً للاتصال عبر SSL/WebSockets (8884)
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
  
  // تحديث الشارات في الواجهة
  updateConnectionBadges(true);

  // الاشتراك في موضوعات البيانات والحالة
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
// 3. استقبال البيانات وتحديث الواجهة (Telemetry)
// ==========================================
function onMessageArrived(message) {
  try {
    const payload = JSON.parse(message.payloadString);
    logDebug(`بيانات جديدة: ${message.payloadString}`);

    // تحديث بطاقات الصفحة الرئيسية والبيانات
    if (payload.air_temp !== undefined) {
      updateValue('val-air-temp', 'd-air-temp', `${payload.air_temp} <small>°C</small>`, `${payload.air_temp}°C`);
      document.getElementById('sys-air-t').innerText = `${payload.air_temp}°C`;
    }
    if (payload.air_hum !== undefined) {
      updateValue('val-air-hum', 'd-air-hum', `${payload.air_hum} <small>%</small>`, `${payload.air_hum}%`);
    }
    if (payload.water_temp !== undefined) {
      updateValue('val-water-temp', 'd-water-temp', `${payload.water_temp} <small>°C</small>`, `${payload.water_temp}°C`);
    }
    if (payload.tank_level !== undefined) {
      updateValue('val-tank', 'd-tank', `${payload.tank_level} <small>%</small>`, `${payload.tank_level}%`);
    }
    if (payload.ec !== undefined) {
      updateValue('val-ec', 'd-ec', `${payload.ec} <small>mS/cm</small>`, `${payload.ec}`);
    }
    if (payload.ph !== undefined) {
      updateValue('val-ph', 'd-ph', payload.ph, payload.ph);
    }

    // تحديث أزرار التحكم وحالة ESP32 إن وجدت بالبيانات
    if (payload.mode !== undefined) {
      setSystemModeUI(payload.mode === "AUTO");
    }
    if (payload.pump !== undefined) document.getElementById('btn-pump').checked = payload.pump === "ON";
    if (payload.fan !== undefined) document.getElementById('btn-fan').checked = payload.fan === "ON";
    if (payload.pad !== undefined) document.getElementById('btn-pad').checked = payload.pad === "ON";

  } catch (e) {
    logDebug(`رسالة نصية: ${message.payloadString}`);
  }
}

function updateValue(id1, id2, htmlVal1, textVal2) {
  const el1 = document.getElementById(id1);
  const el2 = document.getElementById(id2);
  if (el1) el1.innerHTML = htmlVal1;
  if (el2) el2.innerText = textVal2;
}

// ==========================================
// 4. إرسال أعيان التحكم (Commands)
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
// 5. إدارة الواجهة والتنقل
// ==========================================
function showTab(tabName, btnElement) {
  const tabs = document.querySelectorAll('.page-tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  document.getElementById(`page-${tabName}`).classList.add('active');
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
  
  // إرسال وضع النظام الجديد عبر MQTT
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

  document.getElementById('btn-pump').disabled = isAuto;
  document.getElementById('btn-fan').disabled = isAuto;
  document.getElementById('btn-pad').disabled = isAuto;
}

// مسجل التشخيص
function logDebug(message) {
  const consoleBox = document.getElementById('debug-console');
  if (consoleBox) {
    const time = new Date().toLocaleTimeString('ar-TN');
    consoleBox.innerHTML += `<br>[${time}] ${message}`;
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }
}

function clearLogs() {
  document.getElementById('debug-console').innerHTML = '[System] تم مسح السجل.';
}

// ==========================================
// 6. أحداث البدء والتشغيل الأولية
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  logDebug("بدء تشغيل التطبيق...");
  
  // ربط أحداث مفاتيح التحكم السريع
  document.getElementById('btn-pump').addEventListener('change', (e) => sendCommand('pump', e.target.checked));
  document.getElementById('btn-fan').addEventListener('change', (e) => sendCommand('fan', e.target.checked));
  document.getElementById('btn-pad').addEventListener('change', (e) => sendCommand('pad', e.target.checked));

  // بدء الاتصال تلقائياً بـ MQTT عند فتح التطبيق
  connectMQTT();
});
  
