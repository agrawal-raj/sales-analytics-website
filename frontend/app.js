document.addEventListener('DOMContentLoaded', function() {

   
const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn.addEventListener('click', () => {
    container.classList.add('active');
})

loginBtn.addEventListener('click', () => {
    container.classList.remove('active');
})


document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageElement = document.getElementById('message');
    const body = new URLSearchParams();
    body.append('username', username);
    body.append('password', password);
    
    // Clear previous messages
    messageElement.textContent = '';
    messageElement.className = 'error-message';
    
    // Simple client-side validation
    if (!username || !password) {
        messageElement.textContent = 'Please enter both username and password';
        return;
    }
    
    // Call the login API
    fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
    })
    .then(response => {
        if (response.ok) {
            return response.json();

        } else {
            // If server responds with error status
            return response.json().then(err => {
                throw new Error(err.message || 'Login failed');
            });
        }
    })
    .then(data => {
        // Handle successful login
        messageElement.textContent = 'Login successful!';
        messageElement.className = 'success-message';
        
        // You can redirect or store the token here
        const accessToken = data.access_token; 
        localStorage.setItem("role", data.role)
        localStorage.setItem("access_token",accessToken)
        //window.location.href = '/frontend/profile.html'; 
        // Example: Redirect after successful login
        if(data.role==='admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'landing.html';
        }
        
    })
    .catch(error => {
        // Handle errors
        console.error('Error:', error);
        messageElement.textContent = error.message ||'An error occurred during login';
    });
});

document.getElementById('registerForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const role = document.querySelector('input[name="role"]:checked').value;
    const messageElement = document.getElementById('message');

    const raw = JSON.stringify({
        "username": username,
        "password": password,
        "role": role
    });

    // Clear previous messages
    messageElement.textContent = '';
    messageElement.className = 'error-message';

    // Simple validation
    if (!username || !password || !role) {
        messageElement.textContent = 'Please fill all fields';
        return;
    }

    // Call the registration API
    fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: raw
    })
    .then(response => {
        if (response.status === 201) {
            return response.json();
        } else {
            return response.json().then(err => {
                throw new Error(err.detail || 'Registration failed');
            });
        }
    })
    .then(data => {
        // Success
        messageElement.textContent = 'Registration successful! Redirecting...';
        messageElement.className = 'success-message';
        console.log('Redirecting in 3 seconds...');
        setTimeout(() => {
            console.log('Redirecting now...');
            window.location.href = 'index.html';
        }, 3000);
    })
    .catch(error => {
        console.error('Error:', error);
        messageElement.textContent = error.message || 'An error occurred during registration';
    });
});


});
