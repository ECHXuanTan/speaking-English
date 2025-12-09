// Student login functionality

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    
    // Check if already logged in
    if (Auth.isAuthenticated()) {
        const userInfo = Auth.getUserInfo();
        if (userInfo && userInfo.role === 'student') {
            window.location.href = '/student/dashboard.html';
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
    const studentCode = document.getElementById('studentCode').value.trim();
    const password = document.getElementById('password').value.trim();

    // Validation
    if (!studentCode || !password) {
        Utils.showAlert('Vui lòng nhập đầy đủ thông tin đăng nhập', 'warning');
        return;
    }

    // Show loading
    Utils.showLoading(loginBtn, 'Đang đăng nhập...');

    try {
        const response = await Utils.apiRequest('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                student_code: studentCode,
                password: password
            })
        });

        if (response.success) {
            // Store authentication info with 8 hour expiry
            Auth.setToken(response.token || 'student_session', 8);
            Auth.setUserInfo({
                id: response.data.user.id,
                studentCode: response.data.user.student_code,
                fullName: response.data.user.full_name,
                role: 'student'
            });

            Utils.showAlert('Đăng nhập thành công!', 'success');
            
            // Redirect to dashboard immediately
            window.location.href = '/student/dashboard.html';
        } else {
            Utils.showAlert(response.message || 'Đăng nhập thất bại', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        Utils.showAlert('Lỗi kết nối đến server. Vui lòng thử lại.', 'error');
    } finally {
        Utils.hideLoading(loginBtn, '<i class="fas fa-sign-in-alt"></i> Đăng Nhập');
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
