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

// TOASTS LISIBLES
function showError(msg) {
    const div = document.createElement('div');
    div.className = 'toast-msg error';
    div.innerHTML = `<span>❌</span> <span>${msg}</span>`;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
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
    if(new Date() > new Date(APP_CONFIG.EXPIRATION_DATE)) {
        document.body.innerHTML = "<h1 style='color:white;text-align:center;margin-top:50px;'>Session Expirée</h1>";
        return;
    }
    restoreUserData();
    checkRGPDStatus();
    if($('multimodalCheck')) $('multimodalCheck').checked = false;
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
        if(target) target.classList.add('active');
        stopAllCameras();
        return;
    }
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active'));
    const target = $(`step${n}`);
    if(target) target.classList.add('active');
    for(let i=1; i<=n; i++) {
        const dot = $(`step${i}Dot`);
        if(dot) {
            dot.classList.add('active');
            if(i < n) dot.classList.add('completed');
        }
    }
    stopAllCameras();
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

// ================= RESET =================
function resetGameSequence() {
    if(confirm("⚠️ ATTENTION : Voulez-vous vraiment recommencer à zéro ?\n\nCela effacera votre profil et vos scans.")) {
        localStorage.clear();
        location.reload(true);
    }
}

// ================= MULTIMODAL =================
function toggleMultimodal() {
    if($('multimodalCheck').checked) $('multimodalModal').classList.add('active');
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
    new QRCode($('inviteQrcode'), { text: window.location.href, width: 200, height: 200, colorDark : "#0f172a", colorLight : "#ffffff" });
    startInviteTimer();
}
function startInviteTimer() {
    let countdown = 30;
    const timerDisplay = $('inviteTimer');
    if(inviteCountdownInterval) clearInterval(inviteCountdownInterval);
    timerDisplay.innerHTML = `⏱️ Retour dans <strong>${countdown}s</strong>`;
    inviteCountdownInterval = setInterval(() => {
        countdown--;
        timerDisplay.innerHTML = `⏱️ Retour dans <strong>${countdown}s</strong>`;
        if(countdown <= 0) { clearInterval(inviteCountdownInterval); showStep(2); }
    }, 1000);
}
function extendInviteTimer() { startInviteTimer(); }

// ================= GEOLOC & PROFIL =================
$('saveLocation').onclick = async () => {
    const addr = $('userAddress').value;
    const mode = $('transportMode').value;
    if(!addr || !mode) return showError("Remplissez tous les champs");
    
    try {
        $('saveLocation').textContent = "Recherche..."; $('saveLocation').disabled = true;
        
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();
        if(!data.length) throw new Error("Adresse introuvable");
        
        myCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        myFullAddress = data[0].display_name;
        myTransportMode = mode;
        myDepartureTime = $('departureTime').value;
        
        localStorage.setItem('userCoords', JSON.stringify(myCoords));
        localStorage.setItem('transportMode', myTransportMode);
        localStorage.setItem('departureTime', myDepartureTime);
        localStorage.setItem('fullAddress', myFullAddress);
        
        if(!myUniqueId) { myUniqueId = generateUniqueId(); localStorage.setItem('myUniqueId', myUniqueId); }
        if(!myEmoji) { myEmoji = generateEmojiPseudo(); localStorage.setItem('myEmoji', myEmoji); }
        
        $('locationSection').style.display = 'none';
        $('afterLocationSection').style.display = 'block';
        $('myEmojiDisplay').textContent = myEmoji;
        $('detectedAddress').textContent = myFullAddress.split(',')[0];
        
        const payload = {
            type: 'participant', id: myUniqueId, emoji: myEmoji, lat: myCoords.lat, lon: myCoords.lon, 
            address: myFullAddress, transport: myTransportMode, transportMode2: myTransportMode2,
            mode1Days: mode1Days, mode2Days: mode2Days, departureTime: myDepartureTime
        };
        if(googleScriptUrl) fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
        
    } catch(e) {
        showError(e.message);
        $('saveLocation').textContent = "Valider ma localisation"; $('saveLocation').disabled = false;
    }
};

function restoreUserData() {
    myUniqueId = localStorage.getItem('myUniqueId');
    myEmoji = localStorage.getItem('myEmoji');
    const coords = localStorage.getItem('userCoords');
    if(coords) myCoords = JSON.parse(coords);
    myTransportMode = localStorage.getItem('transportMode');
    myTransportMode2 = localStorage.getItem('transportMode2') || '';
    mode1Days = parseInt(localStorage.getItem('mode1Days') || '0');
    mode2Days = parseInt(localStorage.getItem('mode2Days') || '0');
    const saved = localStorage.getItem('participants');
    if(saved) { participants = JSON.parse(saved); scanCount = participants.length; } else { scanCount = 0; }
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
    const camViewId = type === 'game' ? 'gameCameraView' : (type === 'company' ? 'companyCameraView' : (type === 'positioning' ? 'positioningCameraView' : 'cameraView'));
    const videoId = type === 'game' ? 'gameVideo' : (type === 'company' ? 'companyVideo' : (type === 'positioning' ? 'positioningVideo' : 'video'));
    const btnId = type === 'game' ? 'gameScanBtn' : (type === 'company' ? null : (type === 'positioning' ? 'positioningScanBtn' : 'scanBtn'));
    const stopBtnId = type === 'game' ? 'stopGameCamBtn' : (type === 'company' ? 'stopCompCamBtn' : (type === 'positioning' ? 'stopPosCamBtn' : 'stopCamBtn'));

    if(btnId && $(btnId)) $(btnId).style.display = 'none';
    if($(camViewId)) $(camViewId).style.display = 'block';
    if($(stopBtnId)) $(stopBtnId).style.display = 'block';

    const video = $(videoId);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        requestAnimationFrame(() => tick(video, type));
    })
    .catch(err => { showError("Erreur caméra"); stopAllCameras(); });
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
                if(type === 'company' && data.type === 'company') { handleCompanyScan(data); success = true; }
                else if(data.id && data.lat) {
                    if(type === 'game') success = handleGameScan(data);
                    else if(type === 'positioning') success = handlePositioningScan(data);
                    else success = addParticipant(data);
                }
                if(success) stopAllCameras();
            } catch(e) {}
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
    localStorage.setItem('participants', JSON.stringify(participants));
    
    scanCount = participants.length;
    localStorage.setItem('scanCount', scanCount);
    $('scanCount').textContent = scanCount;
    $('step2Progress').style.width = Math.min((scanCount/20)*100, 100) + '%';
    
    showSuccess(`Scan OK ! (${dist.toFixed(1)} km)`);
    
    if(participants.length >= APP_CONFIG.MIN_PARTICIPANTS_REQUIRED) $('goToStep3').disabled = false;
    
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
    if(participants.length < 1) return;
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
            <div><strong>Voisin ${i+1}</strong><br><small>${t.distance.toFixed(1)} km</small></div>
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
    const altList = $('alternativesList');
    if(altList.children.length > 0) return;

    ALTERNATIVES.forEach((alt, i) => {
        const isOther = alt.toLowerCase().includes("autre");
        let html = `
        <div class="checkbox-item-wrapper">
            <div class="checkbox-item">
                <input type="checkbox" id="alt${i}" onchange="handleOptionChange(this, 'alt', '${alt}', ${i}, ${isOther})">
                <label for="alt${i}" style="flex:1;">${alt}</label>
                <select id="prioAlt${i}" class="prio-select" style="display:none; width:auto; padding:2px;" onchange="selectedAlternatives['${alt}'] = this.value">
                    <option value="1">Prio 1</option>
                    <option value="2">Prio 2</option>
                    <option value="3">Prio 3</option>
                </select>
            </div>`;
        if(isOther) html += `<input type="text" id="altInput${i}" class="other-input" placeholder="Précisez..." style="display:none;">`;
        html += `</div>`;
        altList.innerHTML += html;
    });
    
    const constList = $('constraintsList');
    CONSTRAINTS.forEach((item, i) => {
        const isOther = item.toLowerCase().includes("autre");
        let html = `<div class="checkbox-item-wrapper"><div class="checkbox-item">
            <input type="checkbox" id="cons${i}" onchange="handleOptionChange(this, 'cons', '${item}', ${i}, ${isOther})">
            <label for="cons${i}">${item}</label></div>`;
        if(isOther) html += `<input type="text" id="consInput${i}" class="other-input" placeholder="Précisez..." style="display:none;">`;
        html += `</div>`;
        constList.innerHTML += html;
    });

    const levList = $('leversList');
    LEVERS.forEach((item, i) => {
        const isOther = item.toLowerCase().includes("autre");
        let html = `<div class="checkbox-item-wrapper"><div class="checkbox-item">
            <input type="checkbox" id="lev${i}" onchange="handleOptionChange(this, 'lev', '${item}', ${i}, ${isOther})">
            <label for="lev${i}">${item}</label></div>`;
        if(isOther) html += `<input type="text" id="levInput${i}" class="other-input" placeholder="Précisez..." style="display:none;">`;
        html += `</div>`;
        levList.innerHTML += html;
    });
}

function handleOptionChange(checkbox, type, name, index, isOther) {
    if(isOther) {
        const input = document.getElementById(`${type}Input${index}`);
        if(input) input.style.display = checkbox.checked ? 'block' : 'none';
    }
    if(type === 'alt') {
        const prioSelect = document.getElementById(`prioAlt${index}`);
        if(prioSelect) {
            prioSelect.style.display = checkbox.checked ? 'block' : 'none';
            if(checkbox.checked) selectedAlternatives[name] = "1"; 
            else delete selectedAlternatives[name];
        }
    } else if (type === 'cons') {
        if(checkbox.checked) selectedConstraints[name] = "1"; else delete selectedConstraints[name];
    } else if (type === 'lev') {
        if(checkbox.checked) selectedLevers[name] = "1"; else delete selectedLevers[name];
    }
}

function updateCommitmentValue() {
    commitmentLevel = parseInt($('commitmentRange').value);
    $('commitmentValue').textContent = commitmentLevel;
}

function showCompanyScan() {
    let altStr = Object.entries(selectedAlternatives).map(([k,v]) => {
        if(k.toLowerCase().includes("autre")) {
            const inputs = document.querySelectorAll('#alternativesList .other-input');
            for(let inp of inputs) { if(inp.style.display !== 'none') return `Autre: ${inp.value} (Prio ${v})`; }
        }
        return `${k} (Prio ${v})`;
    }).join(', ');

    let consStr = Object.keys(selectedConstraints).join(', ');
    let levStr = Object.keys(selectedLevers).join(', ');

    sendToGoogleSheets({
        type: 'propositions', participantId: myUniqueId, emoji: myEmoji,
        alternatives: altStr, contraintes: consStr, leviers: levStr, engagement: commitmentLevel
    });

    showStep('companyScanPage');
    $('companyScanPage').classList.add('active');
    $('step6').classList.remove('active');
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
    if($('adminPassword').value === APP_CONFIG.ADMIN_PASSWORD) {
        $('adminLogin').style.display = 'none';
        $('adminPanel').style.display = 'block';
        refreshAdminStats();
    } else { showError("Mot de passe incorrect"); }
}

async function generateCompanyQR() {
    const addr = $('companyAddressInput').value;
    if(!addr) return showError("Entrez une adresse");
    
    try {
        $('companyQrcode').innerHTML = 'Génération...';
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();
        
        if(!data.length) throw new Error("Adresse introuvable");
        
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        
        $('companyQrcode').innerHTML = '';
        new QRCode($('companyQrcode'), {
            text: JSON.stringify({ type: 'company', lat: lat, lon: lon }),
            width: 200, height: 200
        });
        $('companyQRSection').style.display = 'flex';
        
    } catch(e) {
        showError("Erreur adresse");
        $('companyQrcode').innerHTML = '';
    }
}

function updateStep5Stats() {
    const total = participants.length + 1;
    $('totalParticipants').textContent = total;
    if(participants.length > 0) {
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
    if(!googleScriptUrl) return;
    fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) })
        .catch(e => console.error("Erreur envoi", e));
}

function resetAllData() {
    if(confirm("⚠️ DANGER : Pour tout effacer, tapez 'SUPPRIMER'")) {
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
        if(data.participants) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.participants), "Participants");
        if(data.scans) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.scans), "Scans");
        XLSX.writeFile(wb, "Atelier_Mobilite_Export.xlsx");
        showSuccess("Export réussi !");
        
    } catch(e) {
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
    if(participants.length > 0) {
        const avg = participants.reduce((acc, p) => acc + p.distance, 0) / participants.length;
        $('adminAvgDistance').textContent = avg.toFixed(1);
    }
}

function generatePDF() {
    const win = window.open('', '_blank');
    const content = `
    <html><head><title>Rapport ${myEmoji}</title>
    <style>body{font-family:sans-serif;padding:20px;color:#333;} h1{color:#4F46E5;} .card{border:1px solid #ddd;padding:15px;border-radius:10px;margin-bottom:15px;background:#f9f9f9;}</style>
    </head><body>
    <h1>🌱 Mon Bilan Mobilité</h1>
    <div class="card">
        <h3>👤 Profil</h3>
        <p><strong>Pseudo :</strong> ${myEmoji}</p>
        <p><strong>Adresse :</strong> ${myFullAddress}</p>
        <p><strong>Mode :</strong> ${myTransportMode}</p>
    </div>
    <div class="card">
        <h3>🌍 Impact</h3>
        <p><strong>Gain potentiel :</strong> ${$('co2Savings').textContent} kg CO2/an</p>
        <p><strong>Voisins trouvés :</strong> ${participants.slice(0,5).length}</p>
    </div>
    <button onclick="window.print()" style="padding:10px 20px;background:#4F46E5;color:white;border:none;border-radius:5px;cursor:pointer;">Imprimer / PDF</button>
    </body></html>`;
    win.document.write(content);
    win.document.close();
}
