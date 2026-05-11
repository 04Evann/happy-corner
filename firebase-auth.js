import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let app, auth, db, provider;

// Promesa global de inicialización
const initPromise = fetch('/api/getConfig')
    .then(res => {
        if (!res.ok) throw new Error("No se pudo obtener la configuración de Firebase");
        return res.json();
    })
    .then(config => {
        // Validación básica
        if (!config.apiKey) throw new Error("API Key no definida en variables de entorno");
        
        app = initializeApp(config);
        auth = getAuth(app);
        db = getFirestore(app);
        provider = new GoogleAuthProvider();
    })
    .catch(err => {
        console.error("Error inicializando Firebase:", err);
    });

export { initPromise, auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc };
