// Exam Questions Management

let currentExamId = null;
let currentExam = null;
let currentQuestions = [];
let usageStats = [];

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

    // Get exam ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    currentExamId = urlParams.get('examId');

    if (!currentExamId) {
        Utils.showAlert('Không tìm thấy thông tin kỳ thi', 'error');
        setTimeout(() => {
            window.location.href = '/supervisor/exams.html';
        }, 2000);
        return;
    }

    // Initialize page
    setupEventListeners();
    loadExamInfo();
    loadQuestions();
});

function setupEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);

    // Question management
    document.getElementById('createQuestionBtn').addEventListener('click', openCreateQuestionModal);
    document.getElementById('batchCreateBtn').addEventListener('click', openBatchModal);

    // Question modal
    document.getElementById('closeModalBtn').addEventListener('click', closeQuestionModal);
    document.getElementById('cancelBtn').addEventListener('click', closeQuestionModal);
    document.getElementById('questionForm').addEventListener('submit', handleSaveQuestion);
    document.getElementById('previewPdfBtn').addEventListener('click', previewPdf);

    // Batch modal
    document.getElementById('closeBatchModalBtn').addEventListener('click', closeBatchModal);
    document.getElementById('cancelBatchBtn').addEventListener('click', closeBatchModal);
    document.getElementById('validateBatchBtn').addEventListener('click', validateBatchData);
    document.getElementById('batchForm').addEventListener('submit', handleBatchCreate);
}

async function loadExamInfo() {
    try {
        const response = await Utils.apiRequest(`/api/supervisor/exams/${currentExamId}`);

        if (response.success && response.data.exam) {
            currentExam = response.data.exam;
            document.getElementById('examName').textContent = currentExam.exam_name;
            document.getElementById('examDescription').textContent =
                `Chuẩn bị: ${currentExam.preparation_time}s • Thời gian thi: ${currentExam.exam_duration}s`;
        } else {
            throw new Error('Không thể tải thông tin kỳ thi');
        }
    } catch (error) {
        console.error('Error loading exam info:', error);
        Utils.showAlert('Lỗi tải thông tin kỳ thi', 'error');
    }
}

async function loadQuestions() {
    try {
        const [questionsResponse, usageResponse] = await Promise.all([
            Utils.apiRequest(`/api/supervisor/exams/${currentExamId}/questions`),
            Utils.apiRequest(`/api/supervisor/exams/${currentExamId}/questions/usage`)
        ]);

        if (questionsResponse.success) {
            currentQuestions = questionsResponse.data.questions || [];
        }

        if (usageResponse.success) {
            usageStats = usageResponse.data.usage || [];
        }

        updateStatistics();
        renderQuestionsGrid();
    } catch (error) {
        console.error('Error loading questions:', error);
        Utils.showAlert('Lỗi tải danh sách đề thi', 'error');
    }
}

function updateStatistics() {
    const total = currentQuestions.length;
    const active = currentQuestions.filter(q => q.is_active).length;
    const totalUsage = usageStats.reduce((sum, stat) => sum + stat.usage_count, 0);

    document.getElementById('totalQuestions').textContent = total;
    document.getElementById('activeQuestions').textContent = active;
    document.getElementById('totalUsage').textContent = totalUsage;
}

function renderQuestionsGrid() {
    const grid = document.getElementById('questionsGrid');

    if (currentQuestions.length === 0) {
        grid.innerHTML = `
            <div class="empty-state-large">
                <i class="fas fa-file-alt"></i>
                <h3>Chưa có đề thi nào</h3>
                <p>Thêm đề thi đầu tiên để bắt đầu</p>
                <button class="btn btn-primary" onclick="openCreateQuestionModal()">
                    <i class="fas fa-plus-circle"></i>
                    Thêm Đề Thi
                </button>
            </div>
        `;
        return;
    }

    const cardsHTML = currentQuestions.map(question => createQuestionCard(question)).join('');
    grid.innerHTML = cardsHTML;
}

function createQuestionCard(question) {
    const usage = usageStats.find(s => s.question.id === question.id);
    const usageCount = usage ? usage.usage_count : 0;
    const statusClass = question.is_active ? 'active' : 'inactive';
    const statusText = question.is_active ? 'Kích hoạt' : 'Vô hiệu hóa';

    return `
        <div class="question-card">
            <div class="question-header">
                <div class="question-code">${question.question_code}</div>
                <span class="question-status-badge ${statusClass}">${statusText}</span>
            </div>

            <iframe src="${question.pdf_drive_url}" class="question-pdf-preview" frameborder="0"></iframe>

            <div class="question-usage">
                <i class="fas fa-users"></i>
                <span>Đã sử dụng: <strong>${usageCount}</strong> lần</span>
            </div>

            <div class="question-actions">
                <button class="btn btn-sm btn-outline" onclick="editQuestion(${question.id})" title="Sửa">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm ${question.is_active ? 'btn-warning' : 'btn-success'}"
                        onclick="toggleQuestion(${question.id}, ${!question.is_active})"
                        title="${question.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}">
                    <i class="fas fa-${question.is_active ? 'eye-slash' : 'eye'}"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${question.id})" title="Xóa">
                    <i class="fas fa-trash"></i>
                </button>
                <a href="${question.pdf_drive_url}" target="_blank" class="btn btn-sm btn-info" title="Xem PDF">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>
    `;
}

// Question Modal Functions
function openCreateQuestionModal() {
    document.getElementById('modalTitle').textContent = 'Thêm Đề Thi';
    document.getElementById('questionForm').reset();
    document.getElementById('questionId').value = '';
    document.getElementById('isActive').value = 'true';
    document.getElementById('pdfPreviewContainer').style.display = 'none';
    document.getElementById('questionModal').style.display = 'flex';
}

function editQuestion(id) {
    const question = currentQuestions.find(q => q.id === id);
    if (!question) return;

    document.getElementById('modalTitle').textContent = 'Sửa Đề Thi';
    document.getElementById('questionId').value = question.id;
    document.getElementById('questionCode').value = question.question_code;
    document.getElementById('pdfDriveUrl').value = question.pdf_drive_url;
    document.getElementById('isActive').value = question.is_active.toString();

    // Show preview
    document.getElementById('pdfPreview').src = question.pdf_drive_url;
    document.getElementById('pdfPreviewContainer').style.display = 'block';

    document.getElementById('questionModal').style.display = 'flex';
}

function closeQuestionModal() {
    document.getElementById('questionModal').style.display = 'none';
}

function previewPdf() {
    const url = document.getElementById('pdfDriveUrl').value.trim();

    if (!url) {
        Utils.showAlert('Vui lòng nhập link PDF trước', 'warning');
        return;
    }

    if (!url.includes('drive.google.com') || !url.includes('/preview')) {
        Utils.showAlert('Link phải có dạng: https://drive.google.com/file/d/.../preview', 'warning');
        return;
    }

    document.getElementById('pdfPreview').src = url;
    document.getElementById('pdfPreviewContainer').style.display = 'block';
}

async function handleSaveQuestion(event) {
    event.preventDefault();

    const questionCode = document.getElementById('questionCode').value.trim();
    const pdfDriveUrl = document.getElementById('pdfDriveUrl').value.trim();
    const isActive = document.getElementById('isActive').value === 'true';

    if (!questionCode || !pdfDriveUrl) {
        Utils.showAlert('Vui lòng nhập đầy đủ thông tin', 'warning');
        return;
    }

    // Validate PDF URL
    if (!pdfDriveUrl.includes('drive.google.com') || !pdfDriveUrl.includes('/preview')) {
        Utils.showAlert('Link PDF không đúng định dạng. Phải có dạng: https://drive.google.com/file/d/.../preview', 'warning');
        return;
    }

    const questionId = document.getElementById('questionId').value;
    const isEdit = !!questionId;

    try {
        const saveBtn = document.getElementById('saveQuestionBtn');
        Utils.showLoading(saveBtn, 'Đang lưu...');

        let response;

        if (isEdit) {
            // Update existing question
            response = await Utils.apiRequest(`/api/supervisor/questions/${questionId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    question_code: questionCode,
                    pdf_drive_url: pdfDriveUrl,
                    is_active: isActive
                })
            });
        } else {
            // Create new question
            response = await Utils.apiRequest(`/api/supervisor/exams/${currentExamId}/questions`, {
                method: 'POST',
                body: JSON.stringify({
                    question_code: questionCode,
                    pdf_drive_url: pdfDriveUrl,
                    is_active: isActive
                })
            });
        }

        if (response.success) {
            Utils.showAlert(`${isEdit ? 'Cập nhật' : 'Tạo'} đề thi thành công!`, 'success');
            closeQuestionModal();
            loadQuestions();
        } else {
            Utils.showAlert(response.message || response.error || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error saving question:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('saveQuestionBtn'), '<i class="fas fa-save"></i> Lưu Đề Thi');
    }
}

async function toggleQuestion(id, newStatus) {
    try {
        const response = await Utils.apiRequest(`/api/supervisor/questions/${id}/toggle`, {
            method: 'PATCH',
            body: JSON.stringify({
                is_active: newStatus
            })
        });

        if (response.success) {
            Utils.showAlert(`${newStatus ? 'Kích hoạt' : 'Vô hiệu hóa'} đề thi thành công!`, 'success');
            loadQuestions();
        } else {
            Utils.showAlert(response.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error toggling question:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

async function deleteQuestion(id) {
    const question = currentQuestions.find(q => q.id === id);
    if (!question) return;

    // Check if question has been used
    const usage = usageStats.find(s => s.question.id === id);
    if (usage && usage.usage_count > 0) {
        if (!confirm(`Đề thi "${question.question_code}" đã được sử dụng ${usage.usage_count} lần.\n\nBạn có chắc chắn muốn xóa?`)) {
            return;
        }
    } else {
        if (!confirm(`Bạn có chắc chắn muốn xóa đề thi "${question.question_code}"?`)) {
            return;
        }
    }

    try {
        const response = await Utils.apiRequest(`/api/supervisor/questions/${id}`, {
            method: 'DELETE'
        });

        if (response.success) {
            Utils.showAlert('Xóa đề thi thành công!', 'success');
            loadQuestions();
        } else {
            Utils.showAlert(response.message || response.error || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error deleting question:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    }
}

// Batch Create Functions
function openBatchModal() {
    document.getElementById('batchForm').reset();
    document.getElementById('batchValidationResult').innerHTML = '';
    document.getElementById('batchModal').style.display = 'flex';
}

function closeBatchModal() {
    document.getElementById('batchModal').style.display = 'none';
}

function validateBatchData() {
    const data = document.getElementById('batchData').value.trim();
    const resultDiv = document.getElementById('batchValidationResult');

    if (!data) {
        resultDiv.innerHTML = '<div class="alert alert-warning">Vui lòng nhập dữ liệu JSON</div>';
        return;
    }

    try {
        const questions = JSON.parse(data);

        if (!Array.isArray(questions)) {
            throw new Error('Dữ liệu phải là một mảng');
        }

        let valid = true;
        let errors = [];

        questions.forEach((q, index) => {
            if (!q.question_code || !q.pdf_drive_url) {
                errors.push(`Dòng ${index + 1}: Thiếu question_code hoặc pdf_drive_url`);
                valid = false;
            }

            if (q.pdf_drive_url && (!q.pdf_drive_url.includes('drive.google.com') || !q.pdf_drive_url.includes('/preview'))) {
                errors.push(`Dòng ${index + 1}: Link PDF không đúng định dạng`);
                valid = false;
            }
        });

        if (valid) {
            resultDiv.innerHTML = `
                <div class="alert alert-success">
                    <i class="fas fa-check-circle"></i>
                    Dữ liệu hợp lệ! Tìm thấy ${questions.length} đề thi.
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div class="alert alert-error">
                    <strong>Lỗi dữ liệu:</strong>
                    <ul style="margin: 10px 0 0 20px;">
                        ${errors.map(e => `<li>${e}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
    } catch (error) {
        resultDiv.innerHTML = `
            <div class="alert alert-error">
                <strong>Lỗi JSON:</strong> ${error.message}
            </div>
        `;
    }
}

async function handleBatchCreate(event) {
    event.preventDefault();

    const data = document.getElementById('batchData').value.trim();

    if (!data) {
        Utils.showAlert('Vui lòng nhập dữ liệu JSON', 'warning');
        return;
    }

    let questions;
    try {
        questions = JSON.parse(data);
    } catch (error) {
        Utils.showAlert('Dữ liệu JSON không hợp lệ', 'error');
        return;
    }

    try {
        const saveBtn = document.getElementById('saveBatchBtn');
        Utils.showLoading(saveBtn, 'Đang tạo...');

        const response = await Utils.apiRequest(`/api/supervisor/exams/${currentExamId}/questions/batch`, {
            method: 'POST',
            body: JSON.stringify({ questions })
        });

        if (response.success) {
            const { success, failed, errors } = response.data;

            if (failed === 0) {
                Utils.showAlert(`Tạo thành công ${success} đề thi!`, 'success');
            } else {
                Utils.showAlert(`Tạo thành công ${success} đề thi. Thất bại: ${failed}. Lỗi: ${errors.join(', ')}`, 'warning');
            }

            closeBatchModal();
            loadQuestions();
        } else {
            Utils.showAlert(response.message || 'Có lỗi xảy ra', 'error');
        }
    } catch (error) {
        console.error('Error batch creating:', error);
        Utils.showAlert('Lỗi kết nối server', 'error');
    } finally {
        Utils.hideLoading(document.getElementById('saveBatchBtn'), '<i class="fas fa-upload"></i> Tạo Hàng Loạt');
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
