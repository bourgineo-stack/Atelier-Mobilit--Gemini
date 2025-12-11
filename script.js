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
    // VÉLO & MICRO-MOBILITÉ
    { q: "Levez la main si vous avez déjà fait le trajet en vélo, même une seule fois.", sub: "Preuve sociale : la pratique existe déjà autour de vous." },
    { q: "Qui a déjà vu un collègue arriver en trottinette ou vélo pliant ?", sub: "La micro-mobilité est visible." },
    { q: "Votre vrai frein au vélo, c'est quoi : transpiration, douches, ou météo ?", sub: "Identifions le blocage opérationnel." },
    { q: "Entre arriver en sueur ou économiser 30€/mois, vous choisissez quoi honnêtement ?", sub: "Le dilemme confort vs économie." },
    { q: "Top chrono : qui parie que le vélo bat la voiture en heure de pointe ?", sub: "Sur 5km en ville, le vélo est souvent plus rapide." },
    { q: "À deux, on se challenge : qui fait domicile-bureau en vélo cette semaine ?", sub: "Engagement immédiat en binôme." },
    { q: "Qui accepterait de prêter son vélo à un collègue pour un trajet test ?", sub: "Solidarité et essai sans risque." },
    
    // TRANSPORTS EN COMMUN (TC)
    { q: "Qui a déjà pris le bus/tram au moins une fois depuis qu'il travaille ici ?", sub: "Test de la connaissance de l'offre." },
    { q: "Votre vrai frein aux TC : temps de trajet, fréquence, ou confort ?", sub: "Analyse des barrières perçues." },
    { q: "Si le bus passait 10 min plus tôt/tard, ça changerait tout pour vous ?", sub: "La flexibilité horaire est-elle une clé ?" },
    { q: "Qui accepterait de tester les TC 2 jours cette semaine si quelqu'un vient avec vous ?", sub: "L'accompagnement pour lever les freins." }
];

const QUESTIONS_FAR = [
    // COVOITURAGE
    { q: "Levez la main si vous partez entre 7h15 et 7h45.", sub: "Vos covoitureurs potentiels sont ici." },
    { q: "Combien de places vides dans vos voitures ce matin ? On compte ensemble.", sub: "Visualisation du gaspillage." },
    { q: "Votre vrai frein au covoiturage : horaires, détour, ou ne pas connaître les gens ?", sub: "Psychologie vs Logistique." },
    { q: "On fait comment sur les horaires si l'un arrive en retard ?", sub: "Règles de vie commune." },
    { q: "Qui serait prêt à faire UN SEUL trajet test en covoiturage cette semaine ?", sub: "Petit pas sans engagement." },
    
    // VOITURE ÉLECTRIQUE & AUTOPARTAGE
    { q: "Qui a déjà été dans une voiture électrique, même comme passager ?", sub: "Démystification par l'expérience." },
    { q: "Votre vrai frein à l'électrique : prix, autonomie, ou recharge ?", sub: "Identifier les peurs technologiques." },
    { q: "Vous avez besoin de votre voiture combien de jours par semaine honnêtement ?", sub: "Remise en question de la possession." },
    
    // TRAIN & INTERMODALITÉ
    { q: "Qui habite à moins de 15 minutes d'une gare ?", sub: "Le train est souvent oublié." },
    { q: "Une trottinette/vélo pliant qui tient dans le train, ça règle votre problème de dernier km ?", sub: "Solution multimodale." },
    
    // TÉLÉTRAVAIL
    { q: "Levez la main si vous habitez à +30 km : le télétravail changerait tout.", sub: "Impact majeur sur la qualité de vie." },
    { q: "Qui pourrait proposer à son manager de tester 1 jour de TT en plus ce mois-ci ?", sub: "Action concrète RH." }
];

// ================= UTILITAIRES =================
function $(id) { return document.getElementById(id); }
function generateUniqueId() { return 'u_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36); }
function generateEmojiPseudo() { return EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random() * EMOJI_SET.length)]; }

// TOASTS
function showError(msg) {
    console.error('[ERROR]', msg);
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
    console.log('[SUCCESS]', msg);
    const div = document.createElement('div');
    div.className = 'toast-msg success';
    div.innerHTML = `<span>✅</span> <span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ================= INIT & NAVIGATION =================
document.addEventListener('DOMContentLoaded', () => {
    console.log('[INIT] DOMContentLoaded');
    
    if (new Date() > new Date(APP_CONFIG.EXPIRATION_DATE)) {
        document.body.innerHTML = "<h1 style='color:white;text-align:center;margin-top:50px;'>Session Expirée</h1>";
        return;
    }

    // Initialiser le canvas pour le scan
    scanCanvas = document.getElementById('canvas');
    if (scanCanvas) {
        scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    }

    // Restaurer les données utilisateur
    restoreUserData();
    checkRGPDStatus();
    
    if ($('multimodalCheck')) $('multimodalCheck').checked = false;
    
    // IMPORTANT: Attacher le gestionnaire d'événement ICI
    const saveBtn = $('saveLocation');
    if (saveBtn) {
        console.log('[INIT] Attachement du bouton saveLocation');
        saveBtn.addEventListener('click', handleSaveLocation);
    } else {
        console.error('[INIT] Bouton saveLocation non trouvé !');
    }
    
    console.log('[INIT] État initial:', { myUniqueId, myCoords, myEmoji });
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
            <p style="opacity:0.9; margin-top:5px;">Ces données permettent de réaliser l'atelier de manière interactive.</p>
            <h3 style="margin-top:20px; color:#e2e8f0;">Durée & Tiers</h3>
            <p style="opacity:0.9; margin-top:5px;">Stockage local + Google Sheet de l'animateur. Suppression sous <strong>7 jours</strong>.</p>
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
    console.log('[NAV] showStep:', n);
    
    if (typeof n === 'string') {
        document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
        const target = $(n);
        if (target) target.classList.add('active');
        stopAllCameras();
        return;
    }
    
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active', 'completed'));
    
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
    
    // Génération des QR codes
    if (n === 2) {
        console.log('[NAV] Step 2 - Génération QR code');
        console.log('[NAV] Données:', { myUniqueId, myCoords });
        setTimeout(() => genMyQRCode('qrcode'), 300);
    }
    if (n === 3) { 
        initGame(); 
        setTimeout(() => genMyQRCode('qrcodeStep3'), 300);
    }
    if (n === 4) {
        setTimeout(() => genMyQRCode('qrcodeStep4'), 300);
    }
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
    if (confirm("⚠️ Voulez-vous vraiment recommencer à zéro ?")) {
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

// ================= GEOLOC & PROFIL =================
async function handleSaveLocation() {
    console.log('[SAVE] Début sauvegarde');
    
    const addr = $('userAddress').value;
    const mode = $('transportMode').value;
    
    if (!addr || !mode) {
        return showError("Remplissez tous les champs");
    }

    const btn = $('saveLocation');
    btn.textContent = "Recherche..."; 
    btn.disabled = true;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();
        
        if (!data.length) {
            throw new Error("Adresse introuvable");
        }

        // Stocker les coordonnées
        myCoords = { 
            lat: parseFloat(data[0].lat), 
            lon: parseFloat(data[0].lon) 
        };
        myFullAddress = data[0].display_name;
        myTransportMode = mode;
        myDepartureTime = $('departureTime').value;

        // Générer l'ID et l'emoji si pas encore fait
        if (!myUniqueId) { 
            myUniqueId = generateUniqueId(); 
            console.log('[SAVE] Nouvel ID généré:', myUniqueId);
        }
        if (!myEmoji) { 
            myEmoji = generateEmojiPseudo(); 
            console.log('[SAVE] Nouvel emoji généré:', myEmoji);
        }

        // Sauvegarder en localStorage
        localStorage.setItem('userCoords', JSON.stringify(myCoords));
        localStorage.setItem('transportMode', myTransportMode);
        localStorage.setItem('departureTime', myDepartureTime);
        localStorage.setItem('fullAddress', myFullAddress);
        localStorage.setItem('myUniqueId', myUniqueId);
        localStorage.setItem('myEmoji', myEmoji);

        console.log('[SAVE] Données sauvegardées:', { 
            myUniqueId, 
            myEmoji, 
            myCoords,
            localStorage: {
                myUniqueId: localStorage.getItem('myUniqueId'),
                userCoords: localStorage.getItem('userCoords')
            }
        });

        // Afficher la section suivante
        $('locationSection').style.display = 'none';
        $('afterLocationSection').style.display = 'block';
        $('myEmojiDisplay').textContent = myEmoji;

        const addrDisplay = $('detectedAddress');
        if (addrDisplay) {
            addrDisplay.textContent = myFullAddress.split(',').slice(0, 2).join(',');
        }

        // Envoi Google Sheets (optionnel)
        if (googleScriptUrl) {
            const payload = {
                type: 'participant', 
                id: myUniqueId, 
                emoji: myEmoji, 
                lat: myCoords.lat, 
                lon: myCoords.lon,
                address: myFullAddress, 
                transport: myTransportMode, 
                transportMode2: myTransportMode2,
                mode1Days: mode1Days, 
                mode2Days: mode2Days, 
                departureTime: myDepartureTime
            };
            fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
                .catch(e => console.warn('[SAVE] Envoi Google Sheets échoué:', e));
        }

        showSuccess("Profil enregistré !");

    } catch (e) {
        console.error('[SAVE] Erreur:', e);
        showError(e.message);
    } finally {
        btn.textContent = "Valider ma localisation"; 
        btn.disabled = false;
    }
}

function restoreUserData() {
    console.log('[RESTORE] Début restauration');
    
    myUniqueId = localStorage.getItem('myUniqueId') || '';
    myEmoji = localStorage.getItem('myEmoji') || '';
    myFullAddress = localStorage.getItem('fullAddress') || '';
    myDepartureTime = localStorage.getItem('departureTime') || '07:30';
    
    const coordsStr = localStorage.getItem('userCoords');
    if (coordsStr) {
        try {
            myCoords = JSON.parse(coordsStr);
        } catch(e) {
            console.error('[RESTORE] Erreur parsing coords:', e);
            myCoords = null;
        }
    }
    
    myTransportMode = localStorage.getItem('transportMode') || '';
    myTransportMode2 = localStorage.getItem('transportMode2') || '';
    mode1Days = parseInt(localStorage.getItem('mode1Days') || '0');
    mode2Days = parseInt(localStorage.getItem('mode2Days') || '0');
    
    const savedParticipants = localStorage.getItem('participants');
    if (savedParticipants) { 
        try {
            participants = JSON.parse(savedParticipants); 
            scanCount = participants.length; 
        } catch(e) {
            console.error('[RESTORE] Erreur parsing participants:', e);
            participants = [];
            scanCount = 0;
        }
    }
    
    console.log('[RESTORE] Données restaurées:', { 
        myUniqueId, 
        myEmoji, 
        myCoords, 
        scanCount 
    });
}

// ================= CAMERA & QR =================
function genMyQRCode(elId) {
    console.log('[QR] Génération pour:', elId);
    
    const el = $(elId);
    if (!el) {
        console.error('[QR] Element non trouvé:', elId);
        return;
    }
    
    // Vérification des données
    console.log('[QR] Données disponibles:', { myUniqueId, myCoords, myEmoji });
    
    if (!myUniqueId) {
        console.error('[QR] myUniqueId manquant');
        el.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">⚠️ ID manquant<br><small>Retournez à l\'étape 1</small></p>';
        return;
    }
    
    if (!myCoords || !myCoords.lat || !myCoords.lon) {
        console.error('[QR] myCoords manquant ou invalide:', myCoords);
        el.innerHTML = '<p style="color:#ef4444; text-align:center; padding:20px;">⚠️ Position manquante<br><small>Retournez à l\'étape 1</small></p>';
        return;
    }
    
    // Vider l'élément
    el.innerHTML = '';
    
    // Créer les données du QR code (format compact et sécurisé)
    const qrData = JSON.stringify({ 
        id: myUniqueId, // Utiliser l'ID complet pour l'unicité
        lat: Number(myCoords.lat.toFixed(4)), // Réduire la précision pour la taille
        lon: Number(myCoords.lon.toFixed(4))
    });
    
    console.log('[QR] Données QR:', qrData);

    try {
        new QRCode(el, {
            text: qrData,
            width: 180, 
            height: 180,
            colorDark: "#0f172a", 
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.L // Niveau L important pour réduire la complexité
        });
        console.log('[QR] QR code généré avec succès');
    } catch(e) {
        console.error('[QR] Erreur génération:', e);
        el.innerHTML = '<p style="color:#ef4444; text-align:center;">Erreur QR: ' + e.message + '</p>';
    }
}

function startScanLoop(type) {
    console.log('[SCAN] Démarrage pour:', type);
    scanning = true;

    let camViewId, videoId, btnId, stopBtnId;

    if (type === 'group') {
        camViewId = 'groupCameraView';
        videoId = 'groupVideo';
        if ($('groupScanInterface')) $('groupScanInterface').style.display = 'block';
    } else {
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
        console.error("[SCAN] Video non trouvée:", videoId);
        return;
    }

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => {
            video.srcObject = stream;
            video.setAttribute("playsinline", true);
            video.play();
            console.log('[SCAN] Caméra démarrée');
            requestAnimationFrame(() => tick(video, type));
        })
        .catch(err => { 
            console.error("[SCAN] Erreur caméra:", err);
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
                scanCanvas = document.createElement('canvas');
                scanCanvas.id = 'canvas';
                scanCanvas.style.display = 'none';
                document.body.appendChild(scanCanvas);
            }
            scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
        }

        scanCanvas.width = video.videoWidth;
        scanCanvas.height = video.videoHeight;
        scanCtx.drawImage(video, 0, 0, scanCanvas.width, scanCanvas.height);
        
        const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });

        if (code) {
            console.log("[SCAN] QR détecté:", code.data);
            try {
                const data = JSON.parse(code.data);
                let success = false;

                // Compatibilité ancien/nouveau format
                if (data.e && !data.emoji) data.emoji = data.e;

                if (type === 'group') {
                    if (data.id) addMemberToGroup(data);
                }
                else if (type === 'company' && data.type === 'company') {
                    handleCompanyScan(data);
                    success = true;
                }
                else if (data.id && data.lat !== undefined) {
                    if (type === 'game') success = handleGameScan(data);
                    else if (type === 'positioning') success = handlePositioningScan(data);
                    else success = addParticipant(data);
                }

                if (success) stopAllCameras();

            } catch (e) { 
                // QR non-JSON, ignorer
            }
        }
    }
    if (scanning) requestAnimationFrame(() => tick(video, type));
}

function stopAllCameras() {
    console.log('[SCAN] Arrêt caméras');
    scanning = false;
    document.querySelectorAll('video').forEach(v => {
        if (v.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
    });
    document.querySelectorAll('.camera-container').forEach(e => e.style.display = 'none');

    ['scanBtn', 'gameScanBtn', 'positioningScanBtn'].forEach(id => { if ($(id)) $(id).style.display = 'block'; });
    ['stopCamBtn', 'stopGameCamBtn', 'stopPosCamBtn', 'stopCompCamBtn'].forEach(id => { if ($(id)) $(id).style.display = 'none'; });
}

// ================= PHASE CO-CONSTRUCTION (GROUPE) =================
function initGroupPhase() {
    const challenges = [
        "Le plus jeune du groupe",
        "Celui avec les cheveux les plus longs",
        "Celui qui habite le plus loin",
        "Celui qui est arrivé le premier ce matin"
    ];
    const winner = challenges[Math.floor(Math.random() * challenges.length)];
    $('leaderChallenge').innerHTML = `👑 Le chef est : <br><span style="color:#F59E0B; font-size:1.2em;">${winner}</span>`;
    
    $('startGroupBtn').style.display = 'none';
    $('groupScanInterface').style.display = 'block';
    
    currentGroup = [];
    updateGroupList();
}

function addMemberToGroup(data) {
    if(currentGroup.find(m => m.id === data.id)) return;
    if(data.id === myUniqueId) { showError("Vous êtes déjà le chef !"); return; }
    
    currentGroup.push(data);
    updateGroupList();
    showSuccess(`${data.emoji || data.e || '👤'} ajouté !`);
    
    scanning = false;
    setTimeout(() => { 
        scanning = true; 
        const video = $('groupVideo');
        if (video) requestAnimationFrame(() => tick(video, 'group')); 
    }, 1500);
}

function updateGroupList() {
    const list = $('groupMembersList');
    if (list) {
        list.innerHTML = currentGroup.map(m => `<div>✅ ${m.emoji || m.e || '👤'}</div>`).join('');
    }
    if ($('validateGroupBtn')) {
        $('validateGroupBtn').disabled = currentGroup.length < 1;
    }
}

function validateGroup() {
    stopAllCameras();
    
    sendToGoogleSheets({
        type: 'group_formation',
        leaderId: myUniqueId,
        members: currentGroup.map(m => m.id).join(',')
    });
    
    $('groupFormationSection').style.display = 'none';
    $('groupDiscussionSection').style.display = 'block';
}

function startDiscussion(type) {
    currentQuestions = type === 'close' ? QUESTIONS_CLOSE : QUESTIONS_FAR;
    questionIndex = 0;
    
    document.querySelectorAll('.coach-btn').forEach(b => b.classList.remove('selected'));
    if (event && event.target) event.target.classList.add('selected');
    
    $('dynamicQuestionCard').style.display = 'block';
    showNextQuestion();
}

function showNextQuestion() {
    if(questionIndex >= currentQuestions.length) {
        $('questionText').textContent = "👏 Tour de table terminé !";
        $('questionSubtext').textContent = "Prenez une note commune ci-dessous.";
        const btn = $('dynamicQuestionCard').querySelector('button');
        if (btn) btn.style.display = 'none';
        return;
    }
    
    const q = currentQuestions[questionIndex];
    $('questionText').textContent = q.q;
    $('questionSubtext').textContent = q.sub;
    
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
    const dLat = (lat2 - lat1) * Math.PI / 180; 
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addParticipant(data) {
    if (!myCoords) {
        showError("Votre position n'est pas définie");
        return false;
    }
    if (participants.find(p => p.id === data.id)) {
        showError("Déjà scanné !");
        return false;
    }
    if (data.id === myUniqueId) {
        showError("C'est votre propre QR !");
        return false;
    }

    const dist = haversineKm(myCoords.lat, myCoords.lon, data.lat, data.lon);
    participants.push({ ...data, distance: dist });
    localStorage.setItem('participants', JSON.stringify(participants));

    scanCount = participants.length;
    localStorage.setItem('scanCount', scanCount);
    
    if ($('scanCount')) $('scanCount').textContent = scanCount;
    if ($('step2Progress')) $('step2Progress').style.width = Math.min((scanCount / 20) * 100, 100) + '%';

    showSuccess(`Scan OK ! (${dist.toFixed(1)} km)`);

    if (participants.length >= APP_CONFIG.MIN_PARTICIPANTS_REQUIRED && $('goToStep3')) {
        $('goToStep3').disabled = false;
    }

    // Mini-challenge si proche
    if (dist < 5 && $('challengeSection')) {
        const chal = miniChallenges[Math.floor(Math.random() * miniChallenges.length)];
        $('challengeTitle').textContent = chal.title;
        $('challengeTask').textContent = chal.task;
        $('challengeSection').style.display = 'block';
        if ($('scanBtn')) $('scanBtn').style.display = 'none';
        $('continueChallengeBtn').onclick = () => {
            $('challengeSection').style.display = 'none';
            if ($('scanBtn')) $('scanBtn').style.display = 'block';
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
    if (!myCoords) return false;
    const dist = haversineKm(myCoords.lat, myCoords.lon, data.lat, data.lon);
    showSuccess(`📍 Distance: ${dist.toFixed(1)} km`);
    return true;
}

function initGame() {
    if (participants.length < 1) return;
    gameTargets = participants.sort((a, b) => a.distance - b.distance).slice(0, 5);
    scannedTargets = []; 
    score = 0; 
    attemptsLeft = 5;
    updateGameUI();
}

function updateGameUI() {
    if ($('scoreBadge')) $('scoreBadge').textContent = `${score}/3`;
    if ($('attemptsLeft')) $('attemptsLeft').textContent = attemptsLeft;
    
    let html = '';
    gameTargets.forEach((t, i) => {
        const isScanned = scannedTargets.includes(t.id);
        html += `
        <div class="participant-card ${isScanned ? 'scanned' : 'target'}">
            <div><strong>Voisin ${i + 1}</strong><br><small>${t.distance.toFixed(1)} km</small></div>
            <div class="icon-badge">${isScanned ? '✅' : '🎯'}</div>
        </div>`;
    });
    if ($('targetList')) $('targetList').innerHTML = html;
}

function handleGameScan(data) {
    const target = gameTargets.find(t => t.id === data.id);
    if (!target) { 
        showError("Ce n'est pas un voisin proche !"); 
        attemptsLeft--;
        updateGameUI();
        if (attemptsLeft <= 0 && $('gameResult')) {
            $('gameResult').innerHTML = `<div class="error-msg">😞 Partie terminée</div>`;
            if ($('gameScanBtn')) $('gameScanBtn').style.display = 'none';
        }
        return false; 
    }
    if (scannedTargets.includes(data.id)) { 
        showError("Déjà trouvé !"); 
        return false; 
    }

    scannedTargets.push(data.id);
    score++;
    showSuccess("Bravo ! Voisin trouvé.");
    updateGameUI();

    if (score >= 3 && $('gameResult')) {
        $('gameResult').innerHTML = `<div class="success-msg">🎉 GAGNÉ !</div>`;
        if ($('gameScanBtn')) $('gameScanBtn').style.display = 'none';
        sendToGoogleSheets({
            type: 'game_result', participantId: myUniqueId, score: score,
            attempts: 5 - attemptsLeft, title: 'Gagné'
        });
    }
    return true;
}

function resetGame() {
    scannedTargets = []; score = 0; attemptsLeft = 5;
    updateGameUI();
    if ($('gameScanBtn')) $('gameScanBtn').style.display = 'block';
    if ($('gameResult')) $('gameResult').innerHTML = '';
}

// ================= FORMULAIRE =================
function initStep6Form() {
    const createFields = (listId, items, type) => {
        const list = $(listId);
        if (!list || list.children.length > 0) return;

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
    if (prioSelect) prioSelect.style.display = checkbox.checked ? 'block' : 'none';

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
    if ($('commitmentValue')) $('commitmentValue').textContent = commitmentLevel;
}

function showCompanyScan() {
    const noteField = $('groupNote');
    if(noteField) localStorage.setItem('groupNote', noteField.value);

    const formatData = (obj, listId) => {
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

    let altStr = formatData(selectedAlternatives, 'alternativesList');
    let consStr = formatData(selectedConstraints, 'constraintsList');
    let levStr = formatData(selectedLevers, 'leversList');

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
    
    const coConst = $('stepCoConstruction');
    if(coConst) coConst.classList.remove('active');

    startScanLoop('company');
}

// ================= ADMIN & RAPPORT =================
function showAdminPage() {
    showStep('adminPage');
    $('adminPage').classList.add('active');
    if ($('adminPanel')) $('adminPanel').style.display = 'none';
    if ($('adminLogin')) $('adminLogin').style.display = 'block';
}

function adminLogin() {
    if ($('adminPassword').value === APP_CONFIG.ADMIN_PASSWORD) {
        $('adminLogin').style.display = 'none';
        $('adminPanel').style.display = 'block';
        refreshAdminStats();
    } else { 
        showError("Mot de passe incorrect"); 
    }
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
    if ($('totalParticipants')) $('totalParticipants').textContent = total;
    if (participants.length > 0) {
        const avg = participants.reduce((acc, p) => acc + p.distance, 0) / participants.length;
        if ($('avgDistance')) $('avgDistance').textContent = avg.toFixed(1);
    }
}

function handleCompanyScan(data) {
    companyCoords = { lat: data.lat, lon: data.lon };
    const dist = haversineKm(myCoords.lat, myCoords.lon, companyCoords.lat, companyCoords.lon);

    let factor = CO2_FACTORS[myTransportMode] || 0.1;
    const co2 = Math.round(dist * 2 * 220 * factor * 0.3);

    if ($('co2Savings')) $('co2Savings').textContent = co2;

    stopAllCameras();
    $('companyScanPage').classList.remove('active');
    $('reportPage').classList.add('active');

    sendToGoogleSheets({ type: 'company_distance', participantId: myUniqueId, emoji: myEmoji, distance: dist });
}

function sendToGoogleSheets(data) {
    if (!googleScriptUrl) return;
    fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) })
        .catch(e => console.error("Erreur envoi:", e));
}

async function exportExcel() {
    const btn = document.querySelector('#adminPanel .btn-primary');
    if (btn) btn.innerText = "Téléchargement...";

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
        const localParts = participants.map(p => ({ Emoji: p.emoji || p.e, Distance: p.distance }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(localParts), "Scans Locaux");
        XLSX.writeFile(wb, "Export_Local.xlsx");
    }
    if (btn) btn.innerText = "📥 Exporter Excel";
}

function refreshAdminStats() {
    if ($('adminTotalUsers')) $('adminTotalUsers').textContent = participants.length + 1;
    if (participants.length > 0) {
        const avg = participants.reduce((acc, p) => acc + p.distance, 0) / participants.length;
        if ($('adminAvgDistance')) $('adminAvgDistance').textContent = avg.toFixed(1);
    }
}

function generatePDF() {
    const alt = localStorage.getItem('finalAlternatives') || "Aucune";
    const cons = localStorage.getItem('finalConstraints') || "Aucune";
    const lev = localStorage.getItem('finalLevers') || "Aucun";
    const groupNote = localStorage.getItem('groupNote') || "";

    const win = window.open('', '_blank');
    win.document.write(`
    <html><head><title>Rapport ${myEmoji}</title>
    <style>
        body{font-family:sans-serif;padding:20px;color:#333;max-width:800px;margin:0 auto;} 
        h1{color:#4F46E5;text-align:center;border-bottom:2px solid #4F46E5;padding-bottom:10px;} 
        h2{color:#4F46E5;margin-top:20px;font-size:1.2em;}
        .card{border:1px solid #e2e8f0;padding:20px;border-radius:10px;margin-bottom:20px;background:#f8fafc;}
        .btn{display:block;width:100%;padding:15px;background:#4F46E5;color:white;text-align:center;border-radius:8px;margin-top:20px;font-weight:bold;border:none;cursor:pointer;}
        .btn-close{background:#ef4444;margin-top:10px;}
        ul{margin:0;padding-left:20px;} li{margin-bottom:5px;}
        .note-box{background:#fffbeb;padding:10px;border-left:4px solid #f59e0b;margin-top:10px;}
    </style></head><body>
    <h1>🌱 Bilan Mobilité - GoDifferent</h1>
    <div class="card"><h2>👤 Profil</h2><p><strong>Pseudo:</strong> ${myEmoji}</p><p><strong>Adresse:</strong> ${myFullAddress}</p><p><strong>Mode:</strong> ${myTransportMode}</p></div>
    <div class="card"><h2>🌍 Impact</h2><p><strong>Gain potentiel:</strong> <span style="color:#10b981;font-size:1.5em;">${$('co2Savings') ? $('co2Savings').textContent : '0'} kg CO2/an</span></p></div>
    <div class="card"><h2>💡 Propositions</h2><p><strong>Alternatives:</strong></p><ul>${alt.split(', ').map(i => `<li>${i}</li>`).join('')}</ul><p><strong>Contraintes:</strong></p><ul>${cons.split(', ').map(i => `<li>${i}</li>`).join('')}</ul><p><strong>Leviers:</strong></p><ul>${lev.split(', ').map(i => `<li>${i}</li>`).join('')}</ul><div class="note-box"><strong>📝 Note:</strong><br>${groupNote || '(aucune)'}</div><p><strong>Engagement:</strong> ${commitmentLevel}%</p></div>
    <button onclick="window.print()" class="btn">🖨️ Imprimer</button>
    <button onclick="window.close()" class="btn btn-close">❌ Fermer</button>
    </body></html>`);
    win.document.close();
}
