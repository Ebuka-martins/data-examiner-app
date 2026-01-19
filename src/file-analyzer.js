class FileAnalyzer {
  constructor() {
    this.supportedFormats = [
      '.csv',
      '.xlsx',
      '.xls',
      '.txt',
      '.json'
    ];
  }

  async parseFile(file) {
    const extension = this.getFileExtension(file.name);
    
    switch (extension) {
      case '.csv':
        return await this.parseCSV(file);
      case '.xlsx':
      case '.xls':
        return await this.parseExcel(file);
      case '.json':
        return await this.parseJSON(file);
      case '.txt':
        return await this.parseText(file);
      default:
        throw new Error(`Unsupported file format: ${extension}`);
    }
  }

  getFileExtension(filename) {
    return filename.slice(filename.lastIndexOf('.')).toLowerCase();
  }

  async parseCSV(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const lines = text.split('\n');
          const headers = lines[0].split(',').map(h => h.trim());
          
          const data = lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
              const values = line.split(',').map(v => v.trim());
              const obj = {};
              headers.forEach((header, index) => {
                obj[header] = values[index] || '';
                
                // Try to convert to number if possible
                const numValue = parseFloat(obj[header]);
                if (!isNaN(numValue) && obj[header] !== '') {
                  obj[header] = numValue;
                }
              });
              return obj;
            });
          
          resolve({
            data,
            headers,
            summary: {
              totalRows: data.length,
              columns: headers,
              sample: data.slice(0, 5)
            }
          });
        } catch (error) {
          reject(new Error('Failed to parse CSV file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    });
  }

  async parseExcel(file) {
    // In a real app, you would use a library like SheetJS
    // For this example, we'll parse as text and simulate
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          // Simulate Excel parsing - in production, use XLSX library
          const text = event.target.result;
          const lines = text.split('\n').slice(0, 100); // First 100 lines
          const headers = ['Column1', 'Column2', 'Column3', 'Column4'];
          
          const data = lines.slice(1)
            .filter(line => line.trim())
            .map((line, index) => {
              const values = line.split('\t');
              return {
                Column1: values[0] || `Data ${index + 1}`,
                Column2: Math.random() * 100,
                Column3: Math.random() * 1000,
                Column4: `Category ${Math.floor(Math.random() * 5) + 1}`
              };
            });
          
          resolve({
            data,
            headers,
            summary: {
              totalRows: data.length,
              columns: headers,
              sample: data.slice(0, 5)
            }
          });
        } catch (error) {
          reject(new Error('Failed to parse Excel file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read Excel file'));
      reader.readAsText(file);
    });
  }

  async parseJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          const data = Array.isArray(jsonData) ? jsonData : [jsonData];
          const headers = data.length > 0 ? Object.keys(data[0]) : [];
          
          resolve({
            data,
            headers,
            summary: {
              totalRows: data.length,
              columns: headers,
              sample: data.slice(0, 5)
            }
          });
        } catch (error) {
          reject(new Error('Failed to parse JSON file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read JSON file'));
      reader.readAsText(file);
    });
  }

  async parseText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const text = event.target.result;
          const lines = text.split('\n').filter(line => line.trim());
          const headers = ['Content'];
          
          const data = lines.map((line, index) => ({
            Content: line,
            LineNumber: index + 1
          }));
          
          resolve({
            data,
            headers: ['Content', 'LineNumber'],
            summary: {
              totalRows: data.length,
              columns: ['Content', 'LineNumber'],
              sample: data.slice(0, 5)
            }
          });
        } catch (error) {
          reject(new Error('Failed to parse text file'));
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read text file'));
      reader.readAsText(file);
    });
  }

  analyzeDataStructure(data) {
    if (!data || data.length === 0) {
      return { insights: 'No data to analyze' };
    }

    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    
    const analysis = {
      totalRows: data.length,
      columns: columns,
      columnTypes: {},
      statisticalSummary: {}
    };

    // Analyze each column
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== '');
      const numericValues = values.filter(val => !isNaN(parseFloat(val)));
      
      if (numericValues.length > 0) {
        // Numeric column
        analysis.columnTypes[column] = 'numeric';
        const nums = numericValues.map(v => parseFloat(v));
        
        analysis.statisticalSummary[column] = {
          type: 'numeric',
          count: nums.length,
          min: Math.min(...nums),
          max: Math.max(...nums),
          average: nums.reduce((a, b) => a + b, 0) / nums.length,
          sum: nums.reduce((a, b) => a + b, 0)
        };
      } else {
        // Text column
        analysis.columnTypes[column] = 'text';
        const uniqueValues = [...new Set(values)];
        
        analysis.statisticalSummary[column] = {
          type: 'text',
          count: values.length,
          uniqueValues: uniqueValues.length,
          sampleValues: uniqueValues.slice(0, 5)
        };
      }
    });

    return analysis;
  }

  prepareForChart(data, analysis) {
    if (!data || data.length === 0) {
      return null;
    }

    const numericColumns = Object.entries(analysis.columnTypes)
      .filter(([_, type]) => type === 'numeric')
      .map(([col]) => col);

    if (numericColumns.length === 0) {
      return null;
    }

    // Use the first numeric column for chart
    const chartColumn = numericColumns[0];
    const chartData = data.slice(0, 50).map(row => ({
      x: row[numericColumns[1]] || `Item ${data.indexOf(row) + 1}`,
      y: parseFloat(row[chartColumn]) || 0
    })).filter(item => !isNaN(item.y));

    return {
      type: 'line', // Can be dynamic based on data
      data: {
        labels: chartData.map(item => item.x),
        datasets: [{
          label: chartColumn,
          data: chartData.map(item => item.y),
          backgroundColor: 'rgba(54, 162, 235, 0.2)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 2,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: `Analysis of ${chartColumn}`
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    };
  }
}

export default FileAnalyzer;