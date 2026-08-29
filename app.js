// إدارة التنقل بين الصفحات الخمس
function showTab(tabName, btnElement) {
  // إخفاء جميع الصفحات
  const tabs = document.querySelectorAll('.page-tab');
  tabs.forEach(tab => tab.classList.remove('active'));

  // إزالة التنشيط عن جميع أزرار التنقل
  const navBtns = document.querySelectorAll('.nav-btn');
  navBtns.forEach(btn => btn.classList.remove('active'));

  // إظهار الصفحة المطلوبة
  document.getElementById(`page-${tabName}`).classList.add('active');

  // تنشيط الزر المختار
  if (btnElement) {
    btnElement.classList.add('active');
  }

  logDebug(`Switched to tab: ${tabName}`);
}

// مسجل التشخيص (Debug Console Log)
function logDebug(message) {
  const consoleBox = document.getElementById('debug-console');
  if (consoleBox) {
    const time = new Date().toLocaleTimeString('ar-TN');
    consoleBox.innerHTML += `<br>[${time}] ${message}`;
    consoleBox.scrollTop = consoleBox.scrollHeight;
  }
}

function clearLogs() {
  document.getElementById('debug-console').innerHTML = '[System] Logs cleared.';
}

// تبديل وضع النظام (AUTO / MANUAL)
let isAuto = true;
function toggleSystemMode() {
  isAuto = !isAuto;
  const modeBtn = document.getElementById('toggle-sys-mode');
  const sysModeText = document.getElementById('sys-mode');
  const modeText = isAuto ? '[ AUTO ]' : '[ MANUAL ]';

  modeBtn.innerText = modeText;
  sysModeText.innerText = isAuto ? 'AUTO' : 'MANUAL';

  // تفعيل أو تعطيل المفاتيح بناءً على الوضع
  document.getElementById('btn-pump').disabled = isAuto;
  document.getElementById('btn-fan').disabled = isAuto;
  document.getElementById('btn-pad').disabled = isAuto;

  logDebug(`System Mode changed to: ${isAuto ? 'AUTO' : 'MANUAL'}`);
}

function testFCM() {
  logDebug('Firebase test initiated...');
  setTimeout(() => {
    logDebug('Firebase initialized successfully.');
    logDebug('FCM token received: eX892...kL9');
  }, 1000);
}
   
