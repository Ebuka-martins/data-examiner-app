// assets/src/pdf-export.js - PDF Export Functionality with Better Error Handling and Black Text

class PDFExporter {
    constructor() {
        this.jsPDF = null;
        this.dependenciesLoaded = false;
        this.loadingPromise = null;
    }

    /**
     * Load required dependencies dynamically if not present
     */
    async loadDependencies() {
        if (this.dependenciesLoaded) return true;
        
        // If already loading, return the existing promise
        if (this.loadingPromise) return this.loadingPromise;

        this.loadingPromise = new Promise((resolve, reject) => {
            let loadedCount = 0;
            const totalDeps = 2;
            let hasError = false;

            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === totalDeps && !hasError) {
                    this.dependenciesLoaded = true;
                    this.loadingPromise = null;
                    resolve(true);
                }
            };

            const handleError = (error) => {
                if (!hasError) {
                    hasError = true;
                    console.error('Failed to load PDF dependencies:', error);
                    this.loadingPromise = null;
                    reject(new Error('Failed to load PDF library'));
                }
            };

            // Check if jsPDF is already loaded
            if (window.jspdf?.jsPDF) {
                this.jsPDF = window.jspdf.jsPDF;
                checkComplete();
            } else {
                // Try multiple CDN sources
                const tryLoadScript = (url, onSuccess, onError) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = onSuccess;
                    script.onerror = onError;
                    document.head.appendChild(script);
                };

                // Try first CDN
                tryLoadScript(
                    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
                    () => {
                        if (window.jspdf?.jsPDF) {
                            this.jsPDF = window.jspdf.jsPDF;
                            checkComplete();
                        } else {
                            // Try backup CDN
                            tryLoadScript(
                                'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
                                () => {
                                    if (window.jspdf?.jsPDF) {
                                        this.jsPDF = window.jspdf.jsPDF;
                                        checkComplete();
                                    } else {
                                        handleError('jsPDF loaded but not found in window');
                                    }
                                },
                                handleError
                            );
                        }
                    },
                    () => {
                        // First CDN failed, try backup
                        tryLoadScript(
                            'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
                            () => {
                                if (window.jspdf?.jsPDF) {
                                    this.jsPDF = window.jspdf.jsPDF;
                                    checkComplete();
                                } else {
                                    handleError('jsPDF loaded but not found in window');
                                }
                            },
                            handleError
                        );
                    }
                );
            }

            // Load jspdf-autotable
            if (window.jspdf?.autoTable) {
                checkComplete();
            } else {
                // Try multiple CDN sources for autotable
                const tryLoadAutoTable = (url) => {
                    const script = document.createElement('script');
                    script.src = url;
                    script.onload = () => {
                        // Give it a moment to register
                        setTimeout(() => {
                            checkComplete();
                        }, 100);
                    };
                    script.onerror = () => {
                        console.warn('Failed to load autoTable from', url);
                        // Still consider it complete, just without autoTable
                        checkComplete();
                    };
                    document.head.appendChild(script);
                };

                // Try primary CDN
                tryLoadAutoTable('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.29/jspdf.plugin.autotable.min.js');
            }

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!this.dependenciesLoaded) {
                    console.warn('PDF dependency loading timed out');
                    this.dependenciesLoaded = true; // Force load
                    this.loadingPromise = null;
                    resolve(true);
                }
            }, 10000);
        });

        return this.loadingPromise;
    }

    /**
     * Export analysis as PDF including chart, messages, and insights
     */
    async exportAnalysis(messages, chartCanvas, analysisData, options = {}) {
        const {
            filename = `data-analysis-${new Date().toISOString().slice(0, 10)}.pdf`,
            includeMessages = true,
            includeChart = true,
            includeMetadata = true,
            orientation = 'portrait'
        } = options;

        try {
            // Load dependencies
            await this.loadDependencies();

            // Check if jsPDF loaded
            if (!this.jsPDF && !window.jspdf?.jsPDF) {
                throw new Error('PDF library not available');
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: 'a4'
            });

            let yPos = 20;

            // Add header
            yPos = this.addHeader(doc, yPos);

            // Add metadata
            if (includeMetadata) {
                yPos = this.addMetadata(doc, yPos, analysisData);
            }

            // Add chart if available
            if (includeChart && chartCanvas && chartCanvas.width > 0) {
                yPos = await this.addChartToPDF(doc, chartCanvas, yPos);
            }

            // Add messages
            if (includeMessages && messages && messages.length > 0) {
                yPos = this.addMessagesToPDF(doc, messages, yPos);
            }

            // Add analysis insights
            if (analysisData?.analysis) {
                yPos = this.addAnalysisInsights(doc, analysisData.analysis, yPos);
            }

            // Add page numbers
            this.addPageNumbers(doc);

            // Save the PDF
            doc.save(filename);
            
            return { success: true, filename };
        } catch (error) {
            console.error('PDF export error:', error);
            throw error;
        }
    }

    /**
     * Add header to PDF
     */
    addHeader(doc, yPos) {
        try {
            doc.setFontSize(24);
            doc.setTextColor(16, 163, 127); // Keep header green
            doc.text('Data Examiner Analysis Report', 20, yPos);
            
            doc.setDrawColor(16, 163, 127);
            doc.setLineWidth(0.5);
            doc.line(20, yPos + 5, 190, yPos + 5);
            
            return yPos + 15;
        } catch (error) {
            console.error('Error adding header:', error);
            return yPos + 10;
        }
    }

    /**
     * Add metadata to PDF
     */
    addMetadata(doc, yPos, analysisData) {
        try {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100); // Gray for metadata
            
            const dateStr = new Date().toLocaleString();
            doc.text(`Generated: ${dateStr}`, 20, yPos);
            
            if (analysisData?.conversationId) {
                doc.text(`Session ID: ${analysisData.conversationId.substring(0, 8)}...`, 20, yPos + 5);
            }
            
            return yPos + 15;
        } catch (error) {
            console.error('Error adding metadata:', error);
            return yPos + 10;
        }
    }

    /**
     * Add chart to PDF as image
     */
    async addChartToPDF(doc, chartCanvas, yPos) {
        if (!chartCanvas || chartCanvas.width === 0) {
            return yPos;
        }

        try {
            // Store original dimensions
            const originalWidth = chartCanvas.width;
            const originalHeight = chartCanvas.height;
            
            // Convert canvas to data URL
            const chartImage = chartCanvas.toDataURL('image/png', 1.0);
            
            // Add chart title - SET TO BLACK
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0); // BLACK for chart title
            doc.text('Data Visualization', 20, yPos);
            
            yPos += 5;
            
            // Calculate dimensions to fit on A4
            const imgWidth = 170; // mm
            const imgHeight = (originalHeight * imgWidth) / originalWidth;
            
            // Check if we need a new page
            if (yPos + imgHeight > 280) {
                doc.addPage();
                yPos = 20;
            }
            
            // Add the image
            doc.addImage(chartImage, 'PNG', 20, yPos, imgWidth, imgHeight);
            
            yPos += imgHeight + 10;
        } catch (error) {
            console.error('Error adding chart to PDF:', error);
            try {
                doc.setTextColor(0, 0, 0); // BLACK for error message
                doc.text('Chart could not be rendered in PDF', 20, yPos);
            } catch (e) {}
            yPos += 10;
        }
        
        return yPos;
    }

    /**
     * Add messages to PDF
     */
    addMessagesToPDF(doc, messages, yPos) {
        if (!messages || messages.length === 0) return yPos;

        try {
            // Filter and prepare message data
            const messageData = messages
                .filter(msg => msg.role === 'user' || msg.role === 'assistant')
                .map(msg => [
                    msg.role === 'user' ? 'User' : 'AI Assistant',
                    this.stripMarkdown(msg.content || '').substring(0, 200) + 
                    (msg.content?.length > 200 ? '...' : '')
                ]);

            if (messageData.length === 0) return yPos;

            // Add section title - SET TO BLACK
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0); // BLACK for section title
            doc.text('Conversation History', 20, yPos);
            yPos += 5;

            // Check if we need a new page
            if (yPos > 260) {
                doc.addPage();
                yPos = 20;
            }

            // Use autotable if available
            if (window.jspdf?.autoTable) {
                doc.autoTable({
                    startY: yPos,
                    head: [['Role', 'Message']],
                    body: messageData,
                    theme: 'striped',
                    headStyles: {
                        fillColor: [16, 163, 127],
                        textColor: [255, 255, 255], // White text on green header
                        fontStyle: 'bold'
                    },
                    bodyStyles: {
                        textColor: [0, 0, 0] // BLACK for table body text
                    },
                    columnStyles: {
                        0: { cellWidth: 30 },
                        1: { cellWidth: 140 }
                    },
                    margin: { left: 20, right: 20 },
                    didDrawPage: (data) => {
                        yPos = data.cursor.y + 10;
                    }
                });
            } else {
                // Fallback without autoTable
                doc.setFontSize(10);
                doc.setTextColor(0, 0, 0); // BLACK for message text
                messageData.forEach(([role, msg], index) => {
                    if (yPos > 280) {
                        doc.addPage();
                        yPos = 20;
                    }
                    doc.text(`${role}: ${msg}`, 20, yPos);
                    yPos += 7;
                });
                yPos += 5;
            }
        } catch (error) {
            console.error('Error adding messages:', error);
        }

        return yPos || 250;
    }

    /**
     * Add analysis insights to PDF
     */
    addAnalysisInsights(doc, analysisText, yPos) {
        if (!analysisText) return yPos;

        try {
            // Check if we need a new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }

            // Add section title - SET TO BLACK
            doc.setFontSize(14);
            doc.setTextColor(0, 0, 0); // BLACK for section title
            doc.text('Analysis Insights', 20, yPos);
            yPos += 5;

            // Clean and format the analysis text
            const cleanText = this.stripMarkdown(analysisText);
            
            // Split into paragraphs
            const paragraphs = cleanText.split('\n\n').filter(p => p.trim());
            
            doc.setFontSize(11);
            doc.setTextColor(50, 50, 50); // Dark gray for insights (almost black)
            
            for (const para of paragraphs) {
                // Split long paragraphs
                const lines = doc.splitTextToSize(para, 170);
                
                // Check if we need a new page
                if (yPos + (lines.length * 5) > 280) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.text(lines, 20, yPos);
                yPos += (lines.length * 5) + 5;
            }
        } catch (error) {
            console.error('Error adding analysis insights:', error);
        }
        
        return yPos + 5;
    }

    /**
     * Add page numbers to PDF
     */
    addPageNumbers(doc) {
        try {
            const pageCount = doc.internal.getNumberOfPages();
            
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150, 150, 150); // Light gray for page numbers
                doc.text(
                    `Page ${i} of ${pageCount}`,
                    doc.internal.pageSize.width / 2,
                    doc.internal.pageSize.height - 10,
                    { align: 'center' }
                );
            }
        } catch (error) {
            console.error('Error adding page numbers:', error);
        }
    }

    /**
     * Strip markdown formatting for cleaner PDF text
     */
    stripMarkdown(text) {
        if (!text) return '';
        
        return text
            .replace(/#{1,6}\s?/g, '') // Remove headers
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
            .replace(/\*(.*?)\*/g, '$1') // Remove italic
            .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Remove code blocks
            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links
            .replace(/!\[(.*?)\]\(.*?\)/g, '$1') // Remove images
            .replace(/- /g, '• ') // Replace list markers with bullet points
            .replace(/\n{3,}/g, '\n\n'); // Remove excessive newlines
    }
}

// Make it globally available
window.PDFExporter = PDFExporter;