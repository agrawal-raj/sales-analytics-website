// Authentication middleware for frontend routes
function checkAuth() {
    const protectedRoutes = ['/profile.html', '/admin.html', '/landing.html'];
    const currentPath = window.location.pathname.split('/').pop();
    
    if (protectedRoutes.includes(`/${currentPath}`)) {
        const token = localStorage.getItem('token');
        
        if (!token) {
            redirectToLogin();
            return false;
        }

        // Verify token with backend
        verifyTokenWithBackend(token).catch(() => {
            redirectToLogin();
        });
    }
    return true;
}

function verifyTokenWithBackend(token) {
    return fetch('/api/verify-token', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Invalid token');
        return response.json();
    });
}

function redirectToLogin() {
    localStorage.removeItem('token');
    window.location.href = '/frontend/index.html?error=unauthorized';
}

// Run check on page load
document.addEventListener('DOMContentLoaded', checkAuth);// Authentication middleware for frontend routes
function checkAuth() {
    const protectedRoutes = ['/profile.html', '/admin.html', '/landing.html'];
    const currentPath = window.location.pathname.split('/').pop();
    
    if (protectedRoutes.includes(`/${currentPath}`)) {
        const token = localStorage.getItem('token');
        
        if (!token) {
            redirectToLogin();
            return false;
        }

        // Verify token with backend
        verifyTokenWithBackend(token).catch(() => {
            redirectToLogin();
        });
    }
    return true;
}

function verifyTokenWithBackend(token) {
    return fetch('/api/verify-token', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) throw new Error('Invalid token');
        return response.json();
    });
}

function redirectToLogin() {
    localStorage.removeItem('token');
    window.location.href = '/frontend/index.html?error=unauthorized';
}

// Run check on page load
document.addEventListener('DOMContentLoaded', checkAuth);