// Exams management functionality

let currentExams = [];
let availableStudents = [];
let selectedStudents = [];
let currentExamForAssignment = null;

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
    loadExams();
    setupEventListeners();
});

function initializePage() {
    const userInfo = Auth.getUserInfo();
    const welcomeMessage = document.getElementById('welcomeMessage');
    
    if (userInfo && userInfo.full_name) {
        welcomeMessage.textContent = `Chào mừng, ${userInfo.full_name}!`;
    }
}

function setupEventListeners() {
    // Navigation
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Exam management
    document.getElementById('createExamBtn').addEventListener('click', openCreateExamModal);
    document.getElementById('exportExamsBtn').addEventListener('click', exportExams);
    document.getElementById('refreshBtn').addEventListener('click', loadExams);

    // Search and filter
    document.getElementById('searchInput').addEventListener('input', handleSearch);
    document.getElementById('statusFilter').addEventListener('change', handleFilter);

    // Exam modal
    document.getElementById('closeModalBtn').addEventListener('click', closeExamModal);
    document.getElementById('cancelBtn').addEventListener('click', closeExamModal);
    document.getElementById('examForm').addEventListener('submit', handleSaveExam);

    // Assign students modal
    document.getElementById('closeAssignModalBtn').addEventListener('click', closeAssignModal);
    document.getElementById('cancelAssignBtn').addEventListener('click', closeAssignModal);
    document.getElementById('selectAllStudentsBtn').addEventListener('click', selectAllStudents);
    document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
    document.getElementById('studentSearchInput').addEventListener('input', filterStudents);
    document.getElementById('confirmAssignBtn').addEventListener('click', handleAssignStudents);
}

async function loadExams() {
    try {
        Utils.showLoading(document.getElementById('refreshBtn'), 'Đang tải...');
        
        const response = await Utils.apiRequest('/api/supervisor/exams');
        
        if (response.success) {
            currentExams = response.data.items || [];
            renderExamsGrid();
        } else {
            Utils.showAlert(response.message || 'Lỗi tải danh sách kỳ thi', 'error');
        }
    } catch (error) {
        console.error('Error loading exams:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('refreshBtn'), '<i class="fas fa-sync-alt"></i> Làm mới');
    }
}

function renderExamsGrid() {
    const grid = document.getElementById('examsGrid');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    // Filter exams
    let filteredExams = currentExams.filter(exam => {
        const matchesSearch = !searchTerm || 
            exam.exam_name.toLowerCase().includes(searchTerm);
        
        const matchesStatus = !statusFilter || exam.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    // Render exam cards
    if (filteredExams.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-large">
                <i class="fas fa-file-alt"></i>
                <h3>Chưa có kỳ thi nào</h3>
                <p>Tạo kỳ thi đầu tiên để bắt đầu</p>
                <button class="btn btn-primary" onclick="openCreateExamModal()">
                    <i class="fas fa-plus-circle"></i>
                    Tạo Kỳ Thi Mới
                </button>
            </div>
        `;
        return;
    }

    const cardsHTML = filteredExams.map(exam => createExamCard(exam)).join('');
    grid.innerHTML = cardsHTML;
}

function createExamCard(exam) {
    const statusClass = getStatusClass(exam.status);
    const statusText = getStatusText(exam.status);
    
    return `
        <div class="exam-card">
            <div class="exam-card-header">
                <div class="exam-title">
                    <h3>${exam.exam_name}</h3>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="exam-actions">
                    <button class="btn btn-sm btn-outline" onclick="editExam(${exam.id})" title="Sửa">
                        <i class="fas fa-edit"></i>
                    </button>
                    <div class="dropdown">
                        <button class="btn btn-sm btn-outline dropdown-toggle" title="Thêm">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                        <div class="dropdown-menu">
                            <a href="#" onclick="assignStudents(${exam.id})">
                                <i class="fas fa-user-plus"></i>
                                Phân công học sinh
                            </a>

                            <a href="#" onclick="exportExamResults(${exam.id})">
                                <i class="fas fa-download"></i>
                                Export kết quả
                            </a>
                            <div class="dropdown-divider"></div>
                            <a href="#" onclick="deleteExam(${exam.id})" class="text-danger">
                                <i class="fas fa-trash"></i>
                                Xóa kỳ thi
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div class="exam-card-body">
                <div class="exam-details">
                    <div class="detail-item">
                        <i class="fas fa-file-alt"></i>
                        <span>Số đề thi: <strong>${exam.questions_count || 0}</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-clock"></i>
                        <span>Chuẩn bị: <strong>${exam.preparation_time}s</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-stopwatch"></i>
                        <span>Thời gian thi: <strong>${exam.exam_duration}s</strong></span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-calendar"></i>
                        <span>Tạo: <strong>${Utils.formatDate(exam.created_at)}</strong></span>
                    </div>
                </div>

                <div class="exam-stats">
                    <div class="stat-item">
                        <div class="stat-number">${exam.total_participants || 0}</div>
                        <div class="stat-label">Tổng HS</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${exam.completed_participants || 0}</div>
                        <div class="stat-label">Hoàn thành</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${exam.in_progress_participants || 0}</div>
                        <div class="stat-label">Đang thi</div>
                    </div>
                </div>

                ${exam.description ? `
                    <div class="exam-description">
                        <p>${exam.description}</p>
                    </div>
                ` : ''}
            </div>

            <div class="exam-card-footer">
                <button class="btn btn-info btn-sm" onclick="manageQuestions(${exam.id})">
                    <i class="fas fa-file-alt"></i>
                    Quản lý Đề Thi
                </button>
                <button class="btn btn-primary btn-sm" onclick="assignStudents(${exam.id})">
                    <i class="fas fa-user-plus"></i>
                    Phân công HS
                </button>
                <button class="btn btn-success btn-sm" onclick="exportExamResults(${exam.id})">
                    <i class="fas fa-download"></i>
                    Export
                </button>
            </div>
        </div>
    `;
}

function getStatusClass(status) {
    switch (status) {
        case 'active': return 'active';
        case 'completed': return 'completed';
        case 'draft': return 'draft';
        default: return 'draft';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'active': return 'Đang diễn ra';
        case 'completed': return 'Hoàn thành';
        case 'draft': return 'Nháp';
        default: return 'Nháp';
    }
}

function handleSearch() {
    renderExamsGrid();
}

function handleFilter() {
    renderExamsGrid();
}

// Exam Modal Functions
function openCreateExamModal() {
    document.getElementById('modalTitle').textContent = 'Tạo Kỳ Thi Mới';
    document.getElementById('examForm').reset();
    document.getElementById('examId').value = '';
    document.getElementById('preparationTime').value = 60;
    document.getElementById('examDuration').value = 300;
    document.getElementById('examModal').style.display = 'flex';
}

function editExam(id) {
    const exam = currentExams.find(e => e.id === id);
    if (!exam) return;

    document.getElementById('modalTitle').textContent = 'Sửa Kỳ Thi';
    document.getElementById('examId').value = exam.id;
    document.getElementById('examName').value = exam.exam_name;
    document.getElementById('preparationTime').value = exam.preparation_time;
    document.getElementById('examDuration').value = exam.exam_duration;
    document.getElementById('examStatus').value = exam.status || 'draft';
    document.getElementById('description').value = exam.description || '';

    document.getElementById('examModal').style.display = 'flex';
}

function closeExamModal() {
    document.getElementById('examModal').style.display = 'none';
}

async function handleSaveExam(event) {
    event.preventDefault();

    const formData = {
        exam_name: document.getElementById('examName').value.trim(),
        preparation_time: parseInt(document.getElementById('preparationTime').value),
        exam_duration: parseInt(document.getElementById('examDuration').value),
        status: document.getElementById('examStatus').value,
        description: document.getElementById('description').value.trim()
    };

    if (!formData.exam_name || !formData.preparation_time || !formData.exam_duration) {
        Utils.showAlert('Vui lòng nhập đầy đủ thông tin bắt buộc', 'warning');
        return;
    }

    const examId = document.getElementById('examId').value;
    const isEdit = !!examId;
    
    try {
        const saveBtn = document.getElementById('saveExamBtn');
        Utils.showLoading(saveBtn, 'Đang lưu...');

        const url = isEdit ? `/api/supervisor/exams/${examId}` : '/api/supervisor/exams';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await Utils.apiRequest(url, {
            method: method,
            body: JSON.stringify(formData)
        });

        if (response.success) {
            Utils.showAlert(`${isEdit ? 'Cập nhật' : 'Tạo'} kỳ thi thành công!`, 'success');
            closeExamModal();
            loadExams();
        } else {
            Utils.showAlert(response.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error saving exam:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('saveExamBtn'), '<i class="fas fa-save"></i> Lưu Kỳ Thi');
    }
}

async function deleteExam(id) {
    const exam = currentExams.find(e => e.id === id);
    if (!exam) return;

    if (!confirm(`Bạn có chắc chắn muốn xóa kỳ thi "${exam.exam_name}"?\n\nLưu ý: Tất cả dữ liệu liên quan sẽ bị xóa!`)) {
        return;
    }

    try {
        const response = await Utils.apiRequest(`/api/supervisor/exams/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            Utils.showAlert('Xóa kỳ thi thành công!', 'success');
            loadExams();
        } else {
            Utils.showAlert(response.message || 'Lỗi xóa kỳ thi', 'error');
        }
    } catch (error) {
        console.error('Error deleting exam:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

// Student Assignment Functions
async function assignStudents(examId) {
    currentExamForAssignment = currentExams.find(e => e.id === examId);
    if (!currentExamForAssignment) return;

    // Update modal info
    document.getElementById('examInfoTitle').textContent = `Kỳ Thi: ${currentExamForAssignment.exam_name}`;
    document.getElementById('examInfoDescription').textContent = 
        `${currentExamForAssignment.total_questions} đề thi • ${currentExamForAssignment.exam_duration}s • ${getStatusText(currentExamForAssignment.status)}`;

    try {
        // Load available students
        const response = await Utils.apiRequest('/api/supervisor/students');
        if (response.success) {
            availableStudents = response.data.items || [];
            renderStudentsList();
            document.getElementById('assignStudentsModal').style.display = 'flex';
        } else {
            Utils.showAlert('Lỗi tải danh sách học sinh', 'error');
        }
    } catch (error) {
        console.error('Error loading students:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

function renderStudentsList() {
    const list = document.getElementById('studentsList');
    const searchTerm = document.getElementById('studentSearchInput').value.toLowerCase();

    const filteredStudents = availableStudents.filter(student =>
        student.student_code.toLowerCase().includes(searchTerm) ||
        student.full_name.toLowerCase().includes(searchTerm)
    );

    if (filteredStudents.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-graduate"></i>
                <p>Không tìm thấy học sinh nào</p>
            </div>
        `;
        return;
    }

    list.innerHTML = filteredStudents.map(student => `
        <div class="student-item">
            <input type="checkbox" 
                   id="student_${student.id}" 
                   value="${student.id}"
                   class="student-assignment-checkbox"
                   onchange="updateSelectedCount()">
            <label for="student_${student.id}" class="student-label">
                <div class="student-info">
                    <div class="student-name">${student.full_name}</div>
                    <div class="student-code">${student.student_code}</div>
                </div>
            </label>
        </div>
    `).join('');
}

function selectAllStudents() {
    document.querySelectorAll('.student-assignment-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    updateSelectedCount();
}

function clearSelection() {
    document.querySelectorAll('.student-assignment-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    updateSelectedCount();
}

function filterStudents() {
    renderStudentsList();
}

function updateSelectedCount() {
    const checkedBoxes = document.querySelectorAll('.student-assignment-checkbox:checked');
    selectedStudents = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    document.getElementById('selectedCount').textContent = selectedStudents.length;
    document.getElementById('confirmAssignBtn').disabled = selectedStudents.length === 0;
}

function closeAssignModal() {
    document.getElementById('assignStudentsModal').style.display = 'none';
    selectedStudents = [];
    currentExamForAssignment = null;
}

async function handleAssignStudents() {
    if (!currentExamForAssignment || selectedStudents.length === 0) return;

    try {
        const confirmBtn = document.getElementById('confirmAssignBtn');
        Utils.showLoading(confirmBtn, 'Đang phân công...');

        const response = await Utils.apiRequest(`/api/supervisor/exams/${currentExamForAssignment.id}/students`, {
            method: 'POST',
            body: JSON.stringify({
                student_ids: selectedStudents
            })
        });

        if (response.success) {
            const message = response.message || `Đã phân công ${selectedStudents.length} học sinh thành công!`;
            Utils.showAlert(message, 'success');
            closeAssignModal();
            loadExams(); // Refresh to update participant counts
        } else {
            Utils.showAlert(response.message || 'Lỗi phân công học sinh', 'error');
        }
    } catch (error) {
        console.error('Error assigning students:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('confirmAssignBtn'), '<i class="fas fa-user-plus"></i> Phân Công');
    }
}

// Export Functions
async function exportExams() {
    try {
        Utils.showLoading(document.getElementById('exportExamsBtn'), 'Đang xuất...');
        
        const filename = `exams_${new Date().toISOString().split('T')[0]}.xlsx`;
        const success = await Utils.downloadFile('/api/supervisor/exams/export', filename);
        
        if (success) {
            Utils.showAlert('Xuất danh sách thành công!', 'success');
        }

    } catch (error) {
        console.error('Error exporting exams:', error);
        Utils.showAlert('Lỗi xuất danh sách', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('exportExamsBtn'), '<i class="fas fa-download"></i> Export Danh Sách');
    }
}

async function exportExamResults(examId) {
    try {
        const filename = `exam_${examId}_results_${new Date().toISOString().split('T')[0]}.xlsx`;
        const success = await Utils.downloadFile(`/api/supervisor/exams/${examId}/export`, filename);
        
        if (success) {
            Utils.showAlert('Xuất kết quả thành công!', 'success');
        }

    } catch (error) {
        console.error('Error exporting exam results:', error);
        Utils.showAlert('Lỗi xuất kết quả', 'error');
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

// Navigate to question management page
function manageQuestions(examId) {
    window.location.href = `/supervisor/exam-questions.html?examId=${examId}`;
}

// Dropdown handling
document.addEventListener('click', function(event) {
    // Close all dropdowns when clicking outside
    if (!event.target.closest('.dropdown')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.style.display = 'none';
        });
    }
});

// Add dropdown toggle functionality
document.addEventListener('click', function(event) {
    if (event.target.closest('.dropdown-toggle')) {
        event.preventDefault();
        const dropdown = event.target.closest('.dropdown');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        // Close other dropdowns
        document.querySelectorAll('.dropdown-menu').forEach(otherMenu => {
            if (otherMenu !== menu) {
                otherMenu.style.display = 'none';
            }
        });
        
        // Toggle current dropdown
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
});
