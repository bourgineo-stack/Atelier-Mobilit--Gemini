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
let participants=[], scanning=false, gameTargets=[], scannedTargets=[], attemptsLeft=5, score=0;
let companyCoords=null, rgpdAccepted=false, inviteCountdownInterval=null, scanCount=0;
let selectedAlternatives={}, selectedConstraints={}, selectedLevers={}, commitmentLevel=80;
let googleScriptUrl = APP_CONFIG.GOOGLE_SCRIPT_URL;
let scanCanvas=null, scanCtx=null;
let currentGroup=[], selectedThemes=[], groupRoles={};

const EMOJI_SET = ['🦸','🐼','🦁','🐻','🦊','🐱','🐯','🦄','🐸','🦉','🐙','🦋','🐨','🦒','🦘','🦥','🐲','🦕'];
const CO2_FACTORS = { 'car-thermal': 0.193, 'car-electric': 0.020, 'carpool': 0.096, 'train': 0.006, 'bus': 0.103, 'bike': 0, 'ebike': 0.002, 'walk': 0, 'remote': 0 };
const ALTERNATIVES = ["Covoiturage","Autopartage","Transports en commun","Train/RER","Vélo","Vélo électrique","Marche","Télétravail","Horaires décalés","Autre"];
const CONSTRAINTS = ["Horaires","Enfants","Matériel","Distance >30km","Pas de TC","Pas de piste cyclable","Météo","Santé","Coût","Autre"];
const LEVERS = ["Prime mobilité","Abonnement TC 75%","Parking vélo","Douches","Recharge élec","Covoiturage interne","Vélos de fonction","Formation","Autre"];

const miniChallenges = [
    { title: "🤝 Connecteurs", task: "Présentez-vous à une 3ème personne ensemble" },
    { title: "🔤 Initiales", task: "Trouvez 2 personnes aux prénoms commençant pareil" },
    { title: "🕵️ Devine", task: "Devinez le quartier de votre binôme" }
];

// ================= BANQUE DE QUESTIONS =================
const QUESTIONS_BANK = {
    velo: {
        name: "Vélo & micro-mobilité", icon: "🚲", color: "#10b981",
        questions: {
            revelation: [
                { q: "Qui a déjà fait le trajet en vélo, même une fois ?", sub: "Levez la main !" },
                { q: "Qui a un vélo qui dort au garage ?", sub: "Il attend son heure..." },
                { q: "Qui connaît quelqu'un avec un VAE ?", sub: "Le vélo électrique change tout." }
            ],
            blocage: [
                { q: "Vrai frein : transpiration, météo ou sécurité ?", sub: "Soyons honnêtes." },
                { q: "Économiser 150€/mois vs arriver essoufflé ?", sub: "Le calcul économique." },
                { q: "Si des douches étaient dispo ?", sub: "L'infrastructure bloque-t-elle ?" }
            ],
            action: [
                { q: "Qui teste un trajet accompagné cette semaine ?", sub: "Sans engagement." },
                { q: "Trouvez un voisin à -2km de chez vous", sub: "Testez ensemble !" },
                { q: "Qui prêterait son vélo pour un essai ?", sub: "Convertis, aidez !" }
            ]
        }
    },
    covoiturage: {
        name: "Covoiturage", icon: "🚗", color: "#f59e0b",
        questions: {
            revelation: [
                { q: "Qui part entre 7h et 8h ?", sub: "Vos covoitureurs potentiels !" },
                { q: "Combien de places vides ce matin ?", sub: "Comptez ensemble." },
                { q: "Qui a déjà covoituré pour autre chose ?", sub: "L'expérience existe." }
            ],
            blocage: [
                { q: "Frein : horaires, détour ou gêne ?", sub: "Identifions le vrai." },
                { q: "Combien de min de détour pour /2 les frais ?", sub: "Votre seuil ?" },
                { q: "Conducteur ou passager ?", sub: "On s'adapte." }
            ],
            action: [
                { q: "Qui teste UN trajet cette semaine ?", sub: "Juste pour voir." },
                { q: "On crée le WhatsApp maintenant ?", sub: "Autant commencer." },
                { q: "Échangez vos numéros avec 2 personnes", sub: "Premier pas !" }
            ]
        }
    },
    tc: {
        name: "Transports en commun", icon: "🚋", color: "#8b5cf6",
        questions: {
            revelation: [
                { q: "Qui a pris le bus/tram récemment ?", sub: "L'expérience existe." },
                { q: "Qui passe devant un arrêt chaque matin ?", sub: "La ligne est proche." },
                { q: "Trajet TC < 45 min ?", sub: "Vérifions ensemble." }
            ],
            blocage: [
                { q: "Frein : temps, fréquence ou confort ?", sub: "Chaque frein a sa solution." },
                { q: "Combien de correspondances ?", sub: "Complexité perçue vs réelle." },
                { q: "Un livre/podcast rendrait ça acceptable ?", sub: "Temps utile ?" }
            ],
            action: [
                { q: "Qui teste les TC 2 jours ?", sub: "Avec quelqu'un, c'est mieux." },
                { q: "Trouvez quelqu'un sur la même ligne", sub: "Testez ensemble." },
                { q: "Téléchargez l'appli maintenant ?", sub: "Checker son trajet." }
            ]
        }
    },
    electrique: {
        name: "Électrique & autopartage", icon: "⚡", color: "#06b6d4",
        questions: {
            revelation: [
                { q: "Qui a été dans une électrique ?", sub: "Même passager." },
                { q: "Qui fait < 50 km/jour ?", sub: "Une électrique suffit." },
                { q: "Combien de bornes près de chez vous ?", sub: "Ça se développe." }
            ],
            blocage: [
                { q: "Frein : prix, autonomie ou recharge ?", sub: "Démystifions." },
                { q: "Km réels par jour ?", sub: "Souvent moins qu'on pense." },
                { q: "Coût RÉEL de votre voiture/mois ?", sub: "Tout compris ?" }
            ],
            action: [
                { q: "Essai groupé, qui est partant ?", sub: "À plusieurs, plus sympa." },
                { q: "L'un a une électrique, l'autre veut tester ?", sub: "Échangez !" },
                { q: "Quelqu'un a testé l'autopartage ?", sub: "Retours concrets." }
            ]
        }
    },
    teletravail: {
        name: "Télétravail & flexibilité", icon: "🏠", color: "#ec4899",
        questions: {
            revelation: [
                { q: "Qui télétravaille déjà 1j/semaine ?", sub: "Plus répandu qu'on pense." },
                { q: "Qui habite à +30 km ?", sub: "Le TT changerait tout." },
                { q: "Qui a négocié +1 jour de TT ?", sub: "Les précédents existent." }
            ],
            blocage: [
                { q: "Frein : manager, poste ou équipement ?", sub: "Le vrai blocage ?" },
                { q: "4j au bureau = combien d'économies/an ?", sub: "Calculons." },
                { q: "Heures/semaine dans les trajets ?", sub: "C'est du temps de vie." }
            ],
            action: [
                { q: "Qui propose 1j de test ce mois ?", sub: "Test limité = plus facile." },
                { q: "Alterner vos jours de présence ?", sub: "Coordination = opportunités." },
                { q: "5h récupérées = vous faites quoi ?", sub: "Visualisez le gain." }
            ]
        }
    },
    intermodal: {
        name: "Solutions combinées", icon: "🔀", color: "#64748b",
        questions: {
            revelation: [
                { q: "Qui combine déjà plusieurs modes ?", sub: "Train+vélo, bus+marche..." },
                { q: "Qui a un vélo/trottinette pliable ?", sub: "Le dernier km compte." },
                { q: "Qui passe devant une gare en voiture ?", sub: "Le train peut remplacer." }
            ],
            blocage: [
                { q: "Frein à combiner : complexité ou temps ?", sub: "Ça se simplifie à l'usage." },
                { q: "Si on vous déposait à la gare ?", sub: "Covoiturage partiel." },
                { q: "Trottinette dans le train = solution ?", sub: "Ça existe." }
            ],
            action: [
                { q: "Checkez les horaires de train maintenant", sub: "L'info est là." },
                { q: "Groupe 'gare + dernier km' ?", sub: "3 volontaires ?" },
                { q: "Qui teste train + trottinette ?", sub: "1 semaine, sans pression." }
            ]
        }
    }
};

// ================= RÔLES =================
const PARTICIPANT_ROLES = {
    explorateur: { name: "Explorateur", icon: "🔍", description: "Je cherche des alternatives", color: "#f59e0b", mission: "Posez des questions, challengez" },
    hybride: { name: "Hybride", icon: "⚡", description: "J'alterne déjà plusieurs modes", color: "#8b5cf6", mission: "Partagez vos astuces" },
    converti: { name: "Conseiller", icon: "🌱", description: "J'ai déjà changé mes habitudes", color: "#10b981", mission: "Rassurez, partagez votre expérience" },
    bloque: { name: "Contraint", icon: "🔒", description: "J'ai des contraintes fortes", color: "#ef4444", mission: "Exprimez vos vraies contraintes" }
};

// ================= UTILITAIRES =================
function $(id) { return document.getElementById(id); }
function generateUniqueId() { return 'u_' + Math.random().toString(36).substr(2,9) + '_' + Date.now().toString(36); }
function generateEmojiPseudo() { return EMOJI_SET[Math.floor(Math.random()*EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random()*EMOJI_SET.length)] + EMOJI_SET[Math.floor(Math.random()*EMOJI_SET.length)]; }
function showError(msg) { const d=document.createElement('div'); d.className='toast-msg error'; d.innerHTML=`<span>❌</span><span>${msg}</span>`; document.body.appendChild(d); setTimeout(()=>d.remove(),3000); }
function showSuccess(msg) { const d=document.createElement('div'); d.className='toast-msg success'; d.innerHTML=`<span>✅</span><span>${msg}</span>`; document.body.appendChild(d); setTimeout(()=>d.remove(),3000); }

// ================= INIT =================
document.addEventListener('DOMContentLoaded', () => {
    if (new Date() > new Date(APP_CONFIG.EXPIRATION_DATE)) { document.body.innerHTML = "<h1 style='color:white;text-align:center;margin-top:50px;'>Session Expirée</h1>"; return; }
    scanCanvas = document.getElementById('canvas');
    if (scanCanvas) scanCtx = scanCanvas.getContext('2d', { willReadFrequently: true });
    restoreUserData();
    checkRGPDStatus();
    const saveBtn = $('saveLocation');
    if (saveBtn) saveBtn.addEventListener('click', handleSaveLocation);
});

function checkRGPDStatus() { if (localStorage.getItem('rgpdAccepted')==='true') { rgpdAccepted=true; if($('rgpdNotice')) $('rgpdNotice').style.display='none'; }}
function acceptRGPD() { rgpdAccepted=true; localStorage.setItem('rgpdAccepted','true'); $('rgpdNotice').style.display='none'; showSuccess("RGPD accepté"); }
function showRGPDDetails() { const m=document.createElement('div'); m.id='rgpdInfoModal'; m.className='modal active'; m.innerHTML=`<div class="modal-content" style="background:#1e293b;color:white;"><h2>🔒 Données</h2><p style="margin-top:15px;">Position, mode transport, heure départ. Stockage local + Google Sheet. Suppression 7j. Contact: volt.face@outlook.fr</p><button class="btn-primary" style="margin-top:20px;" onclick="document.getElementById('rgpdInfoModal').remove()">OK</button></div>`; document.body.appendChild(m); }

function showStep(n) {
    if (typeof n === 'string') { document.querySelectorAll('.step').forEach(s => s.classList.remove('active')); const t=$(n); if(t) t.classList.add('active'); stopAllCameras(); return; }
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.step-dot').forEach(d => d.classList.remove('active','completed'));
    const t = $(`step${n}`); if(t) t.classList.add('active');
    for(let i=1;i<=n;i++) { const d=$(`step${i}Dot`); if(d) { d.classList.add('active'); if(i<n) d.classList.add('completed'); }}
    stopAllCameras();
    if(n===2) setTimeout(()=>genMyQRCode('qrcode'),300);
    if(n===3) { initGame(); setTimeout(()=>genMyQRCode('qrcodeStep3'),300); }
    if(n===4) setTimeout(()=>genMyQRCode('qrcodeStep4'),300);
    if(n===5) updateStep5Stats();
    if(n===6) initStep6Form();
    window.scrollTo(0,0);
}

function checkAccessCode() { if(!rgpdAccepted) return showError("Acceptez le RGPD"); const c=$('accessCodeInput').value.trim(); if(APP_CONFIG.VALID_ACCESS_CODES.includes(c)) { $('loginSection').style.display='none'; $('locationSection').style.display='block'; } else showError("Code invalide"); }
function resetGameSequence() { if(confirm("Recommencer à zéro ?")) { localStorage.clear(); location.reload(true); }}
function toggleMultimodal() { if($('multimodalCheck').checked) $('multimodalModal').classList.add('active'); }
function closeMultimodal() { $('multimodalModal').classList.remove('active'); $('multimodalCheck').checked=false; }
function saveMultimodal() { myTransportMode2=$('transportMode2').value; mode1Days=parseInt($('mode1Days').value); mode2Days=parseInt($('mode2Days').value); localStorage.setItem('transportMode2',myTransportMode2); localStorage.setItem('mode1Days',mode1Days); localStorage.setItem('mode2Days',mode2Days); $('multimodalModal').classList.remove('active'); showSuccess("OK"); }

function showInvitePage() { document.querySelectorAll('.step').forEach(s=>s.classList.remove('active')); $('invitePage').classList.add('active'); $('inviteQrcode').innerHTML=''; new QRCode($('inviteQrcode'),{text:window.location.href,width:200,height:200,colorDark:"#0f172a",colorLight:"#ffffff"}); startInviteTimer(); }
function startInviteTimer() { let c=30; const t=$('inviteTimer'); if(inviteCountdownInterval) clearInterval(inviteCountdownInterval); t.innerHTML=`⏱️ Retour: <strong>${c}s</strong>`; inviteCountdownInterval=setInterval(()=>{ c--; t.innerHTML=`⏱️ Retour: <strong>${c}s</strong>`; if(c<=0){clearInterval(inviteCountdownInterval);showStep(2);}},1000); }

// ================= GEOLOC =================
async function handleSaveLocation() {
    const addr=$('userAddress').value, mode=$('transportMode').value;
    if(!addr||!mode) return showError("Remplissez tout");
    const btn=$('saveLocation'); btn.textContent="Recherche..."; btn.disabled=true;
    try {
        const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&addressdetails=1`);
        const data=await res.json(); if(!data.length) throw new Error("Adresse introuvable");
        myCoords={lat:parseFloat(data[0].lat),lon:parseFloat(data[0].lon)}; myFullAddress=data[0].display_name; myTransportMode=mode; myDepartureTime=$('departureTime').value;
        if(!myUniqueId) myUniqueId=generateUniqueId(); if(!myEmoji) myEmoji=generateEmojiPseudo();
        localStorage.setItem('userCoords',JSON.stringify(myCoords)); localStorage.setItem('transportMode',myTransportMode); localStorage.setItem('departureTime',myDepartureTime); localStorage.setItem('fullAddress',myFullAddress); localStorage.setItem('myUniqueId',myUniqueId); localStorage.setItem('myEmoji',myEmoji);
        $('locationSection').style.display='none'; $('afterLocationSection').style.display='block'; $('myEmojiDisplay').textContent=myEmoji;
        if($('detectedAddress')) $('detectedAddress').textContent=myFullAddress.split(',').slice(0,2).join(',');
        if(googleScriptUrl) fetch(googleScriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify({type:'participant',id:myUniqueId,emoji:myEmoji,lat:myCoords.lat,lon:myCoords.lon,transport:myTransportMode})}).catch(()=>{});
        showSuccess("Profil OK");
    } catch(e) { showError(e.message); }
    btn.textContent="Valider ma localisation"; btn.disabled=false;
}

function restoreUserData() {
    myUniqueId=localStorage.getItem('myUniqueId')||''; myEmoji=localStorage.getItem('myEmoji')||''; myFullAddress=localStorage.getItem('fullAddress')||''; myDepartureTime=localStorage.getItem('departureTime')||'07:30';
    const c=localStorage.getItem('userCoords'); if(c) try{myCoords=JSON.parse(c);}catch(e){myCoords=null;}
    myTransportMode=localStorage.getItem('transportMode')||''; myTransportMode2=localStorage.getItem('transportMode2')||'';
    mode1Days=parseInt(localStorage.getItem('mode1Days')||'0'); mode2Days=parseInt(localStorage.getItem('mode2Days')||'0');
    const p=localStorage.getItem('participants'); if(p) try{participants=JSON.parse(p);scanCount=participants.length;}catch(e){participants=[];scanCount=0;}
}

// ================= QR & CAMERA =================
function genMyQRCode(elId) {
    const el=$(elId); if(!el) return;
    if(!myUniqueId||!myCoords) { el.innerHTML='<p style="color:#ef4444;text-align:center;padding:20px;">⚠️ Profil incomplet</p>'; return; }
    el.innerHTML='';
    const qrData=JSON.stringify({id:myUniqueId.substring(0,12),lat:Math.round(myCoords.lat*1000)/1000,lon:Math.round(myCoords.lon*1000)/1000});
    try { new QRCode(el,{text:qrData,width:180,height:180,colorDark:"#0f172a",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.L}); } catch(e) { el.innerHTML='<p style="color:#ef4444;">Erreur QR</p>'; }
}

function startScanLoop(type) {
    scanning=true;
    let camViewId,videoId,btnId,stopBtnId;
    if(type==='group') { camViewId='groupCameraView'; videoId='groupVideo'; if($('groupScanInterface')) $('groupScanInterface').style.display='block'; }
    else { camViewId=type==='game'?'gameCameraView':(type==='company'?'companyCameraView':(type==='positioning'?'positioningCameraView':'cameraView')); videoId=type==='game'?'gameVideo':(type==='company'?'companyVideo':(type==='positioning'?'positioningVideo':'video')); btnId=type==='game'?'gameScanBtn':(type==='company'?null:(type==='positioning'?'positioningScanBtn':'scanBtn')); stopBtnId=type==='game'?'stopGameCamBtn':(type==='company'?'stopCompCamBtn':(type==='positioning'?'stopPosCamBtn':'stopCamBtn')); if(btnId&&$(btnId)) $(btnId).style.display='none'; if($(camViewId)) $(camViewId).style.display='block'; if($(stopBtnId)) $(stopBtnId).style.display='block'; }
    const video=$(videoId); if(!video) return;
    navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}).then(stream=>{ video.srcObject=stream; video.setAttribute("playsinline",true); video.play(); requestAnimationFrame(()=>tick(video,type)); }).catch(err=>{ showError("Caméra: "+err.message); stopAllCameras(); });
}

function tick(video,type) {
    if(!scanning) return;
    if(video.readyState===video.HAVE_ENOUGH_DATA) {
        if(!scanCanvas) { scanCanvas=document.getElementById('canvas'); if(!scanCanvas) { scanCanvas=document.createElement('canvas'); scanCanvas.style.display='none'; document.body.appendChild(scanCanvas); } scanCtx=scanCanvas.getContext('2d',{willReadFrequently:true}); }
        scanCanvas.width=video.videoWidth; scanCanvas.height=video.videoHeight; scanCtx.drawImage(video,0,0);
        const imageData=scanCtx.getImageData(0,0,scanCanvas.width,scanCanvas.height);
        const code=jsQR(imageData.data,imageData.width,imageData.height,{inversionAttempts:"dontInvert"});
        if(code) { try { const data=JSON.parse(code.data); let success=false; if(data.e&&!data.emoji) data.emoji=data.e; if(type==='group') { if(data.id) addMemberToGroup(data); } else if(type==='company'&&data.type==='company') { handleCompanyScan(data); success=true; } else if(data.id&&data.lat!==undefined) { if(type==='game') success=handleGameScan(data); else if(type==='positioning') success=handlePositioningScan(data); else success=addParticipant(data); } if(success) stopAllCameras(); } catch(e){} }
    }
    if(scanning) requestAnimationFrame(()=>tick(video,type));
}

function stopAllCameras() { scanning=false; document.querySelectorAll('video').forEach(v=>{ if(v.srcObject) v.srcObject.getTracks().forEach(t=>t.stop()); v.srcObject=null; }); document.querySelectorAll('.camera-container').forEach(e=>e.style.display='none'); ['scanBtn','gameScanBtn','positioningScanBtn'].forEach(id=>{ if($(id)) $(id).style.display='block'; }); ['stopCamBtn','stopGameCamBtn','stopPosCamBtn','stopCompCamBtn'].forEach(id=>{ if($(id)) $(id).style.display='none'; }); }

// ================= CO-CONSTRUCTION =================
function initGroupPhase() {
    const challenges=["Le plus jeune","Cheveux les plus longs","Habite le plus loin","Arrivé le premier"];
    const winner=challenges[Math.floor(Math.random()*challenges.length)];
    $('leaderChallenge').innerHTML=`👑 Chef: <strong style="color:#F59E0B;">${winner}</strong>`;
    $('startGroupBtn').style.display='none'; $('groupScanInterface').style.display='block';
    currentGroup=[]; updateGroupList();
}

function addMemberToGroup(data) {
    if(currentGroup.find(m=>m.id===data.id)) return;
    if(data.id===myUniqueId) { showError("C'est vous !"); return; }
    currentGroup.push(data); updateGroupList(); showSuccess("Membre ajouté !");
    scanning=false; setTimeout(()=>{ scanning=true; const v=$('groupVideo'); if(v) requestAnimationFrame(()=>tick(v,'group')); },1500);
}

function updateGroupList() { const l=$('groupMembersList'); if(l) l.innerHTML=currentGroup.map(m=>`<div>✅ ${m.emoji||'👤'}</div>`).join(''); if($('validateGroupBtn')) $('validateGroupBtn').disabled=currentGroup.length<1; }

function validateGroup() {
    stopAllCameras();
    sendToGoogleSheets({type:'group_formation',leaderId:myUniqueId,members:currentGroup.map(m=>m.id).join(',')});
    $('groupFormationSection').style.display='none'; $('newCoConstructionSection').style.display='block';
    initCoConstruction();
}

function initCoConstruction() { $('coConstPhase1').style.display='block'; $('coConstPhase2').style.display='none'; $('coConstPhase3').style.display='none'; $('coConstPhase4').style.display='none'; renderRoleSelector(); }

function renderRoleSelector() {
    const c=$('roleSelector'); if(!c) return;
    let h='<div class="roles-grid">';
    Object.entries(PARTICIPANT_ROLES).forEach(([k,r])=>{ h+=`<div class="role-card" onclick="selectRole('${k}')" id="role-${k}"><div class="role-icon">${r.icon}</div><div class="role-name">${r.name}</div><div class="role-desc">${r.description}</div></div>`; });
    h+='</div>'; c.innerHTML=h;
}

function selectRole(roleKey) {
    document.querySelectorAll('.role-card').forEach(c=>c.classList.remove('selected'));
    $(`role-${roleKey}`).classList.add('selected');
    groupRoles[myUniqueId]=roleKey; localStorage.setItem('myRole',roleKey);
    const r=PARTICIPANT_ROLES[roleKey];
    $('selectedRoleMission').innerHTML=`<div style="background:${r.color}20;border-left:4px solid ${r.color};padding:15px;border-radius:8px;margin-top:15px;"><strong>${r.icon} Votre mission:</strong> ${r.mission}</div>`;
    $('goToPhase2Btn').disabled=false;
}

function goToPhase2() { $('coConstPhase1').style.display='none'; $('coConstPhase2').style.display='block'; renderThemeSelector(); }
function backToPhase1() { $('coConstPhase2').style.display='none'; $('coConstPhase1').style.display='block'; }

function renderThemeSelector() {
    const c=$('themeSelector'); if(!c) return;
    let h='<p style="text-align:center;margin-bottom:15px;">Choisissez <strong>1 ou 2 sujets</strong> :</p><div class="themes-grid">';
    Object.entries(QUESTIONS_BANK).forEach(([k,t])=>{ h+=`<div class="theme-card" onclick="toggleTheme('${k}')" id="theme-${k}" style="--theme-color:${t.color};"><div class="theme-icon">${t.icon}</div><div class="theme-name">${t.name}</div></div>`; });
    h+='</div><div id="selectedThemesDisplay" style="margin-top:15px;text-align:center;"></div>';
    c.innerHTML=h; selectedThemes=[]; updateSelectedThemesDisplay();
}

function toggleTheme(k) {
    const card=$(`theme-${k}`);
    if(selectedThemes.includes(k)) { selectedThemes=selectedThemes.filter(t=>t!==k); card.classList.remove('selected'); }
    else if(selectedThemes.length<2) { selectedThemes.push(k); card.classList.add('selected'); }
    else { showError("Max 2 sujets"); return; }
    updateSelectedThemesDisplay();
}

function updateSelectedThemesDisplay() {
    const d=$('selectedThemesDisplay'); if(!d) return;
    if(selectedThemes.length===0) { d.innerHTML='<span style="opacity:0.5;">Aucun sujet</span>'; $('goToPhase3Btn').disabled=true; }
    else { d.innerHTML=`<strong>Sélection:</strong> ${selectedThemes.map(t=>QUESTIONS_BANK[t].name).join(' + ')}`; $('goToPhase3Btn').disabled=false; }
}

function goToPhase3() { $('coConstPhase2').style.display='none'; $('coConstPhase3').style.display='block'; renderDiscussionCards(); }
function backToPhase2() { $('coConstPhase3').style.display='none'; $('coConstPhase2').style.display='block'; }

function renderDiscussionCards() {
    const c=$('discussionCardsContainer'); if(!c) return;
    let h='';
    selectedThemes.forEach(tk=>{
        const t=QUESTIONS_BANK[tk];
        h+=`<div class="discussion-theme-block" style="--theme-color:${t.color};"><h3 style="color:${t.color};margin-bottom:15px;">${t.icon} ${t.name}</h3>`;
        h+=`<div class="question-category"><div class="category-header" onclick="toggleCategory(this)"><span>🔍 Révélation</span><span class="category-hint">Qui fait déjà ?</span></div><div class="category-questions">${t.questions.revelation.map((q,i)=>`<div class="question-card" onclick="showQuestionModal('${tk}','revelation',${i})"><div class="question-text">${q.q}</div></div>`).join('')}</div></div>`;
        h+=`<div class="question-category"><div class="category-header" onclick="toggleCategory(this)"><span>🚧 Blocages</span><span class="category-hint">Qu'est-ce qui freine ?</span></div><div class="category-questions">${t.questions.blocage.map((q,i)=>`<div class="question-card" onclick="showQuestionModal('${tk}','blocage',${i})"><div class="question-text">${q.q}</div></div>`).join('')}</div></div>`;
        h+=`<div class="question-category"><div class="category-header" onclick="toggleCategory(this)"><span>🎯 Actions</span><span class="category-hint">Qui est prêt ?</span></div><div class="category-questions">${t.questions.action.map((q,i)=>`<div class="question-card" onclick="showQuestionModal('${tk}','action',${i})"><div class="question-text">${q.q}</div></div>`).join('')}</div></div>`;
        h+=`</div>`;
    });
    c.innerHTML=h;
}

function toggleCategory(header) { const q=header.nextElementSibling; const isOpen=q.style.maxHeight&&q.style.maxHeight!=='0px'; document.querySelectorAll('.category-questions').forEach(x=>x.style.maxHeight='0px'); if(!isOpen) q.style.maxHeight=q.scrollHeight+'px'; }

function showQuestionModal(tk,cat,idx) {
    const t=QUESTIONS_BANK[tk], q=t.questions[cat][idx];
    const m=document.createElement('div'); m.className='modal active'; m.id='questionModal';
    m.innerHTML=`<div class="modal-content" style="background:#1e293b;"><div style="font-size:3em;text-align:center;margin-bottom:15px;">${t.icon}</div><h2 style="color:${t.color};text-align:center;font-size:1.2em;line-height:1.4;">${q.q}</h2><p style="text-align:center;opacity:0.7;margin-top:15px;font-style:italic;">${q.sub}</p><div style="display:flex;gap:10px;margin-top:25px;"><button class="btn-outline" style="flex:1;" onclick="document.getElementById('questionModal').remove()">Fermer</button><button class="btn-primary" style="flex:1;background:${t.color};" onclick="markDiscussed();document.getElementById('questionModal').remove()">✓ Discuté</button></div></div>`;
    document.body.appendChild(m);
}

function markDiscussed() { showSuccess("Question notée !"); }

function goToPhase4() { $('coConstPhase3').style.display='none'; $('coConstPhase4').style.display='block'; renderSoftEngagement(); }
function backToPhase3() { $('coConstPhase4').style.display='none'; $('coConstPhase3').style.display='block'; }

function renderSoftEngagement() {
    const c=$('engagementContainer'); if(!c) return;
    const role=PARTICIPANT_ROLES[localStorage.getItem('myRole')||'explorateur'];
    c.innerHTML=`
        <div style="text-align:center;margin-bottom:20px;"><div style="font-size:2.5em;">${role.icon}</div><p style="opacity:0.8;">En tant que <strong>${role.name}</strong></p></div>
        <div class="engagement-options">
            <p style="margin-bottom:15px;">Cette semaine, je serais partant pour...</p>
            <label class="engagement-option"><input type="checkbox" name="eng" value="observer"><span>👀 Observer et réfléchir</span></label>
            <label class="engagement-option"><input type="checkbox" name="eng" value="discuss"><span>💬 En parler avec un collègue</span></label>
            <label class="engagement-option"><input type="checkbox" name="eng" value="calculate"><span>🧮 Calculer mes coûts</span></label>
            <label class="engagement-option"><input type="checkbox" name="eng" value="test"><span>🧪 Tester une alternative (1 trajet)</span></label>
            <label class="engagement-option"><input type="checkbox" name="eng" value="help"><span>🤝 Aider quelqu'un qui veut essayer</span></label>
            <label class="engagement-option"><input type="checkbox" name="eng" value="nothing"><span>😌 Rien pour l'instant, et c'est ok</span></label>
        </div>
        <div style="margin-top:20px;"><label style="display:block;margin-bottom:8px;opacity:0.8;">💡 Une remarque ?</label><textarea id="engagementNote" rows="2" placeholder="(optionnel)"></textarea></div>`;
}

function finishCoConstruction() {
    const engs=[]; document.querySelectorAll('input[name="eng"]:checked').forEach(cb=>engs.push(cb.value));
    const note=$('engagementNote')?$('engagementNote').value:'';
    const groupNote=$('groupNote')?$('groupNote').value:'';
    localStorage.setItem('engagements',JSON.stringify(engs)); localStorage.setItem('engagementNote',note); localStorage.setItem('groupNote',groupNote);
    sendToGoogleSheets({type:'coconstruction',participantId:myUniqueId,emoji:myEmoji,role:localStorage.getItem('myRole'),themes:selectedThemes.join(','),engagements:engs.join(','),note:note,groupNote:groupNote});
    showSuccess("Merci !"); showStep(6);
}

// ================= LOGIQUE METIER =================
function haversineKm(lat1,lon1,lat2,lon2) { const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180,a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2; return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a)); }

function addParticipant(data) {
    if(!myCoords) { showError("Position non définie"); return false; }
    if(participants.find(p=>p.id===data.id)) { showError("Déjà scanné"); return false; }
    if(data.id===myUniqueId) { showError("C'est vous !"); return false; }
    const dist=haversineKm(myCoords.lat,myCoords.lon,data.lat,data.lon);
    participants.push({...data,distance:dist}); localStorage.setItem('participants',JSON.stringify(participants));
    scanCount=participants.length; if($('scanCount')) $('scanCount').textContent=scanCount; if($('step2Progress')) $('step2Progress').style.width=Math.min((scanCount/20)*100,100)+'%';
    showSuccess(`OK ! ${dist.toFixed(1)} km`);
    if(participants.length>=APP_CONFIG.MIN_PARTICIPANTS_REQUIRED&&$('goToStep3')) $('goToStep3').disabled=false;
    if(dist<5&&$('challengeSection')) { const ch=miniChallenges[Math.floor(Math.random()*miniChallenges.length)]; $('challengeTitle').textContent=ch.title; $('challengeTask').textContent=ch.task; $('challengeSection').style.display='block'; if($('scanBtn')) $('scanBtn').style.display='none'; $('continueChallengeBtn').onclick=()=>{ $('challengeSection').style.display='none'; if($('scanBtn')) $('scanBtn').style.display='block'; }; }
    sendToGoogleSheets({type:'scan',scannerId:myUniqueId,scannedId:data.id,distance:dist});
    return true;
}

function handlePositioningScan(data) { if(!myCoords) return false; const d=haversineKm(myCoords.lat,myCoords.lon,data.lat,data.lon); showSuccess(`📍 ${d.toFixed(1)} km`); return true; }

function initGame() { if(participants.length<1) return; gameTargets=participants.sort((a,b)=>a.distance-b.distance).slice(0,5); scannedTargets=[]; score=0; attemptsLeft=5; updateGameUI(); }
function updateGameUI() { if($('scoreBadge')) $('scoreBadge').textContent=`${score}/3`; if($('attemptsLeft')) $('attemptsLeft').textContent=attemptsLeft; let h=''; gameTargets.forEach((t,i)=>{ const s=scannedTargets.includes(t.id); h+=`<div class="participant-card ${s?'scanned':'target'}"><div><strong>Voisin ${i+1}</strong><br><small>${t.distance.toFixed(1)} km</small></div><div class="icon-badge">${s?'✅':'🎯'}</div></div>`; }); if($('targetList')) $('targetList').innerHTML=h; }
function handleGameScan(data) { const t=gameTargets.find(x=>x.id===data.id); if(!t) { showError("Pas un voisin"); attemptsLeft--; updateGameUI(); return false; } if(scannedTargets.includes(data.id)) { showError("Déjà trouvé"); return false; } scannedTargets.push(data.id); score++; showSuccess("Trouvé !"); updateGameUI(); if(score>=3&&$('gameResult')) { $('gameResult').innerHTML=`<div class="success-msg">🎉 GAGNÉ !</div>`; if($('gameScanBtn')) $('gameScanBtn').style.display='none'; } return true; }

// ================= STEP 6 =================
function initStep6Form() {
    const createFields=(listId,items,type)=>{ const l=$(listId); if(!l||l.children.length>0) return; items.forEach((item,i)=>{ const isOther=item.toLowerCase().includes("autre"); let h=`<div class="checkbox-item-wrapper"><div class="checkbox-item"><input type="checkbox" id="${type}${i}" onchange="handleOptionChange(this,'${type}','${item}',${i},${isOther})"><label for="${type}${i}" style="flex:1;">${item}</label></div>`; if(isOther) h+=`<input type="text" id="${type}Input${i}" class="other-input" placeholder="Précisez..." style="display:none;">`; h+=`</div>`; l.innerHTML+=h; }); };
    createFields('alternativesList',ALTERNATIVES,'alt'); createFields('constraintsList',CONSTRAINTS,'cons'); createFields('leversList',LEVERS,'lev');
}
function handleOptionChange(cb,type,name,idx,isOther) { if(isOther) { const inp=document.getElementById(`${type}Input${idx}`); if(inp) inp.style.display=cb.checked?'block':'none'; } let obj=(type==='alt')?selectedAlternatives:(type==='cons'?selectedConstraints:selectedLevers); if(cb.checked) obj[name]="1"; else delete obj[name]; }
function updateCommitmentValue() { commitmentLevel=parseInt($('commitmentRange').value); if($('commitmentValue')) $('commitmentValue').textContent=commitmentLevel; }

function showCompanyScan() {
    const format=obj=>Object.keys(obj).join(', ');
    localStorage.setItem('finalAlternatives',format(selectedAlternatives)); localStorage.setItem('finalConstraints',format(selectedConstraints)); localStorage.setItem('finalLevers',format(selectedLevers));
    sendToGoogleSheets({type:'propositions',participantId:myUniqueId,alternatives:format(selectedAlternatives),contraintes:format(selectedConstraints),leviers:format(selectedLevers),engagement:commitmentLevel});
    showStep('companyScanPage'); startScanLoop('company');
}

// ================= ADMIN =================
function showAdminPage() { showStep('adminPage'); $('adminPage').classList.add('active'); if($('adminPanel')) $('adminPanel').style.display='none'; if($('adminLogin')) $('adminLogin').style.display='block'; }
function adminLogin() { if($('adminPassword').value===APP_CONFIG.ADMIN_PASSWORD) { $('adminLogin').style.display='none'; $('adminPanel').style.display='block'; } else showError("Incorrect"); }
async function generateCompanyQR() { const addr=$('companyAddressInput').value; if(!addr) return showError("Entrez adresse"); try { $('companyQrcode').innerHTML='...'; const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}`); const data=await res.json(); if(!data.length) throw new Error("Introuvable"); $('companyQrcode').innerHTML=''; new QRCode($('companyQrcode'),{text:JSON.stringify({type:'company',lat:parseFloat(data[0].lat),lon:parseFloat(data[0].lon)}),width:200,height:200}); $('companyQRSection').style.display='flex'; } catch(e) { showError(e.message); $('companyQrcode').innerHTML=''; } }
function updateStep5Stats() { if($('totalParticipants')) $('totalParticipants').textContent=participants.length+1; if(participants.length>0) { const avg=participants.reduce((a,p)=>a+p.distance,0)/participants.length; if($('avgDistance')) $('avgDistance').textContent=avg.toFixed(1); } }
function handleCompanyScan(data) { companyCoords={lat:data.lat,lon:data.lon}; const dist=haversineKm(myCoords.lat,myCoords.lon,companyCoords.lat,companyCoords.lon); const factor=CO2_FACTORS[myTransportMode]||0.1; const co2=Math.round(dist*2*220*factor*0.3); if($('co2Savings')) $('co2Savings').textContent=co2; stopAllCameras(); $('companyScanPage').classList.remove('active'); $('reportPage').classList.add('active'); sendToGoogleSheets({type:'company_distance',participantId:myUniqueId,distance:dist}); }
function sendToGoogleSheets(data) { if(!googleScriptUrl) return; fetch(googleScriptUrl,{method:'POST',mode:'no-cors',body:JSON.stringify(data)}).catch(()=>{}); }
async function exportExcel() { try { const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(participants.map(p=>({Distance:p.distance}))),"Scans"); XLSX.writeFile(wb,"GoDifferent_Export.xlsx"); showSuccess("Export OK"); } catch(e) { showError("Erreur"); } }
function generatePDF() { const w=window.open('','_blank'); w.document.write(`<html><head><title>Bilan ${myEmoji}</title><style>body{font-family:sans-serif;padding:20px;max-width:700px;margin:0 auto;}h1{color:#4F46E5;text-align:center;}.card{border:1px solid #ddd;padding:20px;border-radius:10px;margin:15px 0;}.btn{display:block;width:100%;padding:15px;background:#4F46E5;color:white;text-align:center;border-radius:8px;margin-top:20px;border:none;cursor:pointer;font-size:1rem;}</style></head><body><h1>🌱 Bilan Mobilité</h1><div class="card"><p><strong>Pseudo:</strong> ${myEmoji}</p><p><strong>Mode:</strong> ${myTransportMode}</p><p><strong>Gain potentiel:</strong> <span style="color:#10b981;font-size:1.5em;font-weight:bold;">${$('co2Savings')?$('co2Savings').textContent:'0'} kg CO₂/an</span></p></div><div class="card"><p><strong>Alternatives:</strong> ${localStorage.getItem('finalAlternatives')||'Aucune'}</p><p><strong>Contraintes:</strong> ${localStorage.getItem('finalConstraints')||'Aucune'}</p><p><strong>Leviers:</strong> ${localStorage.getItem('finalLevers')||'Aucun'}</p><p><strong>Engagement:</strong> ${commitmentLevel}%</p></div><button onclick="window.print()" class="btn">🖨️ Imprimer</button></body></html>`); w.document.close(); }
