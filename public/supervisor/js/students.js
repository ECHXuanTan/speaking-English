// Students management functionality

let currentStudents = [];
let currentPage = 1;
const itemsPerPage = 10;
let selectedStudents = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!Auth.isAuthenticated()) {
        window.location.href = '/supervisor/login.html';
        return;
    }

    const userInfo = Auth.getUserInfo();
    if (!userInfo || userInfo.role !== 'supervisor') {
        window.location.href = '/supervisor/login.html';
        return;
    }

    // Initialize page
    initializePage();
    loadStudents();
    setupEventListeners();
});

function initializePage() {
    const userInfo = Auth.getUserInfo();
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (userInfo && userInfo.full_name) {
        welcomeMessage.textContent = `Chào mừng, ${userInfo.full_name}!`;
    }

    // Check for import hash
    if (window.location.hash === '#import') {
        setTimeout(() => {
            document.getElementById('importStudentsBtn').click();
        }, 500);
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Student management
    document.getElementById('addStudentBtn').addEventListener('click', openAddStudentModal);
    document.getElementById('importStudentsBtn').addEventListener('click', openImportModal);
    document.getElementById('exportStudentsBtn').addEventListener('click', exportStudents);
    document.getElementById('refreshBtn').addEventListener('click', loadStudents);

    // Search and filter
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('statusFilter').addEventListener('change', handleFilter);

    // Bulk actions
    document.getElementById('selectAllCheckbox').addEventListener('change', handleSelectAll);
    document.getElementById('bulkDeleteBtn').addEventListener('click', handleBulkDelete);
    document.getElementById('bulkGeneratePasswordBtn').addEventListener('click', handleBulkGeneratePassword);

    // Student modal
    document.getElementById('closeModalBtn').addEventListener('click', closeStudentModal);
    document.getElementById('cancelBtn').addEventListener('click', closeStudentModal);
    document.getElementById('studentForm').addEventListener('submit', handleSaveStudent);
    document.getElementById('generatePasswordBtn').addEventListener('click', generatePassword);

    // Import modal
    document.getElementById('closeImportModalBtn').addEventListener('click', closeImportModal);
    document.getElementById('cancelImportBtn').addEventListener('click', closeImportModal);
    document.getElementById('uploadArea').addEventListener('click', () => document.getElementById('fileInput').click());
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('confirmImportBtn').addEventListener('click', handleImport);

    // Drag and drop
    const uploadArea = document.getElementById('uploadArea');
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleDrop);
}

async function loadStudents() {
    try {
        Utils.showLoading(document.getElementById('refreshBtn'), 'Đang tải...');
        
        const response = await Utils.apiRequest('/api/supervisor/students');
        
        if (response.success) {
            currentStudents = response.data.students || [];
            renderStudentsTable();
            updateTotalCount();
        } else {
            Utils.showAlert(response.message || 'Lỗi tải danh sách học sinh', 'error');
        }
    } catch (error) {
        console.error('Error loading students:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('refreshBtn'), '<i class="fas fa-sync-alt"></i> Làm mới');
    }
}

function renderStudentsTable() {
    const tbody = document.getElementById('studentsTableBody');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    // Filter students
    let filteredStudents = currentStudents.filter(student => {
        const matchesSearch = !searchTerm || 
            student.student_code.toLowerCase().includes(searchTerm) ||
            student.full_name.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter ||
            (statusFilter === 'active' && student.is_active) ||
            (statusFilter === 'inactive' && !student.is_active);

        return matchesSearch && matchesStatus;
    });

    // Pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

    // Render table rows
    tbody.innerHTML = '';
    
    if (paginatedStudents.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>Không có học sinh nào</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    paginatedStudents.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <input type="checkbox" class="student-checkbox" value="${student.id}">
            </td>
            <td class="font-weight-bold">${student.student_code}</td>
            <td>${student.full_name}</td>
            <td>
                <span class="password-display">${'*'.repeat(student.password.length)}</span>
                <button class="btn btn-sm btn-outline" onclick="togglePassword(${student.id}, '${student.password}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
            <td>${Utils.formatDate(student.created_at)}</td>
            <td>
                <span class="status-badge ${student.is_active ? 'active' : 'inactive'}">
                    ${student.is_active ? 'Hoạt động' : 'Không hoạt động'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm btn-primary" onclick="editStudent(${student.id})" title="Sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="resetPassword(${student.id})" title="Đặt lại mật khẩu">
                        <i class="fas fa-key"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStudent(${student.id})" title="Xóa">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Setup checkbox listeners
    document.querySelectorAll('.student-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', updateBulkActions);
    });

    // Render pagination
    renderPagination(filteredStudents.length);
}

function renderPagination(totalItems) {
    const pagination = document.getElementById('pagination');
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let paginationHTML = '';
    
    // Previous button
    paginationHTML += `
        <button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" 
                onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // Page numbers
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
            paginationHTML += `
                <button class="page-btn ${i === currentPage ? 'active' : ''}" 
                        onclick="changePage(${i})">
                    ${i}
                </button>
            `;
        } else if (i === currentPage - 3 || i === currentPage + 3) {
            paginationHTML += '<span class="page-ellipsis">...</span>';
        }
    }

    // Next button
    paginationHTML += `
        <button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" 
                onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    pagination.innerHTML = paginationHTML;
}

function changePage(page) {
    if (page < 1 || page > Math.ceil(currentStudents.length / itemsPerPage)) return;
    currentPage = page;
    renderStudentsTable();
}

function updateTotalCount() {
    document.getElementById('totalStudents').textContent = currentStudents.length;
}

function handleSearch() {
    currentPage = 1;
    renderStudentsTable();
}

function handleFilter() {
    currentPage = 1;
    renderStudentsTable();
}

function handleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    const checkboxes = document.querySelectorAll('.student-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
    
    updateBulkActions();
}

function updateBulkActions() {
    const checkedBoxes = document.querySelectorAll('.student-checkbox:checked');
    const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');
    const bulkGeneratePasswordBtn = document.getElementById('bulkGeneratePasswordBtn');
    
    selectedStudents = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    const hasSelection = selectedStudents.length > 0;
    bulkDeleteBtn.disabled = !hasSelection;
    bulkGeneratePasswordBtn.disabled = !hasSelection;
    
    if (hasSelection) {
        bulkDeleteBtn.innerHTML = `<i class="fas fa-trash"></i> Xóa (${selectedStudents.length})`;
        bulkGeneratePasswordBtn.innerHTML = `<i class="fas fa-key"></i> Tạo mật khẩu (${selectedStudents.length})`;
    } else {
        bulkDeleteBtn.innerHTML = '<i class="fas fa-trash"></i> Xóa đã chọn';
        bulkGeneratePasswordBtn.innerHTML = '<i class="fas fa-key"></i> Tạo mật khẩu mới';
    }
}

// Student Modal Functions
function openAddStudentModal() {
    document.getElementById('modalTitle').textContent = 'Thêm Học Sinh Mới';
    document.getElementById('studentForm').reset();
    document.getElementById('studentId').value = '';
    document.getElementById('studentModal').style.display = 'flex';
}

function editStudent(id) {
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;

    document.getElementById('modalTitle').textContent = 'Sửa Thông Tin Học Sinh';
    document.getElementById('studentId').value = student.id;
    document.getElementById('studentCode').value = student.student_code;
    document.getElementById('fullName').value = student.full_name;
    document.getElementById('password').value = student.password;
    
    document.getElementById('studentModal').style.display = 'flex';
}

function closeStudentModal() {
    document.getElementById('studentModal').style.display = 'none';
}

async function handleSaveStudent(event) {
    event.preventDefault();
    
    const formData = {
        student_code: document.getElementById('studentCode').value.trim(),
        full_name: document.getElementById('fullName').value.trim(),
        password: document.getElementById('password').value.trim()
    };

    if (!formData.student_code || !formData.full_name) {
        Utils.showAlert('Vui lòng nhập đầy đủ thông tin bắt buộc', 'warning');
        return;
    }

    const studentId = document.getElementById('studentId').value;
    const isEdit = !!studentId;
    
    try {
        const saveBtn = document.getElementById('saveStudentBtn');
        Utils.showLoading(saveBtn, 'Đang lưu...');

        const url = isEdit ? `/api/supervisor/students/${studentId}` : '/api/supervisor/students';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await Utils.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            Utils.showAlert(`${isEdit ? 'Cập nhật' : 'Tạo'} học sinh thành công!`, 'success');
            closeStudentModal();
            loadStudents();
        } else {
            Utils.showAlert(response.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error saving student:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('saveStudentBtn'), '<i class="fas fa-save"></i> Lưu');
    }
}

function generatePassword() {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    document.getElementById('password').value = password;
}

async function deleteStudent(id) {
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa học sinh "${student.full_name}" (${student.student_code})?`)) {
        return;
    }

    try {
        const response = await Utils.apiRequest(`/api/supervisor/students/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            Utils.showAlert('Xóa học sinh thành công!', 'success');
            loadStudents();
        } else {
            Utils.showAlert(response.message || 'Lỗi xóa học sinh', 'error');
        }
    } catch (error) {
        console.error('Error deleting student:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

async function resetPassword(id) {
    const student = currentStudents.find(s => s.id === id);
    if (!student) return;

    if (!confirm(`Tạo mật khẩu mới cho học sinh "${student.full_name}"?`)) {
        return;
    }

    const newPassword = generateRandomPassword();
    
    try {
        const response = await Utils.apiRequest(`/api/supervisor/students/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
                student_code: student.student_code,
                full_name: student.full_name,
                password: newPassword
            })
        });

        if (response.success) {
            Utils.showAlert(`Mật khẩu mới: ${newPassword}`, 'success');
            loadStudents();
        } else {
            Utils.showAlert(response.message || 'Lỗi đặt lại mật khẩu', 'error');
        }
    } catch (error) {
        console.error('Error resetting password:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

function generateRandomPassword() {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

function togglePassword(id, password) {
    const button = event.target.closest('button');
    const display = button.previousElementSibling;
    
    if (display.textContent.includes('*')) {
        display.textContent = password;
        button.innerHTML = '<i class="fas fa-eye-slash"></i>';
    } else {
        display.textContent = '*'.repeat(password.length);
        button.innerHTML = '<i class="fas fa-eye"></i>';
    }
}

// Bulk Actions
async function handleBulkDelete() {
    if (selectedStudents.length === 0) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedStudents.length} học sinh đã chọn?`)) {
        return;
    }

    try {
        Utils.showLoading(document.getElementById('bulkDeleteBtn'), 'Đang xóa...');

        const promises = selectedStudents.map(id => 
            Utils.apiRequest(`/api/supervisor/students/${id}`, { method: 'DELETE' })
        );

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r.success).length;

        Utils.showAlert(`Đã xóa ${successCount}/${selectedStudents.length} học sinh`, 'success');
        loadStudents();
        
        // Reset selections
        document.getElementById('selectAllCheckbox').checked = false;
        selectedStudents = [];
        updateBulkActions();

    } catch (error) {
        console.error('Error bulk deleting:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('bulkDeleteBtn'), '<i class="fas fa-trash"></i> Xóa đã chọn');
    }
}

async function handleBulkGeneratePassword() {
    if (selectedStudents.length === 0) return;

    if (!confirm(`Tạo mật khẩu mới cho ${selectedStudents.length} học sinh đã chọn?`)) {
        return;
    }

    try {
        Utils.showLoading(document.getElementById('bulkGeneratePasswordBtn'), 'Đang tạo...');

        const promises = selectedStudents.map(async id => {
            const student = currentStudents.find(s => s.id === id);
            if (!student) return null;

            const newPassword = generateRandomPassword();
            return Utils.apiRequest(`/api/supervisor/students/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    student_code: student.student_code,
                    full_name: student.full_name,
                    password: newPassword
                })
            });
        });

        const results = await Promise.all(promises);
        const successCount = results.filter(r => r && r.success).length;

        Utils.showAlert(`Đã tạo mật khẩu mới cho ${successCount}/${selectedStudents.length} học sinh`, 'success');
        loadStudents();
        
        // Reset selections
        document.getElementById('selectAllCheckbox').checked = false;
        selectedStudents = [];
        updateBulkActions();

    } catch (error) {
        console.error('Error bulk generating passwords:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('bulkGeneratePasswordBtn'), '<i class="fas fa-key"></i> Tạo mật khẩu mới');
    }
}

// Export Functions
async function exportStudents() {
    try {
        Utils.showLoading(document.getElementById('exportStudentsBtn'), 'Đang xuất...');
        
        const filename = `students_${new Date().toISOString().split('T')[0]}.xlsx`;
        const success = await Utils.downloadFile('/api/supervisor/students/export', filename);
        
        if (success) {
            Utils.showAlert('Xuất danh sách thành công!', 'success');
        }

    } catch (error) {
        console.error('Error exporting students:', error);
        Utils.showAlert('Lỗi xuất danh sách', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('exportStudentsBtn'), '<i class="fas fa-download"></i> Export Excel');
    }
}

// Import Functions
function openImportModal() {
    document.getElementById('importModal').style.display = 'flex';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('confirmImportBtn').disabled = true;
}

function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    document.getElementById('fileInput').value = '';
    document.getElementById('importPreview').style.display = 'none';
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

async function handleFile(file) {
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        Utils.showAlert('Vui lòng chọn file Excel (.xlsx hoặc .xls)', 'warning');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        Utils.showAlert('File quá lớn. Vui lòng chọn file nhỏ hơn 10MB', 'warning');
        return;
    }

    try {
        // Show preview (in real app, you'd parse the Excel file here)
        document.getElementById('importPreview').style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        
        // For demo, show a sample preview
        showImportPreview([
            { student_code: 'HS001', full_name: 'Nguyễn Văn A', password: 'auto-generated' },
            { student_code: 'HS002', full_name: 'Trần Thị B', password: 'auto-generated' }
        ]);

    } catch (error) {
        console.error('Error reading file:', error);
        Utils.showAlert('Lỗi đọc file Excel', 'error');
    }
}

function showImportPreview(data) {
    const table = document.getElementById('previewTable');
    
    let html = `
        <thead>
            <tr>
                <th>Mã Học Sinh</th>
                <th>Họ và Tên</th>
                <th>Mật Khẩu</th>
            </tr>
        </thead>
        <tbody>
    `;

    data.forEach(row => {
        html += `
            <tr>
                <td>${row.student_code}</td>
                <td>${row.full_name}</td>
                <td>${row.password}</td>
            </tr>
        `;
    });

    html += '</tbody>';
    table.innerHTML = html;
}

async function handleImport() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        Utils.showAlert('Vui lòng chọn file để import', 'warning');
        return;
    }

    try {
        Utils.showLoading(document.getElementById('confirmImportBtn'), 'Đang import...');

        const formData = new FormData();
        formData.append('file', file);

        const result = await Utils.uploadFile('/api/supervisor/students/import', formData);

        if (result && result.success) {
            Utils.showAlert(`Import thành công ${result.data.imported} học sinh!`, 'success');
            closeImportModal();
            loadStudents();
        } else if (result) {
            Utils.showAlert(result.message || 'Lỗi import dữ liệu', 'error');
        }

    } catch (error) {
        console.error('Error importing:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('confirmImportBtn'), '<i class="fas fa-upload"></i> Import Dữ Liệu');
    }
}

async function handleLogout() {
    try {
        const response = await Utils.apiRequest('/api/auth/logout', {
            method: 'POST'
        });

        if (response.success) {
            Auth.clearAuth();
            Utils.showAlert('Đăng xuất thành công!', 'success');
            
            setTimeout(() => {
                window.location.href = '/supervisor/login.html';
            }, 1500);
        } else {
            Utils.showAlert(response.message || 'Đăng xuất thất bại', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        Auth.clearAuth();
        window.location.href = '/supervisor/login.html';
    }
}
