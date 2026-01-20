// Chart Manager for Data Examiner
class ChartManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.currentChart = null;
        this.chartData = null;
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: 'var(--text-primary)',
                        font: {
                            size: 12,
                            family: "'Segoe UI', Roboto, sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'var(--bg-card)',
                    titleColor: 'var(--text-primary)',
                    bodyColor: 'var(--text-secondary)',
                    borderColor: 'var(--border-color)',
                    borderWidth: 1,
                    cornerRadius: 6,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'var(--border-color)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        maxRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'var(--border-color)',
                        drawBorder: false
                    },
                    ticks: {
                        color: 'var(--text-secondary)',
                        callback: function(value) {
                            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                            if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
                            return value;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            },
            hover: {
                animationDuration: 0
            }
        };
        
        this.colorPalettes = {
            primary: [
                'rgba(16, 163, 127, 0.8)',
                'rgba(102, 126, 234, 0.8)',
                'rgba(255, 107, 107, 0.8)',
                'rgba(255, 159, 64, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 205, 86, 0.8)',
                'rgba(54, 162, 235, 0.8)'
            ],
            light: [
                'rgba(16, 163, 127, 0.2)',
                'rgba(102, 126, 234, 0.2)',
                'rgba(255, 107, 107, 0.2)',
                'rgba(255, 159, 64, 0.2)',
                'rgba(75, 192, 192, 0.2)',
                'rgba(153, 102, 255, 0.2)',
                'rgba(255, 205, 86, 0.2)',
                'rgba(54, 162, 235, 0.2)'
            ]
        };
    }

    initialize() {
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        const ctx = this.canvas.getContext('2d');
        
        // Initial empty chart
        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['No Data'],
                datasets: [{
                    label: 'Data',
                    data: [0],
                    borderColor: 'var(--border-color)',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    borderWidth: 1,
                    fill: false
                }]
            },
            options: this.getOptions('line')
        });
    }

    updateChart(data, type = 'auto') {
        if (!this.currentChart) {
            this.initialize();
        }

        if (!data || !data.datasets || data.datasets.length === 0) {
            this.showNoData();
            return;
        }

        // Store the data
        this.chartData = data;
        
        // Determine chart type if auto
        const chartType = type === 'auto' ? this.determineChartType(data) : type;
        
        // Prepare data for chart
        const chartData = this.prepareChartData(data, chartType);
        
        // Update chart
        this.currentChart.data = chartData;
        this.currentChart.options = this.getOptions(chartType);
        this.currentChart.type = chartType;
        
        // Apply colors
        this.applyColors();
        
        // Update with animation
        this.currentChart.update('reset');
    }

    updateChartType(type) {
        if (!this.currentChart || !this.chartData) return;
        
        this.updateChart(this.chartData, type);
    }

    determineChartType(data) {
        const dataset = data.datasets[0];
        
        if (!dataset || !dataset.data) return 'bar';
        
        // If we have categorical data with few items
        if (data.labels && data.labels.length <= 7) {
            return 'bar';
        }
        
        // If data seems sequential
        if (this.isSequentialData(dataset.data)) {
            return 'line';
        }
        
        // For percentage data
        if (this.isPercentageData(dataset.data)) {
            return 'pie';
        }
        
        // Default to bar
        return 'bar';
    }

    isSequentialData(data) {
        if (data.length < 3) return false;
        
        // Check if values are generally increasing/decreasing
        let increasing = 0;
        let decreasing = 0;
        
        for (let i = 1; i < data.length; i++) {
            if (data[i] > data[i-1]) increasing++;
            if (data[i] < data[i-1]) decreasing++;
        }
        
        const total = data.length - 1;
        return increasing / total > 0.7 || decreasing / total > 0.7;
    }

    isPercentageData(data) {
        const sum = data.reduce((a, b) => a + b, 0);
        return Math.abs(sum - 100) < 5; // Close to 100%
    }

    prepareChartData(data, chartType) {
        const preparedData = {
            labels: data.labels || [],
            datasets: data.datasets.map((dataset, index) => {
                const baseConfig = {
                    label: dataset.label || `Dataset ${index + 1}`,
                    data: dataset.data || [],
                    borderWidth: 2,
                    tension: 0.1
                };

                switch (chartType) {
                    case 'line':
                        return {
                            ...baseConfig,
                            fill: true,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        };
                    case 'bar':
                        return {
                            ...baseConfig,
                            borderRadius: 4,
                            borderSkipped: false
                        };
                    case 'pie':
                    case 'doughnut':
                        return {
                            ...baseConfig,
                            borderWidth: 1,
                            hoverOffset: 15
                        };
                    default:
                        return baseConfig;
                }
            })
        };

        // For pie/doughnut, only show first dataset
        if (chartType === 'pie' || chartType === 'doughnut') {
            if (preparedData.datasets.length > 1) {
                preparedData.datasets = [preparedData.datasets[0]];
            }
        }

        return preparedData;
    }

    getOptions(chartType) {
        const options = JSON.parse(JSON.stringify(this.defaultOptions));
        
        switch (chartType) {
            case 'line':
                options.scales = {
                    ...options.scales,
                    x: {
                        ...options.scales.x,
                        type: this.isDateData(this.chartData?.labels) ? 'time' : 'category',
                        time: this.isDateData(this.chartData?.labels) ? {
                            unit: 'day',
                            tooltipFormat: 'MMM d, yyyy'
                        } : undefined
                    }
                };
                break;
                
            case 'bar':
                options.indexAxis = 'x';
                options.scales.x.stacked = this.chartData?.datasets?.length > 1;
                options.scales.y.stacked = this.chartData?.datasets?.length > 1;
                break;
                
            case 'pie':
            case 'doughnut':
                options.plugins.legend.position = 'right';
                options.cutout = chartType === 'doughnut' ? '50%' : 0;
                options.plugins.tooltip.callbacks = {
                    ...options.plugins.tooltip.callbacks,
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = Math.round((value / total) * 100);
                        return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                    }
                };
                break;
        }
        
        return options;
    }

    isDateData(labels) {
        if (!labels || labels.length === 0) return false;
        
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
            /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
            /^\d{2}\/\d{2}\/\d{2}$/, // MM/DD/YY
            /^[A-Za-z]{3} \d{1,2}$/ // Jan 1
        ];
        
        return labels.some(label => 
            datePatterns.some(pattern => pattern.test(label.toString()))
        );
    }

    applyColors() {
        if (!this.currentChart || !this.currentChart.data.datasets) return;
        
        this.currentChart.data.datasets.forEach((dataset, index) => {
            const colorIndex = index % this.colorPalettes.primary.length;
            
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = this.colorPalettes.light[colorIndex];
            }
            
            if (!dataset.borderColor) {
                dataset.borderColor = this.colorPalettes.primary[colorIndex];
            }
            
            if (!dataset.pointBackgroundColor) {
                dataset.pointBackgroundColor = this.colorPalettes.primary[colorIndex];
            }
            
            if (!dataset.pointBorderColor) {
                dataset.pointBorderColor = '#ffffff';
            }
        });
    }

    showNoData() {
        if (!this.currentChart) return;

        this.currentChart.data = {
            labels: ['No Data Available'],
            datasets: [{
                label: 'No Data',
                data: [1],
                backgroundColor: 'rgba(229, 229, 231, 0.5)',
                borderColor: 'rgba(229, 229, 231, 1)',
                borderWidth: 1
            }]
        };
        
        this.currentChart.options.plugins.tooltip.enabled = false;
        this.currentChart.update();
    }

    exportChart(format = 'png', quality = 1.0) {
        if (!this.currentChart) return null;
        
        const url = this.canvas.toDataURL(`image/${format}`, quality);
        
        // Create and trigger download
        const link = document.createElement('a');
        link.download = `data-chart-${Date.now()}.${format}`;
        link.href = url;
        link.click();
        
        return url;
    }

    getChartData() {
        return this.chartData;
    }

    destroy() {
        if (this.currentChart) {
            this.currentChart.destroy();
            this.currentChart = null;
        }
        this.chartData = null;
    }
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartManager;
}