const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const csv = require('csv-parser');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'assets'))); // ✅ Changed from 'public' to 'assets'

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Updated Multer v2 configuration with proper error handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// ✅ File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json',
    'text/plain'
  ];
  
  const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json', '.txt'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type. Allowed: CSV, Excel, JSON, Text. Got: ${file.mimetype}`), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: fileFilter
});

// Parse CSV file
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(new Error('Failed to parse CSV file. Please ensure it\'s properly formatted.'));
      });
  });
};

// Parse Excel file
const parseExcel = (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  } catch (error) {
    console.error('Excel parsing error:', error);
    throw new Error('Failed to parse Excel file. Please ensure it\'s a valid Excel file.');
  }
};

// ✅ Improved error handling for Groq API
const analyzeData = async (data, question = "Analyze this data") => {
  try {
    // Limit data size to avoid token limits
    const dataSample = data.slice(0, 100); // First 100 rows only
    
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [
          {
            role: 'system',
            content: `You are a data analysis expert. Analyze the provided data and give insights in simple terms that normal people can understand. 
            Include:
            1. Key trends and patterns
            2. Important statistics
            3. Business insights
            4. Recommendations
            5. Visualization suggestions
            
            Format with clear sections using markdown. Keep it concise but informative.`
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nData (${data.length} rows, showing sample):\n${JSON.stringify(dataSample, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error('Invalid response from Groq API');
    }
    
    return result.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing data:', error);
    
    // Provide a fallback analysis if API fails
    return `## Analysis Results

**Data Overview:**
- Total rows analyzed: ${data.length}
- Columns: ${Object.keys(data[0] || {}).join(', ') || 'N/A'}

**Key Statistics:**
The data has been processed successfully. Due to an API connection issue, detailed AI analysis is temporarily unavailable.

**Suggested Visualizations:**
1. Line chart for time-series data
2. Bar chart for categorical comparisons
3. Scatter plot for correlations

*Please try again in a moment or check your API key configuration.*`;
  }
};

// ✅ Updated routes with better error handling
app.post('/api/analyze/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded or invalid file type' 
      });
    }

    console.log(`Processing file: ${req.file.originalname}, Type: ${req.file.mimetype}`);

    let data;
    const filePath = req.file.path;
    const fileType = req.file.mimetype;

    // Parse file based on type
    try {
      if (fileType === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv')) {
        data = await parseCSV(filePath);
      } else if (
        fileType.includes('spreadsheetml') ||
        fileType.includes('excel') ||
        req.file.originalname.toLowerCase().match(/\.(xlsx|xls)$/)
      ) {
        data = parseExcel(filePath);
      } else if (fileType === 'application/json') {
        const content = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(content);
        if (!Array.isArray(data)) {
          data = [data];
        }
      } else {
        // Try to read as text
        const content = fs.readFileSync(filePath, 'utf-8');
        data = [{ content }];
      }
    } catch (parseError) {
      // Clean up file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      return res.status(400).json({
        success: false,
        error: `Failed to parse file: ${parseError.message}`
      });
    }

    // Clean up uploaded file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid data found in the file'
      });
    }

    console.log(`Successfully parsed ${data.length} rows from file`);

    const question = req.body.question || "Analyze this data and provide insights";
    const analysis = await analyzeData(data, question);

    const chartData = prepareChartData(data);

    res.json({
      success: true,
      message: `Successfully analyzed ${data.length} rows`,
      analysis,
      chartData,
      dataSummary: {
        totalRows: data.length,
        columns: data.length > 0 ? Object.keys(data[0]) : [],
        sample: data.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Error processing file:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false,
      error: 'Error processing file',
      details: error.message 
    });
  }
});

app.post('/api/analyze/text', async (req, res) => {
  try {
    const { text, question } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'No text provided' 
      });
    }

    let parsedData;
    try {
      // Try to parse as JSON first
      parsedData = JSON.parse(text);
    } catch (e) {
      // Try to parse as CSV-like text
      const lines = text.trim().split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim());
        parsedData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = values[index] || '';
          });
          return obj;
        });
      } else {
        parsedData = [{ text: text }];
      }
    }

    // Ensure we have an array
    if (!Array.isArray(parsedData)) {
      parsedData = [parsedData];
    }

    if (parsedData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid data found in the text'
      });
    }

    const analysis = await analyzeData(parsedData, question || "Analyze this data");
    const chartData = prepareChartData(parsedData);

    res.json({
      success: true,
      message: `Successfully analyzed ${parsedData.length} data points`,
      analysis,
      chartData,
      dataSummary: {
        totalRows: parsedData.length,
        columns: parsedData.length > 0 ? Object.keys(parsedData[0]) : [],
        sample: parsedData.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Error analyzing text:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error analyzing text',
      details: error.message 
    });
  }
});

// ✅ Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK', 
    app: 'Data Examiner',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      fileUpload: '/api/analyze/file',
      textAnalysis: '/api/analyze/text',
      health: '/api/health'
    }
  });
});

// ✅ Test endpoint for file upload
app.post('/api/test/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Clean up test file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.json({
      success: true,
      message: 'File upload test successful',
      file: {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ Helper function to prepare chart data
function prepareChartData(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const sample = data[0];
  const numericFields = Object.keys(sample).filter(key => {
    const value = sample[key];
    return !isNaN(parseFloat(value)) && value !== null && value !== '' && isFinite(value);
  });

  if (numericFields.length === 0) {
    return null;
  }

  // Use first numeric field for chart
  const field = numericFields[0];
  const values = data
    .slice(0, 50)
    .map(row => parseFloat(row[field]))
    .filter(v => !isNaN(v));

  if (values.length === 0) {
    return null;
  }

  return {
    labels: Array.from({ length: values.length }, (_, i) => `Item ${i + 1}`),
    datasets: [{
      label: field,
      data: values,
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1,
      tension: 0.1
    }]
  };
}

// ✅ Serve PWA manifest from assets folder
app.get('/manifest.json', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'manifest.json'));
});

// ✅ Serve service worker
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'service-worker.js'));
});

// ✅ Serve favicon files
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'favicon.ico'));
});

app.get('/favicon/:file', (req, res) => {
  const filePath = path.join(__dirname, 'assets', 'favicon', req.params.file);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Favicon not found' });
  }
});

app.get('/icons/:file', (req, res) => {
  const filePath = path.join(__dirname, 'assets', 'icons', req.params.file);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Icon not found' });
  }
});

// ✅ Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'index.html'));
});

// ✅ Updated error handling middleware for multer v2
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  
  // Multer v2 errors
  if (err instanceof multer.MulterError) {
    let message = err.message;
    
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'File size exceeds 10MB limit';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Too many files uploaded';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Unexpected file field';
    }
    
    return res.status(400).json({
      success: false,
      error: `File upload error: ${message}`
    });
  }
  
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// ✅ Start server with better logging
app.listen(PORT, '0.0.0.0',() => {
  console.log(`
  ====================================================
  🚀  DATA EXAMINER APP v1.0.0
  ====================================================
  
  📍  Server URL: http://localhost:${PORT}
  🔧  Environment: ${process.env.NODE_ENV || 'development'}
  📁  Static files: ./assets/
  💾  Uploads directory: ./uploads/
  
  📡  API Endpoints:
      POST   /api/analyze/file    - Upload and analyze files
      POST   /api/analyze/text    - Analyze pasted text
      GET    /api/health          - Health check
      POST   /api/test/upload     - Test file upload
  
  📱  PWA Features:
      ✅  Manifest: /manifest.json
      ✅  Service Worker: /service-worker.js
      ✅  Favicons: /favicon.ico, /favicon/*
      ✅  Icons: /icons/*
  
  ====================================================
  ✅  Server is running! Press Ctrl+C to stop.
  ====================================================
  `);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🔴 Server shutting down...');
  
  // Clean up uploads directory
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir);
    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });
  }
  
  console.log('✅ Cleanup complete. Goodbye!');
  process.exit(0);
});