// Supervisor login functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    
    // Check if already logged in
    if (Auth.isAuthenticated()) {
        const userInfo = Auth.getUserInfo();
        if (userInfo && userInfo.role === 'supervisor') {
            window.location.href = '/supervisor/dashboard.html';
            return;
        }
    }

    // Show auth message if any (from redirect)
    const authMessage = sessionStorage.getItem('auth_message');
    if (authMessage) {
        Utils.showAlert(authMessage, 'warning');
        sessionStorage.removeItem('auth_message');
    }

    loginForm.addEventListener('submit', handleLogin);
});

async function handleLogin(event) {
    event.preventDefault();
    
    const loginBtn = document.getElementById('loginBtn');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();

    // Validation
    if (!username || !password) {
        Utils.showAlert('Vui lòng nhập đầy đủ thông tin đăng nhập', 'warning');
        return;
    }

    // Show loading
    Utils.showLoading(loginBtn, 'Đang đăng nhập...');

    try {
        const response = await Utils.apiRequest('/api/auth/supervisor-login', {
            method: 'POST',
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        if (response.success) {
            // Store authentication info with 8 hour expiry
            Auth.setToken(response.token || 'supervisor_session', 8);
            Auth.setUserInfo({
                id: response.data.user.id || 'supervisor',
                username: response.data.user.username || username,
                role: 'supervisor'
            });

            Utils.showAlert('Đăng nhập thành công!', 'success');
            
            // Redirect to dashboard immediately
            window.location.href = '/supervisor/dashboard.html';
        } else {
            Utils.showAlert(response.message || 'Đăng nhập thất bại', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Lỗi kết nối đến server. ';
        
        if (error.message.includes('401')) {
            errorMessage = 'Tên đăng nhập hoặc mật khẩu không đúng.';
        } else if (error.message.includes('403')) {
            errorMessage = 'Tài khoản không có quyền truy cập.';
        } else {
            errorMessage += 'Vui lòng thử lại.';
        }
        
        Utils.showAlert(errorMessage, 'error');
    } finally {
        Utils.hideLoading(loginBtn, '<i class="fas fa-sign-in-alt"></i> Đăng Nhập Giám Thị');
    }
}

// Enter key handling
document.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const loginForm = document.getElementById('loginForm');
        if (loginForm && event.target.form === loginForm) {
            handleLogin(event);
        }
    }
});
