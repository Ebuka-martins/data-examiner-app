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

// ==========================
// Security & performance
// ==========================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        scriptSrcElem: ["'self'", 'https://cdn.jsdelivr.net'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================
// Static files - FIXED PATH
// ==========================
// Serve static files from the 'assets' directory
app.use(express.static(path.join(__dirname, 'assets')));

// Serve JavaScript files from src directory
app.use('/src', express.static(path.join(__dirname, 'assets/src')));

// Serve icon files
app.use('/icons', express.static(path.join(__dirname, 'assets/icons')));
app.use('/favicon', express.static(path.join(__dirname, 'assets/favicon')));

// ==========================
// Multer setup
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create uploads directory if it doesn't exist
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.csv', '.xlsx', '.xls', '.json', '.txt'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error('Unsupported file type'), false);
};

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter,
});

// Ensure uploads folder exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// ==========================
// File parsers
// ==========================
const parseCSV = (filePath) =>
  new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });

const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheets = {};
  workbook.SheetNames.forEach((name) => {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
  });
  return sheets;
};

// ==========================
// In-memory conversation storage (for demo - use database in production)
// ==========================
const conversationStore = new Map();

const getConversationContext = (sessionId) => {
  return conversationStore.get(sessionId) || [];
};

const addToConversation = (sessionId, role, content) => {
  if (!conversationStore.has(sessionId)) {
    conversationStore.set(sessionId, []);
  }
  const conversation = conversationStore.get(sessionId);
  conversation.push({ role, content });
  // Keep only last 20 messages to avoid token limits
  if (conversation.length > 20) {
    conversation.splice(0, conversation.length - 20);
  }
};

// ==========================
// AI Analysis with Enhanced System Prompt
// ==========================
const analyzeDataWithAI = async (data, question, sessionId = null, isFollowUp = false) => {
  try {
    const sample = Array.isArray(data) ? data.slice(0, 50) : data;
    const sessionIdToUse = sessionId || uuidv4();
    
    // Get conversation history for follow-ups
    const conversationHistory = isFollowUp ? getConversationContext(sessionIdToUse) : [];

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `You are Data Examiner, an expert data analyst. Analyze the provided data and return your response in a structured format.

IMPORTANT: STRUCTURE YOUR RESPONSE EXACTLY LIKE THIS:

# Overview
[Brief 2-3 sentence summary of what the data shows]

## Key Metrics
[Format each metric as "Metric Name: Value" on separate lines]
Total Records: [number]
Average Value: [number with currency if applicable]
Growth Rate: [percentage]
Max Value: [number]
Min Value: [number]

## Key Insights
- [First key insight in 1 clear sentence]
- [Second key insight in 1 clear sentence]
- [Third key insight in 1 clear sentence]

## Recommendations
1. [First actionable recommendation]
2. [Second actionable recommendation]
3. [Third actionable recommendation]

## Key Finding
[The single most important finding in 1-2 sentences]

Format numbers nicely (e.g., 1,234, 15.5%, $1,250.50).
Be concise but insightful.

CRITICAL: If a chart would help visualize the data, you MUST include a JSON object at the end with chart data.
The JSON should be wrapped in \`\`\`json \`\`\` code blocks:

\`\`\`json
{
  "chart": {
    "title": "Descriptive chart title",
    "type": "bar|line|pie|doughnut",
    "data": {
      "labels": ["Category1", "Category2"],
      "datasets": [{
        "label": "Dataset Name",
        "data": [10, 20],
        "backgroundColor": ["#10a37f", "#667eea"]
      }]
    }
  }
}
\`\`\`

Use markdown for formatting. DO NOT use color:transparent or invisible text.`,
      },
    ];

    // Add conversation history for follow-ups
    conversationHistory.forEach(msg => {
      messages.push(msg);
    });

    // Add current user message
    messages.push({
      role: 'user',
      content: `Question: ${question}

Data sample (first 50 rows):
${JSON.stringify(sample, null, 2)}`,
    });

    console.log('Sending request to Groq API...');
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: messages,
          temperature: 0.7,
          max_tokens: 4000,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Groq API error:', errBody);
      throw new Error(`Groq HTTP ${response.status} – ${errBody}`);
    }

    const result = await response.json();
    const rawContent = result.choices[0].message.content;

    console.log('Raw AI response received');
    
    // Clean the response to remove invisible characters
    let cleanedContent = rawContent
      .replace(/\u0000/g, '') // Remove null characters
      .replace(/[^\S\r\n]+/g, ' ') // Normalize spaces
      .replace(/\u200B/g, '') // Remove zero-width spaces
      .trim();
    
    let analysis = cleanedContent;
    let chartData = null;
    let chartTitle = 'Data Visualization';
    let chartType = 'auto';

    // Extract JSON chart block if present
    const jsonMatch = cleanedContent.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      try {
        console.log('Found JSON in response, parsing...');
        const jsonStr = jsonMatch[1];
        const parsed = JSON.parse(jsonStr);
        
        // Check for different possible JSON structures
        if (parsed.chart?.data) {
          // New format: { chart: { data: {...}, title: "...", type: "..." } }
          chartData = parsed.chart.data;
          chartTitle = parsed.chart.title || chartTitle;
          chartType = parsed.chart.type || chartType;
        } else if (parsed.data) {
          // Format: { data: {...}, title: "..." }
          chartData = parsed.data;
          chartTitle = parsed.title || chartTitle;
          chartType = parsed.type || chartType;
        } else if (parsed.labels && parsed.datasets) {
          // Direct chart data format
          chartData = parsed;
        } else if (parsed.chartData) {
          // Legacy format: { chartData: {...}, chartTitle: "..." }
          chartData = parsed.chartData;
          chartTitle = parsed.chartTitle || chartTitle;
        }
        
        // Remove the JSON block from analysis text
        analysis = cleanedContent.replace(jsonMatch[0], '').trim();
        console.log('Chart data extracted successfully:', {
          hasChartData: !!chartData,
          chartType,
          chartTitle
        });
        
      } catch (e) {
        console.warn('Failed to parse chart JSON:', e.message);
        console.warn('JSON content was:', jsonMatch[1]);
      }
    } else {
      console.log('No JSON chart data found in response');
    }

    // Store in conversation history
    addToConversation(sessionIdToUse, 'user', question);
    addToConversation(sessionIdToUse, 'assistant', cleanedContent);

    return {
      success: true,
      analysis,
      chartData,
      chartTitle,
      chartType,
      conversationId: sessionIdToUse,
    };
  } catch (err) {
    console.error('AI ERROR:', err.message);
    console.error('Stack trace:', err.stack);
    return {
      success: false,
      analysis: 'Sorry, AI analysis failed. Please try again or paste smaller data.',
      chartData: null,
      chartTitle: 'Error',
      chartType: 'auto',
      conversationId: sessionId || uuidv4(),
    };
  }
};

// ==========================
// Routes
// ==========================
app.post('/api/analyze/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: 'No file uploaded' });
    }

    let data;
    const filePath = req.file.path;

    console.log(`Processing file: ${req.file.originalname}`);

    if (req.file.originalname.endsWith('.csv')) {
      data = await parseCSV(filePath);
    } else if (req.file.originalname.match(/\.(xlsx|xls)$/)) {
      data = parseExcel(filePath);
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      data = JSON.parse(content);
    }

    console.log(`Parsed data with ${Array.isArray(data) ? data.length : 'multiple'} rows`);
    fs.unlinkSync(filePath);

    const question = req.body.question || 'Analyze this data and create visualizations';
    const sessionId = req.body.conversationId || uuidv4();

    const result = await analyzeDataWithAI(data, question, sessionId, false);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('File analysis error:', err);
    if (req.file?.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/analyze/text', async (req, res) => {
  const { text, question, conversationId } = req.body;

  // Require a question
  if (!question?.trim()) {
    return res
      .status(400)
      .json({ success: false, error: 'No question provided' });
  }

  // Parse text data
  let dataToSend;
  if (text?.trim()) {
    try {
      dataToSend = JSON.parse(text);
    } catch {
      // If not JSON, send as array of lines
      dataToSend = text.split('\n').map((line) => ({ line }));
    }
  } else {
    // For follow-ups without new data, use stored conversation context
    const conversationHistory = getConversationContext(conversationId);
    if (conversationHistory.length > 0) {
      // Extract data from previous conversation
      const previousMessages = conversationHistory
        .filter(msg => msg.role === 'user')
        .slice(-3); // Get last 3 user messages
      dataToSend = previousMessages.map(msg => ({ question: msg.content }));
    } else {
      dataToSend = '[Continuing from previous analysis]';
    }
  }

  const sessionId = conversationId || uuidv4();

  console.log('Analyzing text data...');
  const result = await analyzeDataWithAI(
    dataToSend,
    question,
    sessionId,
    !!conversationId
  );

  res.json(result);
});

// Chat follow-up route
app.post('/api/chat/followup', async (req, res) => {
  try {
    const { question, conversationId } = req.body;

    if (!question?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: 'No question provided' });
    }

    if (!conversationId) {
      return res
        .status(400)
        .json({ success: false, error: 'No conversation ID provided' });
    }

    // Get conversation history for context
    const conversationHistory = getConversationContext(conversationId);
    
    // Create a data context from previous messages
    let dataContext = '[Previous conversation context]';
    if (conversationHistory.length > 0) {
      // Extract relevant data points from conversation
      const insights = conversationHistory
        .filter(msg => msg.role === 'assistant')
        .map(msg => {
          // Extract key metrics and insights from previous responses
          const lines = msg.content.split('\n');
          const keyLines = lines.filter(line => 
            line.includes(':') || 
            line.startsWith('-') || 
            line.match(/^\d+\./)
          );
          return keyLines.join('\n');
        })
        .filter(content => content.length > 10);
      
      if (insights.length > 0) {
        dataContext = `Previous analysis insights:\n${insights.join('\n\n')}`;
      }
    }

    console.log('Processing follow-up question...');
    const result = await analyzeDataWithAI(
      dataContext,
      question,
      conversationId,
      true
    );

    res.json(result);
  } catch (err) {
    console.error('Follow-up error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      analysis: 'Sorry, I encountered an error processing your follow-up question. Please try again.'
    });
  }
});

// Get conversation history
app.get('/api/conversation/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const conversation = getConversationContext(sessionId);
    res.json({ success: true, conversation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Clear conversation
app.delete('/api/conversation/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    conversationStore.delete(sessionId);
    res.json({ success: true, message: 'Conversation cleared' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test chart endpoint
app.get('/api/test/chart', (req, res) => {
  const testChartData = {
    chart: {
      title: 'Test Sales Data',
      type: 'bar',
      data: {
        labels: ['January', 'February', 'March', 'April', 'May', 'June'],
        datasets: [{
          label: 'Sales 2024',
          data: [65, 59, 80, 81, 56, 55],
          backgroundColor: [
            'rgba(255, 99, 132, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(255, 205, 86, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(54, 162, 235, 0.8)',
            'rgba(153, 102, 255, 0.8)'
          ],
          borderColor: [
            'rgb(255, 99, 132)',
            'rgb(255, 159, 64)',
            'rgb(255, 205, 86)',
            'rgb(75, 192, 192)',
            'rgb(54, 162, 235)',
            'rgb(153, 102, 255)'
          ],
          borderWidth: 1
        }]
      }
    }
  };
  
  res.json({
    success: true,
    analysis: 'This is a test chart to verify chart display functionality.',
    chartData: testChartData.chart.data,
    chartTitle: testChartData.chart.title,
    chartType: testChartData.chart.type,
    conversationId: uuidv4()
  });
});

// ==========================
// Health & SPA fallback - FIXED
// ==========================
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    uptime: process.uptime(),
    conversations: conversationStore.size 
  });
});

// FIXED: Serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Check if the request is for an API route
  if (req.path.startsWith('/api/')) {
    // If it's an API route that doesn't exist, return 404
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  
  // For all other routes, serve the index.html
  res.sendFile(path.join(__dirname, 'assets', 'index.html'), (err) => {
    if (err) {
      console.error('Error serving index.html:', err);
      res.status(500).send('Error loading application');
    }
  });
});

// Clean up old conversations periodically
setInterval(() => {
  // In a real app, you'd track timestamps. For demo, we'll just clear old entries
  // to prevent memory leaks
  if (conversationStore.size > 100) {
    // Clear half of the conversations if we have too many
    const keys = Array.from(conversationStore.keys());
    const toDelete = keys.slice(0, Math.floor(keys.length / 2));
    toDelete.forEach(key => conversationStore.delete(key));
    console.log(`Cleaned up ${toDelete.length} old conversations`);
  }
}, 30 * 60 * 1000); // Every 30 minutes

app.listen(PORT, () => {
  console.log(`🚀 Data Examiner running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📈 Test chart: http://localhost:${PORT}/api/test/chart`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/`);
});