const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const helmet = require('helmet');
const compression = require('compression');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'assets')));

// Create directories
const directories = ['uploads', 'assets/icons', 'assets/favicon'];
directories.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Enhanced storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/plain'
  ];
  
  const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json', '.txt', '.xlsm'];
  
  const extension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1
  },
  fileFilter: fileFilter
});

// Session storage for chat context (in production, use Redis or database)
const sessionStore = new Map();

// Parse CSV
const parseCSV = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(new Error('Failed to parse CSV file. Please check the format.'));
      });
  });
};

// Parse Excel
const parseExcel = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheets = {};
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      sheets[sheetName] = XLSX.utils.sheet_to_json(worksheet);
    });
    
    return sheets;
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error('Failed to parse Excel file. Please ensure it\'s a valid Excel file.');
  }
};

// Enhanced AI analysis with conversation context
const analyzeDataWithAI = async (data, question, sessionId = null, conversationHistory = []) => {
  try {
    // Get session context if available
    let context = '';
    if (sessionId && sessionStore.has(sessionId)) {
      const session = sessionStore.get(sessionId);
      context = `Previous analysis context: ${session.context || 'No previous context'}`;
    }

    // Prepare data sample (limit size for token constraints)
    let dataSample;
    if (Array.isArray(data)) {
      dataSample = data.slice(0, 50);
    } else if (typeof data === 'object') {
      // Handle multiple sheets
      const firstSheet = Object.values(data)[0];
      dataSample = Array.isArray(firstSheet) ? firstSheet.slice(0, 50) : [firstSheet];
    } else {
      dataSample = [{ data: 'Data sample not available' }];
    }

    const messages = [
      {
        role: 'system',
        content: `You are Data Examiner, an expert AI data analyst. Your task is to analyze data and provide insights.
        
        GUIDELINES:
        1. Provide clear, actionable insights in markdown format
        2. Include specific statistics and patterns found
        3. Suggest relevant visualizations
        4. Offer business recommendations
        5. Highlight data quality issues if any
        6. Use bullet points for readability
        7. Keep explanations simple but thorough
        
        Format your response with these sections:
        ## 📊 Executive Summary
        ## 🔍 Key Findings
        ## 📈 Data Statistics
        ## 🎯 Recommendations
        ## 📊 Suggested Visualizations
        ## ⚠️ Data Quality Notes
        
        ${context}`
      },
      ...conversationHistory.slice(-5), // Keep last 5 messages for context
      {
        role: 'user',
        content: `Question: ${question}

Data Sample (${Array.isArray(data) ? data.length : 'multiple sheets'} total rows):
${JSON.stringify(dataSample, null, 2)}

Please analyze this data and provide comprehensive insights.`
      }
    ];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: messages,
        temperature: 0.7,
        max_tokens: 4000,
        top_p: 0.9,
        frequency_penalty: 0.3,
        presence_penalty: 0.3
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const analysis = result.choices[0].message.content;

    // Generate visualization suggestions
    const chartData = prepareAdvancedChartData(data);
    const visualizationSuggestions = generateVisualizationSuggestions(data);

    // Store session context
    if (sessionId) {
      sessionStore.set(sessionId, {
        context: analysis.substring(0, 500), // Store first 500 chars as context
        lastUpdate: Date.now(),
        dataSummary: {
          rows: Array.isArray(data) ? data.length : 'multiple',
          columns: Array.isArray(data) && data.length > 0 ? Object.keys(data[0]) : []
        }
      });
    }

    return {
      analysis,
      chartData,
      visualizationSuggestions,
      conversationId: sessionId || uuidv4()
    };

  } catch (error) {
    console.error('AI Analysis Error:', error);
    
    // Fallback analysis
    return {
      analysis: `## ⚠️ AI Analysis Temporarily Unavailable
      
      **Data Overview:**
      - Data processed successfully
      - Detailed AI insights temporarily unavailable
      
      **Next Steps:**
      1. Try re-uploading your file
      2. Check your internet connection
      3. Contact support if issue persists
      
      *Error Details: ${error.message}*`,
      chartData: prepareAdvancedChartData(data),
      visualizationSuggestions: [],
      conversationId: sessionId || uuidv4()
    };
  }
};

// Enhanced chart data preparation
function prepareAdvancedChartData(data) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  let dataset;
  if (Array.isArray(data)) {
    dataset = data;
  } else if (typeof data === 'object') {
    // Use first sheet for chart
    const firstSheet = Object.values(data)[0];
    dataset = Array.isArray(firstSheet) ? firstSheet : [firstSheet];
  } else {
    return null;
  }

  if (dataset.length === 0) return null;

  const sample = dataset[0];
  const columns = Object.keys(sample);
  
  // Find numeric and date columns
  const numericColumns = columns.filter(col => {
    const value = sample[col];
    return !isNaN(parseFloat(value)) && value !== null && value !== '' && isFinite(value);
  });

  const dateColumns = columns.filter(col => {
    const value = sample[col];
    return !isNaN(Date.parse(value));
  });

  if (numericColumns.length === 0 && dateColumns.length === 0) {
    return null;
  }

  // Prepare datasets for different chart types
  const chartConfigs = [];

  // Line/Bar chart for numeric data
  if (numericColumns.length > 0) {
    const primaryNumeric = numericColumns[0];
    const values = dataset
      .slice(0, 100)
      .map(row => parseFloat(row[primaryNumeric]))
      .filter(v => !isNaN(v));

    if (values.length > 0) {
      chartConfigs.push({
        type: 'line',
        title: `Trend of ${primaryNumeric}`,
        data: {
          labels: Array.from({ length: values.length }, (_, i) => `Point ${i + 1}`),
          datasets: [{
            label: primaryNumeric,
            data: values,
            backgroundColor: 'rgba(16, 163, 127, 0.1)',
            borderColor: 'rgba(16, 163, 127, 1)',
            borderWidth: 2,
            tension: 0.4,
            fill: true
          }]
        }
      });
    }
  }

  // Pie chart for categorical data if we have limited unique values
  const categoricalColumns = columns.filter(col => {
    const uniqueValues = [...new Set(dataset.slice(0, 50).map(row => row[col]))];
    return uniqueValues.length > 1 && uniqueValues.length <= 10;
  });

  if (categoricalColumns.length > 0) {
    const catColumn = categoricalColumns[0];
    const valueCounts = {};
    dataset.slice(0, 50).forEach(row => {
      const value = row[catColumn];
      valueCounts[value] = (valueCounts[value] || 0) + 1;
    });

    chartConfigs.push({
      type: 'pie',
      title: `Distribution of ${catColumn}`,
      data: {
        labels: Object.keys(valueCounts),
        datasets: [{
          data: Object.values(valueCounts),
          backgroundColor: [
            'rgba(16, 163, 127, 0.8)',
            'rgba(102, 126, 234, 0.8)',
            'rgba(255, 107, 107, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ]
        }]
      }
    });
  }

  return chartConfigs.length > 0 ? chartConfigs : null;
}

function generateVisualizationSuggestions(data) {
  const suggestions = [];
  
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return suggestions;
  }

  let dataset;
  if (Array.isArray(data)) {
    dataset = data;
  } else {
    const firstSheet = Object.values(data)[0];
    dataset = Array.isArray(firstSheet) ? firstSheet : [firstSheet];
  }

  if (dataset.length === 0) return suggestions;

  const sample = dataset[0];
  const columns = Object.keys(sample);
  
  // Check for time series
  const dateColumns = columns.filter(col => !isNaN(Date.parse(sample[col])));
  const numericColumns = columns.filter(col => !isNaN(parseFloat(sample[col])));

  if (dateColumns.length > 0 && numericColumns.length > 0) {
    suggestions.push({
      type: 'time-series',
      description: `Line chart showing ${numericColumns[0]} over time`,
      reason: 'Time series data detected'
    });
  }

  // Check for categorical vs numeric
  const categoricalColumns = columns.filter(col => {
    const uniqueValues = [...new Set(dataset.slice(0, 20).map(row => row[col]))];
    return uniqueValues.length <= 10;
  });

  if (categoricalColumns.length > 0 && numericColumns.length > 0) {
    suggestions.push({
      type: 'bar-chart',
      description: `Bar chart comparing ${numericColumns[0]} across ${categoricalColumns[0]} categories`,
      reason: 'Categorical and numeric data combination'
    });
  }

  // Check for correlations
  if (numericColumns.length >= 2) {
    suggestions.push({
      type: 'scatter-plot',
      description: `Scatter plot showing relationship between ${numericColumns[0]} and ${numericColumns[1]}`,
      reason: 'Multiple numeric variables for correlation analysis'
    });
  }

  return suggestions;
}

// Routes
app.post('/api/analyze/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log(`Processing file: ${req.file.originalname}`);

    let data;
    const filePath = req.file.path;
    const fileType = req.file.mimetype;

    try {
      if (fileType === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv')) {
        data = await parseCSV(filePath);
      } else if (
        fileType.includes('spreadsheetml') ||
        fileType.includes('excel') ||
        req.file.originalname.toLowerCase().match(/\.(xlsx|xls|xlsm)$/)
      ) {
        data = parseExcel(filePath);
      } else if (fileType === 'application/json') {
        const content = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(content);
      } else {
        // Text file
        const content = fs.readFileSync(filePath, 'utf-8');
        data = [{ content }];
      }
    } catch (parseError) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        error: `Failed to parse file: ${parseError.message}`
      });
    }

    // Clean up file
    fs.unlinkSync(filePath);

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'No valid data found in the file'
      });
    }

    const question = req.body.question || "Provide comprehensive analysis of this data";
    const sessionId = req.body.conversationId || uuidv4();
    
    const result = await analyzeDataWithAI(data, question, sessionId);

    res.json({
      success: true,
      message: `Successfully analyzed ${Array.isArray(data) ? data.length : 'multiple sheets'} data points`,
      ...result,
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
        uploadTime: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('File analysis error:', error);
    
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze file',
      details: error.message
    });
  }
});

app.post('/api/analyze/text', async (req, res) => {
  try {
    const { text, question, conversationId } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'No text provided'
      });
    }

    let parsedData;
    try {
      parsedData = JSON.parse(text);
    } catch {
      // Try CSV parsing
      const lines = text.trim().split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const delimiter = text.includes('\t') ? '\t' : (text.includes(';') ? ';' : ',');
        const headers = lines[0].split(delimiter).map(h => h.trim());
        parsedData = lines.slice(1).map(line => {
          const values = line.split(delimiter).map(v => v.trim());
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });
      } else {
        parsedData = [{ text }];
      }
    }

    if (!Array.isArray(parsedData)) {
      parsedData = [parsedData];
    }

    if (parsedData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid data found in text'
      });
    }

    const sessionId = conversationId || uuidv4();
    const result = await analyzeDataWithAI(parsedData, question || "Analyze this data", sessionId);

    res.json({
      success: true,
      message: `Analyzed ${parsedData.length} data points`,
      ...result
    });

  } catch (error) {
    console.error('Text analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze text',
      details: error.message
    });
  }
});

app.post('/api/chat/followup', async (req, res) => {
  try {
    const { question, conversationId, previousAnalysis } = req.body;
    
    if (!question || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing question or conversation ID'
      });
    }

    // Get session data (in production, this would be from a database)
    const session = sessionStore.get(conversationId) || {};
    
    const result = await analyzeDataWithAI(
      session.dataSummary || {},
      question,
      conversationId,
      previousAnalysis ? [previousAnalysis] : []
    );

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Chat follow-up error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process follow-up question',
      details: error.message
    });
  }
});

app.get('/api/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    sessions: sessionStore.size,
    version: '2.0.0'
  };
  
  res.json(health);
});

app.get('/api/session/:id', (req, res) => {
  const session = sessionStore.get(req.params.id);
  
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Session not found'
    });
  }
  
  res.json({
    success: true,
    session
  });
});

app.delete('/api/session/:id', (req, res) => {
  sessionStore.delete(req.params.id);
  
  res.json({
    success: true,
    message: 'Session cleared'
  });
});

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds 50MB limit';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    }
    
    return res.status(400).json({
      success: false,
      error: message
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 DATA EXAMINER 2.0.0
  ==========================================
  
  📍 Server: http://localhost:${PORT}
  🔧 Environment: ${process.env.NODE_ENV || 'development'}
  💾 Uploads: ./uploads/
  🎨 Assets: ./assets/
  
  📡 API Endpoints:
      POST   /api/analyze/file
      POST   /api/analyze/text
      POST   /api/chat/followup
      GET    /api/health
      GET    /api/session/:id
      DELETE /api/session/:id
  
  ==========================================
  ✅ Server ready!
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  
  // Clean up uploads
  const uploadDir = 'uploads';
  if (fs.existsSync(uploadDir)) {
    fs.readdirSync(uploadDir).forEach(file => {
      fs.unlinkSync(path.join(uploadDir, file));
    });
  }
  
  server.close(() => {
    console.log('Server closed. Goodbye!');
    process.exit(0);
  });
});