// ======================================================
// GALVENAIS CANVAS
// ======================================================

// Atrodam HTML canvas.
const canvas = document.getElementById("radarCanvas");

// Iegūstam 2D zīmēšanas vidi.
const ctx = canvas.getContext("2d");


// ======================================================
// LOGO
// ======================================================

// Izveidojam logo attēlu.
const logo = new Image();

// Logo faila ceļš.
logo.src = "./assets/logo_navy.png";


// ======================================================
// RADARA IESTATĪJUMI
// ======================================================

// Pašreizējais needle leņķis.
let sweepAngle = 0;

// Needle ātrums.
// Ja gribi vēl ātrāku, palielini, piemēram, uz 1.30.
let sweepSpeed = 1.22;

// Iepriekšējā frame laiks.
let previousTime = 0;


// ======================================================
// LOGO POZĪCIJA
// ======================================================

// -PI / 2 = tieši uz augšu jeb 12 o'clock.
const targetAngle = -Math.PI / 2;

// Logo attālums no radara centra.
// Mazāks = logo zemāk / tuvāk centram.
const targetDistanceFactor = 0.58;

// Maksimālais logo platums.
const maxLogoWidth = 400;

// Logo platums attiecībā pret ekrānu.
const logoWidthFactor = 0.28;


// ======================================================
// REVEAL IESTATĪJUMI
// ======================================================

// Ļoti maza rezerve pirms pirmā un pēc pēdējā logo pikseļa.
const scanPadding = 0.008;

// Cik mīksta ir robeža tieši pie needle.
//
// SVARĪGI:
// Tas NAV visa logo opacity.
// Tikai daži pikseļi pie pašas scan robežas kļūst nedaudz mīkstāki.
const revealFeather = 0.012;


// ======================================================
// LOGO ANIMĀCIJAS STĀVOKLIS
// ======================================================

// idle
// scanning
// holding
// fading
let logoState = "idle";

// Kopējais logo opacity.
// Scan laikā = 1.
// Fade laikā pamazām samazinās.
let logoOpacity = 0;

// Līdz kuram laikam logo paliek redzams pēc scan.
let logoHoldUntil = 0;

// Iepriekšējā frame scan statuss.
let wasScanningLastFrame = false;

// Cik tālu pašreiz ir ticis reveal.
let currentRevealProgress = 0;


// ======================================================
// PIXEL MASK DATI
// ======================================================

// Šeit glabāsim visu iepriekš aprēķināto informāciju
// par logo pikseļiem un to leņķiem.
let scanData = null;


// ======================================================
// CANVAS RESIZE
// ======================================================

function resizeCanvas() {

    // Device Pixel Ratio nodrošina asāku canvas.
    const dpr = window.devicePixelRatio || 1;

    // Canvas fiziskais izmērs.
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // Canvas CSS izmērs.
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;

    // Turpinām izmantot parastus CSS pikseļus koordinātēm.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ja logo jau ir gatavs, pārrēķinām pixel mask.
    if (logo.complete && logo.naturalWidth) {
        buildLogoScanData();
    }

    // Pēc resize sākam tīru ciklu.
    logoState = "idle";
    logoOpacity = 0;
    wasScanningLastFrame = false;
    currentRevealProgress = 0;
}


// Klausāmies loga izmēra maiņu.
window.addEventListener("resize", resizeCanvas);


// ======================================================
// LEŅĶU FUNKCIJAS
// ======================================================

// Normalizē leņķi uz 0 ... 2PI.
function normalizeAngle(angle) {

    const fullCircle = Math.PI * 2;

    return ((angle % fullCircle) + fullCircle) % fullCircle;
}


// Atrod signed starpību starp diviem leņķiem.
//
// Tā kā mūsu logo ir ap 12 o'clock,
// rezultāts būs aptuveni:
//
// kreisā puse = negatīvs
// centrs      = 0
// labā puse   = pozitīvs
function signedAngleDifference(angle, reference) {

    return Math.atan2(
        Math.sin(angle - reference),
        Math.cos(angle - reference)
    );
}


// Cik tālu pulksteņrādītāja virzienā
// ir no viena leņķa līdz otram.
function angularDistanceCW(fromAngle, toAngle) {

    return normalizeAngle(toAngle - fromAngle);
}


// ======================================================
// RADARA / LOGO IZKĀRTOJUMS
// ======================================================

function getLayout() {

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Radara centrs.
    const centerX = width / 2;
    const centerY = height / 2;

    // Radara izmērs.
    const radius = Math.min(width, height) * 0.40;


    // Logo platums.
    const logoWidth = Math.min(
        maxLogoWidth,
        width * logoWidthFactor
    );


    // Saglabājam SVG proporciju.
    const logoHeight =
        logoWidth *
        (logo.naturalHeight / logo.naturalWidth);


    // Logo centra attālums no radara centra.
    const targetDistance =
        radius * targetDistanceFactor;


    // Logo centra X.
    const targetX =
        centerX +
        Math.cos(targetAngle) *
        targetDistance;


    // Logo centra Y.
    const targetY =
        centerY +
        Math.sin(targetAngle) *
        targetDistance;


    // Logo kreisā mala.
    const logoX =
        targetX - logoWidth / 2;


    // Logo augšējā mala.
    const logoY =
        targetY - logoHeight / 2;


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
// IZVEIDOJAM PIXEL-BY-PIXEL LOGO MASKU
// ======================================================

function buildLogoScanData() {

    // Ja logo vēl nav gatavs, neko nedarām.
    if (!logo.complete || !logo.naturalWidth) {
        return;
    }


    const layout = getLayout();


    // Mūsu offscreen logo izmērs pikseļos.
    //
    // Ap 300 px plata logo gadījumā te būs tikai
    // daži desmiti tūkstošu pikseļu, kas JS ir pilnīgi OK.
    const pixelWidth =
        Math.max(1, Math.round(layout.logoWidth));

    const pixelHeight =
        Math.max(1, Math.round(layout.logoHeight));


    // --------------------------------------------------
    // SOURCE CANVAS
    // --------------------------------------------------

    // Šeit uzzīmējam oriģinālo logo.
    const sourceCanvas =
        document.createElement("canvas");

    sourceCanvas.width = pixelWidth;
    sourceCanvas.height = pixelHeight;


    const sourceCtx =
        sourceCanvas.getContext("2d", {
            willReadFrequently: true
        });


    // Uzzīmējam SVG uz offscreen canvas.
    sourceCtx.drawImage(
        logo,
        0,
        0,
        pixelWidth,
        pixelHeight
    );


    // Saņemam visus logo RGBA pikseļus.
    const sourceImageData =
        sourceCtx.getImageData(
            0,
            0,
            pixelWidth,
            pixelHeight
        );


    // --------------------------------------------------
    // REVEAL CANVAS
    // --------------------------------------------------

    // Šeit katru frame izveidosim tikai jau
    // noskenēto logo daļu.
    const revealCanvas =
        document.createElement("canvas");

    revealCanvas.width = pixelWidth;
    revealCanvas.height = pixelHeight;


    const revealCtx =
        revealCanvas.getContext("2d");


    // Gatavs ImageData objekts,
    // kuru pārrakstīsim katru frame scan laikā.
    const revealImageData =
        revealCtx.createImageData(
            pixelWidth,
            pixelHeight
        );


    // --------------------------------------------------
    // LEŅĶI KATRAM PIXELIM
    // --------------------------------------------------

    // Katram pixelim saglabāsim,
    // cik tālu needle jāaiziet, lai to atklātu.
    const pixelAngles =
        new Float32Array(
            pixelWidth * pixelHeight
        );


    // Sākumā meklējam reālā logo
    // kreisāko un labāko leņķi.
    //
    // Nevis SVG bounding box!
    // Tikai pikseļus, kas tiešām ir redzami.
    let minOffset = Infinity;
    let maxOffset = -Infinity;


    // --------------------------------------------------
    // 1. PASS
    // Atrodam īstā logo robežas pēc redzamajiem pikseļiem.
    // --------------------------------------------------

    for (let y = 0; y < pixelHeight; y++) {

        for (let x = 0; x < pixelWidth; x++) {

            // Pikseļa numurs.
            const pixelIndex =
                y * pixelWidth + x;

            // RGBA masīvā viens pixels aizņem 4 vērtības.
            const dataIndex =
                pixelIndex * 4;

            // Alpha kanāls.
            const alpha =
                sourceImageData.data[dataIndex + 3];


            // Pilnībā caurspīdīgos pikseļus ignorējam.
            if (alpha < 5) {

                pixelAngles[pixelIndex] = NaN;

                continue;
            }


            // Pikseļa pozīcija uz galvenā ekrāna.
            const screenX =
                layout.logoX +
                ((x + 0.5) / pixelWidth) *
                layout.logoWidth;


            const screenY =
                layout.logoY +
                ((y + 0.5) / pixelHeight) *
                layout.logoHeight;


            // Leņķis no radara centra uz konkrēto logo pikseli.
            const pixelAngle =
                Math.atan2(
                    screenY - layout.centerY,
                    screenX - layout.centerX
                );


            // Nobīde no 12 o'clock target leņķa.
            const offset =
                signedAngleDifference(
                    pixelAngle,
                    targetAngle
                );


            // Saglabājam pagaidām offset.
            pixelAngles[pixelIndex] = offset;


            // Meklējam pašu pirmo logo pikseli.
            if (offset < minOffset) {
                minOffset = offset;
            }


            // Meklējam pašu pēdējo logo pikseli.
            if (offset > maxOffset) {
                maxOffset = offset;
            }
        }
    }


    // Scan sākuma leņķis.
    const scanStartAngle =
        targetAngle +
        minOffset -
        scanPadding;


    // Scan beigu leņķis.
    const scanEndAngle =
        targetAngle +
        maxOffset +
        scanPadding;


    // Kopējais sweep ceļš cauri logo.
    const totalScanSpan =
        angularDistanceCW(
            scanStartAngle,
            scanEndAngle
        );


    // --------------------------------------------------
    // 2. PASS
    //
    // Pārvēršam katra pikseļa offset
    // par precīzu progress vērtību no scan sākuma.
    // --------------------------------------------------

    for (
        let pixelIndex = 0;
        pixelIndex < pixelAngles.length;
        pixelIndex++
    ) {

        const offset =
            pixelAngles[pixelIndex];


        // Transparent pixels.
        if (Number.isNaN(offset)) {
            continue;
        }


        // Atjaunojam īsto pixel angle.
        const pixelAngle =
            targetAngle + offset;


        // Cik tālu needle jāaiziet no scan sākuma,
        // lai sasniegtu šo konkrēto pikseli.
        pixelAngles[pixelIndex] =
            angularDistanceCW(
                scanStartAngle,
                pixelAngle
            );
    }


    // Saglabājam visu vienā objektā.
    scanData = {

        layout,

        pixelWidth,
        pixelHeight,

        sourceCanvas,
        sourceImageData,

        revealCanvas,
        revealCtx,
        revealImageData,

        pixelProgress: pixelAngles,

        scanStartAngle,
        scanEndAngle,

        totalScanSpan
    };


    // Sākumā reveal ir tukšs.
    updateRevealCanvas(0);
}


// ======================================================
// ATJAUNOJAM REVEAL PIXELUS
// ======================================================

function updateRevealCanvas(revealProgress) {

    if (!scanData) {
        return;
    }


    const source =
        scanData.sourceImageData.data;

    const output =
        scanData.revealImageData.data;

    const progressMap =
        scanData.pixelProgress;


    // --------------------------------------------------
    // EJAM CAURI KATRAM LOGO PIXELIM
    // --------------------------------------------------

    for (
        let pixelIndex = 0;
        pixelIndex < progressMap.length;
        pixelIndex++
    ) {

        const dataIndex =
            pixelIndex * 4;


        // Oriģinālais alpha.
        const sourceAlpha =
            source[dataIndex + 3];


        // Transparent logo pixels paliek transparent.
        if (
            sourceAlpha < 5 ||
            Number.isNaN(progressMap[pixelIndex])
        ) {

            output[dataIndex] = 0;
            output[dataIndex + 1] = 0;
            output[dataIndex + 2] = 0;
            output[dataIndex + 3] = 0;

            continue;
        }


        // Cik tālu jābūt needle,
        // lai sasniegtu šo pikseli.
        const pixelProgress =
            progressMap[pixelIndex];


        // Starpība starp needle un konkrēto pikseli.
        const distanceBehindNeedle =
            revealProgress - pixelProgress;


        // --------------------------------------------------
        // PIXEL VISIBILITY
        // --------------------------------------------------

        let visibility = 0;


        // Needle jau ir pilnībā izgājis pāri pixelim.
        if (distanceBehindNeedle >= revealFeather) {

            visibility = 1;
        }

        // Pixels ir tieši pie needle robežas.
        //
        // Tikai šeit lietojam tiny soft transition,
        // lai mala nav robaina.
        else if (distanceBehindNeedle > -revealFeather) {

            visibility =
                (
                    distanceBehindNeedle +
                    revealFeather
                ) /
                (
                    revealFeather * 2
                );
        }

        // Pretējā gadījumā pixels vēl nav noskenēts.
        else {

            visibility = 0;
        }


        // RGB saglabājam precīzi no oriģinālā logo.
        output[dataIndex] =
            source[dataIndex];

        output[dataIndex + 1] =
            source[dataIndex + 1];

        output[dataIndex + 2] =
            source[dataIndex + 2];


        // Mainām TIKAI konkrētā pixela alpha.
        output[dataIndex + 3] =
            sourceAlpha * visibility;
    }


    // Uzrakstām gatavo pixel mask atpakaļ uz offscreen canvas.
    scanData.revealCtx.putImageData(
        scanData.revealImageData,
        0,
        0
    );
}


// ======================================================
// ZĪMĒJAM NOSKENĒTO LOGO
// ======================================================

function drawRevealedLogo(layout) {

    // Ja nekas nav sagatavots vai logo nav redzams.
    if (
        !scanData ||
        logoOpacity <= 0
    ) {
        return;
    }


    ctx.save();


    // Fade-out tiek piemērots VISAM jau noskenētajam logo.
    ctx.globalAlpha = logoOpacity;


    // Neliels glow.
    ctx.shadowColor =
        "rgba(100, 255, 230, 0.75)";

    ctx.shadowBlur = 20;


    // Uzzīmējam EXACT pixel reveal rezultātu.
    ctx.drawImage(
        scanData.revealCanvas,

        layout.logoX,
        layout.logoY,

        layout.logoWidth,
        layout.logoHeight
    );


    ctx.restore();
}


// ======================================================
// RADARA ZĪMĒŠANA
// ======================================================

function drawRadar() {

    const layout = getLayout();

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
            radius * (i / ringCount);


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
    // HORIZONTĀLĀ LĪNIJA
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


    // --------------------------------------------------
    // VERTIKĀLĀ LĪNIJA
    // --------------------------------------------------

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
    // LOGO
    //
    // Zīmējam pirms needle,
    // lai needle vizuāli būtu virs logo.
    // --------------------------------------------------

    if (logoState !== "idle") {

        drawRevealedLogo(layout);
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
            sweepAngle - offset;

        const alpha =
            (1 - i / trailLines) * 0.055;


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
            `rgba(85, 255, 220, ${alpha})`;

        ctx.lineWidth = 2;

        ctx.stroke();
    }


    // --------------------------------------------------
    // GALVENĀ NEEDLE LĪNIJA
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

function updateLogoScan(currentTime, deltaTime) {

    // Ja pixel dati vēl nav uzbūvēti.
    if (!scanData) {
        return;
    }


    // Cik tālu pašreizējais needle atrodas
    // no reālā pirmā logo pikseļa.
    const sweepProgress =
        angularDistanceCW(
            scanData.scanStartAngle,
            sweepAngle
        );


    // Needle atrodas logo scan zonā tikai tad,
    // ja nav ticis tālāk par pēdējo logo pikseli.
    const isScanningTarget =
        sweepProgress <=
        scanData.totalScanSpan;


    // --------------------------------------------------
    // SCANNING
    // --------------------------------------------------

    if (isScanningTarget) {

        // Scan tikko sākās.
        if (!wasScanningLastFrame) {

            logoState = "scanning";

            // NAV full-logo fade-in.
            // Logo opacity uzreiz ir 1,
            // bet redzami ir tikai needle jau šķērsotie pikseļi.
            logoOpacity = 1;

            currentRevealProgress = 0;

            updateRevealCanvas(0);
        }


        // Needle progress kļūst par reveal progress.
        currentRevealProgress =
            Math.min(
                sweepProgress,
                scanData.totalScanSpan
            );


        // Atklājam TIKAI tos pikseļus,
        // kuriem needle jau ir ticis pāri.
        updateRevealCanvas(
            currentRevealProgress
        );
    }


    // --------------------------------------------------
    // SCAN BEIDZIES
    // --------------------------------------------------

    else {

        // Needle tikko izgāja pāri pašam
        // pēdējam logo pixelim.
        if (
            wasScanningLastFrame &&
            logoState === "scanning"
        ) {

            // Pabeidzam tieši to pašu pixel masku līdz 100%.
            //
            // NEKĀDA pārslēgšanās uz citu full logo.
            currentRevealProgress =
                scanData.totalScanSpan;

            updateRevealCanvas(
                currentRevealProgress
            );


            // Tagad turam to pašu pilnībā
            // noskenēto logo.
            logoState = "holding";

            logoOpacity = 1;

            logoHoldUntil =
                currentTime + 900;
        }


        // --------------------------------------------------
        // HOLD -> FADE
        // --------------------------------------------------

        if (
            logoState === "holding" &&
            currentTime > logoHoldUntil
        ) {

            logoState = "fading";
        }


        // --------------------------------------------------
        // FADE OUT
        // --------------------------------------------------

        if (logoState === "fading") {

            // Tavs iepriekšējais smooth fade.
            logoOpacity -=
                0.52 * deltaTime;


            // Beidzam ciklu.
            if (logoOpacity <= 0) {

                logoOpacity = 0;

                logoState = "idle";

                currentRevealProgress = 0;
            }
        }
    }


    // Saglabājam statusu nākamajam frame.
    wasScanningLastFrame =
        isScanningTarget;
}


// ======================================================
// GALVENĀ ANIMĀCIJA
// ======================================================

function animate(currentTime) {

    // Pirmais frame.
    if (!previousTime) {
        previousTime = currentTime;
    }


    // Frame starpība sekundēs.
    const deltaTime =
        (currentTime - previousTime) / 1000;


    previousTime =
        currentTime;


    // --------------------------------------------------
    // ROTĒJAM NEEDLE
    // --------------------------------------------------

    sweepAngle +=
        sweepSpeed * deltaTime;


    // Pēc pilna apļa sākam no jauna.
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
    // NOTĪRĀM FRAME
    // --------------------------------------------------

    ctx.clearRect(
        0,
        0,
        window.innerWidth,
        window.innerHeight
    );


    // --------------------------------------------------
    // ZĪMĒJAM
    // --------------------------------------------------

    drawRadar();


    // Nākamais frame.
    requestAnimationFrame(animate);
}


// ======================================================
// LOGO LOAD
// ======================================================

// Kad SVG ir pilnībā ielādējies,
// sagatavojam tā pixel-angle karti.
logo.onload = function () {

    buildLogoScanData();
};


// Pirmais canvas resize.
resizeCanvas();


// ======================================================
// START
// ======================================================

requestAnimationFrame(animate);