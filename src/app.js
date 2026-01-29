// src/app.js — Data Examiner — main frontend logic with typewriter effects
class DataExaminerApp {
  constructor() {
    this.api = new DataExaminerAPI();
    this.currentFile = null;
    this.currentSessionId = null;
    this.conversationContext = [];
    this.isDarkMode = localStorage.getItem('darkMode') === 'true';
    this.analysisHistory = JSON.parse(localStorage.getItem('analysisHistory')) || [];
    this.currentTypingMessage = null;

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
    document.documentElement.setAttribute(
      'data-theme',
      this.isDarkMode ? 'dark' : 'light'
    );
    this.elements.themeToggle.innerHTML = this.isDarkMode
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }

  initializeEventListeners() {
    this.elements.menuToggle?.addEventListener('click', () =>
      this.elements.sidebar.classList.toggle('active')
    );
    this.elements.newChat?.addEventListener('click', () => this.resetAnalysis());

    this.elements.uploadBtn?.addEventListener('click', () =>
      this.elements.fileInput.click()
    );
    this.elements.fileInput?.addEventListener('change', e =>
      this.handleFileSelect(e)
    );
    this.elements.analyzePaste?.addEventListener('click', () =>
      this.analyzePastedData()
    );
    this.elements.clearFile?.addEventListener('click', () =>
      this.clearCurrentFile()
    );

    this.elements.quickUpload?.addEventListener('click', () =>
      this.elements.fileInput.click()
    );
    this.elements.quickPaste?.addEventListener('click', () =>
      this.elements.dataInput.focus()
    );
    this.elements.quickSample?.addEventListener('click', () =>
      this.loadSampleData()
    );

    this.elements.sendBtn?.addEventListener('click', () => this.sendMessage());
    this.elements.messageInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.elements.messageInput?.addEventListener('input', () => {
      this.elements.messageInput.style.height = 'auto';
      this.elements.messageInput.style.height =
        Math.min(this.elements.messageInput.scrollHeight, 160) + 'px';
    });

    this.elements.chartType?.addEventListener('change', e =>
      this.updateChartType(e.target.value)
    );
    this.elements.exportChart?.addEventListener('click', () =>
      this.exportChart()
    );
    this.elements.themeToggle?.addEventListener('click', () =>
      this.toggleTheme()
    );
    this.elements.installBtn?.addEventListener('click', () =>
      this.installPWA()
    );

    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err =>
          console.error('Service Worker registration failed:', err)
        );
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
      const res = await this.api.analyzeText(
        text,
        'Analyze this pasted data and create visualizations',
        this.currentSessionId
      );
      this.handleAnalysisResponse(res);
    } catch (err) {
      this.showToast('error', 'Analysis failed: ' + err.message);
    } finally {
      this.showLoading(false);
    }
  }

  async sendMessage() {
    const input = this.elements.messageInput;
    const message = input.value.trim();

    // Hide welcome screen on first message
    if (this.elements.welcomeScreen.style.display !== 'none') {
      this.elements.welcomeScreen.style.display = 'none';
      this.elements.messagesContainer.style.display = 'block';
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
        console.log('Sending follow-up question...');
        response = await this.api.chatFollowup({
          question: message,
          conversationId: this.currentSessionId
        });
      } else {
        // This is a new analysis request - need data
        // Validation: require file OR pasted data for first message
        if (!message && !this.currentFile && !this.elements.dataInput?.value.trim()) {
          throw new Error('Please type a question or upload/paste data');
        }

        // Case 1: File upload
        if (this.currentFile) {
          console.log('Analyzing file...');
          response = await this.api.analyzeFile(
            this.currentFile,
            message || 'Analyze this data and create visualizations',
            this.currentSessionId
          );
          this.currentFile = null;
          this.elements.fileIndicator.style.display = 'none';
        } 
        // Case 2: Pasted data
        else if (this.elements.dataInput?.value.trim()) {
          console.log('Analyzing pasted data...');
          response = await this.api.analyzeText(
            this.elements.dataInput.value.trim(),
            message || 'Analyze this data and create visualizations',
            this.currentSessionId
          );
          this.elements.dataInput.value = '';
        } else {
          // Case 3: Just a question without data (use follow-up logic)
          throw new Error('Please upload data or paste data first, then ask questions');
        }
      }

      console.log('Response received:', {
        success: response.success,
        hasChartData: !!response.chartData,
        chartType: response.chartType,
        conversationId: response.conversationId
      });

      this.currentSessionId = response.conversationId;
      this.handleAnalysisResponse(response);
    } catch (err) {
      console.error('Send message error:', err);
      this.addMessage(
        'bot',
        `**Error**\n\n${err.message || 'Something went wrong. Try again.'}`,
        false // No typewriter for errors
      );
      
      // Show specific error message
      let toastMessage = err.message || 'Analysis failed';
      if (toastMessage.includes('404')) {
        toastMessage = 'Server endpoint not found. Please restart the server.';
      } else if (toastMessage.includes('No active analysis session')) {
        toastMessage = 'Please upload data or paste data first, then ask questions';
      }
      
      this.showToast('error', toastMessage);
    } finally {
      this.showLoading(false);
      input.focus();
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
    
    this.elements.messagesContainer.appendChild(messageDiv);
    this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    
    // Parse the AI response and create beautiful HTML
    const formattedResponse = this.createBeautifulResponseFromMarkdown(res.analysis);
    
    // Start typewriter effect
    this.currentTypingMessage = messageDiv;
    await this.typewriterEffect(messageDiv.querySelector('.message-content'), formattedResponse);

    // Store AI response in conversation context
    this.conversationContext.push({
      role: 'assistant',
      content: res.analysis,
      timestamp: new Date().toISOString()
    });

    // Show chart if AI provided data
    if (res.chartData && window.chartManager) {
      console.log('Displaying chart with data:', res.chartData);
      try {
        window.chartManager.updateChart(
          res.chartData,
          res.chartType || 'auto',
          res.chartTitle || 'Data Visualization'
        );
        this.elements.chartSection.style.display = 'block';
        this.elements.chartSection.style.opacity = '1';
        
        // Update chart type selector if needed
        if (res.chartType && this.elements.chartType) {
          this.elements.chartType.value = res.chartType;
        }
        
        // Scroll to chart if it's significant
        setTimeout(() => {
          this.elements.chartSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 500);
        
      } catch (chartError) {
        console.error('Chart rendering error:', chartError);
        this.showToast('error', 'Could not display chart. ' + chartError.message);
      }
    } else if (window.chartManager) {
      console.log('No chart data provided in response');
      // You can optionally ask AI to generate a chart
      this.askForChartIfNeeded(res);
    }

    this.saveToHistory(res);
  }

  debugChartData(data) {
    console.log('📊 Chart Data Debug:', {
      hasChartData: !!data.chartData,
      chartDataStructure: data.chartData,
      labels: data.chartData?.labels,
      datasetsCount: data.chartData?.datasets?.length,
      chartTitle: data.chartTitle,
      chartType: data.chartType,
      conversationId: data.conversationId
    });
    
    // Show a toast if no chart data
    if (!data.chartData) {
      console.log('No chart data found in response');
    }
  }

  askForChartIfNeeded(response) {
    // Optionally ask AI to generate a chart for the data
    const chartKeywords = ['chart', 'graph', 'visualization', 'visualize', 'plot', 'diagram'];
    const analysisText = response.analysis.toLowerCase();
    
    if (chartKeywords.some(keyword => analysisText.includes(keyword))) {
      // User mentioned charts, but AI didn't provide one
      setTimeout(() => {
        this.showToast('info', 'Chart requested but not generated. Try asking specifically: "Create a bar chart of the data"');
      }, 2000);
    }
  }

  // Typewriter effect function
  async typewriterEffect(element, content, speed = 20) {
    element.classList.remove('typing');
    element.innerHTML = '';
    
    let i = 0;
    let inTag = false;
    let tagContent = '';
    
    const typeChar = () => {
      if (i < content.length) {
        // Check if we're entering or exiting an HTML tag
        if (content.charAt(i) === '<') {
          inTag = true;
          tagContent = '<';
        } else if (content.charAt(i) === '>' && inTag) {
          inTag = false;
          tagContent += '>';
          element.innerHTML += tagContent;
          tagContent = '';
        } else if (inTag) {
          tagContent += content.charAt(i);
        } else {
          element.innerHTML += content.charAt(i);
        }
        
        i++;
        
        // Scroll to bottom as content grows
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        
        // Adjust speed based on character type
        const currentSpeed = content.charAt(i) === ' ' ? speed / 2 : speed;
        setTimeout(typeChar, currentSpeed);
      } else {
        this.currentTypingMessage = null;
      }
    };
    
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (i >= content.length) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
      typeChar();
    });
  }

  // Parse markdown to structured data
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

      // Check for main overview heading
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
      }
      // Check for Key Metrics heading
      else if (line.startsWith('## Key Metrics')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'metrics';
      }
      // Check for Key Insights heading
      else if (line.startsWith('## Key Insights')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'insights';
      }
      // Check for Recommendations heading
      else if (line.startsWith('## Recommendations')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'recommendations';
      }
      // Check for Key Finding heading
      else if (line.startsWith('## Key Finding')) {
        if (currentContent) {
          sections.rawSections.push({
            type: 'paragraph',
            content: currentContent.trim(),
            title: currentSection
          });
          currentContent = '';
        }
        currentSection = 'key finding';
      }
      // Parse metrics (Key: Value format)
      else if (currentSection === 'metrics' && line.includes(':')) {
        const [label, value] = line.split(':').map(s => s.trim());
        sections.metrics.push({ label, value });
      }
      // Parse insights (bullet points)
      else if (currentSection === 'insights' && line.startsWith('-')) {
        const insight = line.replace(/^-\s*/, '').trim();
        if (insight) sections.insights.push(insight);
      }
      // Parse recommendations (numbered list)
      else if (currentSection === 'recommendations' && line.match(/^\d+\./)) {
        const rec = line.replace(/^\d+\.\s*/, '').trim();
        if (rec) sections.recommendations.push(rec);
      }
      // Parse key finding (paragraph after heading)
      else if (currentSection === 'key finding' && line && !line.startsWith('#')) {
        sections.keyFindings.push(line);
        currentSection = ''; // Reset after capturing
      }
      // Skip code blocks
      else if (line.startsWith('```')) {
        while (i < lines.length && !lines[i].includes('```')) {
          i++;
        }
      }
      // Capture other content
      else if (line && !line.startsWith('##') && !line.startsWith('#')) {
        currentContent += line + ' ';
      }
    }

    // Add any remaining content
    if (currentContent) {
      sections.rawSections.push({
        type: 'paragraph',
        content: currentContent.trim(),
        title: currentSection
      });
    }

    return sections;
  }

  // Create beautiful HTML response from markdown - UPDATED VERSION
  createBeautifulResponseFromMarkdown(markdown) {
    // First, check if this is already formatted HTML
    if (markdown.includes('<div class="ai-summary">')) {
      return markdown; // Already formatted, return as-is
    }
    
    // Try to parse as structured data
    const structuredData = this.parseMarkdownToStructuredData(markdown);
    
    // Check if we got any structured data
    if (structuredData.overview || 
        structuredData.metrics.length > 0 || 
        structuredData.insights.length > 0) {
      return this.createBeautifulHTML(structuredData);
    } else {
      // Fallback: format as plain text with basic styling
      return `<div class="message-content-plain">${this.formatMarkdown(markdown)}</div>`;
    }
  }

  // Create beautiful HTML from structured data
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
    
    // Overview - FIXED to always show even if empty
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
      // Use first insight as key finding if none provided
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
      this.elements.messagesContainer.appendChild(messageDiv);
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      
      // Store user message in conversation context
      this.conversationContext.push({
        role: 'user',
        content: content,
        timestamp: new Date().toISOString()
      });
    } else if (!useTypewriter) {
      // For errors or non-typing messages
      messageDiv.innerHTML = `
        <div class="message-avatar">AI</div>
        <div class="message-content">${this.formatMarkdown(content)}</div>
      `;
      this.elements.messagesContainer.appendChild(messageDiv);
      this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      
      // Store AI response in conversation context
      this.conversationContext.push({
        role: 'assistant',
        content: content,
        timestamp: new Date().toISOString()
      });
    }
    // Bot messages with typewriter are handled in handleAnalysisResponse
  }

  formatMarkdown(text) {
    // Simple markdown formatter for user messages
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
    // Implementation for history rendering
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
    
    // Replay the conversation
    if (this.conversationContext.length > 0) {
      this.conversationContext.forEach(msg => {
        if (msg.role === 'user') {
          this.addMessage('user', msg.content, false);
        } else if (msg.role === 'assistant') {
          this.addMessage('bot', msg.content, false);
        }
      });
    } else if (entry.full) {
      // Fallback: just show the analysis
      this.addMessage('bot', entry.full, false);
    }
    
    // Load chart if available
    if (entry.chartData && window.chartManager) {
      window.chartManager.updateChart(
        entry.chartData,
        'auto',
        'Historical Data Visualization'
      );
      this.elements.chartSection.style.display = 'block';
    }
    
    this.elements.welcomeScreen.style.display = 'none';
    this.elements.messagesContainer.style.display = 'block';
  }

  showLoading(show) {
    this.elements.loadingOverlay.style.display = show ? 'flex' : 'none';
  }

  showToast(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
    `;
    this.elements.toastContainer.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 4000);
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
    this.elements.messagesContainer.style.display = 'none';
    this.currentSessionId = null;
    this.currentFile = null;
    this.conversationContext = [];
    this.elements.fileIndicator.style.display = 'none';
    this.elements.fileInput.value = '';
    this.elements.dataInput.value = '';
    this.elements.messageInput.value = '';
    this.elements.messageInput.style.height = 'auto';
    
    // Reset chart
    if (window.chartManager) {
      window.chartManager.showNoData();
    }
  }

  installPWA() {
    // Check if PWA is installable
    if (window.deferredPrompt) {
      window.deferredPrompt.prompt();
      window.deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
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

    this.elements.dataInput.value = sampleData;
    this.showToast('success', 'Sample sales data loaded. Click "Analyze" to get insights!');
  }

  // Test chart functionality
  testChartDisplay() {
    const testChartData = {
      labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
      datasets: [{
        label: 'Sales 2024',
        data: [65, 59, 80, 81, 56, 55, 40],
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)',
          'rgba(255, 159, 64, 0.2)',
          'rgba(255, 205, 86, 0.2)',
          'rgba(75, 192, 192, 0.2)',
          'rgba(54, 162, 235, 0.2)',
          'rgba(153, 102, 255, 0.2)',
          'rgba(201, 203, 207, 0.2)'
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(255, 205, 86)',
          'rgb(75, 192, 192)',
          'rgb(54, 162, 235)',
          'rgb(153, 102, 255)',
          'rgb(201, 203, 207)'
        ],
        borderWidth: 1
      }]
    };
    
    // Update chart
    if (window.chartManager) {
      window.chartManager.updateChart(
        testChartData,
        'bar',
        'Test Sales Data'
      );
      
      // Show chart section
      this.elements.chartSection.style.display = 'block';
      this.elements.chartSection.style.opacity = '1';
      this.showToast('success', 'Test chart displayed!');
      
      // Also show a test analysis
      this.addMessage('bot', '**Test Analysis Complete**\n\nThis is a test chart to verify chart display functionality. The chart shows sample sales data for 2024.', false);
    } else {
      this.showToast('error', 'Chart manager not initialized');
    }
  }
}

// Initialize the app
let chartManager;

document.addEventListener('DOMContentLoaded', () => {
  window.app = new DataExaminerApp();
  
  // Initialize chart manager
  const chartCanvas = document.getElementById('dataChart');
  if (chartCanvas) {
    chartManager = new ChartManager(chartCanvas);
    window.chartManager = chartManager;
    chartManager.initialize();
    console.log('Chart manager initialized');
  } else {
    console.error('Chart canvas not found!');
  }
  
  // Initialize history display
  window.app.renderHistory();
  
  // Check for PWA install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.deferredPrompt = e;
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
      installBtn.style.display = 'flex';
      installBtn.addEventListener('click', () => window.app.installPWA());
    }
  });
  
  // Add test functionality to window for debugging
  window.testChart = () => window.app.testChartDisplay();
  console.log('Test functions: testChart() available in console');
});