// ======================================================
// GALVENAIS CANVAS
// ======================================================

const canvas = document.getElementById("radarCanvas");
const ctx = canvas.getContext("2d");


// ======================================================
// LOGO
// ======================================================

// SVG paliek tikai kā avots, lai JavaScript saprastu,
// kur logo formā drīkst atrasties punkti.
const logo = new Image();

logo.src = "./assets/logo_navy.png";


// ======================================================
// RADARA IESTATĪJUMI
// ======================================================

// Needle pašreizējais leņķis.
let sweepAngle = 0;

// Needle ātrums.
let sweepSpeed = 1.22;

// Iepriekšējā frame laiks.
let previousTime = 0;


// ======================================================
// LOGO POZĪCIJA
// ======================================================

// 12 o'clock.
const targetAngle = -Math.PI / 2;

// Logo atrašanās vieta.
// Mazāks = tuvāk radara centram.
const targetDistanceFactor = 0.58;

// Maksimālais logo platums.
const maxLogoWidth = 600;

// Logo platums attiecībā pret ekrānu.
const logoWidthFactor = 0.28;


// ======================================================
// DOT LOGO IESTATĪJUMI
// ======================================================

// Aptuvenais attālums starp punktiem.
//
// 4 = daudz punktu
// 5 = vidēji blīvs
// 6 = retāks radar look
const dotSpacing = 5;

// Mazākā punkta radius.
const dotMinRadius = 1.15;

// Lielākā punkta radius.
const dotMaxRadius = 2.05;

// Cik stipri punkti var tikt nedaudz nobīdīti,
// lai viss neizskatītos pēc perfekta Excel grid.
const dotJitter = 1.25;

// Minimālais SVG alpha,
// lai konkrētajā vietā drīkstētu būt dots.
//
// Ja logo malas šķiet par plānu,
// samazini uz 30.
//
// Ja logo izskatās pārāk "netīrs",
// palielini uz 80.
const dotAlphaThreshold = 45;


// ======================================================
// DOT KRĀSA
// ======================================================

// Radar cyan/green tonis.
// Šobrīd neizmantojam oriģinālo zilo logo krāsu.
//
// Ja vēlāk gribi, varam izmantot arī NOVIKONTAS zilo.
const dotRed = 105;
const dotGreen = 255;
const dotBlue = 225;


// ======================================================
// REVEAL IESTATĪJUMI
// ======================================================

// Neliela rezerve pirms pirmā un pēc pēdējā logo punkta.
const scanPadding = 0.008;

// Ļoti maigs pārejas laukums tieši pie needle.
//
// Tas nozīmē, ka punkti tieši pie needle
// neieslēdzas brutāli ON/OFF.
const revealFeather = 0.012;


// ======================================================
// LOGO STĀVOKLIS
// ======================================================

// idle
// scanning
// holding
// fading
let logoState = "idle";

// Scan laikā = 1.
// Fade laikā samazinās.
let logoOpacity = 0;

// Līdz kuram laikam logo jāatstāj redzams.
let logoHoldUntil = 0;

// Iepriekšējā frame scan statuss.
let wasScanningLastFrame = false;

// Cik tālu needle jau ir noskenējis logo.
let currentRevealProgress = 0;


// ======================================================
// SAGATAVOTIE LOGO DATI
// ======================================================

// Te vēlāk būs:
// - logo ģeometrija
// - scan sākums/beigas
// - visi radara punkti
let scanData = null;


// ======================================================
// CANVAS RESIZE
// ======================================================

function resizeCanvas() {

    const dpr = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    // Ja logo jau ielādējies,
    // pēc resize pārrēķinām dot logo.
    if (
        logo.complete &&
        logo.naturalWidth
    ) {

        buildLogoScanData();
    }


    // Reset animācijas cikls.
    logoState = "idle";

    logoOpacity = 0;

    wasScanningLastFrame = false;

    currentRevealProgress = 0;
}


window.addEventListener(
    "resize",
    resizeCanvas
);


// ======================================================
// LEŅĶU FUNKCIJAS
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
// DETERMINISTIC RANDOM
// ======================================================

// Mums vajag nelielu random variāciju,
// BET nedrīkst katru frame ģenerēt citu random,
// citādi logo visu laiku vibrēs.
//
// Šī funkcija vieniem un tiem pašiem x/y
// vienmēr atgriezīs vienu un to pašu vērtību.
function pseudoRandom(x, y, seed = 0) {

    const value =
        Math.sin(
            x * 12.9898 +
            y * 78.233 +
            seed * 37.719
        ) * 43758.5453;

    return value - Math.floor(value);
}


// ======================================================
// IZKĀRTOJUMS
// ======================================================

function getLayout() {

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
        ) * 0.40;


    const logoWidth =
        Math.min(
            maxLogoWidth,
            width * logoWidthFactor
        );


    const logoHeight =
        logoWidth *
        (
            logo.naturalHeight /
            logo.naturalWidth
        );


    const targetDistance =
        radius *
        targetDistanceFactor;


    const targetX =
        centerX +
        Math.cos(targetAngle) *
        targetDistance;


    const targetY =
        centerY +
        Math.sin(targetAngle) *
        targetDistance;


    const logoX =
        targetX -
        logoWidth / 2;


    const logoY =
        targetY -
        logoHeight / 2;


    return {

        width,
        height,

        centerX,
        centerY,

        radius,

        targetX,
        targetY,

        logoX,
        logoY,

        logoWidth,
        logoHeight
    };
}


// ======================================================
// SAGATAVOJAM DOT LOGO
// ======================================================

function buildLogoScanData() {

    if (
        !logo.complete ||
        !logo.naturalWidth
    ) {

        return;
    }


    const layout =
        getLayout();


    // Offscreen logo izmērs.
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
    // UZZĪMĒJAM SVG NEREDZAMĀ CANVAS
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
    // 1. ATRODAM REĀLĀ LOGO LEŅĶA ROBEŽAS
    // --------------------------------------------------

    let minOffset = Infinity;
    let maxOffset = -Infinity;


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
                y * pixelWidth + x;


            const dataIndex =
                pixelIndex * 4;


            const alpha =
                pixels[
                    dataIndex + 3
                ];


            // Transparent vietas ignorējam.
            if (alpha < 5) {

                continue;
            }


            // Pārvēršam logo lokālo pikseli
            // par reālu ekrāna koordināti.
            const screenX =
                layout.logoX +
                (
                    (x + 0.5) /
                    pixelWidth
                ) *
                layout.logoWidth;


            const screenY =
                layout.logoY +
                (
                    (y + 0.5) /
                    pixelHeight
                ) *
                layout.logoHeight;


            // Leņķis no radara centra uz šo logo pikseli.
            const pixelAngle =
                Math.atan2(

                    screenY -
                    layout.centerY,

                    screenX -
                    layout.centerX
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


    // Scan sākums un beigas.
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
    // 2. IZVEIDOJAM PAŠUS PUNKTUS
    // --------------------------------------------------

    const dots = [];


    // Neejam cauri katram pikselim.
    //
    // Ņemam paraugus ik pēc dotSpacing pikseļiem.
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

            // --------------------------------------------------
            // NEDAUDZ NEJAUŠS NOVIETOJUMS
            // --------------------------------------------------

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


            // Ja jitter aizgāja ārpus attēla.
            if (
                x < 0 ||
                x >= pixelWidth ||
                y < 0 ||
                y >= pixelHeight
            ) {

                continue;
            }


            const pixelIndex =
                y * pixelWidth + x;


            const dataIndex =
                pixelIndex * 4;


            const alpha =
                pixels[
                    dataIndex + 3
                ];


            // Ja šis punkts neatrodas logo formā,
            // to neizveidojam.
            if (
                alpha <
                dotAlphaThreshold
            ) {

                continue;
            }


            // --------------------------------------------------
            // PUNKTA POZĪCIJA EKRĀNĀ
            // --------------------------------------------------

            const screenX =
                layout.logoX +
                (
                    (x + 0.5) /
                    pixelWidth
                ) *
                layout.logoWidth;


            const screenY =
                layout.logoY +
                (
                    (y + 0.5) /
                    pixelHeight
                ) *
                layout.logoHeight;


            // --------------------------------------------------
            // PUNKTA SCAN LEŅĶIS
            // --------------------------------------------------

            const dotAngle =
                Math.atan2(

                    screenY -
                    layout.centerY,

                    screenX -
                    layout.centerX
                );


            const revealProgress =
                angularDistanceCW(
                    scanStartAngle,
                    dotAngle
                );


            // --------------------------------------------------
            // PUNKTA IZSKATS
            // --------------------------------------------------

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


            const radius =
                dotMinRadius +
                sizeRandom *
                (
                    dotMaxRadius -
                    dotMinRadius
                );


            // Katram dot nedaudz cita intensitāte.
            const brightness =
                0.62 +
                brightnessRandom *
                0.38;


            dots.push({

                x: screenX,

                y: screenY,

                radius,

                brightness,

                revealProgress
            });
        }
    }


    // --------------------------------------------------
    // SAGLABĀJAM VISU
    // --------------------------------------------------

    scanData = {

        layout,

        dots,

        scanStartAngle,

        scanEndAngle,

        totalScanSpan
    };
}


// ======================================================
// ZĪMĒJAM DOT LOGO
// ======================================================

function drawDotLogo() {

    if (
        !scanData ||
        logoOpacity <= 0
    ) {

        return;
    }


    ctx.save();


    // Viegls glow visam dot logo.
    ctx.shadowColor =
        "rgba(100, 255, 225, 0.55)";

    ctx.shadowBlur = 6;


    // --------------------------------------------------
    // EJAM CAURI VISIEM LOGO PUNKTIEM
    // --------------------------------------------------

    for (
        const dot of
        scanData.dots
    ) {

        // Cik tālu needle jau ir aiz konkrētā punkta.
        const distanceBehindNeedle =
            currentRevealProgress -
            dot.revealProgress;


        let visibility = 0;


        // Needle jau ir pilnīgi izgājis tam pāri.
        if (
            distanceBehindNeedle >=
            revealFeather
        ) {

            visibility = 1;
        }


        // Punkts ir tieši needle tuvumā.
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
                    revealFeather * 2
                );
        }


        // Punkts needle vēl nav sasniegts.
        else {

            visibility = 0;
        }


        // Neredzamu punktu vispār nezīmējam.
        if (
            visibility <= 0
        ) {

            continue;
        }


        // Gala alpha.
        const alpha =
            visibility *
            dot.brightness *
            logoOpacity;


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
        getLayout();


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
        Math.PI * 2
    );


    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.35)";


    ctx.lineWidth = 2;

    ctx.stroke();


    // --------------------------------------------------
    // IEKŠĒJIE APĻI
    // --------------------------------------------------

    const ringCount = 4;


    for (
        let i = 1;
        i <= ringCount;
        i++
    ) {

        const ringRadius =
            radius *
            (i / ringCount);


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


        ctx.lineWidth = 1;

        ctx.stroke();
    }


    // --------------------------------------------------
    // KRUSTA LĪNIJAS
    // --------------------------------------------------

    ctx.beginPath();

    ctx.moveTo(
        centerX - radius,
        centerY
    );

    ctx.lineTo(
        centerX + radius,
        centerY
    );

    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.12)";

    ctx.stroke();


    ctx.beginPath();

    ctx.moveTo(
        centerX,
        centerY - radius
    );

    ctx.lineTo(
        centerX,
        centerY + radius
    );

    ctx.strokeStyle =
        "rgba(77, 220, 200, 0.12)";

    ctx.stroke();


    // --------------------------------------------------
    // SWEEP SEKTORA GLOW
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

        sweepAngle - 0.40,

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
    // DOT LOGO
    // --------------------------------------------------
    //
    // Logo zīmējam PIRMS needle,
    // lai needle vizuāli iet pāri punktiem.

    if (
        logoState !== "idle"
    ) {

        drawDotLogo();
    }


    // --------------------------------------------------
    // NEEDLE TRAIL
    // --------------------------------------------------

    const trailLines = 75;


    for (
        let i = 0;
        i < trailLines;
        i++
    ) {

        const offset =
            i * 0.006;


        const angle =
            sweepAngle -
            offset;


        const alpha =
            (
                1 -
                i / trailLines
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


        ctx.lineWidth = 2;


        ctx.stroke();
    }


    // --------------------------------------------------
    // NEEDLE
    // --------------------------------------------------

    const sweepX =
        centerX +
        Math.cos(sweepAngle) *
        radius;


    const sweepY =
        centerY +
        Math.sin(sweepAngle) *
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


    ctx.lineWidth = 3;


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
// LOGO SCAN LOĢIKA
// ======================================================

function updateLogoScan(
    currentTime,
    deltaTime
) {

    if (!scanData) {

        return;
    }


    // Cik tālu needle ir no
    // pirmā reālā logo punkta.
    const sweepProgress =
        angularDistanceCW(

            scanData.scanStartAngle,

            sweepAngle
        );


    const isScanningTarget =
        sweepProgress <=
        scanData.totalScanSpan;


    // --------------------------------------------------
    // SCANNING
    // --------------------------------------------------

    if (isScanningTarget) {

        // Tikko sākām skenēt.
        if (!wasScanningLastFrame) {

            logoState =
                "scanning";


            logoOpacity =
                1;


            currentRevealProgress =
                0;
        }


        // Needle pozīcija = reveal robeža.
        currentRevealProgress =
            Math.min(

                sweepProgress,

                scanData.totalScanSpan
            );
    }


    // --------------------------------------------------
    // ĀRPUS LOGO ZONAS
    // --------------------------------------------------

    else {

        // Needle tikko izgāja cauri pēdējam logo punktam.
        if (
            wasScanningLastFrame &&
            logoState === "scanning"
        ) {

            // Visi punkti tagad ir atklāti.
            currentRevealProgress =
                scanData.totalScanSpan;


            // Turam pilnu dot logo.
            logoState =
                "holding";


            logoOpacity =
                1;


            logoHoldUntil =
                currentTime +
                900;
        }


        // --------------------------------------------------
        // HOLD -> FADE
        // --------------------------------------------------

        if (
            logoState === "holding" &&
            currentTime >
            logoHoldUntil
        ) {

            logoState =
                "fading";
        }


        // --------------------------------------------------
        // FADE
        // --------------------------------------------------

        if (
            logoState === "fading"
        ) {

            logoOpacity -=
                0.52 *
                deltaTime;


            if (
                logoOpacity <= 0
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
        isScanningTarget;
}


// ======================================================
// GALVENĀ ANIMĀCIJA
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


    // --------------------------------------------------
    // NEEDLE KUSTĪBA
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


    // --------------------------------------------------
    // LOGO SCAN
    // --------------------------------------------------

    updateLogoScan(
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
// LOGO LOAD
// ======================================================

logo.onload = function () {

    // Kad SVG gatavs,
    // pārvēršam to radar punktos.
    buildLogoScanData();
};


// ======================================================
// START
// ======================================================

resizeCanvas();

requestAnimationFrame(
    animate
);