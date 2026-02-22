// src/app.js — Data Examiner — COMPLETE WITH AUTHENTICATION
// COMPLETED VERSION - All methods properly implemented

class ChartToggleManager {
    constructor() {
        this.chartSection = document.getElementById('chartSection');
        this.toggleBtn = document.getElementById('chartToggleBtn');
        this.isCollapsed = false;
        
        if (this.chartSection && this.toggleBtn) {
            console.log('📊 Chart toggle manager initialized');
            this.initialize();
        } else {
            console.error('❌ Chart section or toggle button not found!');
        }
    }
    
    initialize() {
        const savedState = localStorage.getItem('chartSectionCollapsed');
        if (savedState !== null) {
            this.isCollapsed = savedState === 'true';
        } else {
            this.isCollapsed = false;
        }
        
        this.applyState();
        
        this.toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔄 Chart toggle clicked, current state:', this.isCollapsed);
            this.toggle();
        });
        
        this.toggleBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        });
        
        this.chartSection.style.display = 'block';
        
        console.log('📊 Chart toggle manager ready, initial state:', this.isCollapsed ? 'collapsed' : 'expanded');
    }
    
    toggle() {
        this.isCollapsed = !this.isCollapsed;
        this.applyState();
        
        localStorage.setItem('chartSectionCollapsed', this.isCollapsed);
        
        const event = new CustomEvent('chartToggle', { 
            detail: { collapsed: this.isCollapsed } 
        });
        document.dispatchEvent(event);
        
        console.log('📊 Chart toggled:', this.isCollapsed ? 'collapsed' : 'expanded');
    }
    
    applyState() {
        if (this.isCollapsed) {
            this.chartSection.classList.add('collapsed');
            this.toggleBtn.classList.add('collapsed');
            this.toggleBtn.querySelector('span').textContent = 'Show Chart';
            this.toggleBtn.setAttribute('aria-label', 'Show chart');
        } else {
            this.chartSection.classList.remove('collapsed');
            this.toggleBtn.classList.remove('collapsed');
            this.toggleBtn.querySelector('span').textContent = 'Hide Chart';
            this.toggleBtn.setAttribute('aria-label', 'Hide chart');
        }
        
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 350);
    }
}

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
    
    this.currentChartData = null;
    this.currentChartType = 'auto';
    this.currentChartTitle = 'Data Visualization';

    this.elements = {};
    this.initializeElements();
    
    // Check authentication first
    if (!this.checkAuthentication()) {
      return; // Stop initialization if not authenticated
    }
    
    this.applyTheme();
    this.initializeEventListeners();
    this.registerServiceWorker();
    this.checkFirstVisit();
    this.setupLogout(); // Setup logout button
    this.renderHistory(); // Render history after initialization
    
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
      'themeToggle', 'toastContainer', 'testChartBtn', 'clearAllHistory', 'logoutBtn'
    ];

    ids.forEach(id => {
      this.elements[id] = document.getElementById(id);
      if (!this.elements[id] && id !== 'testChartBtn' && id !== 'clearAllHistory' && id !== 'logoutBtn') {
        console.warn(`⚠️ Element ${id} not found`);
      }
    });
  }

  // Check authentication and redirect if needed
  checkAuthentication() {
    const currentUser = localStorage.getItem('currentUser');
    const currentPath = window.location.pathname;
    
    // If on login page and already logged in, redirect to main app
    if (currentPath === '/login' && currentUser) {
      window.location.href = '/';
      return false;
    }
    
    // If on main app and not logged in, redirect to login
    if (currentPath === '/' && !currentUser) {
      window.location.href = '/login';
      return false;
    }
    
    // Display user info if logged in
    if (currentUser && currentPath === '/') {
      const user = JSON.parse(currentUser);
      console.log(`👤 Logged in as: ${user.email}`);
      this.addUserIndicator(user);
    }
    
    return true;
  }

  // Add user indicator to header
  addUserIndicator(user) {
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !document.querySelector('.user-indicator')) {
      const userIndicator = document.createElement('div');
      userIndicator.className = 'user-indicator';
      userIndicator.innerHTML = `
        <i class="fas fa-user-circle"></i>
        <span class="user-email">${user.name || user.email.split('@')[0]}</span>
      `;
      headerRight.insertBefore(userIndicator, headerRight.firstChild);
    }
  }

  // Setup logout button
  setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
    } else {
      // Create logout button if it doesn't exist
      this.createLogoutButton();
    }
  }

  // Create logout button if not in HTML
  createLogoutButton() {
    const headerRight = document.querySelector('.header-right');
    if (headerRight && !document.getElementById('logoutBtn')) {
      const logoutBtn = document.createElement('button');
      logoutBtn.id = 'logoutBtn';
      logoutBtn.className = 'logout-btn';
      logoutBtn.title = 'Logout';
      logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.logout();
      });
      
      // Add before theme toggle
      const themeToggle = document.getElementById('themeToggle');
      if (themeToggle) {
        headerRight.insertBefore(logoutBtn, themeToggle);
      } else {
        headerRight.appendChild(logoutBtn);
      }
    }
  }

  // Logout function
  logout() {
    // Clear user session
    localStorage.removeItem('currentUser');
    
    // Show confirmation
    if (this.showToast) {
      this.showToast('success', 'Logged out successfully');
    }
    
    // Redirect to login page
    setTimeout(() => {
      window.location.href = '/login';
    }, 500);
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
    
    document.addEventListener('chartToggle', (e) => {
        console.log(`Chart ${e.detail.collapsed ? 'collapsed' : 'expanded'}`);
        
        if (!e.detail.collapsed && window.chartManager && this.currentChartData) {
            setTimeout(() => {
                window.chartManager.updateChart(
                    this.currentChartData,
                    this.currentChartType || 'auto',
                    this.currentChartTitle || 'Data Visualization'
                );
            }, 300);
        }
    });
    
    // Keyboard shortcut for menu toggle (Alt+M)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'm') {
            e.preventDefault();
            this.toggleSidebar();
        }
    });
    
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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSidebarOpen) {
        console.log('⎋ Escape pressed, closing sidebar');
        this.toggleSidebar(false);
      }
    });

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

    // Clear all history button
    if (this.elements.clearAllHistory) {
      this.elements.clearAllHistory.addEventListener('click', () => this.showClearAllConfirmation());
    }

    window.addEventListener('online', () => this.updateOnlineStatus(true));
    window.addEventListener('offline', () => this.updateOnlineStatus(false));
    
    console.log('✅ Event listeners initialized');
  }

  // Check if first visit and show hints
  checkFirstVisit() {
    if (!localStorage.getItem('visited')) {
        setTimeout(() => {
            // Pulse the menu button
            const menuBtn = this.elements.menuToggle;
            if (menuBtn) {
                menuBtn.classList.add('pulse');
                setTimeout(() => {
                    menuBtn.classList.remove('pulse');
                }, 8000);
            }
            
            // Show welcome hint and arrow
            const welcomeHint = document.getElementById('welcomeHint');
            const menuArrow = document.getElementById('menuArrow');
            
            if (welcomeHint) {
                welcomeHint.style.display = 'flex';
            }
            
            if (menuArrow) {
                menuArrow.style.display = 'block';
            }
            
            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (welcomeHint) {
                    welcomeHint.style.animation = 'fadeOut 0.5s ease forwards';
                    setTimeout(() => {
                        if (welcomeHint && welcomeHint.parentNode) {
                            welcomeHint.remove();
                        }
                    }, 500);
                }
                if (menuArrow && menuArrow.parentNode) {
                    menuArrow.remove();
                }
            }, 10000);
            
            localStorage.setItem('visited', 'true');
        }, 1500);
    } else {
        // For returning users, still show the hint but for shorter time
        setTimeout(() => {
            const welcomeHint = document.getElementById('welcomeHint');
            const menuArrow = document.getElementById('menuArrow');
            
            if (welcomeHint) {
                welcomeHint.style.display = 'flex';
                setTimeout(() => {
                    welcomeHint.style.animation = 'fadeOut 0.5s ease forwards';
                    setTimeout(() => {
                        if (welcomeHint && welcomeHint.parentNode) {
                            welcomeHint.remove();
                        }
                    }, 500);
                }, 3000);
            }
            
            if (menuArrow) {
                menuArrow.style.display = 'block';
                setTimeout(() => {
                    if (menuArrow && menuArrow.parentNode) {
                        menuArrow.remove();
                    }
                }, 3000);
            }
        }, 1000);
    }
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
    
    if (this.elements.welcomeScreen && this.elements.messagesContainer) {
      if (this.elements.welcomeScreen.style.display !== 'none') {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.messagesContainer.style.display = 'block';
      }
    }

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
      
      this.currentSessionId = res.conversationId;
      this.handleAnalysisResponse(res);
      
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

    if (this.elements.welcomeScreen && this.elements.messagesContainer) {
      if (this.elements.welcomeScreen.style.display !== 'none') {
        this.elements.welcomeScreen.style.display = 'none';
        this.elements.messagesContainer.style.display = 'block';
      }
    }

    this.addMessage('user', message);

    input.value = '';
    input.style.height = 'auto';
    this.showLoading(true);

    try {
      let response;

      if (this.currentSessionId) {
        console.log('🔄 Sending follow-up question...');
        response = await this.api.chatFollowup({
          question: message,
          conversationId: this.currentSessionId
        });
      } else {
        if (!this.currentFile && !(this.elements.dataInput?.value.trim())) {
          this.showToast('warning', 'Please upload data or paste data first, then ask questions');
          this.showLoading(false);
          return;
        }

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

    this.debugChartData(res);

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
    
    const formattedResponse = this.createBeautifulResponseFromMarkdown(res.analysis);
    
    setTimeout(() => {
      const contentElement = messageDiv.querySelector('.message-content');
      contentElement.classList.remove('typing');
      contentElement.innerHTML = formattedResponse;
      
      if (this.elements.messagesContainer) {
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
      }

      this.conversationContext.push({
        role: 'assistant',
        content: res.analysis,
        timestamp: new Date().toISOString()
      });

      if (res.chartData && window.chartManager) {
        console.log('🔄 Attempting to display chart with AI data');
        
        if (this.elements.chartSection) {
          this.elements.chartSection.style.display = 'block';
          this.elements.chartSection.style.opacity = '1';
        }
        
        const success = this.displayChartWithData(
          res.chartData,
          res.chartType || 'auto',
          res.chartTitle || 'Data Visualization'
        );
        
        if (!success) {
          console.log('📭 Chart display failed, showing fallback');
          window.chartManager.showNoData();
        }
        
        if (res.chartType && this.elements.chartType) {
          this.elements.chartType.value = res.chartType;
        }
        
      } else if (window.chartManager) {
        console.log('📭 No chart data provided in AI response');
        window.chartManager.showNoData();
        if (this.elements.chartSection) {
          this.elements.chartSection.style.display = 'block';
          this.elements.chartSection.style.opacity = '1';
        }
      }

      this.saveToHistory(res);
    }, 800);
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
    this.currentChartData = chartData;
    this.currentChartType = chartType;
    this.currentChartTitle = chartTitle;
    
    if (!window.chartManager) {
      console.error('❌ Chart manager not available');
      return false;
    }

    console.log('📈 Displaying chart:', { chartType, chartTitle });

    if (!chartData || !chartData.datasets || !Array.isArray(chartData.datasets) || chartData.datasets.length === 0) {
      console.error('❌ Invalid chart data');
      return false;
    }

    if (!chartData.labels || !Array.isArray(chartData.labels)) {
      console.warn('⚠️ No labels provided, generating default labels');
      chartData.labels = chartData.datasets[0].data.map((_, i) => `Item ${i + 1}`);
    }

    try {
      if (!window.chartToggle || !window.chartToggle.isCollapsed) {
        const success = window.chartManager.updateChart(chartData, chartType, chartTitle);
        
        if (success) {
          console.log('✅ Chart displayed successfully');
          if (this.elements.chartSection) {
            this.elements.chartSection.style.display = 'block';
            this.elements.chartSection.style.opacity = '1';
          }
          return true;
        } else {
          console.error('❌ Chart update returned false');
          return false;
        }
      } else {
        console.log('Chart is collapsed, data stored for later display');
        return true;
      }
    } catch (error) {
      console.error('❌ Error displaying chart:', error);
      return false;
    }
  }

  updateChartType(type) {
    if (window.chartManager) {
        if (window.chartManager.currentChart && this.currentChartData) {
            const success = window.chartManager.updateChart(
                this.currentChartData,
                type,
                this.currentChartTitle || 'Data Visualization'
            );
            
            if (!success) {
                this.showToast('error', 'Failed to update chart type');
            } else {
                console.log('Chart type updated to:', type);
            }
        } else {
            this.showToast('warning', 'No chart data available to change type');
        }
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
    
    html += `
      <div class="summary-header">
        <div class="summary-icon">
          <i class="fas fa-chart-bar"></i>
        </div>
        <h2 class="summary-title">Data Analysis Summary</h2>
      </div>
    `;
    
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
      preview: res.analysis ? (res.analysis.replace(/#/g, '').replace(/\*\*/g, '').substring(0, 120) + '...') : 'No analysis',
      full: res.analysis,
      chartData: res.chartData,
      sessionId: this.currentSessionId,
      conversationContext: [...this.conversationContext]
    };
    
    this.analysisHistory.unshift(entry);
    
    // Keep only last 30 items
    if (this.analysisHistory.length > 30) {
      this.analysisHistory = this.analysisHistory.slice(0, 30);
    }
    
    localStorage.setItem('analysisHistory', JSON.stringify(this.analysisHistory));
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

    this.analysisHistory.forEach((entry, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.setAttribute('data-index', index);
      
      // Format date nicely
      const date = new Date(entry.timestamp);
      const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      // Truncate preview if too long
      const preview = entry.preview.length > 60 ? entry.preview.substring(0, 60) + '...' : entry.preview;
      
      // Create content div
      const contentDiv = document.createElement('div');
      contentDiv.className = 'history-item-content';
      contentDiv.innerHTML = `
        <div class="history-title">${preview}</div>
        <div class="history-date">${formattedDate}</div>
        ${entry.chartData ? '<div class="history-has-chart"><i class="fas fa-chart-bar"></i></div>' : ''}
      `;
      
      // Create delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'history-delete-btn';
      deleteBtn.title = 'Delete this analysis';
      deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
      
      // Add click handlers with proper event propagation stopping
      contentDiv.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.loadHistoryItem(index);
      });
      
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        this.showDeleteConfirmation(index, e);
      });
      
      historyItem.appendChild(contentDiv);
      historyItem.appendChild(deleteBtn);
      historyList.appendChild(historyItem);
    });
  }

  showDeleteConfirmation(index, event) {
    // Stop event propagation to prevent triggering any parent clicks
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    console.log(`🗑️ Showing delete confirmation for history item at index: ${index}`);
    
    // Create confirmation toast
    const toastId = 'delete-confirm-' + Date.now();
    const toast = document.createElement('div');
    toast.className = 'toast warning confirmation-toast';
    toast.id = toastId;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="toast-message">Delete this analysis from history?</div>
      </div>
      <div class="toast-actions">
        <button class="toast-btn confirm-btn" id="confirm-${toastId}">
          <i class="fas fa-check"></i> Yes, Delete
        </button>
        <button class="toast-btn cancel-btn" id="cancel-${toastId}">
          <i class="fas fa-times"></i> Cancel
        </button>
      </div>
    `;
    
    // Add to toast container
    this.elements.toastContainer.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);
    
    // Handle confirmation
    const confirmBtn = document.getElementById(`confirm-${toastId}`);
    const cancelBtn = document.getElementById(`cancel-${toastId}`);
    
    confirmBtn.addEventListener('click', () => {
      // Remove confirmation toast
      toast.remove();
      
      console.log(`🗑️ User confirmed deletion of history item at index: ${index}`);
      
      // Add animation class
      const historyItems = document.querySelectorAll('.history-item');
      if (historyItems[index]) {
        historyItems[index].classList.add('removing');
      }
      
      // Remove after animation
      setTimeout(() => {
        // Remove the item from the array
        this.analysisHistory.splice(index, 1);
        
        // Update localStorage
        localStorage.setItem('analysisHistory', JSON.stringify(this.analysisHistory));
        
        // Re-render the history list
        this.renderHistory();
        
        // Show success toast
        this.showToast('success', 'Analysis removed from history');
      }, 200);
    });
    
    cancelBtn.addEventListener('click', () => {
      toast.remove();
      console.log('❌ User cancelled deletion');
      this.showToast('info', 'Deletion cancelled');
    });
    
    // Auto-remove after 10 seconds if no action
    setTimeout(() => {
      const toastElement = document.getElementById(toastId);
      if (toastElement && toastElement.parentNode) {
        toastElement.remove();
      }
    }, 10000);
  }

  showClearAllConfirmation() {
    if (this.analysisHistory.length === 0) {
      this.showToast('info', 'No history to clear');
      return;
    }
    
    console.log('🗑️ Showing clear all confirmation');
    
    // Create confirmation toast
    const toastId = 'clearall-confirm-' + Date.now();
    const toast = document.createElement('div');
    toast.className = 'toast warning confirmation-toast';
    toast.id = toastId;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon"><i class="fas fa-exclamation-triangle"></i></div>
        <div class="toast-message">Delete ALL analysis history? This cannot be undone.</div>
      </div>
      <div class="toast-actions">
        <button class="toast-btn confirm-btn" id="confirm-${toastId}">
          <i class="fas fa-check"></i> Yes, Clear All
        </button>
        <button class="toast-btn cancel-btn" id="cancel-${toastId}">
          <i class="fas fa-times"></i> Cancel
        </button>
      </div>
    `;
    
    // Add to toast container
    this.elements.toastContainer.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);
    
    // Handle confirmation
    const confirmBtn = document.getElementById(`confirm-${toastId}`);
    const cancelBtn = document.getElementById(`cancel-${toastId}`);
    
    confirmBtn.addEventListener('click', () => {
      // Remove confirmation toast
      toast.remove();
      
      console.log('🗑️ User confirmed clear all history');
      
      // Add animation class to all items
      const historyItems = document.querySelectorAll('.history-item');
      historyItems.forEach(item => {
        item.classList.add('removing');
      });
      
      // Clear after animation
      setTimeout(() => {
        this.analysisHistory = [];
        localStorage.setItem('analysisHistory', JSON.stringify([]));
        this.renderHistory();
        this.showToast('success', 'All history cleared');
      }, 200);
    });
    
    cancelBtn.addEventListener('click', () => {
      toast.remove();
      console.log('❌ User cancelled clear all');
      this.showToast('info', 'Clear all cancelled');
    });
    
    // Auto-remove after 10 seconds if no action
    setTimeout(() => {
      const toastElement = document.getElementById(toastId);
      if (toastElement && toastElement.parentNode) {
        toastElement.remove();
      }
    }, 10000);
  }

  loadHistoryItem(index) {
    const entry = this.analysisHistory[index];
    if (entry) {
      console.log(`📂 Loading history item at index: ${index}`);
      this.loadFromHistory(entry);
      
      // Close sidebar on mobile after loading
      if (window.innerWidth <= 768) {
        this.toggleSidebar(false);
      }
    }
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

  showToast(type, message, duration = 4000) {
    if (!this.elements.toastContainer) return;
    
    const existingToasts = this.elements.toastContainer.querySelectorAll('.toast:not(.confirmation-toast)');
    if (existingToasts.length > 3) {
      existingToasts[0].remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon"><i class="fas fa-${icon}"></i></div>
        <div class="toast-message">${message}</div>
      </div>
    `;
    
    this.elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.transform = 'translateX(0)';
      toast.style.opacity = '1';
    }, 10);
    
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
    }, duration);
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
    this.currentChartData = null;
    this.currentChartType = 'auto';
    this.currentChartTitle = 'Data Visualization';
    
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

  // COMPLETED testChart method
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
        console.log('✅ Test chart should be visible');
        this.showToast('success', 'Test chart displayed successfully');
      } else {
        console.log('❌ Test chart failed');
        this.showToast('error', 'Test chart failed to display');
      }
    } else {
      console.log('❌ Chart manager not available');
      this.showToast('error', 'Chart manager not initialized');
    }
  }
}

// Global helper functions
window.testChartToggle = function() {
    if (window.chartToggle) {
        console.log('Testing chart toggle...');
        window.chartToggle.toggle();
    } else {
        console.error('Chart toggle not initialized!');
    }
};

window.forceChartVisible = function() {
    const chartSection = document.getElementById('chartSection');
    if (chartSection) {
        chartSection.style.display = 'block';
        chartSection.classList.remove('collapsed');
        console.log('Chart section forced visible');
    }
    
    const welcomeScreen = document.getElementById('welcomeScreen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
        console.log('Welcome screen forced visible');
    }
    
    const toggleBtn = document.getElementById('chartToggleBtn');
    if (toggleBtn) {
        toggleBtn.classList.remove('collapsed');
        toggleBtn.querySelector('span').textContent = 'Hide Chart';
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🏁 DOM loaded, initializing app...');
  
  // Check if we're on the main app page (not login)
  if (window.location.pathname !== '/login') {
    
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
      const chartSection = document.getElementById('chartSection');
      if (chartSection) {
        chartSection.style.display = 'block';
      }
      
      const welcomeScreen = document.getElementById('welcomeScreen');
      if (welcomeScreen) {
        welcomeScreen.style.display = 'flex';
      }
      
      window.chartToggle = new ChartToggleManager();
      
      window.app = new DataExaminerApp();
      
      const chartCanvas = document.getElementById('dataChart');
      if (chartCanvas) {
        const chartManager = new ChartManager(chartCanvas);
        window.chartManager = chartManager;
        chartManager.initialize();
        console.log('📊 Chart manager initialized');
        
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
        }, 1000);
      } else {
        console.error('❌ Chart canvas not found!');
      }
      
      if (window.app && typeof window.app.renderHistory === 'function') {
        window.app.renderHistory();
      }
      
      window.testChart = () => {
        if (window.app && typeof window.app.testChart === 'function') {
          window.app.testChart();
        }
      };
      
      window.toggleSidebar = (show) => {
        if (window.app && typeof window.app.toggleSidebar === 'function') {
          window.app.toggleSidebar(show);
        }
      };
      
      console.log('🚀 Data Examiner loaded!');
      console.log('🧪 Test functions available:');
      console.log('   - testChart() - Show test chart');
      console.log('   - testChartToggle() - Test chart slide');
      console.log('   - forceChartVisible() - Reset visibility');
      console.log('   - toggleSidebar() - Toggle sidebar');
      
      console.log('📊 Chart toggle state:', window.chartToggle ? window.chartToggle.isCollapsed : 'not initialized');
      
    } catch (error) {
      console.error('❌ Error initializing app:', error);
    }
  }
});

// Add CSS for logout button (add this to your styles.css or keep in app.js)
const logoutButtonStyle = document.createElement('style');
logoutButtonStyle.textContent = `
  .logout-btn {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-full);
    background: var(--bg-tertiary);
    border: none;
    color: var(--text-secondary);
    font-size: var(--font-size-lg);
    cursor: pointer;
    transition: all var(--transition-base);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
  }
  
  .logout-btn:hover {
    background: var(--accent-color);
    color: white;
    transform: rotate(180deg);
  }
  
  .user-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-right: 8px;
  }
  
  .user-indicator i {
    color: var(--primary-color);
    font-size: var(--font-size-lg);
  }
  
  .user-email {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  @media (max-width: 768px) {
    .user-email {
      display: none;
    }
    
    .user-indicator {
      padding: 4px 8px;
    }
  }
`;
document.head.appendChild(logoutButtonStyle);