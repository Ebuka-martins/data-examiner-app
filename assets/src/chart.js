// src/chart.js - Data Examiner Visualization Manager - WITH THEME SUPPORT

// Chart theme colors
const chartTheme = {
    light: {
        gridColor: 'rgba(0, 0, 0, 0.1)',
        textColor: '#1e293b',
        tickColor: '#475569',
        borderColor: '#e2e8f0'
    },
    dark: {
        gridColor: 'rgba(255, 255, 255, 0.1)',
        textColor: '#f1f5f9',
        tickColor: '#cbd5e1',
        borderColor: '#334155'
    }
};

// Get current theme
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

// Get chart colors based on theme
function getChartColors() {
    const theme = getCurrentTheme();
    return theme === 'dark' ? chartTheme.dark : chartTheme.light;
}

class ChartManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.currentChart = null;
    this.chartData = null;
    this.isDestroyed = false;
    this.themeObserver = null;

    this.defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: this.getThemeTextColor(),
            font: { size: 12, family: "'Inter', 'Segoe UI', Roboto, sans-serif" }
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
            label: (context) => {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.parsed.y !== null) {
                label += context.parsed.y.toLocaleString();
              } else if (context.parsed !== null) {
                label += context.parsed.toLocaleString();
              }
              return label;
            }
          }
        },
        title: {
          display: true,
          text: 'Data Visualization',
          color: this.getThemeTextColor(),
          font: { size: 16, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        }
      },
      scales: {
        x: {
          type: 'category',
          grid: { 
            color: this.getThemeGridColor(),
            drawBorder: true,
            borderColor: this.getThemeBorderColor()
          },
          ticks: { 
            color: this.getThemeTickColor(),
            maxRotation: 45,
            font: { size: 11, family: "'Inter', 'Segoe UI', Roboto, sans-serif" }
          },
          title: {
            color: this.getThemeTextColor(),
            font: { size: 12, weight: '500', family: "'Inter', 'Segoe UI', Roboto, sans-serif" }
          }
        },
        y: {
          beginAtZero: true,
          grid: { 
            color: this.getThemeGridColor(),
            drawBorder: true,
            borderColor: this.getThemeBorderColor()
          },
          ticks: {
            color: this.getThemeTickColor(),
            font: { size: 11, family: "'Inter', 'Segoe UI', Roboto, sans-serif" },
            callback: (value) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value;
            }
          },
          title: {
            color: this.getThemeTextColor(),
            font: { size: 12, weight: '500', family: "'Inter', 'Segoe UI', Roboto, sans-serif" }
          }
        }
      },
      interaction: { intersect: false, mode: 'index' },
      animation: { 
        duration: 800, 
        easing: 'easeOutQuart'
      },
      hover: { animationDuration: 0 }
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

  // Helper methods for theme colors
  getThemeGridColor() {
    const colors = getChartColors();
    return colors.gridColor;
  }

  getThemeTextColor() {
    const colors = getChartColors();
    return colors.textColor;
  }

  getThemeTickColor() {
    const colors = getChartColors();
    return colors.tickColor;
  }

  getThemeBorderColor() {
    const colors = getChartColors();
    return colors.borderColor;
  }

  // Update chart with current theme colors
  updateTheme() {
    if (!this.currentChart) return;

    const colors = getChartColors();
    
    // Update scales
    if (this.currentChart.options.scales?.x) {
      if (this.currentChart.options.scales.x.grid) {
        this.currentChart.options.scales.x.grid.color = colors.gridColor;
        this.currentChart.options.scales.x.grid.borderColor = colors.borderColor;
      }
      if (this.currentChart.options.scales.x.ticks) {
        this.currentChart.options.scales.x.ticks.color = colors.tickColor;
      }
      if (this.currentChart.options.scales.x.title) {
        this.currentChart.options.scales.x.title.color = colors.textColor;
      }
    }

    if (this.currentChart.options.scales?.y) {
      if (this.currentChart.options.scales.y.grid) {
        this.currentChart.options.scales.y.grid.color = colors.gridColor;
        this.currentChart.options.scales.y.grid.borderColor = colors.borderColor;
      }
      if (this.currentChart.options.scales.y.ticks) {
        this.currentChart.options.scales.y.ticks.color = colors.tickColor;
      }
      if (this.currentChart.options.scales.y.title) {
        this.currentChart.options.scales.y.title.color = colors.textColor;
      }
    }

    // Update plugins
    if (this.currentChart.options.plugins?.legend?.labels) {
      this.currentChart.options.plugins.legend.labels.color = colors.textColor;
    }

    if (this.currentChart.options.plugins?.title) {
      this.currentChart.options.plugins.title.color = colors.textColor;
    }

    this.currentChart.update();
  }

  // Watch for theme changes
  watchThemeChanges() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
    }

    this.themeObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'data-theme') {
          this.updateTheme();
        }
      });
    });

    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  initialize() {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    this.safeDestroy();
    
    const ctx = this.canvas.getContext('2d');
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    try {
      this.currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['No Data'],
          datasets: [{
            label: 'No Data',
            data: [1],
            backgroundColor: 'rgba(229, 229, 231, 0.5)',
            borderColor: 'rgba(229, 229, 231, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { 
            legend: { display: false },
            title: {
              display: true,
              text: 'No Data Available',
              color: this.getThemeTextColor(),
              font: { size: 16, weight: 'bold' }
            },
            tooltip: { enabled: false }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      });
      
      this.isDestroyed = false;
      this.watchThemeChanges();
      console.log('Chart initialized with no data state');
    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }

  safeDestroy() {
    if (this.themeObserver) {
      this.themeObserver.disconnect();
      this.themeObserver = null;
    }

    if (this.currentChart) {
      try {
        this.currentChart.destroy();
      } catch (error) {
        console.warn('Error destroying chart:', error);
      }
      this.currentChart = null;
    }
    
    if (this.canvas) {
      const ctx = this.canvas.getContext('2d');
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    this.isDestroyed = true;
  }

  updateChart(data, type = 'auto', title = 'Data Visualization') {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return false;
    }

    console.log('🔄 Updating chart:', { dataType: typeof data, chartType: type, title });

    if (!data || !data.datasets || !Array.isArray(data.datasets) || data.datasets.length === 0) {
      console.warn('No valid chart data provided');
      this.showNoData();
      return false;
    }

    if (!data.labels || !Array.isArray(data.labels) || data.labels.length === 0) {
      console.warn('No labels provided, generating default labels');
      data.labels = data.datasets[0].data.map((_, i) => `Item ${i + 1}`);
    }

    this.chartData = JSON.parse(JSON.stringify(data));
    
    this.safeDestroy();

    const chartType = type === 'auto' ? this.determineChartType(data) : type;
    
    const preparedData = this.prepareChartData(data, chartType);
    
    const options = this.getOptions(chartType);
    options.plugins.title.text = title;

    try {
      const ctx = this.canvas.getContext('2d');
      
      this.currentChart = new Chart(ctx, {
        type: chartType,
        data: preparedData,
        options: options
      });

      this.applyColors();
      this.updateTheme(); // Apply theme colors
      this.currentChart.update();
      this.watchThemeChanges(); // Start watching for theme changes
      
      console.log('✅ Chart updated successfully with type:', chartType);
      return true;
      
    } catch (error) {
      console.error('❌ Error creating chart:', error);
      this.showNoData();
      return false;
    }
  }

  updateChartType(type) {
    if (!this.currentChart || !this.chartData) {
      console.warn('No chart or data to update type');
      return false;
    }
    
    console.log('Updating chart type to:', type);
    return this.updateChart(this.chartData, type, this.currentChart.options.plugins.title.text);
  }

  determineChartType(data) {
    const dataset = data.datasets?.[0];
    if (!dataset?.data) return 'bar';

    const labels = data.labels || [];
    const dataPoints = dataset.data || [];

    if (labels.length <= 7 && labels.length > 0) {
      const numericData = dataPoints.filter(v => typeof v === 'number');
      if (numericData.length > 0) {
        const sum = numericData.reduce((a, b) => a + b, 0);
        if (Math.abs(sum - 100) < 10) return 'pie';
      }
      return 'pie';
    }

    return 'bar';
  }

  prepareChartData(data, chartType) {
    const prepared = {
      labels: [...data.labels],
      datasets: data.datasets.map(ds => ({
        label: ds.label || 'Dataset',
        data: [...ds.data],
        borderWidth: 2,
        tension: 0.1
      }))
    };

    if (chartType === 'pie' || chartType === 'doughnut') {
      if (prepared.datasets.length > 1) {
        console.log('Pie/Doughnut chart: using only first dataset');
        prepared.datasets = [prepared.datasets[0]];
      }
      
      prepared.datasets[0].data = prepared.datasets[0].data.map(v => 
        typeof v === 'number' ? v : parseFloat(v) || 0
      );
    }

    return prepared;
  }

  getOptions(chartType) {
    const options = JSON.parse(JSON.stringify(this.defaultOptions));

    if (chartType === 'pie' || chartType === 'doughnut') {
      options.scales = {};
      options.cutout = chartType === 'doughnut' ? '50%' : 0;
      options.plugins.legend.position = 'right';
      options.plugins.tooltip.callbacks = {
        label: (ctx) => {
          const label = ctx.label || '';
          const value = ctx.raw || 0;
          const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
          return `${label}: ${value.toLocaleString()} (${percentage}%)`;
        }
      };
    }

    return options;
  }

  applyColors() {
    if (!this.currentChart?.data?.datasets) return;
    
    const chartType = this.currentChart.config.type;
    
    this.currentChart.data.datasets.forEach((ds, i) => {
      const idx = i % this.colorPalettes.primary.length;
      
      if (chartType === 'pie' || chartType === 'doughnut') {
        const dataLength = ds.data?.length || 0;
        ds.backgroundColor = Array.from({ length: dataLength }, (_, j) => 
          this.colorPalettes.primary[(idx + j) % this.colorPalettes.primary.length]
        );
        ds.borderColor = '#ffffff';
        ds.borderWidth = 2;
      } else {
        if (!ds.backgroundColor) {
          ds.backgroundColor = this.colorPalettes.light[idx];
        }
        if (!ds.borderColor) {
          ds.borderColor = this.colorPalettes.primary[idx];
        }
        if (!ds.pointBackgroundColor) {
          ds.pointBackgroundColor = this.colorPalettes.primary[idx];
        }
        if (!ds.pointBorderColor) {
          ds.pointBorderColor = '#ffffff';
        }
      }
    });
    
    this.currentChart.update();
  }

  showNoData() {
    this.safeDestroy();
    
    if (!this.canvas) return;
    
    try {
      const ctx = this.canvas.getContext('2d');
      
      this.currentChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['No Data'],
          datasets: [{
            label: 'No Data',
            data: [1],
            backgroundColor: 'rgba(229, 229, 231, 0.5)',
            borderColor: 'rgba(229, 229, 231, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'No Data Available',
              color: this.getThemeTextColor(),
              font: { size: 16, weight: 'bold' },
              padding: { top: 10, bottom: 20 }
            },
            tooltip: { enabled: false }
          },
          scales: {
            x: { display: false },
            y: { display: false }
          }
        }
      });
      
      this.isDestroyed = false;
      this.watchThemeChanges();
    } catch (error) {
      console.error('Error showing no data:', error);
    }
  }

  exportChart(format = 'png', quality = 1.0) {
    if (!this.currentChart) {
      console.warn('No chart to export');
      return null;
    }
    
    try {
      const url = this.canvas.toDataURL(`image/${format}`, quality);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      link.download = `data-chart-${timestamp}.${format}`;
      link.href = url;
      link.click();
      
      console.log('Chart exported successfully');
      return url;
    } catch (error) {
      console.error('Error exporting chart:', error);
      return null;
    }
  }

  destroy() {
    this.safeDestroy();
    this.chartData = null;
    console.log('Chart manager destroyed');
  }
}

// Export functions for global use
window.chartUtils = {
  getCurrentTheme,
  getChartColors,
  ChartManager
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
}