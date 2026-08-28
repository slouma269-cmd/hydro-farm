/* =========================================================
   HYDRO FARM
   PHASE 2
   HiveMQ Cloud + GH001
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
   TOAST
========================================================= */

function showToast(message){

    const toast =
        $("toast");

    if(!toast)
        return;

    toast.textContent =
        message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    },2500);

}


/* =========================================================
   NAVIGATION
========================================================= */

function setupNavigation(){

    const buttons =
        document.querySelectorAll(
            ".nav-button"
        );

    const pages =
        document.querySelectorAll(
            ".page"
        );


    buttons.forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const page =
                    button.dataset.page;


                pages.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                const target =
                    $(page);

                if(target){

                    target.classList.add(
                        "active"
                    );

                }


                buttons.forEach(
                    item => {

                        item.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add(
                    "active"
                );


                window.scrollTo({
                    top:0,
                    behavior:"smooth"
                });

            }
        );

    });

}


/* =========================================================
   MQTT CONNECTION STATUS
========================================================= */

function setMQTTStatus(connected){

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


    if(connected){

        dot?.classList.add("online");

        headerDot?.classList.remove(
            "offline"
        );

        headerDot?.classList.add(
            "online"
        );


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


        if(headerStatus)
            headerStatus.textContent =
                "Online";


        if(alertConnection)
            alertConnection.textContent =
                "اتصال MQTT ناجح";


    }else{

        dot?.classList.remove(
            "online"
        );

        headerDot?.classList.remove(
            "online"
        );

        headerDot?.classList.add(
            "offline"
        );


        if(state)
            state.textContent =
                "النظام غير متصل";


        if(sub)
            sub.textContent =
                "ESP32 • MQTT • Offline";


        if(status){

            status.textContent =
                "غير متصل";

            status.className = "";

        }


        if(esp){

            esp.textContent =
                "Offline";

            esp.className = "";

        }


        if(headerStatus)
            headerStatus.textContent =
                "Offline";


        if(alertConnection)
            alertConnection.textContent =
                "في انتظار اتصال ESP32";

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

        showToast(
            "مكتبة MQTT غير موجودة"
        );

        return;

    }


    const password =
        $("mqttPassword")?.value.trim();


    if(!password){

        showToast(
            "أدخل كلمة مرور HiveMQ"
        );

        return;

    }


    if(mqttClient){

        try{
            mqttClient.end(true);
        }catch(e){}

        mqttClient =
            null;

    }


    showToast(
        "جاري الاتصال بـ HiveMQ..."
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

                clean:true,

                reconnectPeriod:3000,

                connectTimeout:10000

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


            subscribeMQTT();


            showToast(
                "تم الاتصال بـ HiveMQ"
            );

        }
    );


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


    mqttClient.on(
        "message",
        handleMQTTMessage
    );

}


/* =========================================================
   SUBSCRIBE
========================================================= */

function subscribeMQTT(){

    if(
        !mqttClient ||
        !mqttClient.connected
    )
        return;


    mqttClient.subscribe(
        TOPICS.telemetry,
        error => {

            if(error){

                console.error(
                    "Telemetry subscribe error:",
                    error
                );

            }else{

                console.log(
                    "Subscribed:",
                    TOPICS.telemetry
                );

            }

        }
    );


    mqttClient.subscribe(
        TOPICS.actuatorState + "/+/state",
        error => {

            if(error){

                console.error(
                    error
                );

            }else{

                console.log(
                    "Subscribed to actuator states"
                );

            }

        }
    );


    mqttClient.subscribe(
        TOPICS.status,
        error => {

            if(error){

                console.error(error);

            }

        }
    );


    mqttClient.subscribe(
        TOPICS.alerts,
        error => {

            if(error){

                console.error(error);

            }

        }
    );

}


/* =========================================================
   MQTT MESSAGE
========================================================= */

function handleMQTTMessage(
    topic,
    message
){

    const text =
        message.toString();

    console.log(
        "MQTT:",
        topic,
        text
    );


    let data;


    try{

        data =
            JSON.parse(text);

    }catch(error){

        console.warn(
            "Invalid JSON:",
            text
        );

        return;

    }


    /* TELEMETRY */

    if(
        topic ===
        TOPICS.telemetry
    ){

        updateTelemetry(
            data
        );

        return;

    }


    /* STATUS */

    if(
        topic ===
        TOPICS.status
    ){

        handleStatus(
            data
        );

        return;

    }


    /* ALERT */

    if(
        topic ===
        TOPICS.alerts
    ){

        handleAlert(
            data
        );

        return;

    }


    /* ACTUATOR */

    if(
        topic.startsWith(
            TOPICS.actuatorState
        )
    ){

        handleActuatorState(
            topic,
            data
        );

    }

}


/* =========================================================
   TELEMETRY
========================================================= */

function updateTelemetry(data){

    console.log(
        "Telemetry data:",
        data
    );


    /*
      دعم أكثر من أسماء للحقول
    */


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

function numberValue(value){

    if(
        value === null ||
        value === undefined ||
        value === ""
    )
        return null;


    const n =
        Number(value);


    if(
        Number.isNaN(n)
    )
        return null;


    return n;

}


/* =========================================================
   LEVEL
========================================================= */

function convertLevel(value){

    const n =
        numberValue(value);


    if(n === null)
        return null;


    /*
      إذا كانت القيمة بالفعل %
    */

    if(
        n >= 0 &&
        n <= 100
    ){

        return n;

    }


    /*
      إذا كان ST045 يعطي ADC
      0...4095
    */

    if(
        n >= 0 &&
        n <= 4095
    ){

        return Math.round(
            (n / 4095) * 100
        );

    }


    return null;

}


/* =========================================================
   NORMALIZE STATE
========================================================= */

function normalizeState(value){

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
   UPDATE UI
========================================================= */

function updateInterface(){

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


    setText(
        "chartTemp",
        formatTemperature(
            sensorData.temperature
        )
    );


    setText(
        "chartLevel",
        formatPercent(
            sensorData.waterLevel
        )
    );


    updateStates();

}


/* =========================================================
   FORMAT
========================================================= */

function formatTemperature(value){

    if(value === null)
        return "--.-°C";


    return (
        Number(value).toFixed(1)
        + "°C"
    );

}


function formatPercent(value){

    if(value === null)
        return "--%";


    return (
        Number(value).toFixed(0)
        + "%"
    );

}


/* =========================================================
   SET TEXT
========================================================= */

function setText(
    id,
    value
){

    const element =
        $(id);

    if(element)
        element.textContent =
            value;

}


/* =========================================================
   UPDATE STATES
========================================================= */

function updateStates(){

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

}


/* =========================================================
   SWITCH
========================================================= */

function setSwitch(
    id,
    state
){

    const button =
        $(id);

    if(!button)
        return;


    if(state){

        button.classList.add(
            "on"
        );

    }else{

        button.classList.remove(
            "on"
        );

    }

}


/* =========================================================
   CONTROL DEVICE
========================================================= */

function controlDevice(
    device
){

    if(
        !mqttClient ||
        !mqttClient.connected
    ){

        showToast(
            "MQTT غير متصل"
        );

        return;

    }


    /*
      التحكم اليدوي فقط
    */

    if(
        currentMode !==
        "MANUAL"
    ){

        showToast(
            "غيّر الوضع إلى MANUAL أولاً"
        );

        return;

    }


    let current;


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


    mqttClient.publish(
        topic,
        payload,
        {
            qos:1
        },
        error => {

            if(error){

                console.error(
                    error
                );

                showToast(
                    "فشل إرسال الأمر"
                );

                return;

            }


            /*
              تحديث مؤقت للواجهة
              إلى أن يصل actuator state
            */

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
   DEVICE BUTTONS
========================================================= */

function setupControls(){

    const controls =
        document.querySelectorAll(
            ".switch[data-device]"
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


    $("systemPadSwitch")
        ?.addEventListener(
            "click",
            () => {

                controlDevice(
                    "pad_cooling"
                );

            }
        );

}


/* =========================================================
   MODE
========================================================= */

function toggleMode(){

    currentMode =
        currentMode ===
        "AUTO"
            ? "MANUAL"
            : "AUTO";


    setText(
        "modeButton",
        currentMode
    );


    setText(
        "homeMode",
        currentMode
    );


    updateStates();


    if(
        mqttClient &&
        mqttClient.connected
    ){

        const topic =
            `${TOPICS.control}/mode/set`;


        const payload =
            JSON.stringify({

                mode:
                    currentMode

            });


        mqttClient.publish(
            topic,
            payload,
            {
                qos:1
            }
        );


        showToast(
            `الوضع: ${currentMode}`
        );

    }else{

        showToast(
            `الوضع: ${currentMode}`
        );

    }

}


/* =========================================================
   STATUS
========================================================= */

function handleStatus(data){

    console.log(
        "ESP32 status:",
        data
    );


    if(
        data.mode
    ){

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


        setText(
            "modeButton",
            currentMode
        );


        setText(
            "homeMode",
            currentMode
        );


        updateStates();

    }

}


/* =========================================================
   ACTUATOR STATE
========================================================= */

function handleActuatorState(
    topic,
    data
){

    const parts =
        topic.split("/");


    const device =
        parts[parts.length - 2];


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


    if(data.mode){

        currentMode =
            String(
                data.mode
            ).toUpperCase();

    }


    updateInterface();

}


/* =========================================================
   ALERT
========================================================= */

function handleAlert(data){

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
   ADD ALERT
========================================================= */

function addHydroAlert(
    title,
    body,
    severity = "INFO"
){

    const list =
        $("alertsList");

    if(!list)
        return;


    const article =
        document.createElement(
            "article"
        );


    let className =
        "good";

    let icon =
        "🟢";


    if(
        severity === "WARNING"
    ){

        className =
            "warning";

        icon =
            "🟡";

    }


    if(
        severity === "HIGH" ||
        severity === "CRITICAL"
    ){

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


    while(
        list.children.length > 20
    ){

        list.removeChild(
            list.lastElementChild
        );

    }

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value){

    return String(value)
        .replaceAll("&","&amp;")
        .replaceAll("<","&lt;")
        .replaceAll(">","&gt;")
        .replaceAll('"',"&quot;")
        .replaceAll("'","&#039;");

}


/* =========================================================
   LOCAL ALERTS
========================================================= */

function checkAlerts(){

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
    ){

        if(
            sensorData.temperature >=
            critical
        ){

            addHydroAlert(
                "حرارة حرجة",
                `حرارة الهواء ${sensorData.temperature.toFixed(1)}°C`,
                "CRITICAL"
            );

        }else if(
            sensorData.temperature >=
            warning
        ){

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
    ){

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

function addHistory(){

    if(
        sensorData.temperature !== null
    ){

        history.temperature.push(
            sensorData.temperature
        );

    }


    if(
        sensorData.waterLevel !== null
    ){

        history.level.push(
            sensorData.waterLevel
        );

    }


    if(
        history.temperature.length > 30
    )
        history.temperature.shift();


    if(
        history.level.length > 30
    )
        history.level.shift();


    drawCharts();

}


/* =========================================================
   CANVAS CHART
========================================================= */

function drawCharts(){

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
   DRAW
========================================================= */

function drawChart(
    canvasId,
    values,
    min,
    max
){

    const canvas =
        $(canvasId);

    if(!canvas)
        return;


    const rect =
        canvas.getBoundingClientRect();


    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        rect.width * dpr;


    canvas.height =
        150 * dpr;


    const ctx =
        canvas.getContext(
            "2d"
        );


    ctx.scale(
        dpr,
        dpr
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


    /* GRID */

    ctx.strokeStyle =
        "#e8efed";

    ctx.lineWidth =
        1;


    for(
        let i=0;
        i<5;
        i++
    ){

        const y =
            10 +
            i *
            ((height-20)/4);


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


    /* LINE */

    ctx.strokeStyle =
        "#0b7a70";

    ctx.lineWidth =
        2.5;

    ctx.beginPath();


    values.forEach(
        (value,index) => {

            const x =
                index *
                (width /
                (values.length-1));


            const normalized =
                (value-min) /
                (max-min);


            const y =
                height -
                15 -
                normalized *
                (height-30);


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
   SETTINGS
========================================================= */

function setupSettings(){

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
        ]

    ];


    pairs.forEach(
        ([inputId,outputId]) => {

            const input =
                $(inputId);

            const output =
                $(outputId);


            if(
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

function saveSettings(){

    const values = {

        warning:
            $("warningTemp")?.value,

        critical:
            $("criticalTemp")?.value,

        pad:
            $("padTemp")?.value,

        low:
            $("lowLevel")?.value,

        criticalLevel:
            $("criticalLevel")?.value

    };


    localStorage.setItem(
        "hydro_warning_temp",
        values.warning
    );


    localStorage.setItem(
        "hydro_critical_temp",
        values.critical
    );


    localStorage.setItem(
        "hydro_pad_temp",
        values.pad
    );


    localStorage.setItem(
        "hydro_low_level",
        values.low
    );


    localStorage.setItem(
        "hydro_critical_level",
        values.criticalLevel
    );


    showToast(
        "تم حفظ الإعدادات"
    );

}


/* =========================================================
   LOAD SETTINGS
========================================================= */

function loadSettings(){

    const map = [

        [
            "warningTemp",
            "hydro_warning_temp"
        ],

        [
            "criticalTemp",
            "hydro_critical_temp"
        ],

        [
            "padTemp",
            "hydro_pad_temp"
        ],

        [
            "lowLevel",
            "hydro_low_level"
        ],

        [
            "criticalLevel",
            "hydro_critical_level"
        ]

    ];


    map.forEach(
        ([inputId,key]) => {

            const input =
                $(inputId);

            if(!input)
                return;


            const value =
                localStorage.getItem(
                    key
                );


            if(value !== null)
                input.value =
                    value;


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

function clearAlerts(){

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
   RANGE BUTTONS
========================================================= */

function setupRanges(){

    const buttons =
        document.querySelectorAll(
            ".range-buttons button"
        );


    buttons.forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    buttons.forEach(
                        b =>
                            b.classList.remove(
                                "selected"
                            )
                    );


                    button.classList.add(
                        "selected"
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
   WINDOW RESIZE
========================================================= */

window.addEventListener(
    "resize",
    drawCharts
);


/* =========================================================
   START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupNavigation();

        setupControls();

        setupSettings();

        setupRanges();


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


        $("saveSettings")
            ?.addEventListener(
                "click",
                saveSettings
            );


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
