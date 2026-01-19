class ChartManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.chart = null;
    this.defaultColors = [
      '#10a37f', '#5436da', '#ff6384', '#36a2eb', '#ffce56',
      '#4bc0c0', '#9966ff', '#ff9f40', '#ff6384', '#c9cbcf'
    ];
  }

  initialize() {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    const ctx = this.canvas.getContext('2d');
    
    // Initial empty chart
    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'No data',
          data: [],
          borderColor: '#e5e5e7',
          backgroundColor: 'rgba(229, 229, 231, 0.2)',
          borderWidth: 1
        }]
      },
      options: this.getDefaultOptions()
    });
  }

  getDefaultOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          padding: 10
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 10
            },
            maxRotation: 45
          }
        },
        y: {
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          },
          ticks: {
            font: {
              size: 10
            }
          },
          beginAtZero: true
        }
      },
      interaction: {
        intersect: false,
        mode: 'nearest'
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    };
  }

  updateChart(data, type = 'auto') {
    if (!this.chart) {
      this.initialize();
    }

    if (!data || !data.datasets || data.datasets.length === 0) {
      this.showNoDataMessage();
      return;
    }

    // Determine chart type if auto
    const chartType = type === 'auto' ? this.determineChartType(data) : type;

    // Update chart with animation
    this.chart.data = this.prepareChartData(data, chartType);
    this.chart.options = this.getChartOptions(chartType, data);
    this.chart.type = chartType;

    // Add colors if not provided
    this.chart.data.datasets.forEach((dataset, index) => {
      if (!dataset.backgroundColor) {
        dataset.backgroundColor = this.getColor(index, 0.2);
      }
      if (!dataset.borderColor) {
        dataset.borderColor = this.getColor(index, 1);
      }
    });

    this.chart.update('reset');
  }

  determineChartType(data) {
    const dataset = data.datasets[0];
    
    if (data.labels && data.labels.length <= 7) {
      // Small number of categories - use bar chart
      return 'bar';
    } else if (dataset.data && dataset.data.length > 20) {
      // Large dataset - use line chart
      return 'line';
    } else if (this.isTimeSeries(data.labels)) {
      // Time series data
      return 'line';
    } else {
      // Default to bar chart
      return 'bar';
    }
  }

  isTimeSeries(labels) {
    if (!labels || labels.length < 2) return false;
    
    // Check for date patterns
    const datePatterns = [
      /\d{4}-\d{2}-\d{2}/, // YYYY-MM-DD
      /\d{2}\/\d{2}\/\d{4}/, // MM/DD/YYYY
      /\d{2}\/\d{2}\/\d{2}/, // MM/DD/YY
      /[A-Za-z]{3} \d{1,2}/, // Jan 1
      /\d{1,2}:[0-5]\d/ // HH:MM
    ];
    
    return labels.some(label => 
      datePatterns.some(pattern => pattern.test(label.toString()))
    );
  }

  prepareChartData(data, chartType) {
    const preparedData = {
      labels: data.labels || [],
      datasets: data.datasets.map((dataset, index) => ({
        label: dataset.label || `Dataset ${index + 1}`,
        data: dataset.data || [],
        backgroundColor: dataset.backgroundColor || this.getColor(index, 0.2),
        borderColor: dataset.borderColor || this.getColor(index, 1),
        borderWidth: dataset.borderWidth || 2,
        fill: chartType === 'line' ? (dataset.fill !== undefined ? dataset.fill : true) : false,
        tension: chartType === 'line' ? (dataset.tension || 0.1) : undefined,
        borderRadius: chartType === 'bar' ? (dataset.borderRadius || 4) : undefined
      }))
    };

    // For pie/doughnut charts, only show first dataset
    if (chartType === 'pie' || chartType === 'doughnut') {
      if (preparedData.datasets.length > 1) {
        preparedData.datasets = [preparedData.datasets[0]];
      }
    }

    return preparedData;
  }

  getChartOptions(chartType, data) {
    const options = this.getDefaultOptions();

    switch (chartType) {
      case 'pie':
      case 'doughnut':
        options.plugins.legend.position = 'right';
        options.cutout = chartType === 'doughnut' ? '50%' : 0;
        break;
        
      case 'bar':
        options.indexAxis = 'x';
        options.scales.x.stacked = data.datasets.length > 1;
        options.scales.y.stacked = data.datasets.length > 1;
        break;
        
      case 'line':
        options.scales.x = {
          ...options.scales.x,
          type: this.isTimeSeries(data.labels) ? 'time' : 'category',
          time: this.isTimeSeries(data.labels) ? {
            unit: 'day',
            tooltipFormat: 'MMM d, yyyy'
          } : undefined
        };
        break;
    }

    return options;
  }

  getColor(index, alpha = 1) {
    const color = this.defaultColors[index % this.defaultColors.length];
    
    if (alpha === 1) return color;
    
    // Convert hex to rgba
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  showNoDataMessage() {
    if (!this.chart) return;

    this.chart.data = {
      labels: ['No Data Available'],
      datasets: [{
        label: 'No Data',
        data: [1],
        backgroundColor: 'rgba(229, 229, 231, 0.5)',
        borderColor: 'rgba(229, 229, 231, 1)',
        borderWidth: 1
      }]
    };
    
    this.chart.options.plugins.tooltip = {
      enabled: false
    };
    
    this.chart.update();
  }

  exportChart(format = 'png') {
    if (!this.chart) return null;

    switch (format) {
      case 'png':
        return this.canvas.toDataURL('image/png');
      case 'jpeg':
        return this.canvas.toDataURL('image/jpeg');
      case 'svg':
        // For SVG, we would need a different approach
        return this.canvas.toDataURL('image/svg+xml');
      default:
        return this.canvas.toDataURL('image/png');
    }
  }

  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}

export default ChartManager;