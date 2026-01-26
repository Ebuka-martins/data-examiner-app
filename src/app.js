// src/app.js — Data Examiner — main frontend logic
class DataExaminerApp {
  constructor() {
    this.api = new DataExaminerAPI();
    this.currentFile = null;
    this.currentSessionId = null;
    this.conversationContext = [];
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.analysisHistory = JSON.parse(localStorage.getItem('analysisHistory')) || [];

    this.elements = {};
    this.initializeElements();
    this.applyTheme();
    this.initializeEventListeners();
    this.registerServiceWorker();
  }

  initializeElements() {
    const ids = [
      'sidebar', 'menuToggle', 'newChat', 'fileInput', 'uploadBtn',
      'dataInput', 'analyzePaste', 'analysisHistory', 'statusIndicator',
      'welcomeScreen', 'messagesContainer', 'chatContainer', 'chartSection',
      'dataChart', 'chartType', 'exportChart', 'messageInput', 'attachBtn',
      'sendBtn', 'fileIndicator', 'fileName', 'clearFile', 'quickUpload',
      'quickPaste', 'quickSample', 'loadingOverlay', 'installBtn',
      'themeToggle', 'toastContainer'
    ];

    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
    });
  }

  applyTheme() {
    document.documentElement.setAttribute('data-theme', this.isDarkMode ? 'dark' : 'light');
    this.elements.themeToggle.innerHTML = this.isDarkMode 
      ? '<i class="fas fa-sun"></i>' 
      : '<i class="fas fa-moon"></i>';
  }

  initializeEventListeners() {
    // Sidebar & navigation
    this.elements.menuToggle?.addEventListener('click', () => this.elements.sidebar.classList.toggle('active'));
    this.elements.newChat?.addEventListener('click', () => this.resetAnalysis());

    // File handling
    this.elements.uploadBtn?.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.fileInput?.addEventListener('change', e => this.handleFileSelect(e));
    this.elements.analyzePaste?.addEventListener('click', () => this.analyzePastedData());
    this.elements.clearFile?.addEventListener('click', () => this.clearCurrentFile());

    // Quick actions
    this.elements.quickUpload?.addEventListener('click', () => this.elements.fileInput.click());
    this.elements.quickPaste?.addEventListener('click', () => this.elements.dataInput.focus());
    this.elements.quickSample?.addEventListener('click', () => this.loadSampleData());

    // Chat
    this.elements.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Auto-resize textarea
    this.elements.messageInput?.addEventListener('input', () => {
      this.elements.messageInput.style.height = 'auto';
      this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 160) + 'px';
    });

    // Chart & theme & install
    this.elements.chartType?.addEventListener('change', e => this.updateChartType(e.target.value));
    this.elements.exportChart?.addEventListener('click', () => this.exportChart());
    this.elements.themeToggle?.addEventListener('click', () => this.toggleTheme());
    this.elements.installBtn?.addEventListener('click', () => this.installPWA());

    // Online status
    window.addEventListener('online',  () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(reg => console.log('Service Worker registered'))
        .catch(err => console.error('Service Worker registration failed:', err));
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode);
    this.applyTheme();
  }

  updateOnlineStatus(isOnline) {
    const dot = this.elements.statusIndicator?.querySelector('.status-dot');
    if (dot) {
      dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
  }

  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.currentFile = file;
    this.elements.fileName.textContent = file.name;
    this.elements.fileIndicator.style.display = 'flex';

    // Optional: auto-analyze on file select
    // await this.sendMessage();
  }

  clearCurrentFile() {
    this.currentFile = null;
    this.elements.fileIndicator.style.display = 'none';
    this.elements.fileInput.value = '';
  }

  async analyzePastedData() {
    const text = this.elements.dataInput?.value.trim();
    if (!text) return this.showToast('warning', 'Please paste some data first');

    this.showLoading(true);
    try {
      const res = await this.api.analyzeText(text, 'Analyze this pasted data', this.currentSessionId);
      this.handleAnalysisResponse(res);
    } catch (err) {
      this.showToast('error', 'Analysis failed: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  }

  async loadSampleData() {
    if (!window.sampleData?.csv) return;
    this.elements.dataInput.value = window.sampleData.csv;
    this.showToast('info', 'Sample data loaded — click Analyze →');
  }

  async sendMessage() {
    const input = this.elements.messageInput;
    const message = input.value.trim();

    if (!message && !this.currentFile && !this.elements.dataInput?.value.trim()) {
      return this.showToast('warning', 'Please type a question or upload/paste data');
    }

    // Hide welcome screen once we start chatting
    if (this.elements.welcomeScreen.style.display !== 'none') {
      this.elements.welcomeScreen.style.display = 'none';
      this.elements.messagesContainer.style.display = 'block';
    }

    // Show user message
    const displayText = message || (this.currentFile ? `Analyzing file: ${this.currentFile.name}` : 'Analyzing pasted data...');
    this.addMessage('user', displayText);

    // Clear input
    input.value = '';
    input.style.height = 'auto';

    this.showLoading(true);

    try {
      let response;

      if (this.currentFile) {
        response = await this.api.analyzeFile(this.currentFile, message || 'Give me insights about this file', this.currentSessionId);
        this.currentFile = null;
        this.elements.fileIndicator.style.display = 'none';
      } else if (this.elements.dataInput?.value.trim()) {
        response = await this.api.analyzeText(this.elements.dataInput.value.trim(), message || 'Analyze this data', this.currentSessionId);
        this.elements.dataInput.value = '';
      } else {
        // Follow-up question
        response = await this.api.chatFollowup({
          question: message,
          conversationId: this.currentSessionId
        });
      }

      this.currentSessionId = response.conversationId;
      this.handleAnalysisResponse(response);

    } catch (err) {
      this.addMessage('bot', `**Error**\n\n${err.message || 'Something went wrong. Please try again.'}`);
      this.showToast('error', err.message || 'Analysis failed');
    } finally {
      this.showLoading(false);
      input.focus();
    }
  }

  handleAnalysisResponse(res) {
    if (!res.success) {
      this.addMessage('bot', `**Error from server**\n\n${res.error || 'Unknown error'}`);
      return;
    }

    this.addMessage('bot', res.analysis);

    // Show chart if available
    if (res.chartData?.length > 0) {
      window.chartManager?.updateChart(res.chartData[0]);
      this.elements.chartSection.style.display = 'block';
    }

    // Save to history
    this.saveToHistory(res);
  }

  addMessage(role, content) {
    const container = this.elements.messagesContainer;
    const msg = document.createElement('div');
    msg.className = `message ${role}-message`;
    msg.innerHTML = `
      <div class="message-avatar">${role === 'user' ? 'You' : 'AI'}</div>
      <div class="message-content markdown-body">${this.formatMarkdown(content)}</div>
    `;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  formatMarkdown(text) {
    // Very basic markdown → HTML (you can use marked.js or similar for full support)
    return text
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  saveToHistory(res) {
    const entry = {
      timestamp: new Date().toISOString(),
      question: this.elements.messageInput?.value || 'File/Paste analysis',
      preview: res.analysis.substring(0, 120) + '...',
      full: res.analysis,
      sessionId: this.currentSessionId
    };
    this.analysisHistory.unshift(entry);
    localStorage.setItem('analysisHistory', JSON.stringify(this.analysisHistory.slice(0, 30)));
    this.renderHistory();
  }

  renderHistory() {
    const list = this.elements.analysisHistory;
    if (!list) return;

    list.innerHTML = '';
    this.analysisHistory.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      div.innerHTML = `
        <div class="history-title">${item.question}</div>
        <div class="history-date">${new Date(item.timestamp).toLocaleDateString()}</div>
        <div class="history-preview">${item.preview}</div>
      `;
      div.onclick = () => {
        this.addMessage('bot', item.full);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      };
      list.appendChild(div);
    });
  }

  showLoading(show) {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  }

  showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    this.elements.toastContainer?.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  }

  updateChartType(type) {
    window.chartManager?.updateChartType(type);
  }

  exportChart() {
    window.chartManager?.exportChart();
  }

  resetAnalysis() {
    this.elements.messagesContainer.innerHTML = '';
    this.elements.chartSection.style.display = 'none';
    this.elements.welcomeScreen.style.display = 'flex';
    this.currentSessionId = null;
    this.currentFile = null;
    this.elements.fileIndicator.style.display = 'none';
  }

  installPWA() {
    // Triggered by beforeinstallprompt event — see event listener below
  }
}

// Global chart manager reference (assuming chart.js exposes window.chartManager)
let chartManager;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DataExaminerApp();
  chartManager = new ChartManager(document.getElementById('dataChart'));
  chartManager.initialize();

  // PWA install prompt
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    window.app.deferredPrompt = e;
    window.app.elements.installBtn.style.display = 'inline-flex';
  });
});