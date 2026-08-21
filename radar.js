// ======================================================
// CANVAS
// ======================================================

const canvas =
    document.getElementById(
        "radarCanvas"
    );

const ctx =
    canvas.getContext(
        "2d"
    );


// ======================================================
// UI
// ======================================================

const radarScreen =
    document.getElementById(
        "radarScreen"
    );

const wakeHint =
    document.getElementById(
        "wakeHint"
    );

const sessionAccess =
    document.getElementById(
        "sessionAccess"
    );

const sessionStatus =
    document.getElementById(
        "sessionStatus"
    );

const sessionSubStatus =
    document.getElementById(
        "sessionSubStatus"
    );

const sessionCodeInput =
    document.getElementById(
        "sessionCodeInput"
    );

const confirmButton =
    document.getElementById(
        "confirmButton"
    );

const accessFlash =
    document.getElementById(
        "accessFlash"
    );

const transitionRing =
    document.getElementById(
        "transitionRing"
    );

const courseScreen =
    document.getElementById(
        "courseScreen"
    );

const courseTitle =
    document.getElementById(
        "courseTitle"
    );

const sessionBadge =
    document.getElementById(
        "sessionBadge"
    );

const resetDemoButton =
    document.getElementById(
        "resetDemoButton"
    );


// ======================================================
// DEMO SESSIONS
// ======================================================

const demoSessions = {

    "482731": {
        courseName:
            "Mathematics"
    },

    "LATVIA": {
        courseName:
            "Latvian Language"
    },

    "GAS101": {
        courseName:
            "GAS BASIC"
    }
};


// ======================================================
// LOGO
// ======================================================

const logo =
    new Image();

logo.src =
    "./assets/logo_navy.png";


// ======================================================
// RADAR SETTINGS
// ======================================================

let sweepAngle =
    0;


const normalSweepSpeed =
    1.22;


let sweepSpeedMultiplier =
    1;


let previousTime =
    0;


// ======================================================
// LOGO POSITION
// ======================================================

const targetAngle =
    -Math.PI / 2;


const targetDistanceFactor =
    0.48;


const maxLogoWidth =
    600;


const logoWidthFactor =
    0.28;


// ======================================================
// DOT STYLE
// ======================================================

const dotSpacing =
    5;


const dotMinRadius =
    1.15;


const dotMaxRadius =
    2.05;


const dotJitter =
    1.25;


const dotAlphaThreshold =
    45;


const dotRed =
    105;


const dotGreen =
    255;


const dotBlue =
    225;


// ======================================================
// SCAN STYLE
// ======================================================

const scanPadding =
    0.008;


const revealFeather =
    0.012;


const logoHoldTime =
    900;


const logoFadeSpeed =
    0.52;


// ======================================================
// LOGO STATE
// ======================================================

let logoState =
    "idle";


let logoOpacity =
    0;


let logoHoldUntil =
    0;


let wasScanningLastFrame =
    false;


let currentRevealProgress =
    0;


let scanData =
    null;


// ======================================================
// APP STATE
// ======================================================

let accessVisible =
    false;


let processing =
    false;


let transitionStarted =
    false;


// ======================================================
// RESIZE
// ======================================================

function resizeCanvas() {

    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        window.innerWidth *
        dpr;


    canvas.height =
        window.innerHeight *
        dpr;


    canvas.style.width =
        `${window.innerWidth}px`;


    canvas.style.height =
        `${window.innerHeight}px`;


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    if (
        logo.complete &&
        logo.naturalWidth
    ) {

        buildLogoScanData();
    }
}


window.addEventListener(
    "resize",
    resizeCanvas
);


// ======================================================
// ANGLE HELPERS
// ======================================================

function normalizeAngle(angle) {

    const fullCircle =
        Math.PI *
        2;


    return (
        (
            angle %
            fullCircle
        ) +
        fullCircle
    ) %
    fullCircle;
}


function signedAngleDifference(
    angle,
    reference
) {

    return Math.atan2(

        Math.sin(
            angle -
            reference
        ),

        Math.cos(
            angle -
            reference
        )
    );
}


function angularDistanceCW(
    fromAngle,
    toAngle
) {

    return normalizeAngle(
        toAngle -
        fromAngle
    );
}


// ======================================================
// STABLE RANDOM
// ======================================================

function pseudoRandom(
    x,
    y,
    seed = 0
) {

    const value =

        Math.sin(

            x *
            12.9898 +

            y *
            78.233 +

            seed *
            37.719

        ) *

        43758.5453;


    return value -
        Math.floor(
            value
        );
}


// ======================================================
// RADAR LAYOUT
// ======================================================

function getRadarLayout() {

    const width =
        window.innerWidth;


    const height =
        window.innerHeight;


    const centerX =
        width / 2;


    const centerY =
        height / 2;


    const radius =
        Math.min(
            width,
            height
        ) *
        0.40;


    return {

        width,
        height,

        centerX,
        centerY,

        radius
    };
}


// ======================================================
// LOGO LAYOUT
// ======================================================

function getLogoLayout() {

    const radar =
        getRadarLayout();


    const logoWidth =
        Math.min(

            maxLogoWidth,

            radar.width *
            logoWidthFactor
        );


    const logoHeight =

        logoWidth *

        (
            logo.naturalHeight /
            logo.naturalWidth
        );


    const distance =

        radar.radius *

        targetDistanceFactor;


    const logoCenterX =

        radar.centerX +

        Math.cos(
            targetAngle
        ) *

        distance;


    const logoCenterY =

        radar.centerY +

        Math.sin(
            targetAngle
        ) *

        distance;


    return {

        radar,

        logoWidth,
        logoHeight,

        logoX:
            logoCenterX -
            logoWidth / 2,

        logoY:
            logoCenterY -
            logoHeight / 2
    };
}


// ======================================================
// BUILD DOTTED LOGO
// ======================================================

function buildLogoScanData() {

    if (
        !logo.complete ||
        !logo.naturalWidth
    ) {

        return;
    }


    const layout =
        getLogoLayout();


    const radar =
        layout.radar;


    const pixelWidth =
        Math.max(

            1,

            Math.round(
                layout.logoWidth
            )
        );


    const pixelHeight =
        Math.max(

            1,

            Math.round(
                layout.logoHeight
            )
        );


    // --------------------------------------------------
    // OFFSCREEN SVG RENDER
    // --------------------------------------------------

    const sourceCanvas =
        document.createElement(
            "canvas"
        );


    sourceCanvas.width =
        pixelWidth;


    sourceCanvas.height =
        pixelHeight;


    const sourceCtx =
        sourceCanvas.getContext(

            "2d",

            {
                willReadFrequently:
                    true
            }
        );


    sourceCtx.drawImage(

        logo,

        0,
        0,

        pixelWidth,
        pixelHeight
    );


    const imageData =
        sourceCtx.getImageData(

            0,
            0,

            pixelWidth,
            pixelHeight
        );


    const pixels =
        imageData.data;


    // --------------------------------------------------
    // REAL ANGULAR EXTENT
    // --------------------------------------------------

    let minOffset =
        Infinity;


    let maxOffset =
        -Infinity;


    for (
        let y = 0;
        y < pixelHeight;
        y++
    ) {

        for (
            let x = 0;
            x < pixelWidth;
            x++
        ) {

            const pixelIndex =
                y *
                pixelWidth +
                x;


            const dataIndex =
                pixelIndex *
                4;


            const alpha =
                pixels[
                    dataIndex +
                    3
                ];


            if (
                alpha <
                5
            ) {

                continue;
            }


            const screenX =

                layout.logoX +

                (
                    (
                        x +
                        0.5
                    ) /
                    pixelWidth
                ) *

                layout.logoWidth;


            const screenY =

                layout.logoY +

                (
                    (
                        y +
                        0.5
                    ) /
                    pixelHeight
                ) *

                layout.logoHeight;


            const pixelAngle =
                Math.atan2(

                    screenY -
                    radar.centerY,

                    screenX -
                    radar.centerX
                );


            const offset =
                signedAngleDifference(

                    pixelAngle,

                    targetAngle
                );


            if (
                offset <
                minOffset
            ) {

                minOffset =
                    offset;
            }


            if (
                offset >
                maxOffset
            ) {

                maxOffset =
                    offset;
            }
        }
    }


    const scanStartAngle =

        targetAngle +

        minOffset -

        scanPadding;


    const scanEndAngle =

        targetAngle +

        maxOffset +

        scanPadding;


    const totalScanSpan =
        angularDistanceCW(

            scanStartAngle,

            scanEndAngle
        );


    // --------------------------------------------------
    // DOT GENERATION
    // --------------------------------------------------

    const dots =
        [];


    for (
        let gridY = 0;
        gridY < pixelHeight;
        gridY += dotSpacing
    ) {

        for (
            let gridX = 0;
            gridX < pixelWidth;
            gridX += dotSpacing
        ) {

            const randomX =
                pseudoRandom(

                    gridX,
                    gridY,
                    1
                );


            const randomY =
                pseudoRandom(

                    gridX,
                    gridY,
                    2
                );


            const jitterX =

                (
                    randomX -
                    0.5
                ) *

                dotJitter *

                2;


            const jitterY =

                (
                    randomY -
                    0.5
                ) *

                dotJitter *

                2;


            const x =
                Math.round(

                    gridX +
                    jitterX
                );


            const y =
                Math.round(

                    gridY +
                    jitterY
                );


            if (
                x < 0 ||
                x >= pixelWidth ||
                y < 0 ||
                y >= pixelHeight
            ) {

                continue;
            }


            const pixelIndex =
                y *
                pixelWidth +
                x;


            const dataIndex =
                pixelIndex *
                4;


            const alpha =
                pixels[
                    dataIndex +
                    3
                ];


            if (
                alpha <
                dotAlphaThreshold
            ) {

                continue;
            }


            const screenX =

                layout.logoX +

                (
                    (
                        x +
                        0.5
                    ) /
                    pixelWidth
                ) *

                layout.logoWidth;


            const screenY =

                layout.logoY +

                (
                    (
                        y +
                        0.5
                    ) /
                    pixelHeight
                ) *

                layout.logoHeight;


            const dotAngle =
                Math.atan2(

                    screenY -
                    radar.centerY,

                    screenX -
                    radar.centerX
                );


            const revealProgress =
                angularDistanceCW(

                    scanStartAngle,

                    dotAngle
                );


            const sizeRandom =
                pseudoRandom(
                    x,
                    y,
                    3
                );


            const brightnessRandom =
                pseudoRandom(
                    x,
                    y,
                    4
                );


            const dotRadius =

                dotMinRadius +

                sizeRandom *

                (
                    dotMaxRadius -
                    dotMinRadius
                );


            const brightness =

                0.62 +

                brightnessRandom *

                0.38;


            dots.push({

                x:
                    screenX,

                y:
                    screenY,

                radius:
                    dotRadius,

                brightness,

                revealProgress
            });
        }
    }


    scanData = {

        dots,

        scanStartAngle,

        scanEndAngle,

        totalScanSpan
    };
}


// ======================================================
// UPDATE LOGO
// ======================================================

function updateLogoScan(
    currentTime,
    deltaTime
) {

    if (!scanData) {

        return;
    }


    const sweepProgress =
        angularDistanceCW(

            scanData.scanStartAngle,

            sweepAngle
        );


    const isScanning =

        sweepProgress <=

        scanData.totalScanSpan;


    // --------------------------------------------------
    // SCANNING
    // --------------------------------------------------

    if (isScanning) {

        if (
            !wasScanningLastFrame
        ) {

            logoState =
                "scanning";


            logoOpacity =
                1;


            currentRevealProgress =
                0;
        }


        currentRevealProgress =
            Math.min(

                sweepProgress,

                scanData.totalScanSpan
            );
    }


    // --------------------------------------------------
    // AFTER SCAN
    // --------------------------------------------------

    else {

        if (
            wasScanningLastFrame &&
            logoState ===
            "scanning"
        ) {

            currentRevealProgress =
                scanData.totalScanSpan;


            logoState =
                "holding";


            logoOpacity =
                1;


            logoHoldUntil =
                currentTime +
                logoHoldTime;
        }


        if (
            logoState ===
            "holding" &&
            currentTime >
            logoHoldUntil
        ) {

            logoState =
                "fading";
        }


        if (
            logoState ===
            "fading"
        ) {

            logoOpacity -=

                logoFadeSpeed *

                deltaTime;


            if (
                logoOpacity <=
                0
            ) {

                logoOpacity =
                    0;


                logoState =
                    "idle";


                currentRevealProgress =
                    0;
            }
        }
    }


    wasScanningLastFrame =
        isScanning;
}


// ======================================================
// DRAW LOGO
// ======================================================

function drawDotLogo() {

    if (
        !scanData ||
        logoState ===
        "idle" ||
        logoOpacity <=
        0
    ) {

        return;
    }


    ctx.save();


    ctx.shadowColor =
        "rgba(100, 255, 225, 0.55)";


    ctx.shadowBlur =
        6;


    for (
        const dot of
        scanData.dots
    ) {

        const distanceBehindNeedle =

            currentRevealProgress -

            dot.revealProgress;


        let visibility =
            0;


        if (
            distanceBehindNeedle >=
            revealFeather
        ) {

            visibility =
                1;
        }


        else if (
            distanceBehindNeedle >
            -revealFeather
        ) {

            visibility =

                (
                    distanceBehindNeedle +

                    revealFeather
                ) /

                (
                    revealFeather *
                    2
                );
        }


        if (
            visibility <=
            0
        ) {

            continue;
        }


        const alpha =

            visibility *

            dot.brightness *

            logoOpacity;


        ctx.beginPath();


        ctx.arc(

            dot.x,

            dot.y,

            dot.radius,

            0,

            Math.PI *
            2
        );


        ctx.fillStyle =

            `rgba(
                ${dotRed},
                ${dotGreen},
                ${dotBlue},
                ${alpha}
            )`;


        ctx.fill();
    }


    ctx.restore();
}


// ======================================================
// SHOW SESSION ACCESS
// ======================================================

function showSessionAccess() {

    if (
        accessVisible ||
        processing ||
        transitionStarted
    ) {

        return;
    }


    accessVisible =
        true;


    wakeHint.classList.add(
        "hidden"
    );


    sessionAccess.classList.add(
        "visible"
    );
}


// ======================================================
// PROCESS SESSION
// ======================================================

function processSessionCode() {

    if (
        processing ||
        transitionStarted
    ) {

        return;
    }


    const code =
        sessionCodeInput.value
            .trim()
            .toUpperCase();


    // --------------------------------------------------
    // EMPTY
    // --------------------------------------------------

    if (!code) {

        sessionAccess.classList.add(
            "denied"
        );


        sessionStatus.textContent =
            "SESSION CODE REQUIRED";


        sessionSubStatus.textContent =
            "TAP THE CODE FIELD AND ENTER YOUR SESSION KEY";


        setTimeout(
            () => {

                sessionAccess.classList.remove(
                    "denied"
                );


                sessionStatus.textContent =
                    "ENTER INSTRUCTOR CODE";


                sessionSubStatus.textContent =
                    "USE THE SESSION KEY PROVIDED BY YOUR INSTRUCTOR";

            },
            1200
        );


        return;
    }


    // --------------------------------------------------
    // PROCESSING
    // --------------------------------------------------

    processing =
        true;


    sessionCodeInput.disabled =
        true;


    confirmButton.disabled =
        true;


    sessionAccess.classList.add(
        "processing"
    );


    sessionStatus.textContent =
        "PROCESSING SESSION";


    sessionSubStatus.textContent =
        "VALIDATING ACCESS KEY";


    sweepSpeedMultiplier =
        1.25;


    // --------------------------------------------------
    // 1.1 SEC
    // --------------------------------------------------

    setTimeout(
        () => {

            const session =
                demoSessions[
                    code
                ];


            if (session) {

                sessionStatus.textContent =
                    "CODE VERIFIED";


                sessionSubStatus.textContent =
                    session.courseName
                        .toUpperCase();
            }

            else {

                sessionStatus.textContent =
                    "CODE NOT RECOGNISED";


                sessionSubStatus.textContent =
                    "SESSION VALIDATION FAILED";
            }

        },
        1100
    );


    // --------------------------------------------------
    // 2 SEC
    // --------------------------------------------------

    setTimeout(
        () => {

            const session =
                demoSessions[
                    code
                ];


            // ==========================================
            // SUCCESS
            // ==========================================

            if (session) {

                sessionAccess.classList.remove(
                    "processing"
                );


                sessionAccess.classList.add(
                    "success"
                );


                sessionStatus.textContent =
                    "ACCESS GRANTED";


                sessionSubStatus.textContent =
                    session.courseName
                        .toUpperCase();


                sweepSpeedMultiplier =
                    1.45;


                courseTitle.textContent =
                    session.courseName;


                sessionBadge.textContent =
                    `SESSION ${code}`;


                accessFlash.classList.add(
                    "active"
                );


                setTimeout(
                    () => {

                        beginCourseTransition();

                    },
                    700
                );
            }


            // ==========================================
            // DENIED
            // ==========================================

            else {

                sessionAccess.classList.remove(
                    "processing"
                );


                sessionAccess.classList.add(
                    "denied"
                );


                sessionStatus.textContent =
                    "ACCESS DENIED";


                sessionSubStatus.textContent =
                    "CHECK SESSION CODE";


                sweepSpeedMultiplier =
                    1;


                setTimeout(
                    () => {

                        resetSessionEntry();

                    },
                    1400
                );
            }

        },
        2000
    );
}


// ======================================================
// RESET ENTRY
// ======================================================

function resetSessionEntry() {

    processing =
        false;


    sessionAccess.classList.remove(
        "processing",
        "success",
        "denied"
    );


    sessionStatus.textContent =
        "ENTER INSTRUCTOR CODE";


    sessionSubStatus.textContent =
        "USE THE SESSION KEY PROVIDED BY YOUR INSTRUCTOR";


    sessionCodeInput.disabled =
        false;


    confirmButton.disabled =
        false;


    sessionCodeInput.value =
        "";


    sessionCodeInput.focus();
}


// ======================================================
// COURSE TRANSITION
// ======================================================

function beginCourseTransition() {

    if (
        transitionStarted
    ) {

        return;
    }


    transitionStarted =
        true;


    sessionAccess.style.opacity =
        "0";


    sessionAccess.style.pointerEvents =
        "none";


    transitionRing.classList.add(
        "active"
    );


    requestAnimationFrame(
        () => {

            courseScreen.classList.add(
                "open"
            );

        }
    );


    setTimeout(
        () => {

            sweepSpeedMultiplier =
                1;

        },
        1300
    );
}


// ======================================================
// EVENTS
// ======================================================

// Touch uz sākuma screen.
radarScreen.addEventListener(
    "pointerdown",
    () => {

        showSessionAccess();
    }
);


// Confirm button.
confirmButton.addEventListener(
    "click",
    event => {

        // Neļaujam pointer eventam darīt neko papildus.
        event.stopPropagation();

        processSessionCode();
    }
);


// Input click nepārslēdz screen state.
sessionCodeInput.addEventListener(
    "pointerdown",
    event => {

        event.stopPropagation();
    }
);


// Keyboard Enter / Android Go.
sessionCodeInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            event.preventDefault();

            processSessionCode();
        }
    }
);


// Uppercase.
sessionCodeInput.addEventListener(
    "input",
    () => {

        sessionCodeInput.value =
            sessionCodeInput.value
                .toUpperCase();
    }
);


// Reset prototype.
resetDemoButton.addEventListener(
    "click",
    () => {

        window.location.reload();
    }
);


// ======================================================
// DRAW RADAR
// ======================================================

function drawRadar() {

    const layout =
        getRadarLayout();


    const {
        centerX,
        centerY,
        radius
    } = layout;


    // --------------------------------------------------
    // OUTER RING
    // --------------------------------------------------

    ctx.beginPath();


    ctx.arc(
        centerX,
        centerY,
        radius,
        0,
        Math.PI * 2
    );


    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.35)";


    ctx.lineWidth =
        2;


    ctx.stroke();


    // --------------------------------------------------
    // INNER RINGS
    // --------------------------------------------------

    const ringCount =
        4;


    for (
        let i = 1;
        i <= ringCount;
        i++
    ) {

        const ringRadius =

            radius *

            (
                i /
                ringCount
            );


        ctx.beginPath();


        ctx.arc(
            centerX,
            centerY,
            ringRadius,
            0,
            Math.PI * 2
        );


        ctx.strokeStyle =
            "rgba(77, 220, 200, 0.12)";


        ctx.lineWidth =
            1;


        ctx.stroke();
    }


    // --------------------------------------------------
    // HORIZONTAL
    // --------------------------------------------------

    ctx.beginPath();


    ctx.moveTo(
        centerX -
        radius,
        centerY
    );


    ctx.lineTo(
        centerX +
        radius,
        centerY
    );


    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.12)";


    ctx.stroke();


    // --------------------------------------------------
    // VERTICAL
    // --------------------------------------------------

    ctx.beginPath();


    ctx.moveTo(
        centerX,
        centerY -
        radius
    );


    ctx.lineTo(
        centerX,
        centerY +
        radius
    );


    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.12)";


    ctx.stroke();


    // --------------------------------------------------
    // SWEEP SECTOR
    // --------------------------------------------------

    ctx.save();


    ctx.beginPath();


    ctx.moveTo(
        centerX,
        centerY
    );


    ctx.arc(
        centerX,
        centerY,
        radius,
        sweepAngle -
        0.40,
        sweepAngle,
        false
    );


    ctx.closePath();


    const sectorGradient =
        ctx.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            radius
        );


    sectorGradient.addColorStop(
        0,
        "rgba(100, 255, 230, 0.22)"
    );


    sectorGradient.addColorStop(
        0.65,
        "rgba(100, 255, 230, 0.08)"
    );


    sectorGradient.addColorStop(
        1,
        "rgba(100, 255, 230, 0.015)"
    );


    ctx.fillStyle =
        sectorGradient;


    ctx.fill();


    ctx.restore();


    // --------------------------------------------------
    // DOTTED LOGO
    // --------------------------------------------------

    drawDotLogo();


    // --------------------------------------------------
    // TRAIL
    // --------------------------------------------------

    const trailLines =
        75;


    for (
        let i = 0;
        i < trailLines;
        i++
    ) {

        const offset =
            i *
            0.006;


        const angle =
            sweepAngle -
            offset;


        const alpha =

            (
                1 -
                i /
                trailLines
            ) *

            0.055;


        const endX =

            centerX +

            Math.cos(
                angle
            ) *

            radius;


        const endY =

            centerY +

            Math.sin(
                angle
            ) *

            radius;


        ctx.beginPath();


        ctx.moveTo(
            centerX,
            centerY
        );


        ctx.lineTo(
            endX,
            endY
        );


        ctx.strokeStyle =
            `rgba(
                85,
                255,
                220,
                ${alpha}
            )`;


        ctx.lineWidth =
            2;


        ctx.stroke();
    }


    // --------------------------------------------------
    // MAIN NEEDLE
    // --------------------------------------------------

    const sweepX =

        centerX +

        Math.cos(
            sweepAngle
        ) *

        radius;


    const sweepY =

        centerY +

        Math.sin(
            sweepAngle
        ) *

        radius;


    const sweepGradient =
        ctx.createLinearGradient(
            centerX,
            centerY,
            sweepX,
            sweepY
        );


    sweepGradient.addColorStop(
        0,
        "rgba(110, 255, 230, 0.18)"
    );


    sweepGradient.addColorStop(
        1,
        "rgba(110, 255, 230, 1)"
    );


    ctx.beginPath();


    ctx.moveTo(
        centerX,
        centerY
    );


    ctx.lineTo(
        sweepX,
        sweepY
    );


    ctx.strokeStyle =
        sweepGradient;


    ctx.lineWidth =
        3;


    ctx.stroke();


    // --------------------------------------------------
    // CENTER
    // --------------------------------------------------

    ctx.beginPath();


    ctx.arc(
        centerX,
        centerY,
        5,
        0,
        Math.PI * 2
    );


    ctx.fillStyle =
        "rgba(130, 255, 235, 1)";


    ctx.fill();
}


// ======================================================
// MAIN ANIMATION
// ======================================================

function animate(currentTime) {

    if (!previousTime) {

        previousTime =
            currentTime;
    }


    const deltaTime =

        (
            currentTime -
            previousTime
        ) /

        1000;


    previousTime =
        currentTime;


    sweepAngle +=

        normalSweepSpeed *

        sweepSpeedMultiplier *

        deltaTime;


    if (
        sweepAngle >
        Math.PI *
        2
    ) {

        sweepAngle -=
            Math.PI *
            2;
    }


    updateLogoScan(
        currentTime,
        deltaTime
    );


    ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );


    drawRadar();


    requestAnimationFrame(
        animate
    );
}


// ======================================================
// LOAD
// ======================================================

logo.onload =
    function () {

        buildLogoScanData();
    };


// ======================================================
// START
// ======================================================

resizeCanvas();

requestAnimationFrame(
    animate
);