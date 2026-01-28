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
        // zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true } }, pan: { enabled: true } }
        // ^^^ uncomment above line + add zoom script in HTML if you want zoom/pan
      },
      scales: {
        x: {
          grid: { color: 'var(--border-color)', drawBorder: false },
          ticks: { color: 'var(--text-secondary)', maxRotation: 45 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'var(--border-color)', drawBorder: false },
          ticks: {
            color: 'var(--text-secondary)',
            callback: (value) => {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
              if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
              return value;
            }
          }
        }
      },
      interaction: { intersect: false, mode: 'index' },
      animation: { duration: 1000, easing: 'easeOutQuart' },
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

    const ctx = this.canvas.getContext('2d');

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

  updateChart(data, type = 'auto', title = 'Data Visualization') {
    if (!this.canvas) return;

    // Destroy previous chart to allow safe type change (Chart.js v4+ best practice)
    if (this.currentChart) {
      this.currentChart.destroy();
      this.currentChart = null;
    }

    if (!data || !data.datasets || data.datasets.length === 0) {
      this.showNoData();
      return;
    }

    this.chartData = data;
    const chartType = type === 'auto' ? this.determineChartType(data) : type;

    const ctx = this.canvas.getContext('2d');
    const preparedData = this.prepareChartData(data, chartType);
    const options = this.getOptions(chartType);

    // Set dynamic title from AI or fallback
    options.plugins.title.text = title;

    this.currentChart = new Chart(ctx, {
      type: chartType,
      data: preparedData,
      options
    });

    this.applyColors();
    this.currentChart.update();
  }

  updateChartType(type) {
    if (!this.currentChart || !this.chartData) return;
    this.updateChart(this.chartData, type);
  }

  determineChartType(data) {
    const dataset = data.datasets?.[0];
    if (!dataset?.data) return 'bar';

    if (data.labels?.length <= 7) return 'bar';
    if (this.isSequentialData(dataset.data)) return 'line';
    if (this.isPercentageData(dataset.data)) return 'pie';

    return 'bar';
  }

  isSequentialData(data) {
    if (data.length < 3) return false;
    let inc = 0, dec = 0;
    for (let i = 1; i < data.length; i++) {
      if (data[i] > data[i - 1]) inc++;
      if (data[i] < data[i - 1]) dec++;
    }
    const total = data.length - 1;
    return (inc / total > 0.7) || (dec / total > 0.7);
  }

  isPercentageData(data) {
    const sum = data.reduce((a, b) => a + b, 0);
    return Math.abs(sum - 100) < 5;
  }

  prepareChartData(data, chartType) {
    const prepared = {
      labels: data.labels || [],
      datasets: data.datasets.map((ds, i) => {
        const base = {
          label: ds.label || `Dataset ${i + 1}`,
          data: ds.data || [],
          borderWidth: 2,
          tension: 0.1
        };

        switch (chartType) {
          case 'line': return { ...base, fill: true, pointRadius: 4, pointHoverRadius: 6 };
          case 'bar':  return { ...base, borderRadius: 4, borderSkipped: false };
          case 'pie':
          case 'doughnut':
            return { ...base, borderWidth: 1, hoverOffset: 15 };
          default: return base;
        }
      })
    };

    if ((chartType === 'pie' || chartType === 'doughnut') && prepared.datasets.length > 1) {
      console.warn('Pie/Doughnut chart: showing only first dataset');
      prepared.datasets = [prepared.datasets[0]];
    }

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
            ? { unit: 'day', tooltipFormat: 'MMM d, yyyy' }
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
          ...opts.plugins.tooltip.callbacks,
          label: (ctx) => {
            const label = ctx.label || '';
            const val = ctx.parsed;
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
      /^[A-Za-z]{3} \d{1,2}$/
    ];
    return labels.some(l => patterns.some(p => p.test(String(l))));
  }

  applyColors() {
    if (!this.currentChart?.data?.datasets) return;
    this.currentChart.data.datasets.forEach((ds, i) => {
      const idx = i % this.colorPalettes.primary.length;
      ds.backgroundColor ??= this.colorPalettes.light[idx];
      ds.borderColor     ??= this.colorPalettes.primary[idx];
      ds.pointBackgroundColor ??= this.colorPalettes.primary[idx];
      ds.pointBorderColor ??= '#ffffff';
    });
  }

  showNoData() {
    if (!this.canvas) return;
    const ctx = this.canvas.getContext('2d');
    if (this.currentChart) this.currentChart.destroy();

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
        plugins: { ...this.defaultOptions.plugins, tooltip: { enabled: false } }
      }
    });
  }

  exportChart(format = 'png', quality = 1.0) {
    if (!this.currentChart) return null;
    const url = this.canvas.toDataURL(`image/${format}`, quality);
    const link = document.createElement('a');
    link.download = `data-chart-${Date.now()}.${format}`;
    link.href = url;
    link.click();
    return url;
  }

  destroy() {
    if (this.currentChart) {
      this.currentChart.destroy();
      this.currentChart = null;
    }
    this.chartData = null;
  }
}

// For Node.js compatibility (optional)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChartManager;
}