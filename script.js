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
let selectedAlternatives={}, selectedConstraints=[], selectedLevers=[], commitmentLevel=80;
let googleScriptUrl = APP_CONFIG.GOOGLE_SCRIPT_URL;

const EMOJI_SET = ['🦸','🐼','🦁','🐻','🦊','🐱','🐯','🦄','🐸','🦉','🐙','🦋','🐨','🦒','🦘','🦥','🐲','🦕'];
const CO2_FACTORS = { 'car-thermal': 0.193, 'car-electric': 0.020, 'carpool': 0.096, 'train': 0.006, 'bus': 0.103, 'bike': 0, 'ebike': 0.002, 'walk': 0, 'remote': 0 };
const ALTERNATIVES = ["Covoiturage", "Autopartage", "Transports en commun", "Train/RER", "Vélo", "Vélo électrique", "Marche", "Vélo-taf", "Télétravail", "Horaires décalés", "Autre (précisez)"];
const CONSTRAINTS = ["Horaires décalés", "Enfants", "Matériel", "Distance >30km", "Pas de TC", "Pas de piste cyclable", "Météo", "Santé", "Flexibilité", "Coût", "Autre (précisez)"];
const LEVERS = ["Prime mobilité", "Abonnement TC 75%", "Parking vélo", "Douches", "Recharge élec", "Covoiturage interne", "Vélos fonction", "Formation", "Autre (précisez)"];
const miniChallenges = [
    { title: "🤝 Connecteurs", task: "Présentez-vous mutuellement à une 3ème personne" },
    { title: "🔤 Initiales", task: "Scannez quelqu'un avec la même initiale" },
    { title: "🕵️ Voisinage", task: "Devinez le quartier de cette personne" },
    { title: "📸 Selfie", task: "Faites un selfie mobilité !" }
];

// ================= UTILITAIRES =================
function $(id) { return document.getElementById(id); }
function generateUniqueId() { return Math.random().toString(36).substr(2, 15); }
function generateEmojiPseudo() { return EMOJI_SET[Math.floor(Math.random()*EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random()*EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random()*EMOJI_SET.length)]; }

function showError(msg) {
    // Affiche l'erreur dans la div dédiée si elle existe, sinon alerte
    const errDiv = document.querySelector('.step.active .error-msg');
    if (errDiv) {
        errDiv.textContent = msg;
        setTimeout(() => errDiv.textContent = '', 3000);
    } else {
        alert("❌ " + msg);
    }
}

function showSuccess(msg) {
    // Petit toast de succès
    const div = document.createElement('div');
    div.className = 'success-msg';
    div.style.position = 'fixed'; div.style.top = '20px'; div.style.left='50%'; div.style.transform='translateX(-50%)';
    div.style.background = 'rgba(16, 185, 129, 0.9)'; div.style.padding = '10px 20px'; div.style.borderRadius = '20px'; div.style.zIndex='9999';
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ================= INIT & NAVIGATION =================
document.addEventListener('DOMContentLoaded', () => {
    if(new Date() > new Date(APP_CONFIG.EXPIRATION_DATE)) {
        document.body.innerHTML = "<h1 style='color:white;text-align:center;margin-top:50px;'>Session Expirée</h1>";
        return;
    }
    
    restoreUserData();
    checkRGPDStatus();
});

function checkRGPDStatus() {
    if(localStorage.getItem('rgpdAccepted') === 'true') {
        rgpdAccepted = true;
        if($('rgpdNotice')) $('rgpdNotice').style.display = 'none';
    }
}

function acceptRGPD() {
    rgpdAccepted = true;
    localStorage.setItem('rgpdAccepted', 'true');
    $('rgpdNotice').style.display = 'none';
}

function showStep(n) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
    
    const target = $(`step${n}`);
    if(target) target.classList.add('active');
    
    // Update dots
    for(let i=1; i<=n; i++) {
        const dot = $(`step${i}Dot`);
        if(dot) {
            dot.classList.add('active');
            if(i < n) dot.classList.add('completed');
        }
    }
    
    stopAllCameras();
    
    // Init spécifique par étape
    if(n===2) setTimeout(()=>genMyQRCode('qrcode'), 100);
    if(n===3) { initGame(); setTimeout(()=>genMyQRCode('qrcodeStep3'), 100); }
    if(n===4) setTimeout(()=>genMyQRCode('qrcodeStep4'), 100);
    if(n===5) updateStep5Stats();
    if(n===6) initStep6Form();
    
    window.scrollTo(0,0);
}

function checkAccessCode() {
    if(!rgpdAccepted) return showError("Veuillez accepter le RGPD.");
    const code = $('accessCodeInput').value.trim();
    if(APP_CONFIG.VALID_ACCESS_CODES.includes(code)) {
        $('loginSection').style.display = 'none';
        $('locationSection').style.display = 'block';
    } else {
        showError("Code invalide");
    }
}

// ================= GEOLOC & PROFIL =================
$('saveLocation').onclick = async () => {
    const addr = $('userAddress').value;
    const mode = $('transportMode').value;
    
    if(!addr || !mode) return showError("Remplissez tous les champs");
    
    try {
        const btn = $('saveLocation');
        btn.textContent = "Recherche..."; btn.disabled = true;
        
        // Simuler délai API si Nominatim
        await new Promise(r => setTimeout(r, 1000));
        
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();
        
        if(!data.length) throw new Error("Adresse introuvable");
        
        myCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        myFullAddress = data[0].display_name;
        myTransportMode = mode;
        myDepartureTime = $('departureTime').value;
        
        // Sauvegarde
        localStorage.setItem('userCoords', JSON.stringify(myCoords));
        localStorage.setItem('transportMode', myTransportMode);
        
        if(!myUniqueId) {
            myUniqueId = generateUniqueId();
            localStorage.setItem('myUniqueId', myUniqueId);
        }
        if(!myEmoji) {
            myEmoji = generateEmojiPseudo();
            localStorage.setItem('myEmoji', myEmoji);
        }
        
        // UI Update
        $('locationSection').style.display = 'none';
        $('afterLocationSection').style.display = 'block';
        $('myEmojiDisplay').textContent = myEmoji;
        $('detectedAddress').textContent = myFullAddress.split(',')[0]; // Juste le début
        
        // Envoi Sheet (Fire & Forget)
        const payload = {
            type: 'participant', id: myUniqueId, emoji: myEmoji, lat: myCoords.lat, lon: myCoords.lon, 
            address: myFullAddress, mode: myTransportMode
        };
        if(googleScriptUrl) fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        
    } catch(e) {
        showError(e.message);
        $('saveLocation').textContent = "Valider ma localisation";
        $('saveLocation').disabled = false;
    }
};

function restoreUserData() {
    myUniqueId = localStorage.getItem('myUniqueId');
    myEmoji = localStorage.getItem('myEmoji');
    const coords = localStorage.getItem('userCoords');
    if(coords) myCoords = JSON.parse(coords);
    myTransportMode = localStorage.getItem('transportMode');
    scanCount = parseInt(localStorage.getItem('scanCount') || '0');
}

// ================= CAMERA & QR =================
function genMyQRCode(elId) {
    const el = $(elId);
    if(!el) return;
    el.innerHTML = '';
    new QRCode(el, {
        text: JSON.stringify({ id: myUniqueId, lat: myCoords.lat, lon: myCoords.lon }),
        width: 180, height: 180,
        colorDark : "#0f172a", colorLight : "#ffffff"
    });
}

function startScanLoop(type) {
    scanning = true;
    
    // Show/Hide UI elements
    const camViewId = type === 'game' ? 'gameCameraView' : (type === 'company' ? 'companyCameraView' : (type === 'positioning' ? 'positioningCameraView' : 'cameraView'));
    const videoId = type === 'game' ? 'gameVideo' : (type === 'company' ? 'companyVideo' : (type === 'positioning' ? 'positioningVideo' : 'video'));
    const btnId = type === 'game' ? 'gameScanBtn' : (type === 'company' ? null : (type === 'positioning' ? 'positioningScanBtn' : 'scanBtn'));
    const stopBtnId = type === 'game' ? 'stopGameCamBtn' : (type === 'company' ? 'stopCompCamBtn' : (type === 'positioning' ? 'stopPosCamBtn' : 'stopCamBtn'));

    if($(btnId)) $(btnId).style.display = 'none';
    if($(camViewId)) $(camViewId).style.display = 'block';
    if($(stopBtnId)) $(stopBtnId).style.display = 'block'; // Bouton stop dédié

    const video = $(videoId);
    
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        requestAnimationFrame(() => tick(video, type));
    })
    .catch(err => {
        showError("Erreur caméra");
        stopAllCameras();
    });
}

function tick(video, type) {
    if(!scanning) return;
    if(video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        const code = jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data, canvas.width, canvas.height);
        
        if(code) {
            try {
                const data = JSON.parse(code.data);
                let success = false;
                
                if(type === 'company' && data.type === 'company') {
                    handleCompanyScan(data); success = true;
                } else if(data.id && data.lat) {
                    if(type === 'game') success = handleGameScan(data);
                    else success = addParticipant(data);
                }
                
                if(success) stopAllCameras();
                
            } catch(e) { console.log("QR non reconnu"); }
        }
    }
    if(scanning) requestAnimationFrame(() => tick(video, type));
}

function stopAllCameras() {
    scanning = false;
    document.querySelectorAll('video').forEach(v => {
        if(v.srcObject) v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
    });
    document.querySelectorAll('.camera-container').forEach(e => e.style.display = 'none');
    
    // Reset boutons
    ['scanBtn', 'gameScanBtn', 'positioningScanBtn'].forEach(id => { if($(id)) $(id).style.display = 'block'; });
    ['stopCamBtn', 'stopGameCamBtn', 'stopPosCamBtn', 'stopCompCamBtn'].forEach(id => { if($(id)) $(id).style.display = 'none'; });
}

// ================= LOGIQUE METIER =================
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2-lat1)*Math.PI/180; const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function addParticipant(data) {
    if(participants.find(p => p.id === data.id)) return false;
    if(data.id === myUniqueId) return false;
    
    const dist = haversineKm(myCoords.lat, myCoords.lon, data.lat, data.lon);
    participants.push({ ...data, distance: dist });
    
    scanCount++;
    localStorage.setItem('scanCount', scanCount);
    $('scanCount').textContent = scanCount;
    $('step2Progress').style.width = Math.min((scanCount/20)*100, 100) + '%';
    
    showSuccess(`Scan OK ! (${dist.toFixed(1)} km)`);
    
    // Débloquer étape suivante
    if(participants.length >= APP_CONFIG.MIN_PARTICIPANTS_REQUIRED) $('goToStep3').disabled = false;
    
    // Challenge aléatoire
    if(dist < 5) {
        const chal = miniChallenges[Math.floor(Math.random()*miniChallenges.length)];
        $('challengeTitle').textContent = chal.title;
        $('challengeTask').textContent = chal.task;
        $('challengeSection').style.display = 'block';
        $('scanBtn').style.display = 'none';
        $('continueChallengeBtn').onclick = () => {
            $('challengeSection').style.display = 'none';
            $('scanBtn').style.display = 'block';
        };
    }
    
    return true;
}

// ================= JEU VOISINS =================
function initGame() {
    if(participants.length < 1) return;
    // Trier par distance
    gameTargets = participants.sort((a,b) => a.distance - b.distance).slice(0, 5);
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
            <div>
                <strong>Voisin ${i+1}</strong>
                <br><small>${t.distance.toFixed(1)} km</small>
            </div>
            <div class="icon-badge">${isScanned ? '✅' : '🎯'}</div>
        </div>`;
    });
    $('targetList').innerHTML = html;
}

function handleGameScan(data) {
    const target = gameTargets.find(t => t.id === data.id);
    if(!target) { showError("Ce n'est pas un voisin proche !"); return false; }
    
    if(scannedTargets.includes(data.id)) { showError("Déjà trouvé !"); return false; }
    
    scannedTargets.push(data.id);
    score++;
    showSuccess("Bravo ! Voisin trouvé.");
    updateGameUI();
    
    if(score >= 3) {
        $('gameResult').innerHTML = `<div class="success-msg">🎉 GAGNÉ !</div>`;
        $('gameScanBtn').style.display = 'none';
    }
    return true;
}

function resetGame() {
    scannedTargets = []; score = 0; attemptsLeft = 5;
    updateGameUI();
    $('gameScanBtn').style.display = 'block';
    $('gameResult').innerHTML = '';
}

// ================= FORMULAIRE & ENTREPRISE =================
function initStep6Form() {
    // Remplissage dynamique (simplifié)
    const altList = $('alternativesList');
    if(altList.children.length === 0) {
        ALTERNATIVES.forEach((alt, i) => {
            altList.innerHTML += `
            <div class="checkbox-item">
                <input type="checkbox" id="alt${i}" onchange="this.checked ? selectedAlternatives['${alt}']=1 : delete selectedAlternatives['${alt}']">
                <label>${alt}</label>
            </div>`;
        });
        // Idem pour contraintes et leviers... (je raccourcis pour la lisibilité)
    }
}

function showCompanyScan() {
    // Ici on enverrait les données du formulaire...
    showStep('companyScanPage'); // Utilise l'ID direct
    $('companyScanPage').classList.add('active'); // Force display
    // Masque step 6
    $('step6').classList.remove('active');
    startScanLoop('company');
}

function handleCompanyScan(data) {
    companyCoords = { lat: data.lat, lon: data.lon };
    // Calcul CO2 fictif
    const dist = haversineKm(myCoords.lat, myCoords.lon, companyCoords.lat, companyCoords.lon);
    const co2 = Math.round(dist * 2 * 220 * 0.1); // Approx
    $('co2Savings').textContent = co2;
    
    stopAllCameras();
    $('companyScanPage').classList.remove('active');
    $('reportPage').classList.add('active');
}

// ================= ADMIN =================
function adminLogin() {
    if($('adminPassword').value === APP_CONFIG.ADMIN_PASSWORD) {
        $('adminLogin').style.display = 'none';
        $('adminPanel').style.display = 'block';
    } else {
        showError("Mot de passe incorrect");
    }
}

function generateCompanyQR() {
    const addr = $('companyAddressInput').value;
    // Ici appel API geocode... simplifié pour l'exemple
    // On simule
    $('companyQrcode').innerHTML = '';
    new QRCode($('companyQrcode'), {
        text: JSON.stringify({ type: 'company', lat: 48.8566, lon: 2.3522 }), // Paris
        width: 200, height: 200
    });
    $('companyQRSection').style.display = 'block';
}
