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
    const errDiv = document.querySelector('.step.active .error-msg');
    if (errDiv) {
        errDiv.textContent = msg;
        setTimeout(() => errDiv.textContent = '', 3000);
    } else {
        alert("❌ " + msg);
    }
}

function showSuccess(msg) {
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
    const modal = document.createElement('div');
    modal.id = 'rgpdInfoModal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content glass-effect" style="background:#1e293b; color:white;">
            <h2>🔒 Données Personnelles</h2>
            <ul style="margin:15px 0 15px 20px;">
                <li>📍 Données stockées localement sur votre téléphone</li>
                <li>⏱️ Supprimées automatiquement sous 7 jours</li>
                <li>👀 Utilisées uniquement pour le jeu en temps réel</li>
            </ul>
            <button class="btn-primary" onclick="document.getElementById('rgpdInfoModal').remove()">Fermer</button>
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

// ================= MULTIMODAL =================
function toggleMultimodal() {
    const cb = $('multimodalCheck');
    if(cb.checked) {
        $('multimodalModal').classList.add('active');
    }
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
    
    const container = $('inviteQrcode');
    container.innerHTML = '';
    new QRCode(container, {
        text: window.location.href,
        width: 200, height: 200,
        colorDark : "#0f172a", colorLight : "#ffffff"
    });
    
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
        if(countdown <= 0) {
            clearInterval(inviteCountdownInterval);
            showStep(2);
        }
    }, 1000);
}

function extendInviteTimer() {
    startInviteTimer();
}

// ================= GEOLOC & PROFIL =================
$('saveLocation').onclick = async () => {
    const addr = $('userAddress').value;
    const mode = $('transportMode').value;
    
    if(!addr || !mode) return showError("Remplissez tous les champs");
    
    try {
        const btn = $('saveLocation');
        btn.textContent = "Recherche..."; btn.disabled = true;
        
        await new Promise(r => setTimeout(r, 1000));
        
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data = await res.json();
        
        if(!data.length) throw new Error("Adresse introuvable");
        
        myCoords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
        myFullAddress = data[0].display_name;
        myTransportMode = mode;
        myDepartureTime = $('departureTime').value;
        
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
        
        // Sauvegarde LocalStorage
        localStorage.setItem('departureTime', myDepartureTime);
        localStorage.setItem('fullAddress', myFullAddress);
        
        $('locationSection').style.display = 'none';
        $('afterLocationSection').style.display = 'block';
        $('myEmojiDisplay').textContent = myEmoji;
        $('detectedAddress').textContent = myFullAddress.split(',')[0];
        
        // Envoi Sheet (CORRIGÉ: noms des champs alignés avec le script Google)
        const payload = {
            type: 'participant', 
            id: myUniqueId, 
            emoji: myEmoji, 
            lat: myCoords.lat, 
            lon: myCoords.lon, 
            address: myFullAddress, 
            transport: myTransportMode, // Correction ici (était 'mode')
            transportMode2: myTransportMode2,
            mode1Days: mode1Days,
            mode2Days: mode2Days,
            departureTime: myDepartureTime
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
    myTransportMode2 = localStorage.getItem('transportMode2') || '';
    mode1Days = parseInt(localStorage.getItem('mode1Days') || '0');
    mode2Days = parseInt(localStorage.getItem('mode2Days') || '0');
    
    // Restauration des participants scannés
    const savedParticipants = localStorage.getItem('participants');
    if(savedParticipants) {
        participants = JSON.parse(savedParticipants);
        scanCount = participants.length;
    } else {
        scanCount = 0;
    }
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
    
    // Sauvegarde de la liste complète pour la persistance (Fix 0 à 3)
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
    
    // Envoi Google Sheet
    sendToGoogleSheets({
        type: 'scan',
        scannerId: myUniqueId,
        scannerEmoji: myEmoji,
        scannedId: data.id,
        distance: dist,
        step: 2,
        totalScans: scanCount
    });
    
    return true;
}

// ================= JEU VOISINS =================
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
    
    // Envoi Google Sheet résultat jeu
    if(score >= 3) {
        $('gameResult').innerHTML = `<div class="success-msg">🎉 GAGNÉ !</div>`;
        $('gameScanBtn').style.display = 'none';
        
        sendToGoogleSheets({
            type: 'game_result',
            participantId: myUniqueId,
            score: score,
            attempts: 5 - attemptsLeft,
            errors: (5 - attemptsLeft) - score,
            title: 'Gagné'
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

// ================= FORMULAIRE & ENTREPRISE =================
function initStep6Form() {
    const altList = $('alternativesList');
    // Éviter les doublons si on revient sur la page
    if(altList.children.length > 0) return;

    // ALTERNATIVES
    ALTERNATIVES.forEach((alt, i) => {
        const isOther = alt.toLowerCase().includes("autre");
        let inputHtml = isOther ? `<input type="text" id="altInput${i}" class="other-input" placeholder="Précisez..." style="display:none; margin-top:5px; width:100%;">` : '';
        
        altList.innerHTML += `
        <div class="checkbox-item-wrapper">
            <div class="checkbox-item">
                <input type="checkbox" id="alt${i}" onchange="handleOptionChange(this, 'alt', '${alt}', ${i}, ${isOther})">
                <label for="alt${i}">${alt}</label>
            </div>
            ${inputHtml}
        </div>`;
    });
    
    // CONTRAINTES
    const constList = $('constraintsList');
    CONSTRAINTS.forEach((item, i) => {
        const isOther = item.toLowerCase().includes("autre");
        let inputHtml = isOther ? `<input type="text" id="consInput${i}" class="other-input" placeholder="Précisez..." style="display:none; margin-top:5px; width:100%;">` : '';
        
        constList.innerHTML += `
        <div class="checkbox-item-wrapper">
            <div class="checkbox-item">
                <input type="checkbox" id="cons${i}" onchange="handleOptionChange(this, 'cons', '${item}', ${i}, ${isOther})">
                <label for="cons${i}">${item}</label>
            </div>
            ${inputHtml}
        </div>`;
    });

    // LEVIERS
    const levList = $('leversList');
    LEVERS.forEach((item, i) => {
        const isOther = item.toLowerCase().includes("autre");
        let inputHtml = isOther ? `<input type="text" id="levInput${i}" class="other-input" placeholder="Précisez..." style="display:none; margin-top:5px; width:100%;">` : '';
        
        levList.innerHTML += `
        <div class="checkbox-item-wrapper">
            <div class="checkbox-item">
                <input type="checkbox" id="lev${i}" onchange="handleOptionChange(this, 'lev', '${item}', ${i}, ${isOther})">
                <label for="lev${i}">${item}</label>
            </div>
            ${inputHtml}
        </div>`;
    });
}

function handleOptionChange(checkbox, type, name, index, isOther) {
    // Gestion champ "Autre"
    if(isOther) {
        const input = document.getElementById(`${type}Input${index}`);
        if(input) {
            input.style.display = checkbox.checked ? 'block' : 'none';
            if(!checkbox.checked) input.value = ''; // Reset si décoché
        }
    }

    // Logique de stockage (simplifiée pour l'exemple)
    let finalName = name;
    if(isOther && checkbox.checked) {
        // On ne stocke pas "Autre" tout de suite, on le récupérera lors de l'envoi
        // Mais on marque qu'il est coché
    }
    
    if(type === 'alt') {
        if(checkbox.checked) selectedAlternatives[name] = 1; else delete selectedAlternatives[name];
    } else if (type === 'cons') {
        if(checkbox.checked) selectedConstraints.push(name); else selectedConstraints = selectedConstraints.filter(c => c !== name);
    } else if (type === 'lev') {
        if(checkbox.checked) selectedLevers.push(name); else selectedLevers = selectedLevers.filter(c => c !== name);
    }
}

function updateCommitmentValue() {
    commitmentLevel = parseInt($('commitmentRange').value);
    $('commitmentValue').textContent = commitmentLevel;
}

function showCompanyScan() {
    // Récupération des valeurs "Autre" avant envoi
    let finalAlternatives = {...selectedAlternatives};
    let finalConstraints = [...selectedConstraints];
    let finalLevers = [...selectedLevers];

    // Fonction helper pour ajouter le texte précis
    const processOther = (list, type) => {
        const wrappers = document.querySelectorAll(`#${list} .checkbox-item-wrapper`);
        wrappers.forEach((w, i) => {
            const cb = w.querySelector('input[type="checkbox"]');
            const txt = w.querySelector('input[type="text"]');
            if(cb && cb.checked && txt && txt.value) {
                // On remplace "Autre" par "Autre: valeur"
                if(type === 'obj') {
                    const key = Object.keys(finalAlternatives).find(k => k.toLowerCase().includes('autre'));
                    if(key) { delete finalAlternatives[key]; finalAlternatives[`Autre: ${txt.value}`] = 1; }
                } else {
                    const idx = type.indexOf(type.find(k => k.toLowerCase().includes('autre')));
                    if(idx > -1) type[idx] = `Autre: ${txt.value}`;
                }
            }
        });
    };
    
    // Préparation données pour Sheet
    const altText = Object.keys(finalAlternatives).join(', ');
    const consText = finalConstraints.join(', ');
    const levText = finalLevers.join(', ');

    sendToGoogleSheets({
        type: 'propositions',
        participantId: myUniqueId,
        emoji: myEmoji,
        alternatives: altText,
        contraintes: consText,
        leviers: levText,
        engagement: commitmentLevel
    });

    showStep('companyScanPage');
    $('companyScanPage').classList.add('active');
    $('step6').classList.remove('active');
    startScanLoop('company');
}

// ================= ADMIN (Correction ici) =================
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
    } else {
        showError("Mot de passe incorrect");
    }
}

function generateCompanyQR() {
    const addr = $('companyAddressInput').value;
    $('companyQrcode').innerHTML = '';
    // QR code simplifié pour l'exemple (en prod, utiliser le vrai geocode)
    new QRCode($('companyQrcode'), {
        text: JSON.stringify({ type: 'company', lat: 48.8566, lon: 2.3522 }),
        width: 200, height: 200
    });
    $('companyQRSection').style.display = 'block';
}

function updateStep5Stats() {
    // Mise à jour des stats pelotes avec les données locales
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
    const co2 = Math.round(dist * 2 * 220 * 0.1); 
    $('co2Savings').textContent = co2;
    
    stopAllCameras();
    $('companyScanPage').classList.remove('active');
    $('reportPage').classList.add('active');
    
    // Envoi final distance entreprise
    sendToGoogleSheets({
        type: 'company_distance',
        participantId: myUniqueId,
        emoji: myEmoji,
        distance: dist
    });
}

// ================= SYNC GOOGLE SHEET =================
function sendToGoogleSheets(data) {
    if(!googleScriptUrl) return;
    fetch(googleScriptUrl, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) })
        .then(() => console.log("Envoyé"))
        .catch(e => console.error("Erreur envoi", e));
}

// ================= RESET =================
function resetAllData() {
    if(confirm("Tout effacer ?")) {
        localStorage.clear();
        location.reload();
    }
}

function refreshAdminStats() {
    // Calcul simple sur données locales pour l'instant (car no-cors ne permet pas de lire le sheet facilement sans proxi)
    $('adminTotalUsers').textContent = participants.length + 1;
    if(participants.length > 0) {
        const avg = participants.reduce((acc, p) => acc + p.distance, 0) / participants.length;
        $('adminAvgDistance').textContent = avg.toFixed(1);
    }
}

function generatePDF() {
    alert("Génération PDF simulée pour cette démo.");
}
