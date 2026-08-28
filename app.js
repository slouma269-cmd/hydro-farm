/* =========================================================
   HYDRO FARM
   MQTT + UI + DEBUG
========================================================= */


/* =========================================================
   MQTT CONFIG
========================================================= */

const MQTT_CONFIG = {

    host:
        "99580666d99a4632b4a1d5087e22d494.s1.eu.hivemq.cloud",

    port:
        8884,

    username:
        "hydro01-test",

    greenhouse:
        "GH001"

};


/* =========================================================
   TOPICS
========================================================= */

const TOPICS = {

    telemetry:
        "greenhouse/GH001/telemetry",

    control:
        "greenhouse/GH001/control",

    actuatorState:
        "greenhouse/GH001/actuators",

    status:
        "greenhouse/GH001/status",

    alerts:
        "greenhouse/GH001/alerts"

};


/* =========================================================
   STATE
========================================================= */

let mqttClient = null;

let currentMode = "AUTO";


let sensorData = {

    temperature: null,
    humidity: null,
    waterTemperature: null,
    waterLevel: null,
    ec: null,
    ph: null,

    pump: 0,
    fan: 0,
    padCooling: 0

};


const history = {

    temperature: [],
    level: []

};


/* =========================================================
   DOM
========================================================= */

const $ = id =>
    document.getElementById(id);


/* =========================================================
   DEBUG SYSTEM
========================================================= */

function hydroDebug(
    message,
    type = "info"
) {

    console.log(
        "[HYDRO]",
        message
    );


    window.dispatchEvent(

        new CustomEvent(
            "hydro-debug",
            {

                detail: {

                    source:
                        "APP",

                    message:
                        String(message),

                    type:
                        type,

                    time:
                        new Date()
                            .toLocaleTimeString()

                }

            }

        )

    );

}


/* =========================================================
   SHOW DEBUG MESSAGE
========================================================= */

window.addEventListener(
    "hydro-debug",
    event => {

        const detail =
            event.detail;


        const box =
            $("debugConsole");


        if(!box)
            return;


        const line =
            document.createElement(
                "div"
            );


        line.className =
            "debug-line " +
            (detail.type || "info");


        line.textContent =
            `[${detail.time}] ${detail.source}: ${detail.message}`;


        box.prepend(
            line
        );


        while(
            box.children.length > 50
        ) {

            box.removeChild(
                box.lastElementChild
            );

        }

    }
);


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    const toast =
        $("toast");


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


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const buttons =
        document.querySelectorAll(
            "[data-page]"
        );


    const pages =
        document.querySelectorAll(
            ".page"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const page =
                        button.dataset.page;


                    pages.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    const target =
                        $(page);


                    if(target)
                        target.classList.add(
                            "active"
                        );


                    buttons.forEach(
                        item =>
                            item.classList.remove(
                                "active"
                            )
                    );


                    button.classList.add(
                        "active"
                    );


                    window.scrollTo(
                        0,
                        0
                    );

                }
            );

        }
    );

}


/* =========================================================
   MQTT STATUS
========================================================= */

function setMQTTStatus(
    connected
) {

    const dot =
        $("mqttDot");

    const state =
        $("mqttState");

    const sub =
        $("mqttSub");

    const status =
        $("mqttStatus");

    const esp =
        $("espStatus");

    const alertConnection =
        $("alertConnection");


    if(connected) {

        dot?.classList.add(
            "online"
        );


        if(state)
            state.textContent =
                "النظام متصل";


        if(sub)
            sub.textContent =
                "ESP32 • MQTT • Online";


        if(status) {

            status.textContent =
                "متصل";

            status.className =
                "green";

        }


        if(esp) {

            esp.textContent =
                "Online";

            esp.className =
                "green";

        }


        if(alertConnection)
            alertConnection.textContent =
                "اتصال MQTT ناجح";


        hydroDebug(
            "MQTT Connected",
            "success"
        );

    } else {

        dot?.classList.remove(
            "online"
        );


        if(state)
            state.textContent =
                "النظام غير متصل";


        if(sub)
            sub.textContent =
                "ESP32 • MQTT • Offline";


        if(status) {

            status.textContent =
                "غير متصل";

            status.className = "";

        }


        if(esp) {

            esp.textContent =
                "Offline";

            esp.className = "";

        }


        if(alertConnection)
            alertConnection.textContent =
                "في انتظار اتصال ESP32";


        hydroDebug(
            "MQTT Offline",
            "warning"
        );

    }

}


/* =========================================================
   MQTT CONNECT
========================================================= */

function connectMQTT() {

    if(
        typeof mqtt ===
        "undefined"
    ) {

        hydroDebug(
            "مكتبة MQTT غير موجودة",
            "error"
        );


        showToast(
            "مكتبة MQTT غير موجودة"
        );


        return;

    }


    const password =
        $("mqttPassword")?.value.trim();


    if(!password) {

        hydroDebug(
            "كلمة مرور HiveMQ غير موجودة",
            "warning"
        );


        showToast(
            "أدخل كلمة مرور HiveMQ"
        );


        return;

    }


    if(mqttClient) {

        try {

            mqttClient.end(
                true
            );

        } catch(e) {}

        mqttClient =
            null;

    }


    hydroDebug(
        "جاري الاتصال بـ HiveMQ...",
        "info"
    );


    const url =
        `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`;


    mqttClient =
        mqtt.connect(
            url,
            {

                username:
                    MQTT_CONFIG.username,

                password:
                    password,

                clientId:
                    "hydro-web-" +
                    Math.random()
                        .toString(16)
                        .substring(2),

                clean:
                    true,

                reconnectPeriod:
                    3000,

                connectTimeout:
                    10000

            }
        );


    mqttClient.on(
        "connect",
        () => {

            setMQTTStatus(
                true
            );


            subscribeMQTT();


            showToast(
                "تم الاتصال بـ HiveMQ"
            );

        }
    );


    mqttClient.on(
        "reconnect",
        () => {

            hydroDebug(
                "MQTT reconnecting...",
                "warning"
            );

            setMQTTStatus(
                false
            );

        }
    );


    mqttClient.on(
        "close",
        () => {

            setMQTTStatus(
                false
            );

        }
    );


    mqttClient.on(
        "error",
        error => {

            console.error(
                error
            );


            hydroDebug(
                "MQTT Error: " +
                error.message,
                "error"
            );


            setMQTTStatus(
                false
            );


            showToast(
                "خطأ في اتصال MQTT"
            );

        }
    );


    mqttClient.on(
        "message",
        handleMQTTMessage
    );

}


/* =========================================================
   SUBSCRIBE
========================================================= */

function subscribeMQTT() {

    if(
        !mqttClient ||
        !mqttClient.connected
    )
        return;


    const subscriptions = [

        TOPICS.telemetry,

        TOPICS.actuatorState +
        "/+/state",

        TOPICS.status,

        TOPICS.alerts

    ];


    subscriptions.forEach(
        topic => {

            mqttClient.subscribe(
                topic,
                error => {

                    if(error) {

                        hydroDebug(
                            "Subscribe error: " +
                            topic,
                            "error"
                        );

                    } else {

                        hydroDebug(
                            "Subscribed: " +
                            topic,
                            "success"
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   MQTT MESSAGE
========================================================= */

function handleMQTTMessage(
    topic,
    message
) {

    const text =
        message.toString();


    hydroDebug(
        "MQTT ← " +
        topic,
        "info"
    );


    console.log(
        "MQTT:",
        topic,
        text
    );


    let data;


    try {

        data =
            JSON.parse(
                text
            );

    } catch(error) {

        hydroDebug(
            "JSON غير صالح",
            "error"
        );


        return;

    }


    if(
        topic ===
        TOPICS.telemetry
    ) {

        updateTelemetry(
            data
        );


        return;

    }


    if(
        topic ===
        TOPICS.status
    ) {

        handleStatus(
            data
        );


        return;

    }


    if(
        topic ===
        TOPICS.alerts
    ) {

        handleAlert(
            data
        );


        return;

    }


    if(
        topic.startsWith(
            TOPICS.actuatorState
        )
    ) {

        handleActuatorState(
            topic,
            data
        );

    }

}


/* =========================================================
   TELEMETRY
========================================================= */

function updateTelemetry(
    data
) {

    sensorData.temperature =
        numberValue(
            data.temperature ??
            data.airTemperature ??
            data.temp
        );


    sensorData.humidity =
        numberValue(
            data.humidity ??
            data.airHumidity ??
            data.hum
        );


    sensorData.waterTemperature =
        numberValue(
            data.waterTemperature ??
            data.waterTemp ??
            data.wt
        );


    sensorData.waterLevel =
        convertLevel(
            data.waterLevel ??
            data.level ??
            data.water_level
        );


    sensorData.ec =
        numberValue(
            data.ec ??
            data.EC
        );


    sensorData.ph =
        numberValue(
            data.ph ??
            data.pH ??
            data.PH
        );


    if(
        data.pump !== undefined
    )
        sensorData.pump =
            normalizeState(
                data.pump
            );


    if(
        data.fan !== undefined
    )
        sensorData.fan =
            normalizeState(
                data.fan
            );


    if(
        data.padCooling !== undefined
    )
        sensorData.padCooling =
            normalizeState(
                data.padCooling
            );


    updateInterface();

    addHistory();

    checkAlerts();

}


/* =========================================================
   NUMBER
========================================================= */

function numberValue(
    value
) {

    if(
        value === null ||
        value === undefined ||
        value === ""
    )
        return null;


    const n =
        Number(value);


    return Number.isNaN(n)
        ? null
        : n;

}


/* =========================================================
   LEVEL
========================================================= */

function convertLevel(
    value
) {

    const n =
        numberValue(
            value
        );


    if(n === null)
        return null;


    if(
        n >= 0 &&
        n <= 100
    )
        return n;


    if(
        n >= 0 &&
        n <= 4095
    )
        return Math.round(
            n / 4095 * 100
        );


    return null;

}


/* =========================================================
   STATE
========================================================= */

function normalizeState(
    value
) {

    if(
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "ON" ||
        value === "on"
    )
        return 1;


    return 0;

}


/* =========================================================
   UI
========================================================= */

function updateInterface() {

    setText(
        "temp",
        formatTemperature(
            sensorData.temperature
        )
    );


    setText(
        "hum",
        formatPercent(
            sensorData.humidity
        )
    );


    setText(
        "wt",
        formatTemperature(
            sensorData.waterTemperature
        )
    );


    setText(
        "level",
        formatPercent(
            sensorData.waterLevel
        )
    );


    setText(
        "ec",
        sensorData.ec === null
            ? "--"
            : sensorData.ec.toFixed(2)
    );


    setText(
        "ph",
        sensorData.ph === null
            ? "--"
            : sensorData.ph.toFixed(2)
    );


    setText(
        "dataWt",
        formatTemperature(
            sensorData.waterTemperature
        )
    );


    setText(
        "dataEc",
        sensorData.ec === null
            ? "--"
            : sensorData.ec.toFixed(2)
    );


    setText(
        "dataPh",
        sensorData.ph === null
            ? "--"
            : sensorData.ph.toFixed(2)
    );


    setText(
        "dataHum",
        formatPercent(
            sensorData.humidity
        )
    );


    setText(
        "systemTemp",
        formatTemperature(
            sensorData.temperature
        )
    );


    setText(
        "systemTank",
        sensorData.waterLevel === null
            ? "الخزان --%"
            : `الخزان ${sensorData.waterLevel.toFixed(0)}%`
    );


    setText(
        "systemWaterTemp",
        formatTemperature(
            sensorData.waterTemperature
        )
    );


    updateStates();

}


/* =========================================================
   FORMAT
========================================================= */

function formatTemperature(
    value
) {

    return value === null
        ? "--.-°C"
        : Number(value).toFixed(1) +
          "°C";

}


function formatPercent(
    value
) {

    return value === null
        ? "--%"
        : Number(value).toFixed(0) +
          "%";

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
    id,
    value
) {

    const element =
        $(id);


    if(element)
        element.textContent =
            value;

}


/* =========================================================
   STATES
========================================================= */

function updateStates() {

    setSwitch(
        "pumpSwitch",
        sensorData.pump
    );


    setSwitch(
        "fanSwitch",
        sensorData.fan
    );


    setSwitch(
        "padSwitch",
        sensorData.padCooling
    );


    setSwitch(
        "systemPadSwitch",
        sensorData.padCooling
    );


    setText(
        "systemPump",
        sensorData.pump
            ? "المضخة ON"
            : "المضخة OFF"
    );


    setText(
        "systemFan",
        sensorData.fan
            ? "المروحة ON"
            : "المروحة OFF"
    );


    setText(
        "systemFanState",
        currentMode
    );


    setText(
        "systemPumpMode",
        currentMode
    );


    setText(
        "pumpMode",
        currentMode
    );


    setText(
        "fanMode",
        currentMode
    );


    setText(
        "padMode",
        currentMode
    );


    setText(
        "homeMode",
        currentMode
    );


    setText(
        "modeButton",
        currentMode
    );

}


/* =========================================================
   SWITCH
========================================================= */

function setSwitch(
    id,
    state
) {

    const button =
        $(id);


    if(!button)
        return;


    button.classList.toggle(
        "on",
        Boolean(state)
    );

}


/* =========================================================
CONTROL
========================================================= */

function controlDevice(
    device
) {

    if(
        !mqttClient ||
        !mqttClient.connected
    ) {

        showToast(
            "MQTT غير متصل"
        );


        return;

    }


    if(
        currentMode !==
        "MANUAL"
    ) {

        showToast(
            "غيّر الوضع إلى MANUAL أولاً"
        );


        return;

    }


    let current = 0;


    if(device === "pump")
        current =
            sensorData.pump;


    if(device === "fan")
        current =
            sensorData.fan;


    if(device === "pad_cooling")
        current =
            sensorData.padCooling;


    const newState =
        current ? 0 : 1;


    const topic =
        `${TOPICS.control}/${device}/set`;


    const payload =
        JSON.stringify({

            state:
                newState,

            mode:
                "MANUAL"

        });


    hydroDebug(
        `إرسال ${device}: ${newState ? "ON" : "OFF"}`,
        "info"
    );


    mqttClient.publish(
        topic,
        payload,
        {
            qos: 1
        },
        error => {

            if(error) {

                hydroDebug(
                    "فشل إرسال الأمر",
                    "error"
                );


                showToast(
                    "فشل إرسال الأمر"
                );


                return;

            }


            if(device === "pump")
                sensorData.pump =
                    newState;


            if(device === "fan")
                sensorData.fan =
                    newState;


            if(device === "pad_cooling")
                sensorData.padCooling =
                    newState;


            updateInterface();


            showToast(
                `${device} → ${newState ? "ON" : "OFF"}`
            );

        }
    );

}


/* =========================================================
   CONTROLS
========================================================= */

function setupControls() {

    document
        .querySelectorAll(
            "[data-device]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        controlDevice(
                            button.dataset.device
                        );

                    }
                );

            }
        );

}


/* =========================================================
   MODE
========================================================= */

function toggleMode() {

    currentMode =
        currentMode ===
        "AUTO"
            ? "MANUAL"
            : "AUTO";


    updateStates();


    if(
        mqttClient &&
        mqttClient.connected
    ) {

        mqttClient.publish(

            `${TOPICS.control}/mode/set`,

            JSON.stringify({

                mode:
                    currentMode

            }),

            {
                qos: 1
            }

        );

    }


    hydroDebug(
        "Mode → " +
        currentMode,
        "info"
    );


    showToast(
        `الوضع: ${currentMode}`
    );

}


/* =========================================================
   STATUS
========================================================= */

function handleStatus(
    data
) {

    if(data.mode) {

        currentMode =
            String(
                data.mode
            ).toUpperCase();


        if(
            currentMode !==
            "MANUAL"
        )
            currentMode =
                "AUTO";


        updateStates();

    }

}


/* =========================================================
   ACTUATOR STATE
========================================================= */

function handleActuatorState(
    topic,
    data
) {

    const parts =
        topic.split("/");


    const device =
        parts[
            parts.length - 2
        ];


    const state =
        normalizeState(
            data.state ??
            data.value ??
            data.status
        );


    if(device === "pump")
        sensorData.pump =
            state;


    if(device === "fan")
        sensorData.fan =
            state;


    if(
        device ===
        "pad_cooling"
    )
        sensorData.padCooling =
            state;


    updateInterface();

}


/* =========================================================
   ALERT
========================================================= */

function handleAlert(
    data
) {

    const title =
        data.title ||
        "تنبيه النظام";


    const body =
        data.body ||
        data.message ||
        "يوجد تنبيه";


    const severity =
        String(
            data.severity ||
            "INFO"
        ).toUpperCase();


    addHydroAlert(
        title,
        body,
        severity
    );


    showToast(
        title
    );

}


/* =========================================================
   ALERT UI
========================================================= */

function addHydroAlert(
    title,
    body,
    severity = "INFO"
) {

    const list =
        $("alertsList");


    if(!list)
        return;


    const article =
        document.createElement(
            "article"
        );


    let icon = "🟢";

    let className =
        "good";


    if(
        severity ===
        "WARNING"
    ) {

        icon = "🟡";

        className =
            "warning";

    }


    if(
        severity === "HIGH" ||
        severity === "CRITICAL"
    ) {

        icon = "🔴";

        className =
            "danger";

    }


    article.className =
        `alert ${className}`;


    article.innerHTML = `

        <span>${escapeHTML(icon)}</span>

        <div>

            <strong>
                ${escapeHTML(title)}
            </strong>

            <small>
                ${escapeHTML(body)}
            </small>

        </div>

    `;


    list.prepend(
        article
    );


    while(
        list.children.length >
        20
    ) {

        list.removeChild(
            list.lastElementChild
        );

    }

}


/* =========================================================
   ESCAPE
========================================================= */

function escapeHTML(
    value
) {

    return String(value)
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );

}


/* =========================================================
   ALERTS
========================================================= */

function checkAlerts() {

    const warning =
        Number(
            localStorage.getItem(
                "hydro_warning_temp"
            ) || 30
        );


    const critical =
        Number(
            localStorage.getItem(
                "hydro_critical_temp"
            ) || 33
        );


    const low =
        Number(
            localStorage.getItem(
                "hydro_low_level"
            ) || 20
        );


    if(
        sensorData.temperature !== null
    ) {

        if(
            sensorData.temperature >=
            critical
        ) {

            addHydroAlert(
                "حرارة حرجة",
                `حرارة الهواء ${sensorData.temperature.toFixed(1)}°C`,
                "CRITICAL"
            );

        } else if(
            sensorData.temperature >=
            warning
        ) {

            addHydroAlert(
                "تحذير الحرارة",
                `حرارة الهواء ${sensorData.temperature.toFixed(1)}°C`,
                "WARNING"
            );

        }

    }


    if(
        sensorData.waterLevel !== null &&
        sensorData.waterLevel <= low
    ) {

        addHydroAlert(
            "مستوى الخزان منخفض",
            `المستوى ${sensorData.waterLevel.toFixed(0)}%`,
            "WARNING"
        );

    }

}


/* =========================================================
   HISTORY
========================================================= */

function addHistory() {

    if(
        sensorData.temperature !== null
    )
        history.temperature.push(
            sensorData.temperature
        );


    if(
        sensorData.waterLevel !== null
    )
        history.level.push(
            sensorData.waterLevel
        );


    if(
        history.temperature.length >
        30
    )
        history.temperature.shift();


    if(
        history.level.length >
        30
    )
        history.level.shift();


    drawCharts();

}


/* =========================================================
   CHARTS
========================================================= */

function drawCharts() {

    drawChart(
        "temperatureChart",
        history.temperature,
        15,
        45
    );


    drawChart(
        "levelChart",
        history.level,
        0,
        100
    );

}


function drawChart(
    canvasId,
    values,
    min,
    max
) {

    const canvas =
        $(canvasId);


    if(!canvas)
        return;


    const rect =
        canvas.getBoundingClientRect();


    if(
        rect.width <= 0
    )
        return;


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        rect.width *
        dpr;


    canvas.height =
        150 *
        dpr;


    const ctx =
        canvas.getContext(
            "2d"
        );


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
        150;


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    ctx.strokeStyle =
        "#e8efed";


    ctx.lineWidth =
        1;


    for(
        let i = 0;
        i < 5;
        i++
    ) {

        const y =
            10 +
            i *
            ((height - 20) / 4);


        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            width,
            y
        );

        ctx.stroke();

    }


    if(
        values.length < 2
    )
        return;


    ctx.strokeStyle =
        "#0b7a70";


    ctx.lineWidth =
        2.5;


    ctx.beginPath();


    values.forEach(
        (value,index) => {

            const x =
                index *
                width /
                (values.length - 1);


            const normalized =
                (value - min) /
                (max - min);


            const y =
                height -
                15 -
                normalized *
                (height - 30);


            if(index === 0)
                ctx.moveTo(
                    x,
                    y
                );
            else
                ctx.lineTo(
                    x,
                    y
                );

        }
    );


    ctx.stroke();

}


/* =========================================================
   CLEAR ALERTS
========================================================= */

function clearAlerts() {

    const list =
        $("alertsList");


    if(!list)
        return;


    list.innerHTML = `

        <article class="alert good">

            <span>🟢</span>

            <div>

                <strong>
                    لا توجد تنبيهات
                </strong>

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


/* =========================================================
   FCM DEBUG TEST
========================================================= */

async function testFirebase() {

    hydroDebug(
        "بدء اختبار Firebase/FCM",
        "info"
    );


    if(
        !window.HydroFirebase
    ) {

        hydroDebug(
            "HydroFirebase غير موجود",
            "error"
        );


        return;

    }


    hydroDebug(
        "Firebase موجود",
        "success"
    );


    if(
        !("Notification" in window)
    ) {

        hydroDebug(
            "Notifications غير مدعومة",
            "error"
        );


        return;

    }


    hydroDebug(
        "Notification permission = " +
        Notification.permission,
        Notification.permission ===
        "granted"
            ? "success"
            : "warning"
    );


    if(
        Notification.permission !==
        "granted"
    ) {

        try {

            const permission =
                await Notification.requestPermission();


            hydroDebug(
                "نتيجة طلب الإذن: " +
                permission,

                permission ===
                "granted"
                    ? "success"
                    : "warning"
            );

        } catch(error) {

            hydroDebug(
                "خطأ في طلب الإذن: " +
                error.message,
                "error"
            );

            return;

        }

    }


    if(
        Notification.permission !==
        "granted"
    )
        return;


    const token =
        await window.HydroFirebase
            .getFCMToken();


    if(token) {

        hydroDebug(
            "FCM Token موجود",
            "success"
        );


        const tokenBox =
            $("debugFCMToken");


        if(tokenBox)
            tokenBox.textContent =
                token;

    }

}


/* =========================================================
   SERVICE WORKER TEST
========================================================= */

async function testServiceWorker() {

    if(
        !("serviceWorker" in navigator)
    ) {

        hydroDebug(
            "Service Worker غير مدعوم",
            "error"
        );


        return;

    }


    try {

        const registrations =
            await navigator
                .serviceWorker
                .getRegistrations();


        hydroDebug(
            `Service Worker registrations: ${registrations.length}`,
            registrations.length
                ? "success"
                : "warning"
        );


        await navigator
            .serviceWorker
            .ready;


        hydroDebug(
            "Service Worker جاهز",
            "success"
        );


    } catch(error) {

        hydroDebug(
            "Service Worker Error: " +
            error.message,
            "error"
        );

    }

}


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        setupNavigation();

        setupControls();


        $("mqttConnect")
            ?.addEventListener(
                "click",
                connectMQTT
            );


        $("modeButton")
            ?.addEventListener(
                "click",
                toggleMode
            );


        $("clearAlerts")
            ?.addEventListener(
                "click",
                clearAlerts
            );


        $("firebaseTest")
            ?.addEventListener(
                "click",
                testFirebase
            );


        $("swTest")
            ?.addEventListener(
                "click",
                testServiceWorker
            );


        $("debugClear")
            ?.addEventListener(
                "click",
                () => {

                    const box =
                        $("debugConsole");

                    if(box)
                        box.innerHTML = "";

                }
            );


        setMQTTStatus(
            false
        );


        updateInterface();

        drawCharts();


        hydroDebug(
            "Hydro Farm بدأ التشغيل",
            "success"
        );


        testServiceWorker();

    }
);


window.addEventListener(
    "resize",
    drawCharts
);
