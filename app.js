/* =========================================================
   HYDRO FARM
   APP.JS - PHASE 2 STABLE
   HiveMQ Cloud + GH001
   MQTT Telemetry + Control
   AUTO / MANUAL
   Navigation + Alerts + Charts
========================================================= */


/* =========================================================
   MQTT CONFIGURATION
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
   MQTT TOPICS
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
   APPLICATION STATE
========================================================= */

let mqttClient = null;

let currentMode = "AUTO";

let lastTelemetryTime = 0;

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


/* =========================================================
   HISTORY
========================================================= */

const history = {

    temperature: [],

    level: [],

    timestamps: []

};

const MAX_HISTORY = 60;


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {

    return document.getElementById(id);

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(id, value) {

    const element = $(id);

    if (element) {

        element.textContent = value;

    }

}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    const toast = $("toast");

    if (!toast) {

        console.log("TOAST:", message);

        return;

    }

    toast.textContent = message;

    toast.classList.add("show");

    clearTimeout(
        showToast.timer
    );

    showToast.timer = setTimeout(
        () => {

            toast.classList.remove("show");

        },
        2500
    );

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation() {

    const pages =
        document.querySelectorAll(".page");

    /*
       ندعم أكثر من شكل للـ navigation
    */

    let buttons =
        document.querySelectorAll(
            "nav button[data-page]"
        );

    /*
       إذا كانت النسخة تستعمل nav-button
    */

    if (!buttons.length) {

        buttons =
            document.querySelectorAll(
                ".nav-button"
            );

    }


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const pageName =
                    button.dataset.page;

                if (!pageName)
                    return;


                pages.forEach(page => {

                    page.classList.remove(
                        "active"
                    );

                });


                const target =
                    $(pageName);

                if (target) {

                    target.classList.add(
                        "active"
                    );

                }


                buttons.forEach(item => {

                    item.classList.remove(
                        "active"
                    );

                });


                button.classList.add(
                    "active"
                );


                window.scrollTo(
                    {
                        top: 0,
                        behavior: "smooth"
                    }
                );

            }
        );

    });

}


/* =========================================================
   FIND MQTT PASSWORD FIELD
========================================================= */

function getMQTTPassword() {

    const fields = [

        "mqttPassword",

        "mqttPass",

        "password",

        "mqtt_password"

    ];


    for (const id of fields) {

        const element = $(id);

        if (element && element.value) {

            return element.value.trim();

        }

    }


    return "";

}


/* =========================================================
   MQTT STATUS
========================================================= */

function setMQTTStatus(connected) {

    const dot =
        $("mqttDot");

    const headerDot =
        $("headerDot");

    const state =
        $("mqttState");

    const sub =
        $("mqttSub");

    const status =
        $("mqttStatus");

    const esp =
        $("espStatus");

    const headerStatus =
        $("headerStatus");

    const alertConnection =
        $("alertConnection");


    if (connected) {

        dot?.classList.add(
            "online"
        );


        headerDot?.classList.remove(
            "offline"
        );

        headerDot?.classList.add(
            "online"
        );


        setText(
            "mqttState",
            "النظام متصل"
        );


        setText(
            "mqttSub",
            "ESP32 • MQTT • Online"
        );


        if (status) {

            status.textContent =
                "متصل";

            status.className =
                "green";

        }


        if (esp) {

            esp.textContent =
                "Online";

            esp.className =
                "green";

        }


        setText(
            "headerStatus",
            "Online"
        );


        setText(
            "alertConnection",
            "اتصال MQTT ناجح"
        );

    }

    else {

        dot?.classList.remove(
            "online"
        );


        headerDot?.classList.remove(
            "online"
        );


        headerDot?.classList.add(
            "offline"
        );


        setText(
            "mqttState",
            "النظام غير متصل"
        );


        setText(
            "mqttSub",
            "ESP32 • MQTT • Offline"
        );


        if (status) {

            status.textContent =
                "غير متصل";

            status.className =
                "";

        }


        if (esp) {

            esp.textContent =
                "Offline";

            esp.className =
                "";

        }


        setText(
            "headerStatus",
            "Offline"
        );


        setText(
            "alertConnection",
            "في انتظار اتصال ESP32"
        );

    }

}


/* =========================================================
   CONNECT MQTT
========================================================= */

function connectMQTT() {

    if (
        typeof mqtt ===
        "undefined"
    ) {

        showToast(
            "مكتبة MQTT غير موجودة"
        );

        console.error(
            "MQTT.js library is not loaded."
        );

        return;

    }


    const password =
        getMQTTPassword();


    if (!password) {

        showToast(
            "أدخل كلمة مرور HiveMQ"
        );

        return;

    }


    /*
       إغلاق الاتصال السابق
    */

    if (mqttClient) {

        try {

            mqttClient.end(true);

        }
        catch (error) {

            console.warn(error);

        }

        mqttClient = null;

    }


    showToast(
        "جاري الاتصال بـ HiveMQ..."
    );


    const url =
        `wss://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}/mqtt`;


    const clientId =
        "hydro-web-" +
        Math.random()
            .toString(16)
            .substring(2);


    mqttClient =
        mqtt.connect(
            url,
            {

                username:
                    MQTT_CONFIG.username,

                password:
                    password,

                clientId:
                    clientId,

                clean:
                    true,

                reconnectPeriod:
                    3000,

                connectTimeout:
                    10000,

                keepalive:
                    30

            }
        );


    /* =====================================================
       CONNECT
    ===================================================== */

    mqttClient.on(
        "connect",
        () => {

            console.log(
                "MQTT CONNECTED"
            );


            setMQTTStatus(
                true
            );


            subscribeMQTT();


            showToast(
                "تم الاتصال بـ HiveMQ"
            );

        }
    );


    /* =====================================================
       RECONNECT
    ===================================================== */

    mqttClient.on(
        "reconnect",
        () => {

            console.log(
                "MQTT reconnecting..."
            );

            setMQTTStatus(
                false
            );

        }
    );


    /* =====================================================
       CLOSE
    ===================================================== */

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


    /* =====================================================
       ERROR
    ===================================================== */

    mqttClient.on(
        "error",
        error => {

            console.error(
                "MQTT ERROR:",
                error
            );

            setMQTTStatus(
                false
            );

            showToast(
                "خطأ في اتصال MQTT"
            );

        }
    );


    /* =====================================================
       MESSAGE
    ===================================================== */

    mqttClient.on(
        "message",
        handleMQTTMessage
    );

}


/* =========================================================
   SUBSCRIBE MQTT
========================================================= */

function subscribeMQTT() {

    if (
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
                {
                    qos: 1
                },
                error => {

                    if (error) {

                        console.error(
                            "Subscribe error:",
                            topic,
                            error
                        );

                    }

                    else {

                        console.log(
                            "Subscribed:",
                            topic
                        );

                    }

                }
            );

        }
    );

}


/* =========================================================
   MQTT MESSAGE HANDLER
========================================================= */

function handleMQTTMessage(
    topic,
    message
) {

    const text =
        message.toString();


    console.log(
        "MQTT MESSAGE:",
        topic,
        text
    );


    let data;


    try {

        data =
            JSON.parse(text);

    }
    catch (error) {

        console.warn(
            "Invalid JSON:",
            text
        );

        return;

    }


    /* TELEMETRY */

    if (
        topic ===
        TOPICS.telemetry
    ) {

        updateTelemetry(
            data
        );

        return;

    }


    /* STATUS */

    if (
        topic ===
        TOPICS.status
    ) {

        handleStatus(
            data
        );

        return;

    }


    /* ALERT */

    if (
        topic ===
        TOPICS.alerts
    ) {

        handleAlert(
            data
        );

        return;

    }


    /* ACTUATOR */

    if (
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
   NUMBER
========================================================= */

function numberValue(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return null;

    }


    const number =
        Number(value);


    if (
        Number.isNaN(number)
    ) {

        return null;

    }


    return number;

}


/* =========================================================
   NORMALIZE STATE
========================================================= */

function normalizeState(value) {

    if (
        value === true ||
        value === 1 ||
        value === "1" ||
        String(value).toUpperCase() === "ON" ||
        String(value).toUpperCase() === "TRUE"
    ) {

        return 1;

    }


    return 0;

}


/* =========================================================
   WATER LEVEL
========================================================= */

function convertLevel(value) {

    const n =
        numberValue(value);


    if (n === null)
        return null;


    /*
       0 - 100 = percentage
    */

    if (
        n >= 0 &&
        n <= 100
    ) {

        return n;

    }


    /*
       ADC 0 - 4095
    */

    if (
        n >= 0 &&
        n <= 4095
    ) {

        return (
            n /
            4095
        ) * 100;

    }


    return null;

}


/* =========================================================
   TELEMETRY
========================================================= */

function updateTelemetry(data) {

    console.log(
        "Telemetry:",
        data
    );


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


    if (
        data.pump !== undefined
    ) {

        sensorData.pump =
            normalizeState(
                data.pump
            );

    }


    if (
        data.fan !== undefined
    ) {

        sensorData.fan =
            normalizeState(
                data.fan
            );

    }


    if (
        data.padCooling !== undefined
    ) {

        sensorData.padCooling =
            normalizeState(
                data.padCooling
            );

    }


    /*
       بعض ESP32 قد يرسل mode
    */

    if (data.mode) {

        const mode =
            String(
                data.mode
            ).toUpperCase();


        if (
            mode === "AUTO" ||
            mode === "MANUAL"
        ) {

            currentMode =
                mode;

        }

    }


    lastTelemetryTime =
        Date.now();


    updateInterface();


    addHistory();


    checkAlerts();

}


/* =========================================================
   UPDATE INTERFACE
========================================================= */

function updateInterface() {

    /* TEMPERATURE */

    setText(
        "temp",
        formatTemperature(
            sensorData.temperature
        )
    );


    setText(
        "tempStatus",
        temperatureStatus()
    );


    /* HUMIDITY */

    setText(
        "hum",
        formatPercent(
            sensorData.humidity
        )
    );


    setText(
        "humStatus",
        sensorData.humidity === null
            ? "انتظار البيانات"
            : "قراءة مباشرة"
    );


    /* WATER TEMPERATURE */

    setText(
        "wt",
        formatTemperature(
            sensorData.waterTemperature
        )
    );


    setText(
        "wtStatus",
        sensorData.waterTemperature === null
            ? "انتظار البيانات"
            : "قراءة مباشرة"
    );


    /* LEVEL */

    setText(
        "level",
        formatPercent(
            sensorData.waterLevel
        )
    );


    setText(
        "levelStatus",
        sensorData.waterLevel === null
            ? "انتظار البيانات"
            : "قراءة مباشرة"
    );


    /* EC */

    setText(
        "ec",
        sensorData.ec === null
            ? "--"
            : sensorData.ec.toFixed(2)
    );


    setText(
        "ecStatus",
        sensorData.ec === null
            ? "انتظار البيانات"
            : "mS/cm"
    );


    /* PH */

    setText(
        "ph",
        sensorData.ph === null
            ? "--"
            : sensorData.ph.toFixed(2)
    );


    setText(
        "phStatus",
        sensorData.ph === null
            ? "انتظار البيانات"
            : "قراءة مباشرة"
    );


    /* DATA PAGE */

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


    /* SYSTEM */

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


    /* CHART CURRENT VALUE */

    setText(
        "cv",
        formatTemperature(
            sensorData.temperature
        )
    );


    updateStates();

}


/* =========================================================
   TEMPERATURE STATUS
========================================================= */

function temperatureStatus() {

    if (
        sensorData.temperature === null
    ) {

        return "انتظار البيانات";

    }


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


    if (
        sensorData.temperature >=
        critical
    ) {

        return "حرارة حرجة";

    }


    if (
        sensorData.temperature >=
        warning
    ) {

        return "تحذير";

    }


    return "طبيعي";

}


/* =========================================================
   FORMAT TEMPERATURE
========================================================= */

function formatTemperature(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "--.-°C";

    }


    return (
        Number(value).toFixed(1)
        + "°C"
    );

}


/* =========================================================
   FORMAT PERCENT
========================================================= */

function formatPercent(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "--%";

    }


    return (
        Number(value).toFixed(0)
        + "%"
    );

}


/* =========================================================
   UPDATE DEVICE STATES
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
        "systemPumpMode",
        currentMode
    );


    setText(
        "systemFanState",
        currentMode === "AUTO"
            ? "تشغيل تلقائي"
            : "تحكم يدوي"
    );


    setText(
        "homeMode",
        currentMode
    );


    setText(
        "modeButton",
        currentMode
    );


    setText(
        "mode",
        currentMode
    );

}


/* =========================================================
   SWITCH VISUAL
========================================================= */

function setSwitch(
    id,
    state
) {

    const button =
        $(id);


    if (!button)
        return;


    if (state) {

        button.classList.add(
            "on"
        );

    }
    else {

        button.classList.remove(
            "on"
        );

    }

}


/* =========================================================
   DEVICE CONTROL
========================================================= */

function controlDevice(
    device
) {

    if (
        !mqttClient ||
        !mqttClient.connected
    ) {

        showToast(
            "MQTT غير متصل"
        );

        return;

    }


    if (
        currentMode !==
        "MANUAL"
    ) {

        showToast(
            "غيّر الوضع إلى MANUAL أولاً"
        );

        return;

    }


    let currentState = 0;


    if (
        device === "pump"
    ) {

        currentState =
            sensorData.pump;

    }


    else if (
        device === "fan"
    ) {

        currentState =
            sensorData.fan;

    }


    else if (
        device === "pad_cooling"
    ) {

        currentState =
            sensorData.padCooling;

    }


    else {

        console.warn(
            "Unknown device:",
            device
        );

        return;

    }


    const newState =
        currentState
            ? 0
            : 1;


    const topic =
        `${TOPICS.control}/${device}/set`;


    const payload =
        JSON.stringify(
            {

                state:
                    newState,

                mode:
                    "MANUAL"

            }
        );


    console.log(
        "MQTT CONTROL:",
        topic,
        payload
    );


    mqttClient.publish(
        topic,
        payload,
        {
            qos: 1
        },
        error => {

            if (error) {

                console.error(
                    "Publish error:",
                    error
                );

                showToast(
                    "فشل إرسال الأمر"
                );

                return;

            }


            /*
               تحديث مؤقت للواجهة
            */

            if (
                device === "pump"
            ) {

                sensorData.pump =
                    newState;

            }


            if (
                device === "fan"
            ) {

                sensorData.fan =
                    newState;

            }


            if (
                device === "pad_cooling"
            ) {

                sensorData.padCooling =
                    newState;

            }


            updateInterface();


            showToast(
                `${device} → ${newState ? "ON" : "OFF"}`
            );

        }
    );

}


/* =========================================================
   CONTROL BUTTONS
========================================================= */

function setupControls() {

    /*
       الشكل الأساسي:
       .sw[data-device]
    */

    const controls =
        document.querySelectorAll(
            ".sw[data-device]"
        );


    controls.forEach(
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
   MODE CONTROL
========================================================= */

function toggleMode() {

    currentMode =
        currentMode === "AUTO"
            ? "MANUAL"
            : "AUTO";


    updateStates();


    if (
        mqttClient &&
        mqttClient.connected
    ) {

        const topic =
            `${TOPICS.control}/mode/set`;


        const payload =
            JSON.stringify(
                {
                    mode:
                        currentMode
                }
            );


        mqttClient.publish(
            topic,
            payload,
            {
                qos: 1
            },
            error => {

                if (error) {

                    console.error(
                        "Mode publish error:",
                        error
                    );

                }

            }
        );

    }


    showToast(
        `الوضع: ${currentMode}`
    );

}


/* =========================================================
   STATUS MESSAGE
========================================================= */

function handleStatus(data) {

    console.log(
        "ESP32 STATUS:",
        data
    );


    if (data.mode) {

        const mode =
            String(
                data.mode
            ).toUpperCase();


        if (
            mode === "AUTO" ||
            mode === "MANUAL"
        ) {

            currentMode =
                mode;

            updateStates();

        }

    }


    if (
        data.online === false
    ) {

        setMQTTStatus(
            false
        );

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


    if (
        device === "pump"
    ) {

        sensorData.pump =
            state;

    }


    if (
        device === "fan"
    ) {

        sensorData.fan =
            state;

    }


    if (
        device === "pad_cooling"
    ) {

        sensorData.padCooling =
            state;

    }


    if (data.mode) {

        const mode =
            String(
                data.mode
            ).toUpperCase();


        if (
            mode === "AUTO" ||
            mode === "MANUAL"
        ) {

            currentMode =
                mode;

        }

    }


    updateInterface();

}


/* =========================================================
   ALERT FROM MQTT
========================================================= */

function handleAlert(data) {

    const title =
        data.title ||
        "تنبيه النظام";


    const body =
        data.body ||
        data.message ||
        "يوجد تنبيه جديد";


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
   ADD ALERT
========================================================= */

function addHydroAlert(
    title,
    body,
    severity = "INFO"
) {

    const list =
        $("alertsList");


    if (!list)
        return;


    const article =
        document.createElement(
            "article"
        );


    let className =
        "good";


    let icon =
        "🟢";


    if (
        severity ===
        "WARNING"
    ) {

        className =
            "warning";

        icon =
            "🟡";

    }


    if (
        severity === "HIGH" ||
        severity === "CRITICAL"
    ) {

        className =
            "danger";

        icon =
            "🔴";

    }


    article.className =
        `alert ${className}`;


    article.innerHTML = `

        <span>${icon}</span>

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


    while (
        list.children.length >
        20
    ) {

        list.removeChild(
            list.lastElementChild
        );

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

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
   LOCAL ALERTS
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


    if (
        sensorData.temperature !== null
    ) {

        if (
            sensorData.temperature >=
            critical
        ) {

            addHydroAlert(
                "حرارة حرجة",
                `حرارة الهواء ${sensorData.temperature.toFixed(1)}°C`,
                "CRITICAL"
            );

        }

        else if (
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


    if (
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

    const now =
        new Date();


    if (
        sensorData.temperature !== null
    ) {

        history.temperature.push(
            sensorData.temperature
        );

    }


    if (
        sensorData.waterLevel !== null
    ) {

        history.level.push(
            sensorData.waterLevel
        );

    }


    history.timestamps.push(
        now
    );


    while (
        history.temperature.length >
        MAX_HISTORY
    ) {

        history.temperature.shift();

    }


    while (
        history.level.length >
        MAX_HISTORY
    ) {

        history.level.shift();

    }


    while (
        history.timestamps.length >
        MAX_HISTORY
    ) {

        history.timestamps.shift();

    }


    drawCharts();

}


/* =========================================================
DRAW ALL CHARTS
========================================================= */

function drawCharts() {

    drawChart(
        "c1",
        history.temperature,
        15,
        45
    );


    drawChart(
        "c2",
        history.temperature,
        15,
        45
    );


    drawChart(
        "c3",
        history.level,
        0,
        100
    );


    /*
       دعم أسماء Canvas القديمة
    */

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


/* =========================================================
   DRAW CHART
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


    const rect =
        canvas.getBoundingClientRect();


    const width =
        Math.max(
            rect.width,
            280
        );


    const height =
        150;


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        width * dpr;


    canvas.height =
        height * dpr;


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


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    /* GRID */

    ctx.strokeStyle =
        "#e8efed";


    ctx.lineWidth =
        1;


    for (
        let i = 0;
        i < 5;
        i++
    ) {

        const y =
            10 +
            i *
            (
                (height - 20) /
                4
            );


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


    if (
        values.length < 2
    ) {

        return;

    }


    /* LINE */

    ctx.strokeStyle =
        "#0b7a70";


    ctx.lineWidth =
        2.5;


    ctx.lineJoin =
        "round";


    ctx.lineCap =
        "round";


    ctx.beginPath();


    values.forEach(
        (value, index) => {

            const x =
                index *
                (
                    width /
                    (values.length - 1)
                );


            const normalized =
                Math.max(
                    0,
                    Math.min(
                        1,
                        (
                            value - min
                        ) /
                        (
                            max - min
                        )
                    )
                );


            const y =
                height -
                15 -
                normalized *
                (
                    height - 30
                );


            if (
                index === 0
            ) {

                ctx.moveTo(
                    x,
                    y
                );

            }

            else {

                ctx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    ctx.stroke();

}


/* =========================================================
   SETTINGS
========================================================= */

function setupSettings() {

    const pairs = [

        [
            "warningTemp",
            "warningValue"
        ],

        [
            "criticalTemp",
            "criticalValue"
        ],

        [
            "padTemp",
            "padValue"
        ],

        [
            "lowLevel",
            "lowValue"
        ],

        [
            "criticalLevel",
            "criticalLevelValue"
        ],


        /*
           دعم أسماء HTML القديمة
        */

        [
            "fan",
            "fo"
        ],

        [
            "crit",
            "fc"
        ],

        [
            "pad",
            "po"
        ],

        [
            "low",
            "lo"
        ],

        [
            "critical",
            "lc"
        ]

    ];


    pairs.forEach(
        ([inputId, outputId]) => {

            const input =
                $(inputId);


            const output =
                $(outputId);


            if (
                !input ||
                !output
            )
                return;


            input.addEventListener(
                "input",
                () => {

                    output.textContent =
                        input.value;

                }
            );

        }
    );


    loadSettings();

}


/* =========================================================
   SAVE SETTINGS
========================================================= */

function saveSettings() {

    const warning =
        getValue(
            "warningTemp",
            "fan"
        );


    const critical =
        getValue(
            "criticalTemp",
            "crit"
        );


    const pad =
        getValue(
            "padTemp",
            "pad"
        );


    const low =
        getValue(
            "lowLevel",
            "low"
        );


    const criticalLevel =
        getValue(
            "criticalLevel",
            "critical"
        );


    if (warning !== null) {

        localStorage.setItem(
            "hydro_warning_temp",
            warning
        );

    }


    if (critical !== null) {

        localStorage.setItem(
            "hydro_critical_temp",
            critical
        );

    }


    if (pad !== null) {

        localStorage.setItem(
            "hydro_pad_temp",
            pad
        );

    }


    if (low !== null) {

        localStorage.setItem(
            "hydro_low_level",
            low
        );

    }


    if (criticalLevel !== null) {

        localStorage.setItem(
            "hydro_critical_level",
            criticalLevel
        );

    }


    showToast(
        "تم حفظ الإعدادات"
    );

}


/* =========================================================
   GET VALUE
========================================================= */

function getValue(
    first,
    second
) {

    const a =
        $(first);


    if (a)
        return a.value;


    const b =
        $(second);


    if (b)
        return b.value;


    return null;

}


/* =========================================================
   LOAD SETTINGS
========================================================= */

function loadSettings() {

    const map = [

        [
            "warningTemp",
            "fan",
            "hydro_warning_temp"
        ],

        [
            "criticalTemp",
            "crit",
            "hydro_critical_temp"
        ],

        [
            "padTemp",
            "pad",
            "hydro_pad_temp"
        ],

        [
            "lowLevel",
            "low",
            "hydro_low_level"
        ],

        [
            "criticalLevel",
            "critical",
            "hydro_critical_level"
        ]

    ];


    map.forEach(
        ([primary, fallback, key]) => {

            const input =
                $(primary) ||
                $(fallback);


            if (!input)
                return;


            const value =
                localStorage.getItem(
                    key
                );


            if (
                value !== null
            ) {

                input.value =
                    value;

            }


            input.dispatchEvent(
                new Event(
                    "input"
                )
            );

        }
    );

}


/* =========================================================
   CLEAR ALERTS
========================================================= */

function clearAlerts() {

    const list =
        $("alertsList");


    if (!list)
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
   RANGE BUTTONS
========================================================= */

function setupRanges() {

    const selectors = [

        ".range-buttons button",

        ".ranges button"

    ];


    let buttons = [];


    selectors.forEach(
        selector => {

            document
                .querySelectorAll(selector)
                .forEach(button => {

                    if (
                        !buttons.includes(
                            button
                        )
                    ) {

                        buttons.push(
                            button
                        );

                    }

                });

        }
    );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    buttons.forEach(
                        b => {

                            b.classList.remove(
                                "selected"
                            );

                            b.classList.remove(
                                "sel"
                            );

                        }
                    );


                    button.classList.add(
                        "selected"
                    );


                    button.classList.add(
                        "sel"
                    );


                    showToast(
                        `الفترة: ${button.textContent}`
                    );

                }
            );

        }
    );

}


/* =========================================================
   MQTT BUTTON
========================================================= */

function setupMQTTButton() {

    const buttons = [

        $("mqttConnect"),

        $("connectMQTT"),

        $("mqttConnectButton")

    ];


    buttons.forEach(
        button => {

            if (!button)
                return;


            button.addEventListener(
                "click",
                connectMQTT
            );

        }
    );

}


/* =========================================================
   MODE BUTTON
========================================================= */

function setupModeButton() {

    const buttons = [

        $("modeButton"),

        $("mode")

    ];


    buttons.forEach(
        button => {

            if (!button)
                return;


            button.addEventListener(
                "click",
                toggleMode
            );

        }
    );

}


/* =========================================================
   CLEAR BUTTON
========================================================= */

function setupClearButton() {

    const buttons = [

        $("clearAlerts"),

        $("clear")

    ];


    buttons.forEach(
        button => {

            if (!button)
                return;


            button.addEventListener(
                "click",
                clearAlerts
            );

        }
    );

}


/* =========================================================
   SAVE BUTTON
========================================================= */

function setupSaveButton() {

    const buttons = [

        $("saveSettings"),

        $("save")

    ];


    buttons.forEach(
        button => {

            if (!button)
                return;


            button.addEventListener(
                "click",
                saveSettings
            );

        }
    );

}


/* =========================================================
   CHECK ESP32 TIMEOUT
========================================================= */

setInterval(
    () => {

        if (
            lastTelemetryTime === 0
        )
            return;


        const elapsed =
            Date.now() -
            lastTelemetryTime;


        /*
           إذا لم تصل بيانات لمدة 30 ثانية
        */

        if (
            elapsed > 30000
        ) {

            setText(
                "espStatus",
                "Offline"
            );


            const esp =
                $("espStatus");


            if (esp) {

                esp.className =
                    "";

            }

        }

    },
    5000
);


/* =========================================================
   RESIZE
========================================================= */

window.addEventListener(
    "resize",
    () => {

        drawCharts();

    }
);


/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "Hydro Farm application starting..."
        );


        setupNavigation();


        setupControls();


        setupSettings();


        setupRanges();


        setupMQTTButton();


        setupModeButton();


        setupClearButton();


        setupSaveButton();


        setMQTTStatus(
            false
        );


        updateInterface();


        drawCharts();


        console.log(
            "Hydro Farm application started"
        );

    }
);
