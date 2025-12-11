// ================= CONFIGURATION =================
const APP_CONFIG = typeof CONFIG !== 'undefined' ? CONFIG : {
    EXPIRATION_DATE: "2025-12-31",
    VALID_ACCESS_CODES: ["25"],
    ADMIN_PASSWORD: "test",
    MIN_PARTICIPANTS_REQUIRED: 1,
    GOOGLE_SCRIPT_URL: ""
};

// ================= VARIABLES GLOBALES =================
let myCoords=null, myUniqueId='', myEmoji='', myTransportMode='', myTransportMode2='', mode1Days=0, mode2Days=0, myDepartureTime='07:30', myFullAddress='';
let participants=[], scanning=false, animationFrameId=null, gameTargets=[], scannedTargets=[], attemptsLeft=5, score=0, gameActive=false;
let companyCoords=null, companyAddress='', rgpdAccepted=false, inviteCountdownInterval=null, scanCount=0;
let selectedAlternatives={}, selectedConstraints={}, selectedLevers={}, commitmentLevel=80;
let googleScriptUrl = APP_CONFIG.GOOGLE_SCRIPT_URL;

// Canvas global pour le scan
let scanCanvas = null;
let scanCtx = null;

// Variables pour la phase de Co-construction (Groupe)
let currentGroup = [];
let currentQuestions = [];
let questionIndex = 0;

const EMOJI_SET = ['🦸','🐼','🦁','🐻','🦊','🐱','🐯','🦄','🐸','🦉','🐙','🦋','🐨','🦒','🦘','🦥','🐲','🦕'];
const CO2_FACTORS = { 'car-thermal': 0.193, 'car-electric': 0.020, 'carpool': 0.096, 'train': 0.006, 'bus': 0.103, 'bike': 0, 'ebike': 0.002, 'walk': 0, 'remote': 0 };
const ALTERNATIVES = ["Covoiturage", "Autopartage", "Transports en commun", "Train/RER", "Vélo", "Vélo électrique", "Marche", "Vélo-taf", "Télétravail", "Horaires décalés", "Autre (précisez)"];
const CONSTRAINTS = ["Horaires décalés", "Enfants", "Matériel", "Distance >30km", "Pas de TC", "Pas de piste cyclable", "Météo", "Santé", "Flexibilité", "Coût", "Autre (précisez)"];
const LEVERS = ["Prime mobilité", "Abonnement TC 75%", "Parking vélo", "Douches", "Recharge élec", "Covoiturage interne", "Vélos fonction", "Formation", "Autre (précisez)"];

const miniChallenges = [
      { title: "🤝 Connecteurs", task: "Présentez-vous mutuellement à une 3ème personne que vous scannerez ensemble", icon: "🎭" },
      { title: "🔤 Chasseurs d'initiales", task: "Scannez 2 personnes dont les prénoms commencent par la même lettre", icon: "🎲" },
      { title: "🕵️ Devine mon adresse", task: "Scannez quelqu'un et tentez de deviner l'adresse qu'il a renseignée (rue, quartier...)", icon: "🏘️" },
      { title: "🆘 Entraide", task: "Trouvez quelqu'un qui semble perdu ou qui a scanné peu de personnes et aidez-le !", icon: "🤲" },
      { title: "📸 Selfie mobilité", task: "Prenez un selfie créatif sur le thème du transport (devant un vélo, un panneau, dans une voiture...)", icon: "🤳", hasPhoto: true }
];

// --- QUESTIONS OPTIMISÉES (NUDGE / SCIENCE COMPORTEMENTALE) ---

const QUESTIONS_CLOSE = [
    { q: "Levez la main si vous avez déjà fait le trajet en vélo, même une seule fois.", sub: "Regardez autour de vous : la pratique existe déjà." },
    { q: "Votre vrai frein au vélo, c'est quoi : transpiration, météo ou sécurité ?", sub: "Soyons honnêtes sur ce qui bloque vraiment." },
    { q: "Top chrono : qui parie que le vélo bat la voiture en heure de pointe ?", sub: "Sur 5km, le vélo met 15-20min constants. Et vous ?" },
    { q: "Entre arriver en sueur ou économiser 30€/mois, vous choisissez quoi ?", sub: "La question des douches et du FMD est centrale." },
    { q: "Qui a déjà vu un collègue arriver en trottinette ou vélo pliant ?", sub: "La micro-mobilité permet de faire les derniers kilomètres sans effort." },
    { q: "Si le bus passait 10 min plus tôt/tard, ça changerait tout pour vous ?", sub: "La flexibilité horaire est-elle une solution ?" },
    { q: "À deux, on se challenge : qui fait domicile-bureau en vélo cette semaine ?", sub: "Trouvez un partenaire de route dans ce groupe." }
];

const QUESTIONS_FAR = [
    { q: "Levez la main si vous partez entre 7h15 et 7h45 le matin.", sub: "Regardez bien : ce sont vos covoitureurs potentiels !" },
    { q: "Combien de places vides dans vos voitures ce matin ? On compte ensemble.", sub: "C'est autant d'économies potentielles qui s'envolent." },
    { q: "Votre vrai frein au covoiturage : horaires, détour, ou l'humain ?", sub: "La peur de l'inconnu ou la contrainte technique ?" },
    { q: "Qui serait prêt à faire UN SEUL trajet test en covoiturage cette semaine ?", sub: "Pas d'engagement long terme, juste un essai." },
    { q: "Votre vrai frein à l'électrique : prix, autonomie, ou recharge ?", sub: "Démystifions les blocages techniques." },
    { q: "Qui habite à moins de 15 minutes d'une gare ?", sub: "Le train + vélo/trottinette est souvent imbattable sur le temps." },
    { q: "Si vous récupériez 5h/semaine de trajet grâce au Télétravail, vous en feriez quoi ?", sub: "Sport, famille, sommeil ?" }
];

// ================= UTILITAIRES =================
function $(id) { return document.getElementById(id); }
function generateUniqueId() { return Math.random().toString(36).substr(2, 15); }
function generateEmojiPseudo() { return EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)]; }

// TOASTS LISIBLES
function showError(msg) {
    const errDiv = document.querySelector('.step.active .error-msg');
    if (errDiv && errDiv.offsetParent !== null) {
        errDiv.textContent = msg;
        setTimeout(() => errDiv.textContent = '', 3000);
    } else {
        const div = document.createElement('div');
        div.className = 'toast-msg error';
        div.innerHTML = `<span>❌</span> <span>${msg}</span>`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), 3000);
    }
}

function showSuccess(msg) {
    const div = document.createElement('div');
    div.className = 'toast-msg success';
    div.innerHTML = `<span>✅</span> <span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ================= INIT & NAVIGATION =================
document.addEventListener('DOMContentLoaded', () => {
    if (new Date() > new Date(APP_CONFIG.EXPIRATION_DATE)) {
        document.body.innerHTML = "<h1 style='color:white;text-align:center;margin-top:50px;'>Session Expirée</h1>";
        return;
    }

    scanCanvas = document.getElementById('canvas');
    if (scanCanvas) {
        scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    }

    restoreUserData();
    checkRGPDStatus();
    if ($('multimodalCheck')) $('multimodalCheck').checked = false;
});

function checkRGPDStatus() {
    if (localStorage.getItem('rgpdAccepted') === 'true') {
        rgpdAccepted = true;
        if ($('rgpdNotice')) $('rgpdNotice').style.display = 'none';
    }
}

function acceptRGPD() {
    rgpdAccepted = true;
    localStorage.setItem('rgpdAccepted', 'true');
    $('rgpdNotice').style.display = 'none';
    showSuccess("RGPD Validé");
}

function showRGPDDetails() {
    const pseudo = myEmoji || "(généré après validation)";
    const modal = document.createElement('div');
    modal.id = 'rgpdInfoModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content glass-effect" style="background:#1e293b; color:white; max-height:90vh; overflow-y:auto; border: 1px solid rgba(255,255,255,0.2);">
            <h2 style="color:#a5b4fc; margin-top:0;">🔒 Protection de vos données</h2>
            <h3 style="margin-top:20px; color:#e2e8f0;">Quelles données collectons-nous ?</h3>
            <ul style="margin-left:20px; margin-top:10px; line-height:1.6; opacity:0.9;">
                <li>📍 Coordonnées GPS de votre adresse</li>
                <li>🚗 Votre mode de transport actuel</li>
                <li>⏰ Votre heure de départ habituelle</li>
                <li>🆔 Un identifiant anonyme généré automatiquement</li>
            </ul>
            <h3 style="margin-top:20px; color:#e2e8f0;">Pourquoi ?</h3>
            <p style="opacity:0.9; margin-top:5px;">Ces données permettent de réaliser l'atelier de manière interactive et de visualiser collectivement les trajets domicile-travail.</p>
            <h3 style="margin-top:20px; color:#e2e8f0;">Durée & Tiers</h3>
            <p style="opacity:0.9; margin-top:5px;">Stockage local sur votre appareil + Google Sheet de l'animateur. Suppression sous <strong>7 jours</strong>.</p>
            <h3 style="margin-top:15px;">Vos droits</h3>
            <ul style="margin-left:20px; opacity:0.9;">
                <li>Droit d'accès et de suppression.</li>
                <li>Identifiant : <strong>${pseudo}</strong></li>
                <li>Contact : <strong>volt.face@outlook.fr</strong></li>
            </ul>
            <button class="btn-primary" style="margin-top:25px;" onclick="document.getElementById('rgpdInfoModal').remove()">✅ J'ai compris</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function showStep(n) {
    if (typeof n === 'string') {
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        const target = $(n);
        if (target) target.classList.add('active');
        stopAllCameras();
        return;
    }
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
    const target = $(`step${n}`);
    if (target) target.classList.add('active');
    for (let i = 1; i <= n; i++) {
        const dot = $(`step${i}Dot`);
        if (dot) {
            dot.classList.add('active');
            if (i < n) dot.classList.add('completed');
        }
    }
    stopAllCameras();
    if (n === 2) setTimeout(() => genMyQRCode('qrcode'), 100);
    if (n === 3) { initGame(); setTimeout(() => genMyQRCode('qrcodeStep3'), 100); }
    if (n === 4) setTimeout(() => genMyQRCode('qrcodeStep4'), 100);
    if (n === 5) updateStep5Stats();
    if (n === 6) initStep6Form();
    window.scrollTo(0, 0);
}

function checkAccessCode() {
    if (!rgpdAccepted) return showError("Veuillez accepter le RGPD.");
    const code = $('accessCodeInput').value.trim();
    if (APP_CONFIG.VALID_ACCESS_CODES.includes(code)) {
        $('loginSection').style.display = 'none';
        $('locationSection').style.display = 'block';
    } else {
        showError("Code invalide");
    }
}

// ================= RESET =================
function resetGameSequence() {
    if (confirm("⚠️ ATTENTION : Voulez-vous vraiment recommencer à zéro ?\n\nCela effacera votre profil et vos scans.")) {
        localStorage.clear();
        location.reload(true);
    }
}

// ================= MULTIMODAL =================
function toggleMultimodal() {
    if ($('multimodalCheck').checked) $('multimodalModal').classList.add('active');
}
function closeMultimodal() {
    $('multimodalModal').classList.remove('active');
    $('multimodalCheck').checked = false;
}
function saveMultimodal() {
    myTransportMode2 = $('transportMode2').value;
    mode1Days = parseInt($('mode1Days').value);
    mode2Days = parseInt($('mode2Days').value);
    localStorage.setItem('transportMode2', myTransportMode2);
    localStorage.setItem('mode1Days', mode1Days);
    localStorage.setItem('mode2Days', mode2Days);
    $('multimodalModal').classList.remove('active');
    showSuccess("Modes enregistrés !");
}

// ================= INVITATION =================
function showInvitePage() {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    $('invitePage').classList.add('active');
    $('inviteQrcode').innerHTML = '';
    new QRCode($('inviteQrcode'), { text: window.location.href, width: 200, height: 200, colorDark: "#0f172a", colorLight: "#ffffff" });
    startInviteTimer();
}
function startInviteTimer() {
    let countdown = 30;
    const timerDisplay = $('inviteTimer');
    if (inviteCountdownInterval) clearInterval(inviteCountdownInterval);
    timerDisplay.innerHTML = `⏱️ Retour dans <strong>${countdown}s</strong>`;
    inviteCountdownInterval = setInterval(() => {
        countdown--;
        timerDisplay.innerHTML = `⏱️ Retour dans <strong>${countdown}s</strong>`;
        if (countdown <= 0) { clearInterval(inviteCountdownInterval); showStep(2); }
    }, 1000);
}
function extendInviteTimer() { startInviteTimer(); }

// ================= GEOLOC & PROFIL =================
$('saveLocation').onclick = async () => {
    const addr = $('userAddress').value;
    const mode = $('transportMode').value;
    if (!addr || !mode) return showError("Remplissez tous les champs");

    try {
        $('saveLocation').textContent = "Recherche..."; $('saveLocation').disabled = true;

        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();
        if (!data.length) throw new Error("Adresse introuvable");

        myCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        myFullAddress = data[0].display_name;
        myTransportMode = mode;
        myDepartureTime = $('departureTime').value;

        localStorage.setItem('userCoords', JSON.stringify(myCoords));
        localStorage.setItem('transportMode', myTransportMode);
        localStorage.setItem('departureTime', myDepartureTime);
        localStorage.setItem('fullAddress', myFullAddress);

        if (!myUniqueId) { myUniqueId = generateUniqueId(); localStorage.setItem('myUniqueId', myUniqueId); }
        if (!myEmoji) { myEmoji = generateEmojiPseudo(); localStorage.setItem('myEmoji', myEmoji); }

        $('locationSection').style.display = 'none';
        $('afterLocationSection').style.display = 'block';
        $('myEmojiDisplay').textContent = myEmoji;

        const addrDisplay = $('detectedAddress');
        if (addrDisplay) addrDisplay.textContent = myFullAddress.split(',').slice(0, 2).join(',');

        const payload = {
            type: 'participant', id: myUniqueId, emoji: myEmoji, lat: myCoords.lat, lon: myCoords.lon,
            address: myFullAddress, transport: myTransportMode, transportMode2: myTransportMode2,
            mode1Days: mode1Days, mode2Days: mode2Days, departureTime: myDepartureTime
        };
        if (googleScriptUrl) fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });

    } catch (e) {
        showError(e.message);
        $('saveLocation').textContent = "Valider ma localisation"; $('saveLocation').disabled = false;
    }
};

function restoreUserData() {
    myUniqueId = localStorage.getItem('myUniqueId');
    myEmoji = localStorage.getItem('myEmoji');
    const coords = localStorage.getItem('userCoords');
    if (coords) myCoords = JSON.parse(coords);
    myTransportMode = localStorage.getItem('transportMode');
    myTransportMode2 = localStorage.getItem('transportMode2') || '';
    mode1Days = parseInt(localStorage.getItem('mode1Days') || '0');
    mode2Days = parseInt(localStorage.getItem('mode2Days') || '0');
    const saved = localStorage.getItem('participants');
    if (saved) { participants = JSON.parse(saved); scanCount = participants.length; } else { scanCount = 0; }
}

// ================= CAMERA & QR =================
function genMyQRCode(elId) {
    const el = $(elId);
    if (!el) return;
    el.innerHTML = '';
    
    // Sécurité : Vérifier les données avant de générer
    const id = myUniqueId || 'unknown';
    const lat = myCoords ? myCoords.lat : 0;
    const lon = myCoords ? myCoords.lon : 0;

    // Utilisation d'un format minimal pour alléger le QR code
    const qrData = JSON.stringify({ id: id, lat: lat, lon: lon });

    new QRCode(el, {
        text: qrData,
        width: 180, 
        height: 180,
        colorDark: "#0f172a", 
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.L // Niveau L pour meilleure lisibilité (moins de densité)
    });
}

function startScanLoop(type) {
    scanning = true;

    // Définition des IDs en fonction du type
    let camViewId, videoId, btnId, stopBtnId;

    if (type === 'group') {
        camViewId = 'groupCameraView';
        videoId = 'groupVideo';
        btnId = null; // Pas de bouton à cacher ici, géré par l'interface
        stopBtnId = null;
        // On affiche l'interface spécifique
        $('groupScanInterface').style.display = 'block';
    } else {
        // Types classiques (normal, game, company, positioning)
        camViewId = type === 'game' ? 'gameCameraView' : (type === 'company' ? 'companyCameraView' : (type === 'positioning' ? 'positioningCameraView' : 'cameraView'));
        videoId = type === 'game' ? 'gameVideo' : (type === 'company' ? 'companyVideo' : (type === 'positioning' ? 'positioningVideo' : 'video'));
        btnId = type === 'game' ? 'gameScanBtn' : (type === 'company' ? null : (type === 'positioning' ? 'positioningScanBtn' : 'scanBtn'));
        stopBtnId = type === 'game' ? 'stopGameCamBtn' : (type === 'company' ? 'stopCompCamBtn' : (type === 'positioning' ? 'stopPosCamBtn' : 'stopCamBtn'));

        if (btnId && $(btnId)) $(btnId).style.display = 'none';
        if ($(camViewId)) $(camViewId).style.display = 'block';
        if ($(stopBtnId)) $(stopBtnId).style.display = 'block';
    }

    const video = $(videoId);
    if (!video) {
        console.error("Vidéo introuvable pour le type:", type);
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            video.setAttribute("playsinline", true); // Important pour iOS
            video.play();
            requestAnimationFrame(() => tick(video, type));
        })
        .catch(err => { 
            console.error("Erreur accès caméra:", err);
            showError("Erreur caméra: " + err.message); 
            stopAllCameras(); 
        });
}

function tick(video, type) {
    if (!scanning) return;
    
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        if (!scanCanvas) {
            scanCanvas = document.getElementById('canvas');
            if(!scanCanvas) {
                 // Création à la volée si manquant dans le HTML
                 scanCanvas = document.createElement('canvas');
                 scanCanvas.id = 'canvas';
                 scanCanvas.style.display = 'none';
                 document.body.appendChild(scanCanvas);
            }
            scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
        }

        // Toujours redimensionner le canvas à la taille de la vidéo actuelle
        scanCanvas.width = video.videoWidth;
        scanCanvas.height = video.videoHeight;
        
        scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
        
        const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        
        // Tentative de lecture du QR code
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            console.log("QR Code détecté:", code.data); // Log pour debug
            try {
                const data = JSON.parse(code.data);
                let success = false;

                // --- LOGIQUE DE SCAN CENTRALISÉE ---
                if (type === 'group') {
                    // Pour le groupe, on scanne en boucle sans fermer la caméra
                    if (data.id) {
                        addMemberToGroup(data);
                        // On ne met pas success=true pour ne pas stopper la caméra
                    }
                }
                else if (type === 'company' && data.type === 'company') {
                    handleCompanyScan(data);
                    success = true;
                }
                // Cas général : scan de participant (étape 2, jeu, ou positionnement)
                // On vérifie qu'il y a un ID et une Lat (signature d'un participant)
                else if (data.id && data.lat !== undefined) {
                    if (type === 'game') success = handleGameScan(data);
                    else if (type === 'positioning') success = handlePositioningScan(data);
                    else success = addParticipant(data);
                }

                if (success) stopAllCameras();

            } catch (e) { 
                // Ignorer silencieusement les QR codes qui ne sont pas du JSON valide (autres applis, menus...)
                // console.warn("QR code invalide (pas du JSON ou format incorrect)", e);
            }
        }
    }
    if (scanning) requestAnimationFrame(() => tick(video, type));
}

function stopAllCameras() {
    scanning = false;
    document.querySelectorAll('video').forEach(v => {
        if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
    });
    document.querySelectorAll('.camera-container').forEach(e => e.style.display = 'none');

    // Réafficher les boutons
    ['scanBtn', 'gameScanBtn', 'positioningScanBtn'].forEach(id => { if ($(id)) $(id).style.display = 'block'; });
    // Cacher les boutons stop
    ['stopCamBtn', 'stopGameCamBtn', 'stopPosCamBtn', 'stopCompCamBtn'].forEach(id => { if ($(id)) $(id).style.display = 'none'; });
}

// ================= PHASE CO-CONSTRUCTION (GROUPE) =================
function initGroupPhase() {
    // 1. Tirage au sort du chef
    const challenges = [
        "Le plus jeune du groupe",
        "Celui avec les cheveux les plus longs",
        "Celui qui fait le mieux le grand écart",
        "Celui qui tire la langue le plus loin"
    ];
    const winner = challenges[Math.floor(Math.random() * challenges.length)];
    $('leaderChallenge').innerHTML = `👑 Le chef est : <br><span style="color:#F59E0B; font-size:1.2em;">${winner}</span>`;
    
    // 2. Afficher interface scan
    $('startGroupBtn').style.display = 'none';
    $('groupScanInterface').style.display = 'block';
    
    // 3. Reset groupe
    currentGroup = [];
    updateGroupList();
}

function addMemberToGroup(data) {
    // Anti-doublon et auto-scan
    if(currentGroup.find(m => m.id === data.id)) return;
    if(data.id === myUniqueId) { showError("Vous êtes déjà le chef !"); return; }
    
    currentGroup.push(data);
    updateGroupList();
    showSuccess(`${data.emoji || 'Membre'} ajouté !`);
    
    // Pause technique pour éviter le scan multiple immédiat
    scanning = false;
    setTimeout(() => { scanning = true; requestAnimationFrame(() => tick($('groupVideo'), 'group')); }, 1500);
}

function updateGroupList() {
    const list = $('groupMembersList');
    list.innerHTML = currentGroup.map(m => `<div>✅ ${m.emoji || '👤'} (ajouté)</div>`).join('');
    
    // Activer bouton si au moins 1 membre scanné
    $('validateGroupBtn').disabled = currentGroup.length < 1;
}

function validateGroup() {
    stopAllCameras();
    
    // Envoi sheet
    sendToGoogleSheets({
        type: 'group_formation',
        leaderId: myUniqueId,
        members: currentGroup.map(m => m.id).join(',')
    });
    
    // Passage à la phase 2 : Discussion
    $('groupFormationSection').style.display = 'none';
    $('groupDiscussionSection').style.display = 'block';
}

// Phase 2 : Discussion Dynamique
function startDiscussion(type) {
    currentQuestions = type === 'close' ? QUESTIONS_CLOSE : QUESTIONS_FAR;
    questionIndex = 0;
    
    // Highlight bouton
    document.querySelectorAll('.coach-btn').forEach(b => b.classList.remove('selected'));
    event.target.classList.add('selected');
    
    // Afficher carte question
    $('dynamicQuestionCard').style.display = 'block';
    showNextQuestion();
}

function showNextQuestion() {
    if(questionIndex >= currentQuestions.length) {
        $('questionText').textContent = "👏 Tour de table terminé !";
        $('questionSubtext').textContent = "Prenez maintenant une note commune ci-dessous.";
        $('dynamicQuestionCard').querySelector('button').style.display = 'none';
        return;
    }
    
    const q = currentQuestions[questionIndex];
    $('questionText').textContent = q.q;
    $('questionSubtext').textContent = q.sub;
    
    // Animation simple
    const card = $('dynamicQuestionCard');
    card.style.opacity = 0;
    setTimeout(() => card.style.opacity = 1, 100);
}

function nextQuestion() {
    questionIndex++;
    showNextQuestion();
}

// ================= LOGIQUE METIER =================
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addParticipant(data) {
    if (participants.find(p => p.id === data.id)) return false;
    if (data.id === myUniqueId) return false;

    const dist = haversineKm(myCoords.lat, myCoords.lon, data.lat, data.lon);
    participants.push({ ...data, distance: dist });
    localStorage.setItem('participants', JSON.stringify(participants));

    scanCount = participants.length;
    localStorage.setItem('scanCount', scanCount);
    $('scanCount').textContent = scanCount;
    $('step2Progress').style.width = Math.min((scanCount / 20) * 100, 100) + '%';

    showSuccess(`Scan OK ! (${dist.toFixed(1)} km)`);

    if (participants.length >= APP_CONFIG.MIN_PARTICIPANTS_REQUIRED) $('goToStep3').disabled = false;

    if (dist < 5) {
        const chal = miniChallenges[Math.floor(Math.random() * miniChallenges.length)];
        $('challengeTitle').textContent = chal.title;
        $('challengeTask').textContent = chal.task;
        $('challengeSection').style.display = 'block';
        $('scanBtn').style.display = 'none';
        $('continueChallengeBtn').onclick = () => {
            $('challengeSection').style.display = 'none';
            $('scanBtn').style.display = 'block';
        };
    }

    sendToGoogleSheets({
        type: 'scan', scannerId: myUniqueId, scannerEmoji: myEmoji,
        scannedId: data.id, distance: dist, step: 2, totalScans: scanCount
    });
    return true;
}

// ================= JEU & POSITIONNEMENT =================
function handlePositioningScan(data) {
    const dist = haversineKm(myCoords.lat, myCoords.lon, data.lat, data.lon);
    showSuccess(`📍 Distance: ${dist.toFixed(1)} km`);
    $('positioningScanBtn').style.display = 'block';
    return true;
}

function initGame() {
    if (participants.length < 1) return;
    gameTargets = participants.sort((a, b) => a.distance - b.distance).slice(0, 5);
    scannedTargets = []; score = 0; attemptsLeft = 5;
    updateGameUI();
}

function updateGameUI() {
    $('scoreBadge').textContent = `${score}/3`;
    $('attemptsLeft').textContent = attemptsLeft;
    let html = '';
    gameTargets.forEach((t, i) => {
        const isScanned = scannedTargets.includes(t.id);
        html += `
        <div class="participant-card ${isScanned ? 'scanned' : 'target'}">
            <div><strong>Voisin ${i + 1}</strong><br><small>${t.distance.toFixed(1)} km</small></div>
            <div class="icon-badge">${isScanned ? '✅' : '🎯'}</div>
        </div>`;
    });
    $('targetList').innerHTML = html;
}

function handleGameScan(data) {
    const target = gameTargets.find(t => t.id === data.id);
    if (!target) { showError("Ce n'est pas un voisin proche !"); return false; }
    if (scannedTargets.includes(data.id)) { showError("Déjà trouvé !"); return false; }

    scannedTargets.push(data.id);
    score++;
    showSuccess("Bravo ! Voisin trouvé.");
    updateGameUI();

    if (score >= 3) {
        $('gameResult').innerHTML = `<div class="success-msg">🎉 GAGNÉ !</div>`;
        $('gameScanBtn').style.display = 'none';
        sendToGoogleSheets({
            type: 'game_result', participantId: myUniqueId, score: score,
            attempts: 5 - attemptsLeft, errors: (5 - attemptsLeft) - score, title: 'Gagné'
        });
    }
    return true;
}

function resetGame() {
    scannedTargets = []; score = 0; attemptsLeft = 5;
    updateGameUI();
    $('gameScanBtn').style.display = 'block';
    $('gameResult').innerHTML = '';
}

// ================= FORMULAIRE AVEC HIERARCHIE =================
function initStep6Form() {
    const createFields = (listId, items, type) => {
        const list = $(listId);
        if (list.children.length > 0) return;

        items.forEach((item, i) => {
            const isOther = item.toLowerCase().includes("autre");
            let html = `
            <div class="checkbox-item-wrapper">
                <div class="checkbox-item">
                    <input type="checkbox" id="${type}${i}" onchange="handleOptionChange(this, '${type}', '${item}', ${i}, ${isOther})">
                    <label for="${type}${i}" style="flex:1;">${item}</label>
                    <select id="prio${type.charAt(0).toUpperCase() + type.slice(1)}${i}" class="prio-select" style="display:none; width:auto; padding:2px;" 
                        onchange="updatePriority('${type}', '${item}', this.value)">
                        <option value="1">Prio 1</option>
                        <option value="2">Prio 2</option>
                        <option value="3">Prio 3</option>
                    </select>
                </div>`;
            if (isOther) html += `<input type="text" id="${type}Input${i}" class="other-input" placeholder="Précisez..." style="display:none;">`;
            html += `</div>`;
            list.innerHTML += html;
        });
    };

    createFields('alternativesList', ALTERNATIVES, 'alt');
    createFields('constraintsList', CONSTRAINTS, 'cons');
    createFields('leversList', LEVERS, 'lev');
}

function handleOptionChange(checkbox, type, name, index, isOther) {
    if (isOther) {
        const input = document.getElementById(`${type}Input${index}`);
        if (input) input.style.display = checkbox.checked ? 'block' : 'none';
    }

    const capType = type.charAt(0).toUpperCase() + type.slice(1);
    const prioSelect = document.getElementById(`prio${capType}${index}`);

    if (prioSelect) {
        prioSelect.style.display = checkbox.checked ? 'block' : 'none';
    }

    let targetObj = (type === 'alt') ? selectedAlternatives : (type === 'cons' ? selectedConstraints : selectedLevers);

    if (checkbox.checked) {
        targetObj[name] = "1";
    } else {
        delete targetObj[name];
    }
}

function updatePriority(type, name, value) {
    let targetObj = (type === 'alt') ? selectedAlternatives : (type === 'cons' ? selectedConstraints : selectedLevers);
    if (targetObj[name]) targetObj[name] = value;
}

function updateCommitmentValue() {
    commitmentLevel = parseInt($('commitmentRange').value);
    $('commitmentValue').textContent = commitmentLevel;
}

function showCompanyScan() {
    // Save group note first (si elle existe)
    const noteField = $('groupNote');
    if(noteField) {
        localStorage.setItem('groupNote', noteField.value);
    }

    const formatData = (obj, listId, typePrefix) => {
        return Object.entries(obj).map(([k, v]) => {
            let displayName = k;
            if (k.toLowerCase().includes("autre")) {
                const inputs = document.querySelectorAll(`#${listId} .other-input`);
                for (let inp of inputs) {
                    if (inp.style.display !== 'none' && inp.value) {
                        displayName = `Autre: ${inp.value}`;
                        break;
                    }
                }
            }
            return `${displayName} (Prio ${v})`;
        }).join(', ');
    };

    let altStr = formatData(selectedAlternatives, 'alternativesList', 'alt');
    let consStr = formatData(selectedConstraints, 'constraintsList', 'cons');
    let levStr = formatData(selectedLevers, 'leversList', 'lev');

    localStorage.setItem('finalAlternatives', altStr);
    localStorage.setItem('finalConstraints', consStr);
    localStorage.setItem('finalLevers', levStr);

    sendToGoogleSheets({
        type: 'propositions', participantId: myUniqueId, emoji: myEmoji,
        alternatives: altStr, contraintes: consStr, leviers: levStr, engagement: commitmentLevel,
        groupNote: localStorage.getItem('groupNote') || ""
    });

    showStep('companyScanPage');
    $('companyScanPage').classList.add('active');
    $('step6').classList.remove('active');
    
    // Important: cacher l'étape co-construction si elle était active
    const coConst = $('stepCoConstruction');
    if(coConst) coConst.classList.remove('active');

    startScanLoop('company');
}

// ================= ADMIN & RAPPORT =================
function showAdminPage() {
    showStep('adminPage');
    $('adminPage').classList.add('active');
    $('adminPanel').style.display = 'none';
    $('adminLogin').style.display = 'block';
}

function adminLogin() {
    if ($('adminPassword').value === APP_CONFIG.ADMIN_PASSWORD) {
        $('adminLogin').style.display = 'none';
        $('adminPanel').style.display = 'block';
        refreshAdminStats();
    } else { showError("Mot de passe incorrect"); }
}

async function generateCompanyQR() {
    const addr = $('companyAddressInput').value;
    if (!addr) return showError("Entrez une adresse");

    try {
        $('companyQrcode').innerHTML = 'Génération...';
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();

        if (!data.length) throw new Error("Adresse introuvable");

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);

        $('companyQrcode').innerHTML = '';
        new QRCode($('companyQrcode'), {
            text: JSON.stringify({ type: 'company', lat: lat, lon: lon }),
            width: 200, height: 200
        });
        $('companyQRSection').style.display = 'flex';

    } catch (e) {
        showError("Erreur adresse");
        $('companyQrcode').innerHTML = '';
    }
}

function updateStep5Stats() {
    const total = participants.length + 1;
    $('totalParticipants').textContent = total;
    if (participants.length > 0) {
        const avg = participants.reduce((acc, p) => acc + p.distance, 0) / participants.length;
        $('avgDistance').textContent = avg.toFixed(1);
    }
}

function handleCompanyScan(data) {
    companyCoords = { lat: data.lat, lon: data.lon };
    const dist = haversineKm(myCoords.lat, myCoords.lon, companyCoords.lat, companyCoords.lon);

    let factor = CO2_FACTORS[myTransportMode] || 0.1;
    const co2 = Math.round(dist * 2 * 220 * factor * 0.3);

    $('co2Savings').textContent = co2;

    stopAllCameras();
    $('companyScanPage').classList.remove('active');
    $('reportPage').classList.add('active');

    sendToGoogleSheets({ type: 'company_distance', participantId: myUniqueId, emoji: myEmoji, distance: dist });
}

function sendToGoogleSheets(data) {
    if (!googleScriptUrl) return;
    fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) })
        .catch(e => console.error("Erreur envoi", e));
}

function resetAllData() {
    if (confirm("⚠️ DANGER : Pour tout effacer, tapez 'SUPPRIMER'")) {
        localStorage.clear();
        location.reload();
    }
}

async function exportExcel() {
    const btn = document.querySelector('#adminPanel .btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "Téléchargement...";

    try {
        const res = await fetch(googleScriptUrl + '?action=get');
        const data = await res.json();

        const wb = XLSX.utils.book_new();
        if (data.participants) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.participants), "Participants");
        if (data.scans) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.scans), "Scans");
        XLSX.writeFile(wb, "Atelier_Mobilite_Export.xlsx");
        showSuccess("Export réussi !");

    } catch (e) {
        console.warn("Export Google échoué, fallback local");
        const wb = XLSX.utils.book_new();
        const localParts = participants.map(p => ({ Emoji: p.emoji, Distance: p.distance, Mode: p.transport }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(localParts), "Mes Scans Locaux");
        XLSX.writeFile(wb, "Export_Local_Secours.xlsx");
    }
    btn.innerText = originalText;
}

function refreshAdminStats() {
    $('adminTotalUsers').textContent = participants.length + 1;
    if (participants.length > 0) {
        const avg = participants.reduce((acc, p) => acc + p.distance, 0) / participants.length;
        $('adminAvgDistance').textContent = avg.toFixed(1);
    }
}

function generatePDF() {
    const alt = localStorage.getItem('finalAlternatives') || "Aucune";
    const cons = localStorage.getItem('finalConstraints') || "Aucune";
    const lev = localStorage.getItem('finalLevers') || "Aucun";
    const groupNote = localStorage.getItem('groupNote') || "";

    const win = window.open('', '_blank');
    const content = `
    <html><head><title>Rapport ${myEmoji}</title>
    <style>
        body{font-family:sans-serif;padding:20px;color:#333;max-width:800px;margin:0 auto;} 
        h1{color:#4F46E5;text-align:center;border-bottom:2px solid #4F46E5;padding-bottom:10px;} 
        h2{color:#4F46E5;margin-top:20px;font-size:1.2em;border-bottom:1px solid #eee;padding-bottom:5px;}
        .card{border:1px solid #e2e8f0;padding:20px;border-radius:10px;margin-bottom:20px;background:#f8fafc;}
        .btn{display:block;width:100%;padding:15px;background:#4F46E5;color:white;text-align:center;text-decoration:none;border-radius:8px;margin-top:20px;font-weight:bold;border:none;cursor:pointer;}
        .btn-close{background:#ef4444;margin-top:10px;}
        ul{margin:0;padding-left:20px;}
        li{margin-bottom:5px;}
        .note-box {background:#fffbeb; padding:10px; border-left:4px solid #f59e0b; margin-top:10px;}
    </style>
    </head><body>
    <h1>🌱 Mon Bilan Mobilité - GoDifferent</h1>
    
    <div class="card">
        <h2>👤 Profil</h2>
        <p><strong>Pseudo :</strong> ${myEmoji}</p>
        <p><strong>Adresse :</strong> ${myFullAddress}</p>
        <p><strong>Mode actuel :</strong> ${myTransportMode}</p>
    </div>

    <div class="card">
        <h2>🌍 Impact & Réseau</h2>
        <p><strong>Gain potentiel :</strong> <span style="color:#10b981;font-weight:bold;font-size:1.5em;">${$('co2Savings').textContent} kg CO2/an</span></p>
        <p><strong>Voisins trouvés :</strong> ${participants.slice(0, 5).length}</p>
    </div>

    <div class="card">
        <h2>💡 Vos Propositions (Priorisées)</h2>
        <p><strong>Alternatives :</strong></p>
        <ul>${alt.split(', ').map(i => `<li>${i}</li>`).join('')}</ul>
        
        <p><strong>Contraintes :</strong></p>
        <ul>${cons.split(', ').map(i => `<li>${i}</li>`).join('')}</ul>
        
        <p><strong>Leviers :</strong></p>
        <ul>${lev.split(', ').map(i => `<li>${i}</li>`).join('')}</ul>
        
        <div class="note-box">
            <strong>📝 Note de Groupe :</strong><br>
            ${groupNote}
        </div>

        <p style="margin-top:15px;"><strong>Engagement personnel :</strong> ${commitmentLevel}%</p>
    </div>

    <p style="text-align:center;font-size:0.8em;color:#666;">Généré par l'Atelier Mobilité. Conservez ce document.</p>
    
    <button onclick="window.print()" class="btn">🖨️ Imprimer / Sauvegarder en PDF</button>
    <button onclick="window.close()" class="btn btn-close">❌ Fermer la fenêtre</button>
    </body></html>`;
    win.document.write(content);
    win.document.close();
}
