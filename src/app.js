import FileAnalyzer from './src/file-analyzer.js';
import ChartManager from './src/chart.js';
import API from './src/api.js';

class ChatApplication {
    constructor() {
        this.initializeElements();
        this.initializeEventListeners();
        this.setupServiceWorker();
        this.loadHistory();
        this.chart = null;
        this.currentFile = null;
        this.currentDataType = null;
        
        // Initialize modules
        this.fileAnalyzer = new FileAnalyzer();
        this.api = new API();
        
        // Initialize chart
        this.chartManager = new ChartManager(this.elements.chartCanvas);
        this.chartManager.initialize();
    }

    initializeElements() {
        // DOM Elements
        this.elements = {
            chatContainer: document.getElementById('chatContainer'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendMessage'),
            fileInput: document.getElementById('fileInput'),
            attachButton: document.getElementById('attachFile'),
            filePreview: document.getElementById('filePreview'),
            dataInput: document.getElementById('dataInput'),
            analyzePaste: document.getElementById('analyzePaste'),
            newChat: document.getElementById('newChat'),
            installBtn: document.getElementById('installBtn'),
            menuBtn: document.getElementById('menuBtn'),
            sidebar: document.querySelector('.sidebar'),
            loadingModal: document.getElementById('loadingModal'),
            chartCanvas: document.getElementById('dataChart'),
            chartContainer: document.getElementById('chartContainer'),
            analysisHistory: document.getElementById('analysisHistory')
        };

        // Install prompt
        this.deferredPrompt = null;
    }

    initializeEventListeners() {
        // Send message on button click
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());

        // Send message on Enter (with Shift for new line)
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        this.elements.messageInput.addEventListener('input', () => {
            this.elements.messageInput.style.height = 'auto';
            this.elements.messageInput.style.height = Math.min(this.elements.messageInput.scrollHeight, 120) + 'px';
        });

        // File attachment
        this.elements.attachButton.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Analyze pasted data
        this.elements.analyzePaste.addEventListener('click', () => this.analyzePastedData());

        // New chat
        this.elements.newChat.addEventListener('click', () => this.clearChat());

        // Install button
        this.elements.installBtn.addEventListener('click', () => this.installPWA());

        // Menu button (mobile)
        this.elements.menuBtn.addEventListener('click', () => {
            this.elements.sidebar.classList.toggle('active');
        });

        // Close sidebar when clicking outside (mobile)
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && 
                !this.elements.sidebar.contains(e.target) && 
                !this.elements.menuBtn.contains(e.target)) {
                this.elements.sidebar.classList.remove('active');
            }
        });

        // Before install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            this.elements.installBtn.style.display = 'flex';
        });

        // App installed
        window.addEventListener('appinstalled', () => {
            this.deferredPrompt = null;
            this.elements.installBtn.style.display = 'none';
            this.showMessage('success', 'App installed successfully!');
        });

        // Online/offline detection
        window.addEventListener('online', () => this.handleOnlineStatus(true));
        window.addEventListener('offline', () => this.handleOnlineStatus(false));
    }

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('ServiceWorker registered:', registration);
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }

    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        if (!message && !this.currentFile && !this.currentDataType) return;

        // Add user message
        this.addMessage('user', message);

        // Clear input
        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';

        // Show loading
        this.showLoading(true);

        try {
            let response;
            
            if (this.currentFile) {
                // Analyze file with message
                response = await this.analyzeFile(this.currentFile, message);
            } else if (this.currentDataType === 'text') {
                // Analyze pasted text
                const text = this.elements.dataInput.value.trim();
                response = await this.analyzeText(text, message);
            } else {
                // Just send message (for follow-up questions)
                response = await this.analyzeText('', message);
            }

            // Add bot response
            this.addMessage('bot', response.analysis);

            // Update chart if available
            if (response.chartData) {
                this.updateChart(response.chartData);
            }

            // Save to history
            this.saveToHistory({
                type: this.currentDataType || 'chat',
                question: message || 'Data analysis',
                analysis: response.analysis,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error:', error);
            this.addMessage('bot', `Error: ${error.message}. Please try again.`);
        } finally {
            this.showLoading(false);
        }
    }

    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.currentFile = file;
        this.currentDataType = 'file';

        // Show file preview
        this.showFilePreview(file);

        // Auto-analyze the file
        this.addMessage('user', `Uploaded file: ${file.name}`);
        this.showLoading(true);

        try {
            const response = await this.analyzeFile(file, "Analyze this file and provide insights");
            this.addMessage('bot', response.analysis);
            
            if (response.chartData) {
                this.updateChart(response.chartData);
            }

            this.saveToHistory({
                type: 'file',
                filename: file.name,
                question: 'Analyze this file',
                analysis: response.analysis,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error:', error);
            this.addMessage('bot', `Error analyzing file: ${error.message}`);
        } finally {
            this.showLoading(false);
            event.target.value = '';
        }
    }

    async analyzePastedData() {
        const text = this.elements.dataInput.value.trim();
        if (!text) {
            this.showMessage('error', 'Please paste some data first');
            return;
        }

        this.currentDataType = 'text';
        
        this.addMessage('user', 'Analyzing pasted data...');
        this.showLoading(true);

        try {
            const response = await this.analyzeText(text, "Analyze this data and provide insights");
            this.addMessage('bot', response.analysis);
            
            if (response.chartData) {
                this.updateChart(response.chartData);
            }

            this.saveToHistory({
                type: 'text',
                question: 'Analyze pasted data',
                analysis: response.analysis,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error:', error);
            this.addMessage('bot', `Error analyzing data: ${error.message}`);
        } finally {
            this.showLoading(false);
        }
    }

    async analyzeFile(file, question) {
        try {
            const response = await this.api.analyzeFile(file, question);
            return response;
        } catch (error) {
            // Fallback to local analysis if API fails
            console.warn('API call failed, using local analysis:', error);
            return await this.analyzeFileLocally(file, question);
        }
    }

    async analyzeFileLocally(file, question) {
        try {
            // Parse file locally
            const parsedData = await this.fileAnalyzer.parseFile(file);
            
            // Analyze structure
            const analysis = this.fileAnalyzer.analyzeDataStructure(parsedData.data);
            
            // Prepare chart data
            const chartConfig = this.fileAnalyzer.prepareForChart(parsedData.data, analysis);
            
            // Generate analysis text
            const analysisText = this.generateAnalysisText(parsedData, analysis, question);
            
            return {
                analysis: analysisText,
                chartData: chartConfig ? chartConfig.data : null,
                rawData: parsedData.data.slice(0, 10)
            };
        } catch (error) {
            throw new Error(`Local analysis failed: ${error.message}`);
        }
    }

    async analyzeText(text, question) {
        try {
            const response = await this.api.analyzeText(text, question);
            return response;
        } catch (error) {
            // Fallback to local analysis
            console.warn('API call failed, using local analysis:', error);
            return await this.analyzeTextLocally(text, question);
        }
    }

    async analyzeTextLocally(text, question) {
        try {
            // Try to parse as structured data
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                // Parse as CSV-like text
                const lines = text.trim().split('\n');
                if (lines.length > 1) {
                    const headers = lines[0].split(',').map(h => h.trim());
                    data = lines.slice(1).map(line => {
                        const values = line.split(',').map(v => v.trim());
                        const obj = {};
                        headers.forEach((header, index) => {
                            obj[header] = values[index] || '';
                        });
                        return obj;
                    });
                } else {
                    data = [{ content: text }];
                }
            }

            const dataArray = Array.isArray(data) ? data : [data];
            const analysis = this.fileAnalyzer.analyzeDataStructure(dataArray);
            const chartConfig = this.fileAnalyzer.prepareForChart(dataArray, analysis);
            
            const analysisText = this.generateAnalysisText(
                { data: dataArray, summary: analysis }, 
                analysis, 
                question
            );
            
            return {
                analysis: analysisText,
                chartData: chartConfig ? chartConfig.data : null,
                rawData: dataArray.slice(0, 10)
            };
        } catch (error) {
            throw new Error(`Local text analysis failed: ${error.message}`);
        }
    }

    generateAnalysisText(parsedData, analysis, question) {
        const summary = parsedData.summary || analysis;
        
        let text = `## 📊 Data Analysis Report\n\n`;
        
        if (question && question !== "Analyze this data and provide insights") {
            text += `**Question:** ${question}\n\n`;
        }
        
        text += `### Data Overview\n`;
        text += `- **Total Rows:** ${summary.totalRows || parsedData.data.length}\n`;
        text += `- **Columns:** ${summary.columns ? summary.columns.join(', ') : 'N/A'}\n\n`;
        
        text += `### Key Insights\n`;
        
        if (summary.statisticalSummary) {
            Object.entries(summary.statisticalSummary).forEach(([column, stats]) => {
                if (stats.type === 'numeric') {
                    text += `- **${column}:** Range: ${stats.min.toFixed(2)} - ${stats.max.toFixed(2)}, Average: ${stats.average.toFixed(2)}\n`;
                } else if (stats.type === 'text') {
                    text += `- **${column}:** ${stats.uniqueValues} unique values\n`;
                }
            });
        }
        
        text += `\n### Recommendations