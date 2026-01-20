// Main Application Controller
class DataExaminerApp {
    constructor() {
        this.currentFile = null;
        this.currentChart = null;
        this.analysisHistory = [];
        this.isDarkMode = false;
        this.deferredPrompt = null;
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeServiceWorker();
        this.loadFromLocalStorage();
        this.setupTheme();
    }

    initializeElements() {
        // Core elements
        this.elements = {
            // Sidebar
            sidebar: document.getElementById('sidebar'),
            menuToggle: document.getElementById('menuToggle'),
            newChat: document.getElementById('newChat'),
            fileInput: document.getElementById('fileInput'),
            uploadBtn: document.getElementById('uploadBtn'),
            dataInput: document.getElementById('dataInput'),
            analyzePaste: document.getElementById('analyzePaste'),
            analysisHistory: document.getElementById('analysisHistory'),
            statusIndicator: document.getElementById('statusIndicator'),
            
            // Main content
            welcomeScreen: document.getElementById('welcomeScreen'),
            messagesContainer: document.getElementById('messagesContainer'),
            chatContainer: document.getElementById('chatContainer'),
            chartSection: document.getElementById('chartSection'),
            chartCanvas: document.getElementById('dataChart'),
            chartType: document.getElementById('chartType'),
            exportChart: document.getElementById('exportChart'),
            
            // Input
            messageInput: document.getElementById('messageInput'),
            attachBtn: document.getElementById('attachBtn'),
            sendBtn: document.getElementById('sendBtn'),
            fileIndicator: document.getElementById('fileIndicator'),
            fileName: document.getElementById('fileName'),
            clearFile: document.getElementById('clearFile'),
            
            // Quick actions
            quickUpload: document.getElementById('quickUpload'),
            quickPaste: document.getElementById('quickPaste'),
            quickSample: document.getElementById('quickSample'),
            
            // UI
            loadingOverlay: document.getElementById('loadingOverlay'),
            installBtn: document.getElementById('installBtn'),
            themeToggle: document.getElementById('themeToggle'),
            toastContainer: document.getElementById('toastContainer')
        };

        // Initialize API and Chart
        this.api = new DataExaminerAPI();
        this.chartManager = new ChartManager(this.elements.chartCanvas);
    }

    initializeEventListeners() {
        // Sidebar
        this.elements.menuToggle.addEventListener('click', () => this.toggleSidebar());
        this.elements.newChat.addEventListener('click', () => this.resetAnalysis());
        this.elements.uploadBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.analyzePaste.addEventListener('click', () => this.analyzePastedData());
        this.elements.clearFile.addEventListener('click', () => this.clearCurrentFile());

        // Quick actions
        this.elements.quickUpload.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.quickPaste.addEventListener('click', () => {
            this.elements.dataInput.focus();
            this.showToast('info', 'Paste your data in the sidebar textarea');
        });
        this.elements.quickSample.addEventListener('click', () => this.loadSampleData());

        // Input
        this.elements.attachBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.sendBtn.addEventListener('click', () => this.sendMessage());
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = Math.min(
                this.elements.messageInput.scrollHeight,
                150
            ) + 'px';
        });

        // Chart controls
        this.elements.chartType.addEventListener('change', () => this.updateChartType());
        this.elements.exportChart.addEventListener('click', () => this.exportChart());

        // PWA installation
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBtn.style.display = 'flex';
        });

        this.elements.installBtn.addEventListener('click', () => this.installPWA());
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.elements.installBtn.style.display = 'none';
            this.showToast('success', 'App installed successfully!');
        });

        // Theme toggle
        this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

        // Online/offline detection
        window.addEventListener('online', () => this.updateOnlineStatus(true));
        window.addEventListener('offline', () => this.updateOnlineStatus(false));

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 1024 && 
                !this.elements.sidebar.contains(e.target) && 
                !this.elements.menuToggle.contains(e.target)) {
                this.elements.sidebar.classList.remove('active');
            }
        });
    }

    async initializeServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            this.showToast('info', 'New version available. Refresh to update.');
                        }
                    });
                });
            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    loadFromLocalStorage() {
        // Load theme
        const savedTheme = localStorage.getItem('dataExaminerTheme');
        if (savedTheme) {
            this.isDarkMode = savedTheme === 'dark';
            this.applyTheme();
        }

        // Load history
        const savedHistory = localStorage.getItem('dataExaminerHistory');
        if (savedHistory) {
            try {
                this.analysisHistory = JSON.parse(savedHistory);
                this.renderHistory();
            } catch (error) {
                console.error('Failed to load history:', error);
                this.analysisHistory = [];
            }
        }
    }

    saveToLocalStorage() {
        localStorage.setItem('dataExaminerTheme', this.isDarkMode ? 'dark' : 'light');
        localStorage.setItem('dataExaminerHistory', JSON.stringify(this.analysisHistory));
    }

    setupTheme() {
        // Check system preference
        if (!localStorage.getItem('dataExaminerTheme')) {
            this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.applyTheme();
        }
    }

    toggleTheme() {
        this.isDarkMode = !this.isDarkMode;
        this.applyTheme();
        this.saveToLocalStorage();
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
        this.elements.themeToggle.innerHTML = this.isDarkMode ? 
            '<i class="fas fa-sun"></i>' : 
            '<i class="fas fa-moon"></i>';
    }

    toggleSidebar() {
        this.elements.sidebar.classList.toggle('active');
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file size
        if (file.size > 10 * 1024 * 1024) {
            this.showToast('error', 'File size exceeds 10MB limit');
            return;
        }

        // Validate file type
        const allowedTypes = ['.csv', '.xlsx', '.xls', '.json', '.txt'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();
        
        if (!allowedTypes.includes(fileExt)) {
            this.showToast('error', 'Invalid file type. Please upload CSV, Excel, JSON, or text files.');
            return;
        }

        this.currentFile = file;
        this.showFileIndicator(file);
        this.showToast('success', `File "${file.name}" selected`);

        // Auto-analyze if welcome screen is visible
        if (this.elements.welcomeScreen.style.display !== 'none') {
            this.sendMessage();
        }

        // Reset file input
        event.target.value = '';
    }

    showFileIndicator(file) {
        this.elements.fileName.textContent = file.name;
        this.elements.fileIndicator.style.display = 'flex';
    }

    clearCurrentFile() {
        this.currentFile = null;
        this.elements.fileIndicator.style.display = 'none';
        this.elements.fileName.textContent = 'No file selected';
        this.showToast('info', 'File cleared');
    }

    async analyzePastedData() {
        const text = this.elements.dataInput.value.trim();
        if (!text) {
            this.showToast('error', 'Please paste some data first');
            return;
        }

        this.currentFile = null;
        this.sendMessage();
    }

    loadSampleData() {
        this.elements.dataInput.value = window.sampleData.csv;
        this.showToast('info', 'Sample sales data loaded. Click "Analyze" in the sidebar.');
        this.elements.dataInput.focus();
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message && !this.currentFile && !this.elements.dataInput.value.trim()) {
            this.showToast('error', 'Please enter a message or upload data');
            return;
        }

        // Hide welcome screen on first interaction
        if (this.elements.welcomeScreen.style.display !== 'none') {
            this.elements.welcomeScreen.style.display = 'none';
            this.elements.messagesContainer.style.display = 'block';
        }

        // Add user message
        this.addMessage('user', message || (this.currentFile ? 
            `Uploaded file: ${this.currentFile.name}` : 
            'Analyzing pasted data'));

        // Clear input
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';

        // Show loading
        this.showLoading(true);

        try {
            let response;
            
            if (this.currentFile) {
                response = await this.api.analyzeFile(this.currentFile, message || 'Analyze this data');
            } else if (this.elements.dataInput.value.trim()) {
                response = await this.api.analyzeText(
                    this.elements.dataInput.value.trim(), 
                    message || 'Analyze this data'
                );
            } else {
                response = await this.api.analyzeText('', message);
            }

            // Add bot response
            this.addMessage('bot', response.analysis);

            // Update chart if available
            if (response.chartData) {
                this.updateChart(response.chartData);
            }

            // Save to history
            this.addToHistory({
                type: this.currentFile ? 'file' : 'text',
                question: message || 'Data analysis',
                analysis: response.analysis,
                timestamp: new Date().toISOString(),
                dataSummary: response.dataSummary
            });

        } catch (error) {
            console.error('Error:', error);
            this.addMessage('bot', `**Error:** ${error.message}\n\nPlease try again or check your connection.`);
            this.showToast('error', 'Analysis failed: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const avatar = role === 'user' ? 'U' : 'AI';
        const name = role === 'user' ? 'You' : 'Data Assistant';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatar}</div>
                <h4>${name}</h4>
                <span class="message-timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
        `;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth' });
    }

    formatMessage(content) {
        if (!content) return '';
        
        return content
            // Headers
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Lists
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Line breaks
            .replace(/\n/g, '<br>')
            
            // Links (basic)
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    }

    updateChart(chartData) {
        if (!chartData || !chartData.labels || chartData.labels.length === 0) {
            this.elements.chartSection.style.display = 'none';
            return;
        }

        const type = this.elements.chartType.value;
        this.chartManager.updateChart(chartData, type);
        this.elements.chartSection.style.display = 'block';
    }

    updateChartType() {
        if (this.chartManager.currentChart) {
            const type = this.elements.chartType.value;
            this.chartManager.updateChartType(type);
        }
    }

    exportChart() {
        if (this.chartManager.currentChart) {
            const link = document.createElement('a');
            link.download = `data-analysis-${Date.now()}.png`;
            link.href = this.chartManager.exportChart();
            link.click();
            this.showToast('success', 'Chart exported successfully');
        }
    }

    addToHistory(analysis) {
        analysis.id = Date.now();
        this.analysisHistory.unshift(analysis);
        
        // Keep only last 20 items
        if (this.analysisHistory.length > 20) {
            this.analysisHistory = this.analysisHistory.slice(0, 20);
        }
        
        this.renderHistory();
        this.saveToLocalStorage();
    }

    renderHistory() {
        const historyList = this.elements.analysisHistory;
        
        if (this.analysisHistory.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="fas fa-inbox"></i>
                    <p>No analyses yet</p>
                </div>
            `;
            return;
        }
        
        historyList.innerHTML = this.analysisHistory.map(item => `
            <div class="history-item" data-id="${item.id}">
                <div class="history-title">${item.question.substring(0, 50)}${item.question.length > 50 ? '...' : ''}</div>
                <div class="history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
            </div>
        `).join('');
        
        // Add click handlers
        historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = parseInt(item.dataset.id);
                this.loadFromHistory(id);
            });
        });
    }

    loadFromHistory(id) {
        const analysis = this.analysisHistory.find(item => item.id === id);
        if (!analysis) return;
        
        this.resetAnalysis();
        this.addMessage('user', analysis.question);
        this.addMessage('bot', analysis.analysis);
        
        if (analysis.dataSummary && analysis.dataSummary.chartData) {
            this.updateChart(analysis.dataSummary.chartData);
        }
        
        this.showToast('info', 'Analysis loaded from history');
        this.toggleSidebar();
    }

    resetAnalysis() {
        this.elements.welcomeScreen.style.display = 'block';
        this.elements.messagesContainer.style.display = 'none';
        this.elements.messagesContainer.innerHTML = '';
        this.elements.chartSection.style.display = 'none';
        this.elements.fileIndicator.style.display = 'none';
        this.currentFile = null;
        this.elements.dataInput.value = '';
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        
        if (this.chartManager.currentChart) {
            this.chartManager.destroy();
        }
        
        this.showToast('info', 'New analysis started');
    }

    updateOnlineStatus(isOnline) {
        const statusDot = this.elements.statusIndicator.querySelector('.status-dot');
        const statusText = this.elements.statusIndicator.querySelector('span:last-child');
        
        if (isOnline) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
            this.showToast('success', 'You are back online');
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Offline';
            this.showToast('error', 'You are offline. Some features may not work.');
        }
    }

    async installPWA() {
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                this.showToast('success', 'App installed successfully!');
                this.elements.installBtn.style.display = 'none';
            }
            
            this.deferredPrompt = null;
        }
    }

    showLoading(show) {
        this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    showToast(type, message, title = '') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle'
        };
        
        toast.innerHTML = `
            <i class="toast-icon ${icons[type]}"></i>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.elements.toastContainer.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            toast.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        });
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DataExaminerApp();
    console.log('Data Examiner App initialized');
});