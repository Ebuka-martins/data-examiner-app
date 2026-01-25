// Complete app.js - Enhanced with AI Chatbot
class DataExaminerApp {
    constructor() {
        this.currentFile = null;
        this.currentChart = null;
        this.analysisHistory = [];
        this.isDarkMode = false;
        this.deferredPrompt = null;
        this.currentSessionId = null;
        this.conversationContext = [];
        
        this.initializeElements();
        this.initializeEventListeners();
        this.initializeServiceWorker();
        this.loadFromLocalStorage();
        this.setupTheme();
        this.checkOnlineStatus();
        this.animateWelcomeScreen();
    }

    initializeElements() {
        this.elements = {
            sidebar: document.getElementById('sidebar'),
            menuToggle: document.getElementById('menuToggle'),
            newChat: document.getElementById('newChat'),
            fileInput: document.getElementById('fileInput'),
            uploadBtn: document.getElementById('uploadBtn'),
            dataInput: document.getElementById('dataInput'),
            analyzePaste: document.getElementById('analyzePaste'),
            analysisHistory: document.getElementById('analysisHistory'),
            statusIndicator: document.getElementById('statusIndicator'),
            
            welcomeScreen: document.getElementById('welcomeScreen'),
            messagesContainer: document.getElementById('messagesContainer'),
            chatContainer: document.getElementById('chatContainer'),
            chartSection: document.getElementById('chartSection'),
            chartCanvas: document.getElementById('dataChart'),
            chartType: document.getElementById('chartType'),
            exportChart: document.getElementById('exportChart'),
            
            messageInput: document.getElementById('messageInput'),
            attachBtn: document.getElementById('attachBtn'),
            sendBtn: document.getElementById('sendBtn'),
            fileIndicator: document.getElementById('fileIndicator'),
            fileName: document.getElementById('fileName'),
            clearFile: document.getElementById('clearFile'),
            
            quickUpload: document.getElementById('quickUpload'),
            quickPaste: document.getElementById('quickPaste'),
            quickSample: document.getElementById('quickSample'),
            
            loadingOverlay: document.getElementById('loadingOverlay'),
            installBtn: document.getElementById('installBtn'),
            themeToggle: document.getElementById('themeToggle'),
            toastContainer: document.getElementById('toastContainer')
        };

        this.api = new DataExaminerAPI();
        this.chartManager = new ChartManager(this.elements.chartCanvas);
        this.fileAnalyzer = new FileAnalyzer();
    }

    initializeEventListeners() {
        // Sidebar controls
        this.elements.menuToggle.addEventListener('click', () => this.toggleSidebar());
        this.elements.newChat.addEventListener('click', () => this.resetAnalysis());
        
        // File operations
        this.elements.uploadBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.elements.analyzePaste.addEventListener('click', () => this.analyzePastedData());
        this.elements.clearFile.addEventListener('click', () => this.clearCurrentFile());
        
        // Quick actions
        this.elements.quickUpload.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.quickPaste.addEventListener('click', () => {
            this.elements.dataInput.focus();
            this.showToast('info', '💡 Paste your data in the sidebar textarea');
        });
        this.elements.quickSample.addEventListener('click', () => this.loadSampleData());
        
        // Chat input
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
                200
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
            this.showToast('success', '🎉 App installed successfully!');
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

    animateWelcomeScreen() {
        // Add entrance animations to welcome elements
        const elements = document.querySelectorAll('.hero-icon, .welcome-screen h1, .hero-subtitle, .quick-action');
        elements.forEach((el, index) => {
            el.style.opacity = '0';
            el.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                el.style.transition = 'all 0.5s ease-out';
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, 100 * index);
        });
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Show file preview
        this.showFilePreview(file);

        // Auto-analyze if welcome screen is visible
        if (this.elements.welcomeScreen.style.display !== 'none') {
            setTimeout(() => {
                this.sendMessage();
            }, 500); // Small delay for better UX
        }

        event.target.value = '';
    }

    showFilePreview(file) {
        this.currentFile = file;
        
        const preview = document.createElement('div');
        preview.className = 'file-preview glass';
        preview.innerHTML = `
            <div class="file-preview-content">
                <i class="fas fa-file-${this.getFileIcon(file.name)}"></i>
                <div>
                    <h4>${file.name}</h4>
                    <p>${this.formatFileSize(file.size)} • ${file.type}</p>
                </div>
            </div>
            <button class="clear-file" id="clearFileBtn">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        document.querySelector('.input-container').prepend(preview);
        
        document.getElementById('clearFileBtn').addEventListener('click', () => {
            this.clearCurrentFile();
            preview.remove();
        });
        
        this.showToast('success', `📁 ${file.name} loaded successfully`);
    }

    getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        switch(ext) {
            case 'csv': return 'csv';
            case 'xlsx': case 'xls': return 'excel';
            case 'json': return 'code';
            case 'txt': return 'alt';
            default: return 'file';
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message && !this.currentFile && !this.elements.dataInput.value.trim()) {
            this.showToast('error', '✏️ Please enter a message or upload data');
            this.elements.messageInput.focus();
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
                response = await this.api.analyzeFile(this.currentFile, message || 'Analyze this data', this.currentSessionId);
            } else if (this.elements.dataInput.value.trim()) {
                response = await this.api.analyzeText(
                    this.elements.dataInput.value.trim(), 
                    message || 'Analyze this data',
                    this.currentSessionId
                );
            } else {
                // Follow-up question
                response = await this.api.chatFollowup({
                    question: message,
                    conversationId: this.currentSessionId,
                    previousAnalysis: this.conversationContext[this.conversationContext.length - 1]
                });
            }

            // Store session ID for conversation continuity
            if (response.conversationId) {
                this.currentSessionId = response.conversationId;
            }

            // Add bot response
            this.addMessage('bot', response.analysis);
            
            // Store in conversation context
            this.conversationContext.push({
                role: 'assistant',
                content: response.analysis
            });

            // Update chart if available
            if (response.chartData && response.chartData.length > 0) {
                this.updateChart(response.chartData[0]); // Show first chart
            }

            // Show visualization suggestions
            if (response.visualizationSuggestions && response.visualizationSuggestions.length > 0) {
                this.showVisualizationSuggestions(response.visualizationSuggestions);
            }

            // Save to history
            this.addToHistory({
                type: this.currentFile ? 'file' : 'text',
                question: message || 'Data analysis',
                analysis: response.analysis,
                timestamp: new Date().toISOString(),
                dataSummary: response.dataSummary,
                conversationId: this.currentSessionId
            });

            // Show analysis tips
            this.showAnalysisTips();

        } catch (error) {
            console.error('Error:', error);
            
            const errorMessage = error.message.includes('API key') 
                ? '⚠️ API key configuration issue. Please check your .env file.'
                : `❌ Analysis failed: ${error.message}`;
            
            this.addMessage('bot', `**Error Analysis**\n\n${errorMessage}\n\nPlease try again or check your connection.`);
            this.showToast('error', errorMessage);
        } finally {
            this.showLoading(false);
        }
    }

    addMessage(role, content) {
        const messageId = `msg-${Date.now()}`;
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message fade-in`;
        messageDiv.id = messageId;
        
        const timestamp = new Date().toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const avatar = role === 'user' ? '👤' : '🤖';
        const name = role === 'user' ? 'You' : 'Data Assistant';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatar}</div>
                <h4>${name}</h4>
                <span class="message-timestamp">${timestamp}</span>
            </div>
            <div class="message-content">${this.formatMessage(content)}</div>
            ${role === 'bot' ? this.getMessageActions(messageId) : ''}
        `;
        
        this.elements.messagesContainer.appendChild(messageDiv);
        messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        // Add copy functionality
        if (role === 'bot') {
            this.setupMessageActions(messageId);
        }
    }

    getMessageActions(messageId) {
        return `
            <div class="message-actions" data-message-id="${messageId}">
                <button class="action-btn copy-btn" title="Copy to clipboard">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="action-btn share-btn" title="Share analysis">
                    <i class="fas fa-share-alt"></i>
                </button>
                <button class="action-btn save-btn" title="Save to history">
                    <i class="fas fa-bookmark"></i>
                </button>
            </div>
        `;
    }

    setupMessageActions(messageId) {
        const messageDiv = document.getElementById(messageId);
        const actions = messageDiv.querySelector('.message-actions');
        
        // Copy button
        actions.querySelector('.copy-btn').addEventListener('click', () => {
            const content = messageDiv.querySelector('.message-content').textContent;
            navigator.clipboard.writeText(content).then(() => {
                this.showToast('success', '📋 Copied to clipboard!');
            });
        });
        
        // Share button
        actions.querySelector('.share-btn').addEventListener('click', () => {
            this.shareAnalysis(messageDiv.querySelector('.message-content').textContent);
        });
        
        // Save button
        actions.querySelector('.save-btn').addEventListener('click', () => {
            this.saveToHistory(messageDiv);
        });
    }

    formatMessage(content) {
        if (!content) return '';
        
        let formatted = content
            // Headers with emojis
            .replace(/^# (.*$)/gm, '<h1>📊 $1</h1>')
            .replace(/^## (.*$)/gm, '<h2>🔍 $1</h2>')
            .replace(/^### (.*$)/gm, '<h3>🎯 $1</h3>')
            
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Lists
            .replace(/^\* (.*$)/gm, '<li>• $1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul class="fade-in">$1</ul>')
            
            // Code blocks with syntax highlighting
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Links
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" class="text-link">🔗 $1</a>')
            
            // Line breaks
            .replace(/\n/g, '<br>');
        
        // Add data tables if detected
        if (content.includes('|')) {
            const tableRegex = /\|(.+)\|\n\|[-:]+\|\n([\s\S]*?)(?=\n\n|\n#|$)/g;
            formatted = formatted.replace(tableRegex, (match, headers, rows) => {
                const headerCells = headers.split('|').filter(cell => cell.trim()).map(cell => `<th>${cell.trim()}</th>`).join('');
                const rowLines = rows.trim().split('\n');
                const tableRows = rowLines.map(row => {
                    const cells = row.split('|').filter(cell => cell.trim()).map(cell => `<td>${cell.trim()}</td>`).join('');
                    return `<tr>${cells}</tr>`;
                }).join('');
                
                return `<div class="table-container"><table><thead><tr>${headerCells}</tr></thead><tbody>${tableRows}</tbody></table></div>`;
            });
        }
        
        return formatted;
    }

    showVisualizationSuggestions(suggestions) {
        const suggestionsHTML = suggestions.map(suggestion => `
            <div class="suggestion-item glass">
                <i class="fas fa-chart-${this.getChartIcon(suggestion.type)}"></i>
                <div>
                    <h5>${suggestion.description}</h5>
                    <p>${suggestion.reason}</p>
                </div>
            </div>
        `).join('');
        
        const suggestionDiv = document.createElement('div');
        suggestionDiv.className = 'visualization-suggestions fade-in';
        suggestionDiv.innerHTML = `
            <h4>📊 Suggested Visualizations</h4>
            <div class="suggestions-grid">
                ${suggestionsHTML}
            </div>
        `;
        
        this.elements.messagesContainer.appendChild(suggestionDiv);
        suggestionDiv.scrollIntoView({ behavior: 'smooth' });
    }

    getChartIcon(type) {
        const icons = {
            'time-series': 'line',
            'bar-chart': 'bar',
            'pie-chart': 'pie',
            'scatter-plot': 'dot-circle'
        };
        return icons[type] || 'chart-bar';
    }

    showAnalysisTips() {
        const tips = [
            "💡 Try asking: 'What are the main trends?'",
            "💡 Ask: 'Show me correlations in the data'",
            "💡 Try: 'Create a summary report'",
            "💡 Ask: 'What are the key insights?'"
        ];
        
        const randomTip = tips[Math.floor(Math.random() * tips.length)];
        
        // Show tip after a delay
        setTimeout(() => {
            this.showToast('info', randomTip, '💡 Quick Tip');
        }, 2000);
    }

    updateChart(chartConfig) {
        if (!chartConfig || !chartConfig.data) {
            this.elements.chartSection.style.display = 'none';
            return;
        }

        this.chartManager.updateChart(chartConfig);
        this.elements.chartSection.style.display = 'block';
        
        // Animate chart section
        this.elements.chartSection.classList.add('fade-in');
    }

    shareAnalysis(content) {
        if (navigator.share) {
            navigator.share({
                title: 'Data Analysis Results',
                text: content.substring(0, 100) + '...',
                url: window.location.href
            });
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(content).then(() => {
                this.showToast('success', '📋 Analysis copied to clipboard!');
            });
        }
    }

    saveToHistory(messageDiv) {
        const content = messageDiv.querySelector('.message-content').textContent;
        const timestamp = new Date().toISOString();
        
        this.analysisHistory.unshift({
            id: Date.now(),
            content: content.substring(0, 200) + '...',
            timestamp: timestamp,
            fullContent: content
        });
        
        this.renderHistory();
        this.showToast('success', '💾 Analysis saved to history!');
    }

    // ... (rest of the methods remain similar but enhanced with animations and better UX)

    showToast(type, message, title = '') {
        const toastId = `toast-${Date.now()}`;
        const toast = document.createElement('div');
        toast.className = `toast ${type} fade-in`;
        toast.id = toastId;
        
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
        const autoRemove = setTimeout(() => {
            this.removeToast(toastId);
        }, 5000);
        
        // Close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            clearTimeout(autoRemove);
            this.removeToast(toastId);
        });
    }

    removeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.style.animation = 'slideInRight 0.3s ease-out reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }

    // ... (rest of the methods)
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    // Add loading animation
    document.body.classList.add('loading');
    
    setTimeout(() => {
        window.app = new DataExaminerApp();
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
        
        console.log('🚀 Data Examiner 2.0.0 initialized');
        
        // Show welcome tip
        setTimeout(() => {
            if (document.getElementById('welcomeScreen').style.display !== 'none') {
                window.app.showToast('info', '👋 Welcome! Upload a file or paste data to get started', 'Get Started');
            }
        }, 1000);
    }, 500);
});