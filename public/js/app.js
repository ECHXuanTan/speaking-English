// Global application functions and utilities

// Redirect function for role selection
function redirectTo(role) {
    if (role === 'student') {
        window.location.href = '/student/login.html';
    } else if (role === 'supervisor') {
        window.location.href = '/supervisor/login.html';
    }
}

// Utility functions
class Utils {
    // Show loading state
    static showLoading(element, text = 'Đang xử lý...') {
        if (element) {
            element.innerHTML = `<span class="loading-spinner"></span> ${text}`;
            element.disabled = true;
        }
    }

    // Hide loading state
    static hideLoading(element, originalText) {
        if (element) {
            element.innerHTML = originalText;
            element.disabled = false;
        }
    }

    // Show alert message
    static showAlert(message, type = 'success', containerId = 'alertContainer') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.innerHTML = `
            <i class="fas fa-${this.getAlertIcon(type)}"></i>
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;float:right;cursor:pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(alertDiv);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentElement) {
                alertDiv.remove();
            }
        }, 5000);
    }

    static getAlertIcon(type) {
        const icons = {
            success: 'check-circle',
            warning: 'exclamation-triangle',
            error: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Format time (seconds to mm:ss)
    static formatTime(seconds) {
        if (typeof seconds === 'object' && seconds instanceof Date) {
            return seconds.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    // Format date (YYYY-MM-DD to DD/MM/YYYY)
    static formatDate(dateString) {
        if (!dateString) return '--';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }

    // Format date and time (YYYY-MM-DD HH:mm:ss to DD/MM/YYYY HH:mm)
    static formatDateTime(dateTimeString) {
        if (!dateTimeString) return '--';
        try {
            const date = new Date(dateTimeString);
            return date.toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateTimeString;
        }
    }

    // API request wrapper
    static async apiRequest(url, options = {}) {
        try {
            const defaultOptions = {
                headers: {
                    'Content-Type': 'application/json',
                },
            };

            const response = await fetch(url, { ...defaultOptions, ...options });
            
            // Handle authentication errors (401/403)
            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                
                // Clear auth and redirect to login
                Auth.clearAuth();
                
                // Show appropriate message
                const message = errorData.message || (response.status === 401 ? 
                    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại' : 
                    'Không có quyền truy cập');
                
                // Store message for display after redirect
                sessionStorage.setItem('auth_message', message);
                
                // Redirect to appropriate login page
                const currentPath = window.location.pathname;
                if (currentPath.includes('/student/')) {
                    window.location.href = '/student/login.html';
                } else if (currentPath.includes('/supervisor/')) {
                    window.location.href = '/supervisor/login.html';
                } else {
                    window.location.href = '/';
                }
                
                return; // Stop execution
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // Download file with authentication check
    static async downloadFile(url, filename = null) {
        try {
            const response = await fetch(url);
            
            // Handle authentication errors (401/403) 
            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                
                // Clear auth and redirect to login
                Auth.clearAuth();
                
                // Show appropriate message
                const message = errorData.message || (response.status === 401 ? 
                    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại' : 
                    'Không có quyền truy cập');
                
                // Store message for display after redirect
                sessionStorage.setItem('auth_message', message);
                
                // Redirect to appropriate login page
                const currentPath = window.location.pathname;
                if (currentPath.includes('/student/')) {
                    window.location.href = '/student/login.html';
                } else if (currentPath.includes('/supervisor/')) {
                    window.location.href = '/supervisor/login.html';
                } else {
                    window.location.href = '/';
                }
                
                return false; // Stop execution
            }
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = downloadUrl;
            a.download = filename || 'download';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            document.body.removeChild(a);
            
            return true;
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    }

    // Upload file with authentication check
    static async uploadFile(url, formData) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            
            // Handle authentication errors (401/403)
            if (response.status === 401 || response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                
                // Clear auth and redirect to login
                Auth.clearAuth();
                
                // Show appropriate message
                const message = errorData.message || (response.status === 401 ? 
                    'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại' : 
                    'Không có quyền truy cập');
                
                // Store message for display after redirect
                sessionStorage.setItem('auth_message', message);
                
                // Redirect to appropriate login page
                const currentPath = window.location.pathname;
                if (currentPath.includes('/student/')) {
                    window.location.href = '/student/login.html';
                } else if (currentPath.includes('/supervisor/')) {
                    window.location.href = '/supervisor/login.html';
                } else {
                    window.location.href = '/';
                }
                
                return null; // Stop execution
            }
            
            return await response.json();
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    }

    // Check system health
    static async checkSystemHealth() {
        try {
            const response = await this.apiRequest('/api/system/health');
            return response.status === 'ok';
        } catch (error) {
            console.error('System health check failed:', error);
            return false;
        }
    }
}

// Initialize system status check and global authentication
document.addEventListener('DOMContentLoaded', async () => {
    // Global authentication check for protected pages
    Auth.checkAuthAndRedirect();
    
    const statusIndicator = document.querySelector('.status-indicator');
    const statusText = document.querySelector('.system-status span:last-child');
    
    // Only show system status on pages that have status indicators
    if (statusIndicator && statusText) {
        statusIndicator.className = 'status-indicator online';
        statusText.textContent = 'Hệ thống hoạt động bình thường';
    }
});

// Authentication utilities
class Auth {
    static getToken() {
        return sessionStorage.getItem('auth_token');
    }

    static setToken(token, expiryHours = 168) {
        const now = new Date();
        const expiry = new Date(now.getTime() + (expiryHours * 60 * 60 * 1000)); // Default 168 hours (7 days)
        
        sessionStorage.setItem('auth_token', token);
        sessionStorage.setItem('token_expiry', expiry.toISOString());
    }

    static removeToken() {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('user_info');
        sessionStorage.removeItem('token_expiry');
    }

    static clearAuth() {
        this.removeToken();
    }

    static getUserInfo() {
        const userInfo = sessionStorage.getItem('user_info');
        return userInfo ? JSON.parse(userInfo) : null;
    }

    static setUserInfo(userInfo) {
        sessionStorage.setItem('user_info', JSON.stringify(userInfo));
    }

    static isTokenExpired() {
        const expiry = sessionStorage.getItem('token_expiry');
        if (!expiry) return true;
        
        const expiryDate = new Date(expiry);
        const now = new Date();
        return now >= expiryDate;
    }

    static isAuthenticated() {
        const token = this.getToken();
        const userInfo = this.getUserInfo();
        
        if (!token || !userInfo) {
            return false;
        }
        
        if (this.isTokenExpired()) {
            this.removeToken(); // Clear expired session
            return false;
        }
        
        return true;
    }

    // Check authentication for protected pages and redirect if needed
    static checkAuthAndRedirect() {
        const currentPath = window.location.pathname;
        const isLoginPage = currentPath.includes('login.html') || currentPath === '/' || currentPath === '/index.html';
        
        // Skip auth check for login pages and home page
        if (isLoginPage) {
            return true;
        }

        const token = this.getToken();
        const userInfo = this.getUserInfo();
        
        // Check if token or user info is missing
        if (!token || !userInfo) {
            this.redirectToLogin(currentPath, 'Vui lòng đăng nhập để tiếp tục');
            return false;
        }
        
        // Check if token is expired
        if (this.isTokenExpired()) {
            this.removeToken(); // Clear expired session
            this.redirectToLogin(currentPath, 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại');
            return false;
        }

        return true;
    }

    // Helper method to redirect to appropriate login page with message
    static redirectToLogin(currentPath, message = null) {
        // Store message to show after redirect
        if (message) {
            sessionStorage.setItem('auth_message', message);
        }
        
        // Determine which login page to redirect to based on current path
        if (currentPath.includes('/student/')) {
            window.location.href = '/student/login.html';
        } else if (currentPath.includes('/supervisor/')) {
            window.location.href = '/supervisor/login.html';
        } else {
            // Default to home page for unknown paths
            window.location.href = '/';
        }
    }

    static async logout() {
        try {
            await Utils.apiRequest('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.removeToken();
            window.location.href = '/';
        }
    }
}

// Export for use in other files
window.Utils = Utils;
window.Auth = Auth;
