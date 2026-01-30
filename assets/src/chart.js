// src/chart.js - Data Examiner Visualization Manager
// Compatible with Chart.js v4+, includes time scale support and dynamic titles

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
        duration: 1000, 
        easing: 'easeOutQuart',
        onComplete: () => {
          console.log('Chart animation complete');
        }
      },
      hover: { animationDuration: 0 }
    };

    this.colorPalettes = {
      primary: [
        'rgba(16, 163, 127, 0.8)',   // Primary green
        'rgba(102, 126, 234, 0.8)',  // Primary blue
        'rgba(255, 107, 107, 0.8)',  // Red
        'rgba(255, 159, 64, 0.8)',   // Orange
        'rgba(75, 192, 192, 0.8)',   // Teal
        'rgba(153, 102, 255, 0.8)',  // Purple
        'rgba(255, 205, 86, 0.8)',   // Yellow
        'rgba(54, 162, 235, 0.8)'    // Light blue
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

    this.currentChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['No Data'],
        datasets: [{
          label: 'No Data',
          data: [0],
          backgroundColor: 'rgba(229, 229, 231, 0.5)',
          borderColor: 'rgba(229, 229, 231, 1)',
          borderWidth: 1
        }]
      },
      options: {
        ...this.defaultOptions,
        plugins: { 
          ...this.defaultOptions.plugins, 
          tooltip: { enabled: false } 
        }
      }
    });
    
    console.log('Chart initialized with no data state');
  }

  updateChart(data, type = 'auto', title = 'Data Visualization') {
    if (!this.canvas) {
      console.error('Canvas element not found');
      return;
    }

    console.log('Updating chart:', { 
      dataType: typeof data, 
      chartType: type, 
      title 
    });

    // Destroy previous chart to allow safe type change
    if (this.currentChart) {
      console.log('Destroying previous chart');
      this.currentChart.destroy();
      this.currentChart = null;
    }

    if (!data || !data.datasets || data.datasets.length === 0) {
      console.warn('No valid chart data provided');
      this.showNoData();
      return;
    }

    this.chartData = data;
    const chartType = type === 'auto' ? this.determineChartType(data) : type;

    console.log('Chart type determined:', chartType);
    
    const ctx = this.canvas.getContext('2d');
    const preparedData = this.prepareChartData(data, chartType);
    const options = this.getOptions(chartType);

    // Set dynamic title from AI or fallback
    options.plugins.title.text = title;

    console.log('Creating new chart with data:', preparedData);
    
    try {
      this.currentChart = new Chart(ctx, {
        type: chartType,
        data: preparedData,
        options
      });

      this.applyColors();
      this.currentChart.update();
      
      console.log('Chart updated successfully');
    } catch (error) {
      console.error('Error creating chart:', error);
      this.showNoData();
    }
  }

  updateChartType(type) {
    if (!this.currentChart || !this.chartData) {
      console.warn('No chart or data to update type');
      return;
    }
    
    console.log('Updating chart type to:', type);
    this.updateChart(this.chartData, type, this.currentChart.options.plugins.title.text);
  }

  determineChartType(data) {
    const dataset = data.datasets?.[0];
    if (!dataset?.data) return 'bar';

    const labels = data.labels || [];
    const dataPoints = dataset.data || [];

    // If data looks like percentages (sum close to 100) and small number of categories
    if (labels.length <= 6) {
      const sum = dataPoints.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 100) < 5) return 'pie';
    }

    // If we have date-like labels, use line chart
    if (labels.length >= 5 && this.isDateData(labels)) {
      return 'line';
    }

    // Default to bar for categorical data
    return 'bar';
  }

  prepareChartData(data, chartType) {
    console.log('Preparing chart data for type:', chartType);
    
    // Validate data structure
    if (!data.labels || !Array.isArray(data.labels)) {
      data.labels = data.labels || Array.from({ length: data.datasets?.[0]?.data?.length || 0 }, (_, i) => `Item ${i + 1}`);
    }

    const prepared = {
      labels: data.labels,
      datasets: data.datasets.map((ds, i) => {
        const base = {
          label: ds.label || `Dataset ${i + 1}`,
          data: ds.data || [],
          borderWidth: 2,
          tension: 0.1
        };

        switch (chartType) {
          case 'line': 
            return { 
              ...base, 
              fill: true, 
              pointRadius: 4, 
              pointHoverRadius: 6,
              borderColor: ds.borderColor,
              backgroundColor: ds.backgroundColor || 'rgba(16, 163, 127, 0.1)'
            };
          case 'bar':  
            return { 
              ...base, 
              borderRadius: 4, 
              borderSkipped: false,
              backgroundColor: ds.backgroundColor,
              borderColor: ds.borderColor
            };
          case 'pie':
          case 'doughnut':
            return { 
              ...base, 
              borderWidth: 1, 
              hoverOffset: 15,
              backgroundColor: ds.backgroundColor,
              borderColor: ds.borderColor || '#ffffff'
            };
          default: 
            return base;
        }
      })
    };

    // For pie/doughnut charts, only show first dataset
    if ((chartType === 'pie' || chartType === 'doughnut') && prepared.datasets.length > 1) {
      console.warn('Pie/Doughnut chart: showing only first dataset');
      prepared.datasets = [prepared.datasets[0]];
    }

    console.log('Prepared data structure:', {
      labelsCount: prepared.labels.length,
      datasetsCount: prepared.datasets.length,
      firstDatasetDataLength: prepared.datasets[0]?.data?.length
    });

    return prepared;
  }

  getOptions(chartType) {
    const opts = JSON.parse(JSON.stringify(this.defaultOptions));

    switch (chartType) {
      case 'line':
        opts.scales.x = {
          ...opts.scales.x,
          type: this.isDateData(this.chartData?.labels) ? 'time' : 'category',
          time: this.isDateData(this.chartData?.labels)
            ? { 
                unit: 'day', 
                tooltipFormat: 'MMM d, yyyy',
                displayFormats: {
                  day: 'MMM d',
                  week: 'MMM d',
                  month: 'MMM yyyy'
                }
              }
            : undefined
        };
        break;

      case 'bar':
        opts.indexAxis = 'x';
        opts.scales.x.stacked = this.chartData?.datasets?.length > 1;
        opts.scales.y.stacked = this.chartData?.datasets?.length > 1;
        break;

      case 'pie':
      case 'doughnut':
        opts.plugins.legend.position = 'right';
        opts.cutout = chartType === 'doughnut' ? '50%' : 0;
        opts.plugins.tooltip.callbacks = {
          label: (ctx) => {
            const label = ctx.label || '';
            const val = ctx.raw || 0;
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = Math.round((val / total) * 100);
            return `${label}: ${val.toLocaleString()} (${pct}%)`;
          }
        };
        break;
    }

    return opts;
  }

  isDateData(labels) {
    if (!labels?.length) return false;
    const patterns = [
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{4}-\d{2}-\d{2}T/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{2}\/\d{2}\/\d{2}$/,
      /^[A-Za-z]{3} \d{1,2}$/,
      /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i
    ];
    return labels.some(l => patterns.some(p => p.test(String(l))));
  }

  applyColors() {
    if (!this.currentChart?.data?.datasets) return;
    
    this.currentChart.data.datasets.forEach((ds, i) => {
      const idx = i % this.colorPalettes.primary.length;
      
      // Only apply default colors if not already set
      if (!ds.backgroundColor || ds.backgroundColor.length === 0) {
        if (this.currentChart.config.type === 'pie' || 
            this.currentChart.config.type === 'doughnut') {
          // For pie/doughnut, generate array of colors for each data point
          const dataLength = ds.data?.length || 0;
          ds.backgroundColor = Array.from({ length: dataLength }, (_, j) => 
            this.colorPalettes.primary[(idx + j) % this.colorPalettes.primary.length]
          );
        } else {
          // For line/bar, single color for dataset
          ds.backgroundColor = this.colorPalettes.light[idx];
        }
      }
      
      if (!ds.borderColor) {
        if (this.currentChart.config.type === 'pie' || 
            this.currentChart.config.type === 'doughnut') {
          // For pie/doughnut, border is usually white
          ds.borderColor = '#ffffff';
        } else {
          // For line/bar, use primary color
          ds.borderColor = this.colorPalettes.primary[idx];
        }
      }
      
      if (!ds.pointBackgroundColor) {
        ds.pointBackgroundColor = this.colorPalettes.primary[idx];
      }
      
      if (!ds.pointBorderColor) {
        ds.pointBorderColor = '#ffffff';
      }
    });
    
    console.log('Applied colors to chart');
  }

  showNoData() {
    if (!this.canvas) return;
    
    const ctx = this.canvas.getContext('2d');
    if (this.currentChart) this.currentChart.destroy();

    console.log('Showing "No Data" chart state');
    
    this.currentChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['No Data Available'],
        datasets: [{
          label: 'No Data',
          data: [1],
          backgroundColor: 'rgba(229, 229, 231, 0.5)',
          borderColor: 'rgba(229, 229, 231, 1)',
          borderWidth: 1
        }]
      },
      options: {
        ...this.defaultOptions,
        plugins: { 
          ...this.defaultOptions.plugins, 
          title: {
            ...this.defaultOptions.plugins.title,
            text: 'No Data Available'
          },
          tooltip: { enabled: false } 
        },
        scales: {
          x: { display: false },
          y: { display: false }
        }
      }
    });
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
    if (this.currentChart) {
      this.currentChart.destroy();
      this.currentChart = null;
    }
    this.chartData = null;
    console.log('Chart manager destroyed');
  }
}

// For Node.js compatibility (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
}