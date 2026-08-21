// ======================================================
// CANVAS
// ======================================================

const canvas = document.getElementById("radarCanvas");
const ctx = canvas.getContext("2d");


// ======================================================
// ATTĒLI
// ======================================================

// Augšējais attēls / logo.
const topImage = new Image();
topImage.src = "./assets/logo_navy.png";

// Apakšējais attēls.
// Ja fails saucas citādi, nomaini tikai šo rindu.
const bottomImage = new Image();
bottomImage.src = "./assets/logo_navy.png";


// ======================================================
// RADARA IESTATĪJUMI
// ======================================================

// Needle sākuma leņķis.
let sweepAngle = 0;

// Needle kustības ātrums.
let sweepSpeed = 1.22;

// Iepriekšējā frame laiks.
let previousTime = 0;


// ======================================================
// AUGŠĒJĀ OBJEKTA POZĪCIJA
// ======================================================

// -PI / 2 = 12 o'clock.
const topTargetAngle = -Math.PI / 2;

// Attālums no centra.
const topDistanceFactor = 0.58;

// Maksimālais izmērs.
const topMaxWidth = 650;

// Izmērs pret browser platumu.
const topWidthFactor = 0.28;


// ======================================================
// APAKŠĒJĀ OBJEKTA POZĪCIJA
// ======================================================

// PI / 2 = 6 o'clock.
const bottomTargetAngle = Math.PI / 2;

// Cik tālu uz leju no centra.
const bottomDistanceFactor = 0.50;

// Izmērs pret radara radius.
const bottomSizeFactor = 1.5;

// Maksimālais platums.
const bottomMaxWidth = 550;

// ======================================================
// DOT PARAMETRI
// ======================================================
//
// ŠIE PARAMETRI ATTIECAS UZ ABIEM OBJEKTIEM.
//
// Tātad augšējais un apakšējais izskatīsies vienādi.

const dotSpacing = 5;

const dotMinRadius = 1.15;
const dotMaxRadius = 2.05;

const dotJitter = 1.25;

// Transparent pixel threshold.
const dotAlphaThreshold = 45;


// ======================================================
// DOT KRĀSA
// ======================================================

const dotRed = 105;
const dotGreen = 255;
const dotBlue = 225;


// ======================================================
// SCAN PARAMETRI
// ======================================================

// Neliela rezerve pirms/pēc objekta.
const scanPadding = 0.008;

// Mīksta pāreja tieši pie needle.
const revealFeather = 0.012;

// Cik ilgi objekts paliek pilnībā redzams pēc scan.
const objectHoldTime = 900;

// Fade ātrums.
const objectFadeSpeed = 0.52;


// ======================================================
// OBJEKTU DATI
// ======================================================

// Šeit pēc image load būs visi dot dati.
let topData = null;
let bottomData = null;


// ======================================================
// AUGŠĒJĀ OBJEKTA ANIMĀCIJAS STĀVOKLIS
// ======================================================

const topState = {

    // idle
    // scanning
    // holding
    // fading
    mode: "idle",

    opacity: 0,

    revealProgress: 0,

    holdUntil: 0,

    wasScanningLastFrame: false
};


// ======================================================
// APAKŠĒJĀ OBJEKTA ANIMĀCIJAS STĀVOKLIS
// ======================================================

const bottomState = {

    mode: "idle",

    opacity: 0,

    revealProgress: 0,

    holdUntil: 0,

    wasScanningLastFrame: false
};


// ======================================================
// CANVAS RESIZE
// ======================================================

function resizeCanvas() {

    const dpr =
        window.devicePixelRatio || 1;


    canvas.width =
        window.innerWidth * dpr;

    canvas.height =
        window.innerHeight * dpr;


    canvas.style.width =
        `${window.innerWidth}px`;

    canvas.style.height =
        `${window.innerHeight}px`;


    // Ļauj mums turpināt izmantot normālus CSS pikseļus.
    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    // Pēc resize pārrēķinām abus objektus.
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


    // Reset abu objektu animāciju.
    resetState(topState);
    resetState(bottomState);
}


window.addEventListener(
    "resize",
    resizeCanvas
);


// ======================================================
// STATE RESET
// ======================================================

function resetState(state) {

    state.mode = "idle";

    state.opacity = 0;

    state.revealProgress = 0;

    state.holdUntil = 0;

    state.wasScanningLastFrame = false;
}


// ======================================================
// LEŅĶU PALĪGFUNKCIJAS
// ======================================================

function normalizeAngle(angle) {

    const fullCircle =
        Math.PI * 2;


    return (
        (angle % fullCircle) +
        fullCircle
    ) % fullCircle;
}


function signedAngleDifference(
    angle,
    reference
) {

    return Math.atan2(

        Math.sin(
            angle - reference
        ),

        Math.cos(
            angle - reference
        )
    );
}


function angularDistanceCW(
    fromAngle,
    toAngle
) {

    return normalizeAngle(
        toAngle - fromAngle
    );
}


// ======================================================
// STABILS RANDOM
// ======================================================
//
// Random izmantojam tikai punktu izskatam.
//
// Tas vienmēr dod vienu un to pašu rezultātu
// konkrētajam x/y, tāpēc punkti nevibrēs.

function pseudoRandom(
    x,
    y,
    seed = 0
) {

    const value =
        Math.sin(
            x * 12.9898 +
            y * 78.233 +
            seed * 37.719
        ) *
        43758.5453;


    return value -
        Math.floor(value);
}


// ======================================================
// RADARA PAMATA LAYOUT
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
// AUGŠĒJĀ ATTĒLA BOX
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
// APAKŠĒJĀ ATTĒLA BOX
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
// UNIVERSĀLA DOT TARGET IZVEIDOŠANA
// ======================================================
//
// Šī funkcija strādā GAN top, GAN bottom.
//
// Image -> invisible canvas -> alpha detection -> dots.
//
// Katram dot tiek arī aprēķināts leņķis,
// lai needle varētu to atklāt precīzi savā laikā.

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
    // IMAGE -> OFFSCREEN CANVAS
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
                willReadFrequently: true
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
    // ATRODAM REĀLO LEŅĶA ROBEŽU
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
                    dataIndex + 3
                ];


            // Transparent pixel.
            if (
                alpha < 5
            ) {

                continue;
            }


            // Pārvēršam local image pixel
            // par reālo browser koordināti.
            const screenX =
                box.x +
                (
                    (x + 0.5) /
                    pixelWidth
                ) *
                box.width;


            const screenY =
                box.y +
                (
                    (y + 0.5) /
                    pixelHeight
                ) *
                box.height;


            // Leņķis no radara centra uz pixel.
            const pixelAngle =
                Math.atan2(

                    screenY -
                    radar.centerY,

                    screenX -
                    radar.centerX
                );


            // Nobīde no objekta centrālā leņķa.
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
    // VEIDOJAM DOTS
    // --------------------------------------------------

    const dots = [];


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

            // Stable random jitter.
            const randomX =
                pseudoRandom(

                    gridX,
                    gridY,

                    seedOffset + 1
                );


            const randomY =
                pseudoRandom(

                    gridX,
                    gridY,

                    seedOffset + 2
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
                    dataIndex + 3
                ];


            // Punkts nav uz attēla formas.
            if (
                alpha <
                dotAlphaThreshold
            ) {

                continue;
            }


            // --------------------------------------------------
            // DOT POZĪCIJA
            // --------------------------------------------------

            const screenX =
                box.x +
                (
                    (x + 0.5) /
                    pixelWidth
                ) *
                box.width;


            const screenY =
                box.y +
                (
                    (y + 0.5) /
                    pixelHeight
                ) *
                box.height;


            // --------------------------------------------------
            // DOT LEŅĶIS
            // --------------------------------------------------

            const dotAngle =
                Math.atan2(

                    screenY -
                    radar.centerY,

                    screenX -
                    radar.centerX
                );


            // Cik tālu needle jāaiziet
            // no scan start līdz šim dot.
            const revealProgress =
                angularDistanceCW(

                    scanStartAngle,

                    dotAngle
                );


            // --------------------------------------------------
            // DOT IZSKATS
            // --------------------------------------------------

            const sizeRandom =
                pseudoRandom(

                    x,
                    y,

                    seedOffset + 3
                );


            const brightnessRandom =
                pseudoRandom(

                    x,
                    y,

                    seedOffset + 4
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
// BUILD TOP
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


// ======================================================
// BUILD BOTTOM
// ======================================================

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
// UNIVERSĀLA TARGET ANIMĀCIJA
// ======================================================
//
// Šī pati funkcija kontrolē gan top, gan bottom.
//
// Tātad abi uzvedas IDENTISKI.

function updateTarget(
    targetData,
    state,
    currentTime,
    deltaTime
) {

    if (!targetData) {

        return;
    }


    // Cik tālu needle atrodas
    // no konkrētā target scan sākuma.
    const sweepProgress =
        angularDistanceCW(

            targetData.scanStartAngle,

            sweepAngle
        );


    // Vai needle pašlaik atrodas
    // objekta scan zonā.
    const isScanning =
        sweepProgress <=
        targetData.totalScanSpan;


    // --------------------------------------------------
    // SCANNING
    // --------------------------------------------------

    if (isScanning) {

        // Tikko needle pieskārās objektam.
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


        // Needle kustība tieši kontrolē reveal.
        state.revealProgress =
            Math.min(

                sweepProgress,

                targetData.totalScanSpan
            );
    }


    // --------------------------------------------------
    // NEEDLE IZGĀJA CAURI OBJEKTAM
    // --------------------------------------------------

    else {

        if (
            state.wasScanningLastFrame &&
            state.mode ===
            "scanning"
        ) {

            // Atklājam pēdējos punktus.
            state.revealProgress =
                targetData.totalScanSpan;


            // Hold.
            state.mode =
                "holding";


            state.opacity =
                1;


            state.holdUntil =
                currentTime +
                objectHoldTime;
        }


        // --------------------------------------------------
        // HOLD -> FADE
        // --------------------------------------------------

        if (
            state.mode ===
            "holding" &&
            currentTime >
            state.holdUntil
        ) {

            state.mode =
                "fading";
        }


        // --------------------------------------------------
        // FADE
        // --------------------------------------------------

        if (
            state.mode ===
            "fading"
        ) {

            state.opacity -=

                objectFadeSpeed *
                deltaTime;


            if (
                state.opacity <= 0
            ) {

                state.opacity =
                    0;


                state.mode =
                    "idle";


                state.revealProgress =
                    0;
            }
        }
    }


    state.wasScanningLastFrame =
        isScanning;
}


// ======================================================
// UNIVERSĀLA DOT TARGET ZĪMĒŠANA
// ======================================================
//
// Arī šī pati funkcija zīmē gan top, gan bottom.

function drawDotTarget(
    targetData,
    state
) {

    if (
        !targetData ||
        state.mode === "idle" ||
        state.opacity <= 0
    ) {

        return;
    }


    ctx.save();


    // Glow.
    ctx.shadowColor =
        "rgba(100, 255, 225, 0.55)";


    ctx.shadowBlur =
        6;


    // --------------------------------------------------
    // VISI TARGET PUNKTI
    // --------------------------------------------------

    for (
        const dot of
        targetData.dots
    ) {

        // Cik tālu needle jau ir
        // aiz konkrētā punkta.
        const distanceBehindNeedle =

            state.revealProgress -
            dot.revealProgress;


        let visibility =
            0;


        // Needle jau ticis pāri.
        if (
            distanceBehindNeedle >=
            revealFeather
        ) {

            visibility =
                1;
        }


        // Punkts ir tieši pie needle.
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


        // Needle vēl nav ticis līdz dot.
        else {

            visibility =
                0;
        }


        if (
            visibility <= 0
        ) {

            continue;
        }


        // Gala alpha.
        const alpha =

            visibility *

            dot.brightness *

            state.opacity;


        // --------------------------------------------------
        // DOT
        // --------------------------------------------------

        ctx.beginPath();


        ctx.arc(

            dot.x,

            dot.y,

            dot.radius,

            0,

            Math.PI * 2
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
// RADARA ZĪMĒŠANA
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
    // HORIZONTĀLĀ LĪNIJA
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
    // VERTIKĀLĀ LĪNIJA
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
    // SWEEP GLOW
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


    // ==================================================
    // ABI DOT OBJEKTI
    // ==================================================
    //
    // Abi tiek zīmēti PIRMS needle.
    //
    // Tāpēc needle vizuāli iet viņiem pāri.

    ctx.save();

    // Drošībai clip uz radara apli.
    ctx.beginPath();

    ctx.arc(

        centerX,
        centerY,

        radius - 2,

        0,

        Math.PI * 2
    );

    ctx.clip();


    // Augšējais.
    drawDotTarget(
        topData,
        topState
    );


    // Apakšējais.
    drawDotTarget(
        bottomData,
        bottomState
    );


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

            Math.cos(angle) *
            radius;


        const endY =

            centerY +

            Math.sin(angle) *
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
    // GALVENĀ NEEDLE
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

        Math.PI * 2
    );


    ctx.fillStyle =
        "rgba(130, 255, 235, 1)";


    ctx.fill();
}


// ======================================================
// GALVENĀ ANIMĀCIJA
// ======================================================

function animate(currentTime) {

    // Pirmais frame.
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
    // ROTĒJAM NEEDLE
    // --------------------------------------------------

    sweepAngle +=

        sweepSpeed *
        deltaTime;


    if (
        sweepAngle >
        Math.PI * 2
    ) {

        sweepAngle -=
            Math.PI * 2;
    }


    // ==================================================
    // AUGŠĒJAIS TARGET
    // ==================================================

    updateTarget(

        topData,

        topState,

        currentTime,

        deltaTime
    );


    // ==================================================
    // APAKŠĒJAIS TARGET
    // ==================================================

    updateTarget(

        bottomData,

        bottomState,

        currentTime,

        deltaTime
    );


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