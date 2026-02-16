// src/chart.js - Data Examiner Visualization Manager - COMPLETE FIXED VERSION

class ChartManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.currentChart = null;
    this.chartData = null;
    this.isDestroyed = false;

    this.defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: 'var(--text-primary)',
            font: { size: 12, family: "'Segoe UI', Roboto, sans-serif" }
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
          color: 'var(--text-primary)',
          font: { size: 16, weight: 'bold' },
          padding: { top: 10, bottom: 20 }
        }
      },
      scales: {
        x: {
          type: 'category',
          grid: { 
            color: 'var(--border-color)', 
            drawBorder: false 
          },
          ticks: { 
            color: 'var(--text-secondary)', 
            maxRotation: 45,
            font: { size: 11 }
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
            font: { size: 11 },
            callback: (value) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value;
            }
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
              color: 'var(--text-primary)',
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
      console.log('Chart initialized with no data state');
    } catch (error) {
      console.error('Error initializing chart:', error);
    }
  }

  safeDestroy() {
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
      this.currentChart.update();
      
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
              color: 'var(--text-primary)',
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
}