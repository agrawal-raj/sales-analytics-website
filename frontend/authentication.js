// Authentication middleware for frontend routes
async function checkAuth() {
    // Define route access levels
    const routePermissions = {
        '/profile.html': ['user', 'admin'],
        '/landing.html': ['user', 'admin'],
        '/admin.html': ['admin']
    };

    const currentPath = '/' + window.location.pathname.split('/').pop();
    
    // If not a protected route, allow access
    if (!routePermissions.hasOwnProperty(currentPath)) {
        return true;
    }

    // Check for token
    const token = localStorage.getItem('access_token');
    if (!token) {
        redirectToLogin();
        return false;
    }

    // Check user role
    const role = localStorage.getItem('role');
    if (!role) {
        redirectToLogin();
        return false;
    }

    // Verify route access based on role
    const allowedRoles = routePermissions[currentPath];
    if (!allowedRoles.includes(role)) {
        // Alternatively redirect to "unauthorized" page instead of login
        redirectToLogin();
        return false;
    }

    // Verify token with backend
    try {
        await verifyTokenWithBackend(token);
        return true;
    } catch (error) {
        console.error('Token verification failed:', error);
        redirectToLogin();
        return false;
    }
}

// Helper function for redirection
function redirectToLogin() {
    // Clear invalid auth data
    localStorage.removeItem('access_token');
    localStorage.removeItem('role');
    window.location.href = '/frontend/index.html?error=unauthorized';
}

async function verifyTokenWithBackend(token) {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/verify-token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Token verification failed:', error);
        throw error;
    }
}


// Run check on page load
document.addEventListener('DOMContentLoaded', checkAuth);// Authentication middleware for frontend routes
