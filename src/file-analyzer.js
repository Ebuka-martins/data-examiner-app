// File Analyzer Utility for Data Examiner
class FileAnalyzer {
    constructor() {
        this.supportedFormats = {
            csv: {
                extensions: ['.csv', '.txt'],
                mimeTypes: ['text/csv', 'text/plain'],
                parser: this.parseCSV.bind(this)
            },
            excel: {
                extensions: ['.xlsx', '.xls', '.xlsm'],
                mimeTypes: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel'
                ],
                parser: this.parseExcel.bind(this)
            },
            json: {
                extensions: ['.json'],
                mimeTypes: ['application/json'],
                parser: this.parseJSON.bind(this)
            }
        };
    }

    async analyzeFile(file) {
        const fileInfo = this.getFileInfo(file);
        
        if (!fileInfo) {
            throw new Error(`Unsupported file format: ${file.name}`);
        }

        try {
            const data = await fileInfo.parser(file);
            const analysis = this.analyzeDataStructure(data);
            const chartConfig = this.prepareChartConfig(data, analysis);
            
            return {
                success: true,
                data: data,
                analysis: analysis,
                chartConfig: chartConfig,
                fileInfo: fileInfo
            };
        } catch (error) {
            console.error('File analysis error:', error);
            throw new Error(`Failed to analyze file: ${error.message}`);
        }
    }

    getFileInfo(file) {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        const mimeType = file.type;
        
        for (const [format, info] of Object.entries(this.supportedFormats)) {
            if (info.extensions.includes(extension) || info.mimeTypes.includes(mimeType)) {
                return { format, ...info };
            }
        }
        
        return null;
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const text = event.target.result;
                    const lines = text.split('\n').filter(line => line.trim());
                    
                    if (lines.length === 0) {
                        reject(new Error('Empty CSV file'));
                        return;
                    }
                    
                    // Detect delimiter
                    const delimiter = this.detectDelimiter(text);
                    const headers = lines[0].split(delimiter).map(h => h.trim());
                    
                    const data = lines.slice(1)
                        .filter(line => line.trim())
                        .map((line, index) => {
                            const values = line.split(delimiter).map(v => v.trim());
                            const obj = {};
                            
                            headers.forEach((header, i) => {
                                let value = values[i] || '';
                                
                                // Try to convert to appropriate type
                                if (this.isNumeric(value)) {
                                    value = parseFloat(value);
                                } else if (this.isBoolean(value)) {
                                    value = value.toLowerCase() === 'true';
                                } else if (this.isDate(value)) {
                                    value = new Date(value);
                                }
                                
                                obj[header] = value;
                            });
                            
                            return obj;
                        });
                    
                    resolve(data);
                } catch (error) {
                    reject(new Error(`CSV parsing error: ${error.message}`));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
        });
    }

    async parseExcel(file) {
        // Note: In a real implementation, you would use SheetJS library
        // This is a simplified version that reads as CSV
        return this.parseCSV(file);
    }

    async parseJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    // Normalize to array
                    if (Array.isArray(data)) {
                        resolve(data);
                    } else if (typeof data === 'object') {
                        resolve([data]);
                    } else {
                        reject(new Error('JSON must be an array or object'));
                    }
                } catch (error) {
                    reject(new Error(`JSON parsing error: ${error.message}`));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read JSON file'));
            reader.readAsText(file);
        });
    }

    detectDelimiter(text) {
        const lines = text.split('\n').slice(0, 10);
        const delimiters = [',', ';', '\t', '|'];
        let maxCount = 0;
        let bestDelimiter = ',';
        
        for (const delimiter of delimiters) {
            const count = lines[0].split(delimiter).length;
            if (count > maxCount) {
                maxCount = count;
                bestDelimiter = delimiter;
            }
        }
        
        return bestDelimiter;
    }

    analyzeDataStructure(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return {
                totalRows: 0,
                columns: [],
                columnTypes: {},
                statisticalSummary: {}
            };
        }

        const sample = data[0];
        const columns = Object.keys(sample);
        
        const analysis = {
            totalRows: data.length,
            columns: columns,
            columnTypes: {},
            statisticalSummary: {},
            dataQuality: {
                missingValues: 0,
                duplicateRows: 0
            }
        };

        // Analyze each column
        columns.forEach(column => {
            const values = data.map(row => row[column]);
            const nonEmptyValues = values.filter(val => 
                val !== null && val !== undefined && val !== ''
            );
            
            // Count missing values
            analysis.dataQuality.missingValues += values.length - nonEmptyValues.length;
            
            // Determine column type
            if (nonEmptyValues.length === 0) {
                analysis.columnTypes[column] = 'unknown';
                return;
            }
            
            const firstValue = nonEmptyValues[0];
            
            if (typeof firstValue === 'number' || this.isNumericArray(nonEmptyValues)) {
                analysis.columnTypes[column] = 'numeric';
                const numericValues = nonEmptyValues.map(v => parseFloat(v));
                
                analysis.statisticalSummary[column] = {
                    type: 'numeric',
                    count: numericValues.length,
                    min: Math.min(...numericValues),
                    max: Math.max(...numericValues),
                    mean: numericValues.reduce((a, b) => a + b, 0) / numericValues.length,
                    median: this.calculateMedian(numericValues),
                    sum: numericValues.reduce((a, b) => a + b, 0),
                    stdDev: this.calculateStdDev(numericValues)
                };
            } else if (firstValue instanceof Date || this.isDateArray(nonEmptyValues)) {
                analysis.columnTypes[column] = 'date';
                const dates = nonEmptyValues.map(v => new Date(v));
                
                analysis.statisticalSummary[column] = {
                    type: 'date',
                    count: dates.length,
                    earliest: new Date(Math.min(...dates)).toISOString().split('T')[0],
                    latest: new Date(Math.max(...dates)).toISOString().split('T')[0],
                    uniqueDays: new Set(dates.map(d => d.toISOString().split('T')[0])).size
                };
            } else {
                analysis.columnTypes[column] = 'text';
                const uniqueValues = [...new Set(nonEmptyValues.map(v => v.toString()))];
                
                analysis.statisticalSummary[column] = {
                    type: 'text',
                    count: nonEmptyValues.length,
                    uniqueCount: uniqueValues.length,
                    mostCommon: this.findMostCommon(nonEmptyValues),
                    sampleValues: uniqueValues.slice(0, 5)
                };
            }
        });

        // Check for duplicate rows
        const rowStrings = data.map(row => JSON.stringify(row));
        analysis.dataQuality.duplicateRows = rowStrings.length - new Set(rowStrings).size;

        return analysis;
    }

    prepareChartConfig(data, analysis) {
        if (!data || data.length === 0 || !analysis) {
            return null;
        }

        const numericColumns = Object.entries(analysis.columnTypes)
            .filter(([_, type]) => type === 'numeric')
            .map(([col]) => col);

        if (numericColumns.length === 0) {
            return null;
        }

        // Use first numeric column for chart
        const chartColumn = numericColumns[0];
        const values = data
            .slice(0, 50)
            .map(row => parseFloat(row[chartColumn]))
            .filter(v => !isNaN(v));

        if (values.length === 0) {
            return null;
        }

        // Check if we have a date column for x-axis
        const dateColumns = Object.entries(analysis.columnTypes)
            .filter(([_, type]) => type === 'date')
            .map(([col]) => col);

        let labels;
        if (dateColumns.length > 0) {
            const dateColumn = dateColumns[0];
            labels = data.slice(0, 50).map(row => {
                const date = new Date(row[dateColumn]);
                return isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString().split('T')[0];
            });
        } else {
            labels = Array.from({ length: values.length }, (_, i) => `Item ${i + 1}`);
        }

        return {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: chartColumn,
                    data: values,
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `Analysis of ${chartColumn}`
                    }
                }
            }
        };
    }

    // Helper methods
    isNumeric(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    isNumericArray(arr) {
        return arr.every(val => this.isNumeric(val));
    }

    isBoolean(value) {
        return value.toLowerCase() === 'true' || value.toLowerCase() === 'false';
    }

    isDate(value) {
        return !isNaN(Date.parse(value));
    }

    isDateArray(arr) {
        return arr.every(val => !isNaN(Date.parse(val)));
    }

    calculateMedian(arr) {
        const sorted = [...arr].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
        
        return sorted[middle];
    }

    calculateStdDev(arr) {
        const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
        const squaredDiffs = arr.map(val => Math.pow(val - mean, 2));
        const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / arr.length;
        return Math.sqrt(avgSquaredDiff);
    }

    findMostCommon(arr) {
        const counts = {};
        let maxCount = 0;
        let mostCommon = arr[0];
        
        arr.forEach(val => {
            const key = val.toString();
            counts[key] = (counts[key] || 0) + 1;
            
            if (counts[key] > maxCount) {
                maxCount = counts[key];
                mostCommon = val;
            }
        });
        
        return {
            value: mostCommon,
            count: maxCount,
            percentage: ((maxCount / arr.length) * 100).toFixed(1) + '%'
        };
    }
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileAnalyzer;
}