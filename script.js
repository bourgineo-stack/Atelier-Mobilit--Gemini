// ... (Début inchangé) ...

// ================= CO-CONSTRUCTION : LOGIQUE GROUPE & QUESTIONS =================
let currentGroup = [];
let currentQuestions = [];
let questionIndex = 0;

// Questions "Maïeutiques"
const QUESTIONS_CLOSE = [
    { q: "Si le tram/bus est en panne demain, comment venez-vous ?", sub: "Testez l'itinéraire vélo mentalement." },
    { q: "Le vélo : plus facile tout seul ou à deux pour débuter ?", sub: "Qui pourrait être votre 'parrain' vélo ?" },
    { q: "Connaissez-vous les aides pour l'achat d'un VAE ?", sub: "Jusqu'à 400€ par l'État + Abondement employeur parfois." },
    { q: "Top Chrono : Qui gagne entre vélo et voiture à 18h ?", sub: "Sur 5km, le vélo met 15-20min constants. La voiture ?" },
    { q: "La mobilité douce a-t-elle un lien avec votre santé ?", sub: "30min de vélo = sport journalier validé." }
];

const QUESTIONS_FAR = [
    { q: "Imaginez un moyen de faire le 'dernier km' qui tiendrait dans le coffre ?", sub: "Trotinette, skate, vélo pliant ?" },
    { q: "Comment s'organiser : Appli de covoit ou groupe WhatsApp ?", sub: "Qu'est-ce qui est le moins contraignant ?" },
    { q: "Connaissez-vous quelqu'un qui a une voiture électrique ?", sub: "L'avez-vous déjà essayée ?" },
    { q: "On fait comment pour les horaires si on covoiture ?", sub: "Faut-il être flexible ou rigide sur l'heure de départ ?" },
    { q: "Connaissez-vous les services type 'GetAround' ?", sub: "Louer sa voiture quand elle ne sert pas au travail." }
];

// Phase 1 : Formation Groupe
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

function startScanLoop(type) {
    // ... (Code scan inchangé, mais assurez-vous que 'group' est géré dans tick())
    // Ajout spécifique pour le type 'group'
    const camViewId = type === 'group' ? 'groupCameraView' : (type === 'game' ? 'gameCameraView' : (type === 'company' ? 'companyCameraView' : (type === 'positioning' ? 'positioningCameraView' : 'cameraView')));
    const videoId = type === 'group' ? 'groupVideo' : (type === 'game' ? 'gameVideo' : (type === 'company' ? 'companyVideo' : (type === 'positioning' ? 'positioningVideo' : 'video')));
    // ... (Reste de la logique d'affichage des divs caméra) ...
    
    // Pour simplifier, assurez-vous que votre fonction startScanLoop existante gère bien les ID génériques
    // ou ajoutez ces lignes :
    if(type === 'group') {
        $('groupScanInterface').style.display = 'block';
        $('groupCameraView').style.display = 'block';
    }
    
    // Lancement caméra standard...
    scanning = true;
    const video = $(videoId);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    .then(stream => {
        video.srcObject = stream;
        video.setAttribute("playsinline", true);
        video.play();
        requestAnimationFrame(() => tick(video, type));
    });
}

// Ajout dans la fonction tick() pour gérer le type 'group'
/* if (type === 'group' && data.id) {
        addMemberToGroup(data);
    }
*/

function addMemberToGroup(data) {
    // Anti-doublon
    if(currentGroup.find(m => m.id === data.id)) return;
    if(data.id === myUniqueId) { showError("Vous êtes déjà le chef !"); return; }
    
    currentGroup.push(data);
    updateGroupList();
    showSuccess(`${data.emoji || 'Membre'} ajouté !`);
    
    // Pause courte pour éviter scan multiple
    scanning = false;
    setTimeout(() => { scanning = true; requestAnimationFrame(() => tick($('groupVideo'), 'group')); }, 1500);
}

function updateGroupList() {
    const list = $('groupMembersList');
    list.innerHTML = currentGroup.map(m => `<div>✅ ${m.emoji || '👤'} (scan ok)</div>`).join('');
    
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
    
    // Animation simple (fade in)
    const card = $('dynamicQuestionCard');
    card.style.opacity = 0;
    setTimeout(() => card.style.opacity = 1, 100);
}

function nextQuestion() {
    questionIndex++;
    showNextQuestion();
}

// ... (Assurez-vous d'intégrer la logique 'group' dans tick() comme mentionné plus haut) ...
