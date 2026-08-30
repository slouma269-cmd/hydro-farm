const MQTT_CONFIG = {
  host: "broker.hivemq.com",
  port: 8884,
  path: "/mqtt",
  clientId: "Web_App_" + Math.random().toString(16).substr(2, 8),
  topicTelemetry: "greenhouse/GH001/telemetry",
  topicCommands: "greenhouse/GH001/commands"
};

let client;
let airTempChart, tankLevelChart;

function switchTab(tabId, btnElement) {
  document.querySelectorAll('.page-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  document.getElementById(`tab-${tabId}`).classList.add('active');
  if (btnElement) btnElement.classList.add('active');
}

function updateGauge(gaugeId, valId, value, minVal, maxVal, unit) {
  const gaugeEl = document.getElementById(gaugeId);
  const valEl = document.getElementById(valId);
  
  if (valEl) {
    valEl.innerHTML = unit ? `${value} <small>${unit}</small>` : `${value}`;
  }

  if (gaugeEl) {
    const percentage = Math.min(Math.max((value - minVal) / (maxVal - minVal), 0), 1);
    const degrees = percentage * 360;
    gaugeEl.style.background = `conic-gradient(#00d2ff ${degrees}deg, #1e293b ${degrees}deg)`;
  }
}

function initMQTT() {
  logDebug("جاري الاتصال بخادم HiveMQ MQTT...");
  client = new Paho.MQTT.Client(MQTT_CONFIG.host, Number(MQTT_CONFIG.port), MQTT_CONFIG.path, MQTT_CONFIG.clientId);

  client.onConnectionLost = onConnectionLost;
  client.onMessageArrived = onMessageArrived;

  client.connect({
    onSuccess: onConnect,
    onFailure: onFail,
    useSSL: true
  });
}

function onConnect() {
  logDebug("تم الاتصال بنجاح بخادم MQTT!");
  document.getElementById('sys-status-badge').innerText = "متصل بالشبكة";
  document.getElementById('sys-status-badge').className = "badge green";
  client.subscribe(MQTT_CONFIG.topicTelemetry);
}

function onFail(responseObject) {
  logDebug("فشل الاتصال: " + responseObject.errorMessage);
  document.getElementById('sys-status-badge').innerText = "غير متصل";
  document.getElementById('sys-status-badge').className = "badge red";
}

function onConnectionLost(responseObject) {
  if (responseObject.errorCode !== 0) {
    logDebug("انقطع الاتصال: " + responseObject.errorMessage);
  }
}

function onMessageArrived(message) {
  try {
    const payload = JSON.parse(message.payloadString);
    logDebug(`بيانات واردة: ${message.payloadString}`);

    const currentTime = new Date().toLocaleTimeString('ar-TN', { 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });

    if (payload.air_temp !== undefined) {
      updateGauge('gauge-air-temp', 'val-air-temp', payload.air_temp, 0, 50, '°C');
      const sysAir = document.getElementById('sys-air-t');
      if (sysAir) sysAir.innerText = `حرارة الهواء الحالية: ${payload.air_temp}°C`;
      addChartData(airTempChart, currentTime, payload.air_temp);
    }
    if (payload.air_hum !== undefined) updateGauge('gauge-air-hum', 'val-air-hum', payload.air_hum, 0, 100, '%');
    if (payload.water_temp !== undefined) updateGauge('gauge-water-temp', 'val-water-temp', payload.water_temp, 0, 50, '°C');
    if (payload.tank_level !== undefined) {
      updateGauge('gauge-tank', 'val-tank', payload.tank_level, 0, 100, '%');
      addChartData(tankLevelChart, currentTime, payload.tank_level);
    }
    if (payload.ph !== undefined) updateGauge('gauge-ph', 'val-ph', payload.ph, 0, 14, '');
    if (payload.ec !== undefined) updateGauge('gauge-ec', 'val-ec', payload.ec, 0, 5, 'mS/cm');

    if (payload.pump1 !== undefined) document.getElementById('btn-pump1').checked = (payload.pump1 === "ON");
    if (payload.pump2 !== undefined) document.getElementById('btn-pump2').checked = (payload.pump2 === "ON");
    if (payload.pump3 !== undefined) document.getElementById('btn-pump3').checked = (payload.pump3 === "ON");
    if (payload.pad !== undefined) document.getElementById('btn-pad').checked = (payload.pad === "ON");
    if (payload.fan1 !== undefined) document.getElementById('btn-fan1').checked = (payload.fan1 === "ON");
    if (payload.fan2 !== undefined) document.getElementById('btn-fan2').checked = (payload.fan2 === "ON");

  } catch (e) {
    logDebug(`خطأ في البيانات: ${e.message}`);
  }
}

function toggleDevice(deviceName, state) {
  if (!client || !client.isConnected()) {
    alert("التطبيق غير متصل بخادم MQTT");
    return;
  }
  const cmdObj = {};
  cmdObj[deviceName] = state ? "ON" : "OFF";
  
  const message = new Paho.MQTT.Message(JSON.stringify(cmdObj));
  message.destinationName = MQTT_CONFIG.topicCommands;
  client.send(message);
  logDebug(`تم إرسال أمر: ${JSON.stringify(cmdObj)}`);
}

function logDebug(msg) {
  const consoleBox = document.getElementById('debug-console');
  if (consoleBox) {
    consoleBox.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg}</div>`;
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }
}

function initCharts() {
  const ctxDonut = document.getElementById('devicesDonutChart').getContext('2d');
new Chart(ctxDonut, {
  type: 'doughnut',
  data: {
    labels: ['Running', 'Idle', 'Off', 'Alert'],
    datasets: [{
      data: [5, 1, 2, 1],
      backgroundColor: ['#22c55e', '#0284c7', '#94a3b8', '#ef4444']
    }]
  },
  options: {
    plugins: { legend: { position: 'right' } },
    cutout: '70%'
  }
});
  const ctxAir = document.getElementById('liveAirChart').getContext('2d');
  airTempChart = new Chart(ctxAir, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'حرارة الهواء (°C)', data: [], borderColor: '#00d2ff', fill: false }] }
  });

  const ctxTank = document.getElementById('liveTankChart').getContext('2d');
  tankLevelChart = new Chart(ctxTank, {
    type: 'line',
    data: { labels: [], datasets: [{ label: 'مستوى الخزان (%)', data: [], borderColor: '#22c55e', fill: true }] }
  });
}

function addChartData(chart, label, data) {
  if (!chart) return;
  if (chart.data.labels.length > 10) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(data);
  chart.update();
}

window.onload = function() {
  initCharts();
  initMQTT();
};

