import { initPromise, auth, onAuthStateChanged } from './firebase-auth.js';

document.addEventListener("DOMContentLoaded", () => {
    initPromise.then(() => {
        // Escuchar el estado de autenticación de Firebase
        onAuthStateChanged(auth, (user) => {
            const desktopNav = document.querySelector('.nav-desktop');
            const sideMenu = document.getElementById('sideMenu');
            
            if (user) {
                // Usuario logueado
                const dashboardLinkDesktop = `<a href="/dashboard" class="user-btn" style="color: var(--hp-pink); font-weight: 700;">¡Hola, ${user.displayName.split(' ')[0]}!</a>`;
                const dashboardLinkMobile = `<a href="/dashboard" style="color: var(--hp-pink); font-weight: 700;">Dashboard (${user.displayName.split(' ')[0]})</a>`;
                
                // Reemplazar o añadir link al dashboard
                actualizarLinks(desktopNav, dashboardLinkDesktop, true);
                actualizarLinks(sideMenu, dashboardLinkMobile, false);
            } else {
                // Usuario no logueado
                const loginLinkDesktop = `<a href="/login.html" class="login-btn">Iniciar Sesión</a>`;
                const loginLinkMobile = `<a href="/login.html">Iniciar Sesión</a>`;
                
                actualizarLinks(desktopNav, loginLinkDesktop, true);
                actualizarLinks(sideMenu, loginLinkMobile, false);
            }
        });
    });
});

function actualizarLinks(container, newLinkHtml, isDesktop) {
    if (!container) return;
    
    // Remover botón previo si existe
    const existingLogin = container.querySelector('a[href="/login.html"]');
    const existingDash = container.querySelector('a[href="/dashboard"]');
    if (existingLogin) existingLogin.remove();
    if (existingDash) existingDash.remove();

    // Añadir el nuevo al final del nav
    container.insertAdjacentHTML('beforeend', newLinkHtml);
}
