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
// UI ELEMENTI
// ======================================================

const sessionPanel =
    document.getElementById(
        "sessionPanel"
    );

const sessionCodeInput =
    document.getElementById(
        "sessionCodeInput"
    );

const enterButton =
    document.getElementById(
        "enterButton"
    );

const sessionStatus =
    document.getElementById(
        "sessionStatus"
    );

const sessionStatusSub =
    document.getElementById(
        "sessionStatusSub"
    );

const transitionRing =
    document.getElementById(
        "transitionRing"
    );

const courseScreen =
    document.getElementById(
        "courseScreen"
    );

const activeSessionBadge =
    document.getElementById(
        "activeSessionBadge"
    );

const resetDemoButton =
    document.getElementById(
        "resetDemoButton"
    );


// ======================================================
// DEMO SESSION
// ======================================================

// Šis pagaidām ir mūsu fake instructor code.
//
// Vēlāk šeit nebūs hard-coded vērtība.
// Android/native/backend noteiks, vai session ir derīga.
const DEMO_SESSION_CODE =
    "482731";


// ======================================================
// ATTĒLI
// ======================================================

// Augšējais NOVIKONTAS logo.
const topImage =
    new Image();

topImage.src =
    "./assets/logo_navy.png";


// Apakšējais attēls.
const bottomImage =
    new Image();

bottomImage.src =
    "./assets/logo_navy.png";


// ======================================================
// RADARA IESTATĪJUMI
// ======================================================

let sweepAngle =
    0;


// Normālais ātrums.
const normalSweepSpeed =
    1.22;


// Processing laikā
// needle nedaudz paātrinās.
let sweepSpeedMultiplier =
    1;


// Iepriekšējā frame laiks.
let previousTime =
    0;


// ======================================================
// AUGŠĒJAIS TARGET
// ======================================================

// 12 o'clock.
const topTargetAngle =
    -Math.PI / 2;


const topDistanceFactor =
    0.58;


const topMaxWidth =
    300;


const topWidthFactor =
    0.28;


// ======================================================
// APAKŠĒJAIS TARGET
// ======================================================

// 6 o'clock.
const bottomTargetAngle =
    Math.PI / 2;


// Regulē atrašanās vietu.
const bottomDistanceFactor =
    0.50;


// Regulē izmēru.
const bottomSizeFactor =
    1.05;


const bottomMaxWidth =
    420;


// ======================================================
// DOT PARAMETRI
// ======================================================
//
// Abi objekti izmanto vienu stilu.

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


// ======================================================
// DOT KRĀSA
// ======================================================

const dotRed =
    105;


const dotGreen =
    255;


const dotBlue =
    225;


// ======================================================
// SCAN PARAMETRI
// ======================================================

const scanPadding =
    0.008;


const revealFeather =
    0.012;


// Cik ilgi pilns objekts
// paliek redzams.
const objectHoldTime =
    900;


// Fade ātrums.
const objectFadeSpeed =
    0.52;


// ======================================================
// SAGATAVOTIE TARGET DATI
// ======================================================

let topData =
    null;


let bottomData =
    null;


// ======================================================
// TARGET STATE FACTORY
// ======================================================

function createTargetState() {

    return {

        mode:
            "idle",

        opacity:
            0,

        revealProgress:
            0,

        holdUntil:
            0,

        wasScanningLastFrame:
            false,

        completedOnce:
            false
    };
}


const topState =
    createTargetState();


const bottomState =
    createTargetState();


// ======================================================
// SESSION UI STATE
// ======================================================

// Vai session panelis jau ir parādīts.
let sessionPanelShown =
    false;


// Kad panelis parādās,
// bottom target vairs neatkārtojas.
let bottomTargetEnabled =
    true;


// Vai šobrīd apstrādājam kodu.
let processingSession =
    false;


// Vai sākusies pāreja uz course.
let courseTransitionStarted =
    false;


// ======================================================
// CANVAS RESIZE
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


    // Pārrēķinām target dot punktus.
    if (
        topImage.complete &&
        topImage.naturalWidth
    ) {

        buildTopData();
    }


    if (
        bottomImage.complete &&
        bottomImage.naturalWidth
    ) {

        buildBottomData();
    }
}


window.addEventListener(
    "resize",
    resizeCanvas
);


// ======================================================
// LEŅĶI
// ======================================================

function normalizeAngle(
    angle
) {

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
// STABILS RANDOM
// ======================================================
//
// Punktu random pozīcijas ir stabilas,
// tāpēc tie nevibrē katru frame.

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
// RADARA LAYOUT
// ======================================================

function getRadarLayout() {

    const width =
        window.innerWidth;


    const height =
        window.innerHeight;


    const centerX =
        width /
        2;


    const centerY =
        height /
        2;


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
// TOP BOX
// ======================================================

function getTopBox() {

    const layout =
        getRadarLayout();


    const width =
        Math.min(

            topMaxWidth,

            layout.width *
            topWidthFactor
        );


    const height =
        width *
        (
            topImage.naturalHeight /
            topImage.naturalWidth
        );


    const distance =
        layout.radius *
        topDistanceFactor;


    const centerX =
        layout.centerX +

        Math.cos(
            topTargetAngle
        ) *

        distance;


    const centerY =
        layout.centerY +

        Math.sin(
            topTargetAngle
        ) *

        distance;


    return {

        x:
            centerX -
            width / 2,

        y:
            centerY -
            height / 2,

        width,
        height,

        targetAngle:
            topTargetAngle
    };
}


// ======================================================
// BOTTOM BOX
// ======================================================

function getBottomBox() {

    const layout =
        getRadarLayout();


    const width =
        Math.min(

            bottomMaxWidth,

            layout.radius *
            bottomSizeFactor
        );


    const height =
        width *
        (
            bottomImage.naturalHeight /
            bottomImage.naturalWidth
        );


    const distance =
        layout.radius *
        bottomDistanceFactor;


    const centerX =
        layout.centerX +

        Math.cos(
            bottomTargetAngle
        ) *

        distance;


    const centerY =
        layout.centerY +

        Math.sin(
            bottomTargetAngle
        ) *

        distance;


    return {

        x:
            centerX -
            width / 2,

        y:
            centerY -
            height / 2,

        width,
        height,

        targetAngle:
            bottomTargetAngle
    };
}


// ======================================================
// UNIVERSĀLA DOT TARGET IZVEIDE
// ======================================================

function buildDotTarget(
    image,
    box,
    seedOffset
) {

    const radar =
        getRadarLayout();


    const pixelWidth =
        Math.max(

            1,

            Math.round(
                box.width
            )
        );


    const pixelHeight =
        Math.max(

            1,

            Math.round(
                box.height
            )
        );


    // --------------------------------------------------
    // OFFSCREEN CANVAS
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

        image,

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
    // ATRODAM REĀLO ATTĒLA LEŅĶA ROBEŽU
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

                box.x +

                (
                    (
                        x +
                        0.5
                    ) /
                    pixelWidth
                ) *

                box.width;


            const screenY =

                box.y +

                (
                    (
                        y +
                        0.5
                    ) /
                    pixelHeight
                ) *

                box.height;


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

                    box.targetAngle
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


    // --------------------------------------------------
    // SCAN START / END
    // --------------------------------------------------

    const scanStartAngle =

        box.targetAngle +

        minOffset -

        scanPadding;


    const scanEndAngle =

        box.targetAngle +

        maxOffset +

        scanPadding;


    const totalScanSpan =
        angularDistanceCW(

            scanStartAngle,

            scanEndAngle
        );


    // --------------------------------------------------
    // DOTS
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

                    seedOffset +
                    1
                );


            const randomY =
                pseudoRandom(

                    gridX,
                    gridY,

                    seedOffset +
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

                box.x +

                (
                    (
                        x +
                        0.5
                    ) /
                    pixelWidth
                ) *

                box.width;


            const screenY =

                box.y +

                (
                    (
                        y +
                        0.5
                    ) /
                    pixelHeight
                ) *

                box.height;


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

                    seedOffset +
                    3
                );


            const brightnessRandom =
                pseudoRandom(

                    x,
                    y,

                    seedOffset +
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


    return {

        dots,

        scanStartAngle,

        scanEndAngle,

        totalScanSpan
    };
}


// ======================================================
// BUILD TARGETS
// ======================================================

function buildTopData() {

    if (
        !topImage.complete ||
        !topImage.naturalWidth
    ) {

        return;
    }


    topData =
        buildDotTarget(

            topImage,

            getTopBox(),

            10
        );
}


function buildBottomData() {

    if (
        !bottomImage.complete ||
        !bottomImage.naturalWidth
    ) {

        return;
    }


    bottomData =
        buildDotTarget(

            bottomImage,

            getBottomBox(),

            30
        );
}


// ======================================================
// TARGET UPDATE
// ======================================================

function updateTarget(
    targetData,
    state,
    currentTime,
    deltaTime
) {

    if (!targetData) {

        return;
    }


    const sweepProgress =
        angularDistanceCW(

            targetData.scanStartAngle,

            sweepAngle
        );


    const isScanning =

        sweepProgress <=

        targetData.totalScanSpan;


    // --------------------------------------------------
    // SCANNING
    // --------------------------------------------------

    if (isScanning) {

        if (
            !state.wasScanningLastFrame
        ) {

            state.mode =
                "scanning";


            state.opacity =
                1;


            state.revealProgress =
                0;
        }


        state.revealProgress =
            Math.min(

                sweepProgress,

                targetData.totalScanSpan
            );
    }


    // --------------------------------------------------
    // AFTER SCAN
    // --------------------------------------------------

    else {

        if (
            state.wasScanningLastFrame &&
            state.mode ===
            "scanning"
        ) {

            state.revealProgress =
                targetData.totalScanSpan;


            state.mode =
                "holding";


            state.opacity =
                1;


            state.holdUntil =
                currentTime +
                objectHoldTime;
        }


        if (
            state.mode ===
            "holding" &&
            currentTime >
            state.holdUntil
        ) {

            state.mode =
                "fading";
        }


        if (
            state.mode ===
            "fading"
        ) {

            state.opacity -=

                objectFadeSpeed *
                deltaTime;


            if (
                state.opacity <=
                0
            ) {

                state.opacity =
                    0;


                state.mode =
                    "idle";


                state.revealProgress =
                    0;


                // Svarīgi session panel loģikai.
                state.completedOnce =
                    true;
            }
        }
    }


    state.wasScanningLastFrame =
        isScanning;
}


// ======================================================
// TARGET DRAW
// ======================================================

function drawDotTarget(
    targetData,
    state
) {

    if (
        !targetData ||
        state.mode ===
        "idle" ||
        state.opacity <=
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
        targetData.dots
    ) {

        const distanceBehindNeedle =

            state.revealProgress -

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

            state.opacity;


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
// SESSION PANEL
// ======================================================

function showSessionPanel() {

    if (
        sessionPanelShown
    ) {

        return;
    }


    sessionPanelShown =
        true;


    // Bottom logo vairs neatkārtojas.
    bottomTargetEnabled =
        false;


    sessionPanel.classList.add(
        "visible"
    );


    // Input vēl nefokusējam automātiski,
    // lai Android keyboard pats neuzlec.
}


// ======================================================
// RESET SESSION PANEL
// ======================================================

function resetSessionPanel() {

    processingSession =
        false;


    sweepSpeedMultiplier =
        1;


    sessionPanel.classList.remove(
        "processing",
        "success",
        "denied"
    );


    sessionStatus.textContent =
        "ENTER SESSION CODE";


    sessionStatusSub.textContent =
        "INSTRUCTOR ACCESS KEY REQUIRED";


    sessionCodeInput.disabled =
        false;


    enterButton.disabled =
        false;


    sessionCodeInput.value =
        "";


    sessionCodeInput.focus();
}


// ======================================================
// PROCESS SESSION CODE
// ======================================================

function processSessionCode() {

    if (
        processingSession ||
        courseTransitionStarted
    ) {

        return;
    }


    const enteredCode =
        sessionCodeInput.value
            .trim()
            .toUpperCase();


    // Nekas nav ievadīts.
    if (!enteredCode) {

        sessionPanel.classList.add(
            "denied"
        );


        sessionStatus.textContent =
            "CODE REQUIRED";


        sessionStatusSub.textContent =
            "ENTER THE INSTRUCTOR SESSION KEY";


        setTimeout(
            () => {

                sessionPanel.classList.remove(
                    "denied"
                );


                sessionStatus.textContent =
                    "ENTER SESSION CODE";


                sessionStatusSub.textContent =
                    "INSTRUCTOR ACCESS KEY REQUIRED";

            },
            900
        );


        return;
    }


    processingSession =
        true;


    // Nedaudz paātrinām radar sweep.
    sweepSpeedMultiplier =
        1.28;


    sessionCodeInput.disabled =
        true;


    enterButton.disabled =
        true;


    sessionPanel.classList.add(
        "processing"
    );


    sessionStatus.textContent =
        "PROCESSING SESSION CODE";


    sessionStatusSub.textContent =
        "VALIDATING ACCESS KEY";


    // --------------------------------------------------
    // 1.2 SEK
    // --------------------------------------------------

    setTimeout(
        () => {

            if (
                enteredCode ===
                DEMO_SESSION_CODE
            ) {

                sessionStatus.textContent =
                    "CODE VERIFIED";


                sessionStatusSub.textContent =
                    "SESSION IDENTIFIED";
            }

            else {

                sessionStatus.textContent =
                    "ACCESS KEY NOT RECOGNISED";


                sessionStatusSub.textContent =
                    "SESSION VALIDATION FAILED";
            }

        },
        1200
    );


    // --------------------------------------------------
    // 2 SEK
    // --------------------------------------------------

    setTimeout(
        () => {

            if (
                enteredCode ===
                DEMO_SESSION_CODE
            ) {

                sessionPanel.classList.remove(
                    "processing"
                );


                sessionPanel.classList.add(
                    "success"
                );


                sessionStatus.textContent =
                    "ACCESS GRANTED";


                sessionStatusSub.textContent =
                    "TRAINING SESSION READY";


                // Īss needle boost pirms transition.
                sweepSpeedMultiplier =
                    1.5;


                // Parādām session kodu fake course page.
                activeSessionBadge.textContent =
                    `SESSION ${enteredCode}`;


                // Nedaudz vēlāk sākam page transition.
                setTimeout(
                    () => {

                        beginCourseTransition();

                    },
                    650
                );
            }

            else {

                // --------------------------------------------------
                // ACCESS DENIED
                // --------------------------------------------------

                sessionPanel.classList.remove(
                    "processing"
                );


                sessionPanel.classList.add(
                    "denied"
                );


                sessionStatus.textContent =
                    "ACCESS DENIED";


                sessionStatusSub.textContent =
                    "CHECK SESSION CODE";


                sweepSpeedMultiplier =
                    1;


                // Pēc brīža dodam vēl vienu mēģinājumu.
                setTimeout(
                    () => {

                        resetSessionPanel();

                    },
                    1400
                );
            }

        },
        2000
    );
}


// ======================================================
// COURSE TRANSITION
// ======================================================

function beginCourseTransition() {

    if (
        courseTransitionStarted
    ) {

        return;
    }


    courseTransitionStarted =
        true;


    // Circular ring no radara centra.
    transitionRing.classList.add(
        "active"
    );


    // Atveram course screen ar circle clip-path.
    courseScreen.classList.add(
        "open"
    );


    // Session panelis mazliet izdziest.
    sessionPanel.style.opacity =
        "0";


    sessionPanel.style.pointerEvents =
        "none";


    // Kad transition pabeigts,
    // atgriežam normālu sweep ātrumu.
    setTimeout(
        () => {

            sweepSpeedMultiplier =
                1;

        },
        1300
    );
}


// ======================================================
// UI EVENTI
// ======================================================

// Enter button.
enterButton.addEventListener(
    "click",
    processSessionCode
);


// Keyboard Enter.
sessionCodeInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "Enter"
        ) {

            processSessionCode();
        }
    }
);


// Automātiski lielie burti.
sessionCodeInput.addEventListener(
    "input",
    () => {

        sessionCodeInput.value =
            sessionCodeInput.value
                .toUpperCase();
    }
);


// Demo reset.
resetDemoButton.addEventListener(
    "click",
    () => {

        // Eksperimentam vienkāršākais restart.
        window.location.reload();
    }
);


// ======================================================
// RADARA DRAW
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
    // ĀRĒJAIS APLIS
    // --------------------------------------------------

    ctx.beginPath();


    ctx.arc(

        centerX,
        centerY,

        radius,

        0,

        Math.PI *
        2
    );


    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.35)";


    ctx.lineWidth =
        2;


    ctx.stroke();


    // --------------------------------------------------
    // IEKŠĒJIE APĻI
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

            Math.PI *
            2
        );


        ctx.strokeStyle =
            "rgba(77, 220, 200, 0.12)";


        ctx.lineWidth =
            1;


        ctx.stroke();
    }


    // --------------------------------------------------
    // KRUSTA LĪNIJAS
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
    // SWEEP GLOW SEKTORS
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
    // DOT TARGETS
    // --------------------------------------------------

    ctx.save();


    // Neļaujam dot attēliem iziet ārpus radara.
    ctx.beginPath();


    ctx.arc(

        centerX,
        centerY,

        radius -
        2,

        0,

        Math.PI *
        2
    );


    ctx.clip();


    // Top turpina ciklot arī tad,
    // kad session panel ir redzams.
    drawDotTarget(
        topData,
        topState
    );


    // Bottom tikai pirms session panel.
    if (
        bottomTargetEnabled
    ) {

        drawDotTarget(
            bottomData,
            bottomState
        );
    }


    ctx.restore();


    // --------------------------------------------------
    // NEEDLE TRAIL
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
    // NEEDLE
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
    // CENTRA PUNKTS
    // --------------------------------------------------

    ctx.beginPath();


    ctx.arc(

        centerX,
        centerY,

        5,

        0,

        Math.PI *
        2
    );


    ctx.fillStyle =
        "rgba(130, 255, 235, 1)";


    ctx.fill();
}


// ======================================================
// MAIN ANIMATION
// ======================================================

function animate(
    currentTime
) {

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


    // --------------------------------------------------
    // NEEDLE KUSTĪBA
    // --------------------------------------------------

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


    // --------------------------------------------------
    // TOP TARGET
    // --------------------------------------------------

    updateTarget(

        topData,

        topState,

        currentTime,

        deltaTime
    );


    // --------------------------------------------------
    // BOTTOM TARGET
    // --------------------------------------------------

    if (
        bottomTargetEnabled
    ) {

        updateTarget(

            bottomData,

            bottomState,

            currentTime,

            deltaTime
        );


        // Kad bottom pirmo reizi:
        //
        // scan ->
        // full ->
        // fade ->
        // pazuda
        //
        // tad parādām SESSION ACCESS.
        if (
            bottomState.completedOnce &&
            !sessionPanelShown
        ) {

            showSessionPanel();
        }
    }


    // --------------------------------------------------
    // CLEAR
    // --------------------------------------------------

    ctx.clearRect(

        0,
        0,

        window.innerWidth,

        window.innerHeight
    );


    // --------------------------------------------------
    // DRAW
    // --------------------------------------------------

    drawRadar();


    requestAnimationFrame(
        animate
    );
}


// ======================================================
// IMAGE LOAD
// ======================================================

topImage.onload =
    function () {

        buildTopData();
    };


bottomImage.onload =
    function () {

        buildBottomData();
    };


// ======================================================
// START
// ======================================================

resizeCanvas();


requestAnimationFrame(
    animate
);