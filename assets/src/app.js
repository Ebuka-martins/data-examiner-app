// src/app.js — Data Examiner — FIXED VERSION
class DataExaminerApp {
  constructor() {
    this.api = new DataExaminerAPI();
    this.currentFile = null;
    this.currentSessionId = null;
    this.conversationContext = [];
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.analysisHistory = JSON.parse(localStorage.getItem('analysisHistory')) || [];
    this.currentTypingMessage = null;
    this.isSidebarOpen = false;

    this.elements = {};
    this.initializeElements();
    this.applyTheme();
    this.initializeEventListeners();
    this.registerServiceWorker();
    
    console.log('✅ App initialized with elements:', Object.keys(this.elements));
  }

  initializeElements() {
    const ids = [
      'sidebar', 'menuToggle', 'sidebarClose', 'sidebarOverlay', 'newChat', 'fileInput', 'uploadBtn',
      'dataInput', 'analyzePaste', 'analysisHistory', 'statusIndicator',
      'welcomeScreen', 'messagesContainer', 'chatContainer', 'chartSection',
      'dataChart', 'chartType', 'exportChart', 'messageInput', 'attachBtn',
      'sendBtn', 'fileIndicator', 'fileName', 'clearFile', 'quickUpload',
      'quickPaste', 'quickSample', 'loadingOverlay', 'installBtn',
      'themeToggle', 'toastContainer', 'testChartBtn'
    ];

    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
      if (!this.elements[id] && id !== 'testChartBtn') {
        console.warn(`⚠️ Element ${id} not found`);
      }
    });
  }

  applyTheme() {
    document.documentElement.setAttribute(
      'data-theme',
      this.isDarkMode ? 'dark' : 'light'
    );
    if (this.elements.themeToggle) {
      this.elements.themeToggle.innerHTML = this.isDarkMode
        ? '<i class="fas fa-sun"></i>'
        : '<i class="fas fa-moon"></i>';
    }
  }

  initializeEventListeners() {
    console.log('🔌 Initializing event listeners...');
    
    // Sidebar toggle functionality
    if (this.elements.menuToggle) {
      this.elements.menuToggle.addEventListener('click', () => {
        console.log('📱 Menu toggle clicked');
        this.toggleSidebar();
      });
    }

    if (this.elements.sidebarClose) {
      this.elements.sidebarClose.addEventListener('click', () => {
        console.log('❌ Sidebar close clicked');
        this.toggleSidebar(false);
      });
    }

    if (this.elements.sidebarOverlay) {
      this.elements.sidebarOverlay.addEventListener('click', () => {
        console.log('🌑 Overlay clicked');
        this.toggleSidebar(false);
      });
    }

    // Close sidebar with Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSidebarOpen) {
        console.log('⎋ Escape pressed, closing sidebar');
        this.toggleSidebar(false);
      }
    });

    // Existing event listeners
    if (this.elements.newChat) {
      this.elements.newChat.addEventListener('click', () => this.resetAnalysis());
    }

    if (this.elements.uploadBtn) {
      this.elements.uploadBtn.addEventListener('click', () => {
        console.log('📁 Upload button clicked');
        this.elements.fileInput.click();
      });
    }
    
    if (this.elements.fileInput) {
      this.elements.fileInput.addEventListener('change', e => {
        console.log('📄 File selected');
        this.handleFileSelect(e);
      });
    }
    
    if (this.elements.analyzePaste) {
      this.elements.analyzePaste.addEventListener('click', () => {
        console.log('📋 Analyze paste clicked');
        this.analyzePastedData();
      });
    }
    
    if (this.elements.clearFile) {
      this.elements.clearFile.addEventListener('click', () => {
        console.log('🗑️ Clear file clicked');
        this.clearCurrentFile();
      });
    }

    if (this.elements.quickUpload) {
      this.elements.quickUpload.addEventListener('click', () => {
        console.log('⚡ Quick upload clicked');
        this.elements.fileInput.click();
      });
    }
    
    if (this.elements.quickPaste) {
      this.elements.quickPaste.addEventListener('click', () => {
        console.log('⚡ Quick paste clicked');
        if (this.elements.dataInput) {
          this.elements.dataInput.focus();
          this.showToast('info', 'Start typing or paste your data above');
        }
      });
    }
    
    if (this.elements.quickSample) {
      this.elements.quickSample.addEventListener('click', () => {
        console.log('🧪 Quick sample clicked');
        this.loadSampleData();
      });
    }

    if (this.elements.sendBtn) {
      this.elements.sendBtn.addEventListener('click', () => {
        console.log('📤 Send button clicked');
        this.sendMessage();
      });
    }
    
    if (this.elements.messageInput) {
      this.elements.messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          console.log('↵ Enter key pressed (send)');
          this.sendMessage();
        }
      });

      this.elements.messageInput.addEventListener('input', () => {
        this.elements.messageInput.style.height = 'auto';
        this.elements.messageInput.style.height =
          Math.min(this.elements.messageInput.scrollHeight, 160) + 'px';
      });
    }

    if (this.elements.chartType) {
      this.elements.chartType.addEventListener('change', e => {
        console.log('📊 Chart type changed to:', e.target.value);
        this.updateChartType(e.target.value);
      });
    }
    
    if (this.elements.exportChart) {
      this.elements.exportChart.addEventListener('click', () => {
        console.log('💾 Export chart clicked');
        this.exportChart();
      });
    }
    
    if (this.elements.themeToggle) {
      this.elements.themeToggle.addEventListener('click', () => {
        console.log('🌗 Theme toggle clicked');
        this.toggleTheme();
      });
    }
    
    if (this.elements.installBtn) {
      this.elements.installBtn.addEventListener('click', () => {
        console.log('📲 Install PWA clicked');
        this.installPWA();
      });
    }
    
    if (this.elements.testChartBtn) {
      this.elements.testChartBtn.addEventListener('click', () => {
        console.log('🧪 Test chart clicked');
        this.testChart();
      });
      this.elements.testChartBtn.style.display = 'flex';
    }

    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    
    console.log('✅ Event listeners initialized');
  }

  toggleSidebar(show) {
    const sidebar = this.elements.sidebar;
    const overlay = this.elements.sidebarOverlay;
    
    if (!sidebar || !overlay) {
      console.error('❌ Sidebar or overlay elements not found!');
      return;
    }
    
    if (show === undefined) {
      show = !this.isSidebarOpen;
    }
    
    console.log(`🔄 Setting sidebar to: ${show ? 'open' : 'closed'}`);
    
    if (show) {
      sidebar.classList.add('active');
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.isSidebarOpen = true;
    } else {
      sidebar.classList.remove('active');
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      this.isSidebarOpen = false;
    }
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(() => console.log('✅ Service Worker registered'))
        .catch(err =>
          console.error('❌ Service Worker registration failed:', err)
        );
    }
  }

  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    localStorage.setItem('darkMode', this.isDarkMode);
    this.applyTheme();
    this.showToast('success', `Switched to ${this.isDarkMode ? 'dark' : 'light'} mode`);
  }

  updateOnlineStatus(isOnline) {
    const dot = this.elements.statusIndicator?.querySelector('.status-dot');
    if (dot) {
      dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
    }
    this.showToast(isOnline ? 'success' : 'error', 
      isOnline ? 'Back online' : 'You are offline');
  }

  async handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) {
      console.log('⚠️ No file selected');
      return;
    }

    console.log(`📄 File selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
    
    this.currentFile = file;
    if (this.elements.fileName) {
      this.elements.fileName.textContent = file.name;
    }
    if (this.elements.fileIndicator) {
      this.elements.fileIndicator.style.display = 'flex';
    }
    
    this.showToast('success', `File "${file.name}" selected`);
  }

  clearCurrentFile() {
    console.log('🗑️ Clearing current file');
    this.currentFile = null;
    if (this.elements.fileIndicator) {
      this.elements.fileIndicator.style.display = 'none';
    }
    if (this.elements.fileInput) {
      this.elements.fileInput.value = '';
    }
    this.showToast('info', 'File cleared');
  }

  async analyzePastedData() {
    const text = this.elements.dataInput?.value.trim();
    if (!text) {
      this.showToast('warning', 'Please paste some data first');
      return;
    }

    console.log('📋 Analyzing pasted data...');
    
    // Hide welcome screen and show messages
    if (this.elements.welcomeScreen && this.elements.messagesContainer) {
      if (this.elements.welcomeScreen.style.display !== 'none') {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.messagesContainer.style.display = 'block';
      }
    }

    // Add user message
    this.addMessage('user', 'Analyze this pasted data and create visualizations');

    this.showLoading(true);
    try {
      const res = await this.api.analyzeText(
        text,
        'Analyze this pasted data and create visualizations',
        this.currentSessionId
      );
      
      console.log('✅ Paste analysis response:', {
        success: res.success,
        hasChartData: !!res.chartData,
        chartType: res.chartType,
        conversationId: res.conversationId
      });
      
      // Update session ID for conversation continuity
      this.currentSessionId = res.conversationId;
      
      // Handle the response with full AI summary and charts
      this.handleAnalysisResponse(res);
      
      // Clear the paste area after successful analysis
      if (this.elements.dataInput) {
        this.elements.dataInput.value = '';
      }
      
      this.showToast('success', 'Analysis complete!');
      
    } catch (err) {
      console.error('❌ Paste analysis error:', err);
      this.addMessage(
        'bot',
        `**Error**\n\n${err.message || 'Analysis failed. Please try again.'}`,
        false
      );
      this.showToast('error', 'Analysis failed: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  }

  async sendMessage() {
    const input = this.elements.messageInput;
    if (!input) return;
    
    const message = input.value.trim();
    
    if (!message) {
      this.showToast('warning', 'Please enter a question');
      return;
    }

    console.log('📤 Sending message:', message.substring(0, 50) + '...');

    // Hide welcome screen on first message
    if (this.elements.welcomeScreen && this.elements.messagesContainer) {
      if (this.elements.welcomeScreen.style.display !== 'none') {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.messagesContainer.style.display = 'block';
      }
    }

    // Display user message
    this.addMessage('user', message);

    input.value = '';
    input.style.height = 'auto';
    this.showLoading(true);

    try {
      let response;

      // Check if this is a follow-up question (we have an active session)
      if (this.currentSessionId) {
        // This is a follow-up question about previous data
        console.log('🔄 Sending follow-up question...');
        response = await this.api.chatFollowup({
          question: message,
          conversationId: this.currentSessionId
        });
      } else {
        // This is a new analysis request - need data
        // Validation: require file OR pasted data for first message
        if (!this.currentFile && !(this.elements.dataInput?.value.trim())) {
          this.showToast('warning', 'Please upload data or paste data first, then ask questions');
          this.showLoading(false);
          return;
        }

        // Case 1: File upload
        if (this.currentFile) {
          console.log('📁 Analyzing file...');
          response = await this.api.analyzeFile(
            this.currentFile,
            message || 'Analyze this data and create visualizations',
            this.currentSessionId
          );
          this.currentFile = null;
          if (this.elements.fileIndicator) {
            this.elements.fileIndicator.style.display = 'none';
          }
        } 
        // Case 2: Pasted data
        else if (this.elements.dataInput?.value.trim()) {
          console.log('📋 Analyzing pasted data...');
          response = await this.api.analyzeText(
            this.elements.dataInput.value.trim(),
            message || 'Analyze this data and create visualizations',
            this.currentSessionId
          );
          if (this.elements.dataInput) {
            this.elements.dataInput.value = '';
          }
        } else {
          // Case 3: Just a question without data (use follow-up logic)
          throw new Error('Please upload data or paste data first, then ask questions');
        }
      }

      console.log('✅ Response received:', {
        success: response.success,
        hasChartData: !!response.chartData,
        chartType: response.chartType,
        conversationId: response.conversationId
      });

      this.currentSessionId = response.conversationId;
      this.handleAnalysisResponse(response);
    } catch (err) {
      console.error('❌ Send message error:', err);
      this.addMessage(
        'bot',
        `**Error**\n\n${err.message || 'Something went wrong. Try again.'}`,
        false
      );
      
      let toastMessage = err.message || 'Analysis failed';
      if (toastMessage.includes('404')) {
        toastMessage = 'Server endpoint not found. Please restart the server.';
      } else if (toastMessage.includes('No active analysis session')) {
        toastMessage = 'Please upload data or paste data first, then ask questions';
      }
      
      this.showToast('error', toastMessage);
    } finally {
      this.showLoading(false);
      if (input) {
        input.focus();
      }
    }
  }

  async handleAnalysisResponse(res) {
    if (!res.success) {
      this.addMessage(
        'bot',
        `**Error from server**\n\n${res.analysis || res.error}`,
        false
      );
      return;
    }

    // Debug: Log chart data
    this.debugChartData(res);

    // Create bot message with typing indicator
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot-message';
    messageDiv.innerHTML = `
      <div class="message-avatar">AI</div>
      <div class="message-content typing">
        <div class="typing-indicator">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>
      </div>
    `;
    
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.appendChild(messageDiv);
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }
    
    // Parse the AI response
    const formattedResponse = this.createBeautifulResponseFromMarkdown(res.analysis);
    
    // Display the response after a short delay (typing effect)
    setTimeout(() => {
      const contentElement = messageDiv.querySelector('.message-content');
      contentElement.classList.remove('typing');
      contentElement.innerHTML = formattedResponse;
      
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      }

      // Store AI response in conversation context
      this.conversationContext.push({
        role: 'assistant',
        content: res.analysis,
        timestamp: new Date().toISOString()
      });

      // Show chart if AI provided data
      if (res.chartData && window.chartManager) {
        console.log('🔄 Attempting to display chart with AI data');
        
        // Show the chart section first
        if (this.elements.chartSection) {
          this.elements.chartSection.style.display = 'block';
          this.elements.chartSection.style.opacity = '1';
        }
        
        // Try to display the chart
        const success = this.displayChartWithData(
          res.chartData,
          res.chartType || 'auto',
          res.chartTitle || 'Data Visualization'
        );
        
        if (!success) {
          console.log('📭 Chart display failed, showing fallback');
          window.chartManager.showNoData();
        }
        
        // Update chart type selector if needed
        if (res.chartType && this.elements.chartType) {
          this.elements.chartType.value = res.chartType;
        }
        
      } else if (window.chartManager) {
        console.log('📭 No chart data provided in AI response');
        // Show "no data" state
        window.chartManager.showNoData();
        if (this.elements.chartSection) {
          this.elements.chartSection.style.display = 'block';
          this.elements.chartSection.style.opacity = '1';
        }
      }

      this.saveToHistory(res);
    }, 800); // Typing effect duration
  }

  debugChartData(data) {
    console.log('📊 Chart Data Debug:', {
      hasChartData: !!data.chartData,
      labels: data.chartData?.labels?.length || 0,
      datasetsCount: data.chartData?.datasets?.length || 0,
      chartTitle: data.chartTitle,
      chartType: data.chartType,
      conversationId: data.conversationId
    });
  }

  displayChartWithData(chartData, chartType = 'auto', chartTitle = 'Data Visualization') {
    if (!window.chartManager) {
      console.error('❌ Chart manager not available');
      return false;
    }

    console.log('📈 Displaying chart:', { chartType, chartTitle });

    // Validate chart data
    if (!chartData || !chartData.datasets || !Array.isArray(chartData.datasets) || chartData.datasets.length === 0) {
      console.error('❌ Invalid chart data');
      return false;
    }

    // Ensure labels exist
    if (!chartData.labels || !Array.isArray(chartData.labels)) {
      console.warn('⚠️ No labels provided, generating default labels');
      chartData.labels = chartData.datasets[0].data.map((_, i) => `Item ${i + 1}`);
    }

    try {
      // Update the chart
      const success = window.chartManager.updateChart(chartData, chartType, chartTitle);
      
      if (success) {
        console.log('✅ Chart displayed successfully');
        // Ensure chart section is visible
        if (this.elements.chartSection) {
          this.elements.chartSection.style.display = 'block';
          this.elements.chartSection.style.opacity = '1';
        }
        return true;
      } else {
        console.error('❌ Chart update returned false');
        return false;
      }
    } catch (error) {
      console.error('❌ Error displaying chart:', error);
      return false;
    }
  }

  parseMarkdownToStructuredData(markdown) {
    const lines = markdown.split('\n');
    const sections = {
      overview: '',
      metrics: [],
      insights: [],
      recommendations: [],
      keyFindings: [],
      rawSections: []
    };

    let currentSection = '';
    let currentContent = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      if (line.startsWith('# ')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        sections.overview = line.replace('# ', '');
        currentSection = 'overview';
      } else if (line.startsWith('## Key Metrics')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'metrics';
      } else if (line.startsWith('## Key Insights')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'insights';
      } else if (line.startsWith('## Recommendations')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'recommendations';
      } else if (line.startsWith('## Key Finding')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'key finding';
      } else if (currentSection === 'metrics' && line.includes(':')) {
        const [label, value] = line.split(':').map(s => s.trim());
        sections.metrics.push({ label, value });
      } else if (currentSection === 'insights' && line.startsWith('-')) {
        const insight = line.replace(/^-\s*/, '').trim();
        if (insight) sections.insights.push(insight);
      } else if (currentSection === 'recommendations' && line.match(/^\d+\./)) {
        const rec = line.replace(/^\d+\.\s*/, '').trim();
        if (rec) sections.recommendations.push(rec);
      } else if (currentSection === 'key finding' && line && !line.startsWith('#')) {
        sections.keyFindings.push(line);
        currentSection = '';
      } else if (line.startsWith('```')) {
        while (i < lines.length && !lines[i].includes('```')) {
          i++;
        }
      } else if (line && !line.startsWith('##') && !line.startsWith('#')) {
        currentContent += line + ' ';
      }
    }

    if (currentContent) {
      sections.rawSections.push({
        type: 'paragraph',
        content: currentContent.trim(),
        title: currentSection
      });
    }

    return sections;
  }

  createBeautifulResponseFromMarkdown(markdown) {
    if (markdown.includes('<div class="ai-summary">')) {
      return markdown;
    }
    
    const structuredData = this.parseMarkdownToStructuredData(markdown);
    
    if (structuredData.overview || 
        structuredData.metrics.length > 0 || 
        structuredData.insights.length > 0) {
      return this.createBeautifulHTML(structuredData);
    } else {
      return `<div class="message-content-plain">${this.simpleMarkdownToHTML(markdown)}</div>`;
    }
  }

  simpleMarkdownToHTML(text) {
    if (!text) return '';
    
    return text
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/<\/p><p>/g, '</p><p>');
  }

  createBeautifulHTML(structuredData) {
    const { overview, metrics, insights, recommendations, keyFindings } = structuredData;
    
    let html = '<div class="ai-summary">';
    
    // Header
    html += `
      <div class="summary-header">
        <div class="summary-icon">
          <i class="fas fa-chart-bar"></i>
        </div>
        <h2 class="summary-title">Data Analysis Summary</h2>
      </div>
    `;
    
    // Overview
    html += `
      <div class="summary-section">
        <div class="section-header">
          <div class="section-icon">
            <i class="fas fa-eye"></i>
          </div>
          <h3 class="section-title">Overview</h3>
        </div>
        <p class="section-content">${overview || 'Analysis overview will appear here.'}</p>
      </div>
    `;
    
    // Metrics
    if (metrics.length > 0) {
      html += `
        <div class="summary-section">
          <div class="section-header">
            <div class="section-icon">
              <i class="fas fa-chart-line"></i>
            </div>
            <h3 class="section-title">Key Metrics</h3>
          </div>
          <div class="metrics-grid">
      `;
      
      metrics.forEach((metric, index) => {
        html += `
          <div class="metric-card">
            <div class="metric-value">${metric.value || 'N/A'}</div>
            <div class="metric-label">${metric.label || 'Metric ' + (index + 1)}</div>
          </div>
        `;
      });
      
      html += `</div></div>`;
    }
    
    // Insights
    if (insights.length > 0) {
      html += `
        <div class="summary-section">
          <div class="section-header">
            <div class="section-icon">
              <i class="fas fa-lightbulb"></i>
            </div>
            <h3 class="section-title">Key Insights</h3>
          </div>
          <div class="insights-container">
      `;
      
      insights.forEach((insight, index) => {
        const icons = ['fa-chart-pie', 'fa-trend-up', 'fa-filter', 'fa-bullseye', 'fa-search'];
        const icon = icons[index] || 'fa-chart-bar';
        html += `
          <div class="insight-card">
            <div class="insight-header">
              <div class="insight-icon">
                <i class="fas ${icon}"></i>
              </div>
              <h4 class="insight-title">Insight ${index + 1}</h4>
            </div>
            <p class="insight-content">${insight}</p>
          </div>
        `;
      });
      
      html += `</div></div>`;
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      html += `
        <div class="recommendation">
          <h4 class="recommendation-title"><i class="fas fa-bullseye"></i> Recommendations</h4>
          <ul class="summary-list">
      `;
      
      recommendations.forEach((rec, index) => {
        html += `
          <li class="summary-item">
            <span class="item-icon"><i class="fas fa-check-circle"></i></span>
            <span class="item-text">${rec}</span>
          </li>
        `;
      });
      
      html += `</ul></div>`;
    }
    
    // Key Findings
    if (keyFindings.length > 0) {
      html += `
        <div class="highlight-box">
          <h4 class="highlight-title"><i class="fas fa-star"></i> Key Finding</h4>
          <p class="highlight-content">${keyFindings[0]}</p>
        </div>
      `;
    } else if (insights.length > 0) {
      html += `
        <div class="highlight-box">
          <h4 class="highlight-title"><i class="fas fa-star"></i> Key Finding</h4>
          <p class="highlight-content">${insights[0]}</p>
        </div>
      `;
    }
    
    html += '</div>';
    return html;
  }

  addMessage(role, content, useTypewriter = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    if (role === 'user') {
      messageDiv.innerHTML = `
        <div class="message-avatar">You</div>
        <div class="message-content">${this.formatMarkdown(content)}</div>
      `;
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.appendChild(messageDiv);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      }
      
      this.conversationContext.push({
        role: 'user',
        content: content,
        timestamp: new Date().toISOString()
      });
    } else if (!useTypewriter) {
      messageDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">${this.formatMarkdown(content)}</div>
      `;
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.appendChild(messageDiv);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      }
      
      this.conversationContext.push({
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString()
      });
    }
  }

  formatMarkdown(text) {
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
      preview: res.analysis ? (res.analysis.substring(0, 120) + '...') : 'No analysis',
      full: res.analysis,
      chartData: res.chartData,
      sessionId: this.currentSessionId,
      conversationContext: [...this.conversationContext]
    };
    this.analysisHistory.unshift(entry);
    localStorage.setItem(
      'analysisHistory',
      JSON.stringify(this.analysisHistory.slice(0, 30))
    );
    this.renderHistory();
  }

  renderHistory() {
    const historyList = this.elements.analysisHistory;
    if (!historyList) return;

    historyList.innerHTML = '';

    if (this.analysisHistory.length === 0) {
      historyList.innerHTML = `
        <div class="history-empty">
          <i class="fas fa-inbox"></i>
          <p>No analyses yet</p>
        </div>
      `;
      return;
    }

    this.analysisHistory.forEach(entry => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div class="history-title">${entry.preview}</div>
        <div class="history-date">${new Date(entry.timestamp).toLocaleDateString()}</div>
        ${entry.chartData ? '<div class="history-has-chart"><i class="fas fa-chart-bar"></i></div>' : ''}
      `;
      historyItem.addEventListener('click', () => {
        this.loadFromHistory(entry);
      });
      historyList.appendChild(historyItem);
    });
  }

  loadFromHistory(entry) {
    this.resetAnalysis();
    this.currentSessionId = entry.sessionId;
    this.conversationContext = entry.conversationContext || [];
    
    if (this.conversationContext.length > 0) {
      this.conversationContext.forEach(msg => {
        if (msg.role === 'user') {
          this.addMessage('user', msg.content, false);
        } else if (msg.role === 'assistant') {
          this.addMessage('bot', msg.content, false);
        }
      });
    } else if (entry.full) {
      this.addMessage('bot', entry.full, false);
    }
    
    if (entry.chartData && window.chartManager) {
      this.displayChartWithData(
        entry.chartData,
        'auto',
        'Historical Data Visualization'
      );
    }
    
    if (this.elements.welcomeScreen && this.elements.messagesContainer) {
      this.elements.welcomeScreen.style.display = 'none';
      this.elements.messagesContainer.style.display = 'block';
    }
  }

  showLoading(show) {
    if (this.elements.loadingOverlay) {
      this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
    }
  }

  showToast(type, message) {
    if (!this.elements.toastContainer) return;
    
    // Remove existing toasts
    const existingToasts = this.elements.toastContainer.querySelectorAll('.toast');
    if (existingToasts.length > 3) {
      existingToasts[0].remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
    `;
    this.elements.toastContainer.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.transform = 'translateX(100%)';
        toast.style.opacity = '0';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.remove();
          }
        }, 300);
      }
    }, 4000);
  }

  updateChartType(type) {
    if (window.chartManager && window.chartManager.currentChart) {
      window.chartManager.updateChartType(type);
    }
  }

  exportChart() {
    if (window.chartManager) {
      const url = window.chartManager.exportChart();
      if (url) {
        this.showToast('success', 'Chart exported successfully');
      }
    }
  }

  resetAnalysis() {
    console.log('🔄 Resetting analysis...');
    
    if (this.elements.messagesContainer) {
      this.elements.messagesContainer.innerHTML = '';
    }
    
    if (this.elements.chartSection) {
      this.elements.chartSection.style.display = 'none';
    }
    
    if (this.elements.welcomeScreen && this.elements.messagesContainer) {
      this.elements.welcomeScreen.style.display = 'flex';
      this.elements.messagesContainer.style.display = 'none';
    }
    
    this.currentSessionId = null;
    this.currentFile = null;
    this.conversationContext = [];
    
    if (this.elements.fileIndicator) {
      this.elements.fileIndicator.style.display = 'none';
    }
    
    if (this.elements.fileInput) {
      this.elements.fileInput.value = '';
    }
    
    if (this.elements.dataInput) {
      this.elements.dataInput.value = '';
    }
    
    if (this.elements.messageInput) {
      this.elements.messageInput.value = '';
      this.elements.messageInput.style.height = 'auto';
    }
    
    if (window.chartManager) {
      window.chartManager.showNoData();
    }
    
    this.showToast('info', 'New analysis started');
  }

  installPWA() {
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('✅ User accepted the install prompt');
          this.showToast('success', 'App installed successfully!');
        }
        window.deferredPrompt = null;
      });
    }
  }

  loadSampleData() {
    const sampleData = `Date,Sales,Expenses,Profit,Region
2024-01-01,15000,8000,7000,North
2024-01-02,18000,9000,9000,South
2024-01-03,22000,11000,11000,East
2024-01-04,19000,9500,9500,West
2024-01-05,25000,12000,13000,North
2024-01-06,21000,10500,10500,South
2024-01-07,23000,11500,11500,East`;

    if (this.elements.dataInput) {
      this.elements.dataInput.value = sampleData;
    }
    this.showToast('success', 'Sample sales data loaded. Click "Analyze" to get insights!');
  }

  // TEST FUNCTION - Simple test chart
  testChart() {
    console.log('🧪 Testing chart system...');
    
    const testData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      datasets: [{
        label: 'Test Sales',
        data: [65, 59, 80, 81, 56, 55],
        backgroundColor: 'rgba(16, 163, 127, 0.8)',
        borderColor: 'rgba(16, 163, 127, 1)',
        borderWidth: 2
      }]
    };
    
    if (window.chartManager) {
      const success = this.displayChartWithData(testData, 'bar', 'Test Chart - Sales Data');
      if (success) {
        this.showToast('success', 'Test chart displayed!');
        console.log('✅ Test chart should be visible');
      } else {
        this.showToast('error', 'Failed to display test chart');
        console.log('❌ Test chart failed');
      }
    } else {
      this.showToast('error', 'Chart manager not initialized');
      console.log('❌ Chart manager not available');
    }
  }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏁 DOM loaded, initializing app...');
  
  // Clear old service worker caches
  if ('serviceWorker' in navigator) {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      console.log('🧹 Old caches cleared');
    });
  }
  
  try {
    window.app = new DataExaminerApp();
    
    // Initialize chart manager
    const chartCanvas = document.getElementById('dataChart');
    if (chartCanvas) {
      const chartManager = new ChartManager(chartCanvas);
      window.chartManager = chartManager;
      chartManager.initialize();
      console.log('📊 Chart manager initialized');
      
      // Show initial test chart after a delay
      setTimeout(() => {
        console.log('🔄 Showing initial test chart');
        const testData = {
          labels: ['Loading', 'System', 'Ready'],
          datasets: [{
            label: 'Status',
            data: [100, 75, 50],
            backgroundColor: 'rgba(16, 163, 127, 0.6)'
          }]
        };
        chartManager.updateChart(testData, 'bar', 'System Status');
        
        // Show chart section
        const chartSection = document.getElementById('chartSection');
        if (chartSection) {
          chartSection.style.display = 'block';
          chartSection.style.opacity = '1';
        }
      }, 1000);
    } else {
      console.error('❌ Chart canvas not found!');
    }
    
    // Initialize history display
    if (window.app && typeof window.app.renderHistory === 'function') {
      window.app.renderHistory();
    }
    
    // Add test function to window for debugging
    window.testChart = () => {
      if (window.app && typeof window.app.testChart === 'function') {
        window.app.testChart();
      }
    };
    
    // Add a manual sidebar toggle function for debugging
    window.toggleSidebar = (show) => {
      if (window.app && typeof window.app.toggleSidebar === 'function') {
        window.app.toggleSidebar(show);
      }
    };
    
    console.log('🚀 Data Examiner loaded!');
    console.log('🧪 Test function available: testChart()');
    console.log('🔄 Sidebar toggle available: toggleSidebar(true/false)');
    
    // Check if sidebar elements exist
    setTimeout(() => {
      console.log('🔍 Checking sidebar elements:');
      console.log('menuToggle:', document.getElementById('menuToggle') ? '✓ Found' : '✗ Missing');
      console.log('sidebarClose:', document.getElementById('sidebarClose') ? '✓ Found' : '✗ Missing');
      console.log('sidebarOverlay:', document.getElementById('sidebarOverlay') ? '✓ Found' : '✗ Missing');
      console.log('sidebar:', document.getElementById('sidebar') ? '✓ Found' : '✗ Missing');
    }, 500);
    
  } catch (error) {
    console.error('❌ Error initializing app:', error);
    alert('Error initializing app. Please check console for details.');
  }
});