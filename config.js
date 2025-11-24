// CONFIGURATION DE L'ATELIER MOBILITÉ
// Modifiez ce fichier pour chaque nouvel événement/client.

const CONFIG = {
    // La date après laquelle l'app affiche "Session Expirée" (Protection IP)
    EXPIRATION_DATE: "2025-12-31",

    // Les codes d'accès valides pour les participants (ex: "25", "TOTAL2024")
    VALID_ACCESS_CODES: ["25"],

    // Mot de passe pour accéder au panneau admin (en bas à droite)
    ADMIN_PASSWORD: 'mobilite2025',

    // Nombre minimum de participants scannés pour débloquer la suite
    MIN_PARTICIPANTS_REQUIRED: 1,

    // URL de ton Google Apps Script (Backend)
    // Laisse vide ici si tu veux le configurer manuellement dans l'interface Admin
    GOOGLE_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzFwJ2Eyt05aq9OnWlB0_lpmt1lfTx3CYZa1yDZ3GX6hwPGzTfHKlIExkgwxIA0sWed/exec'
};
