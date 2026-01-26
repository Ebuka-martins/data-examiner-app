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

// Security & performance middleware
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

// Serve static files
app.use(express.static(path.join(__dirname, 'assets')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/icons', express.static(path.join(__dirname, 'assets/icons')));
app.use('/favicon', express.static(path.join(__dirname, 'assets/favicon')));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueId}${ext}`);
  }
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
  fileFilter
});

// Create uploads folder
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// Parse CSV
const parseCSV = (filePath) => new Promise((resolve, reject) => {
  const results = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => resolve(results))
    .on('error', reject);
});

// Parse Excel
const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheets = {};
  workbook.SheetNames.forEach(name => {
    sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name]);
  });
  return sheets;
};

// AI Analysis (Groq)
const analyzeDataWithAI = async (data, question, sessionId = null) => {
  try {
    const sample = Array.isArray(data) ? data.slice(0, 50) : data;
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
            content: 'You are Data Examiner, an expert AI data analyst. Provide clear insights, stats, recommendations, and visualization suggestions in markdown format.'
          },
          {
            role: 'user',
            content: `Question: ${question}\n\nData sample:\n${JSON.stringify(sample, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) throw new Error('Groq API error');

    const result = await response.json();
    const analysis = result.choices[0].message.content;

    return {
      analysis,
      chartData: [], // Add chart logic if needed
      visualizationSuggestions: [],
      conversationId: sessionId || uuidv4()
    };
  } catch (err) {
    console.error(err);
    return {
      analysis: 'AI analysis failed. Raw data summary only.',
      chartData: [],
      visualizationSuggestions: [],
      conversationId: sessionId || uuidv4()
    };
  }
};

// Routes
app.post('/api/analyze/file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file' });

    let data;
    const filePath = req.file.path;

    if (req.file.originalname.endsWith('.csv')) {
      data = await parseCSV(filePath);
    } else if (req.file.originalname.match(/\.(xlsx|xls)$/)) {
      data = parseExcel(filePath);
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      data = JSON.parse(content);
    }

    fs.unlinkSync(filePath);

    const question = req.body.question || 'Analyze this data';
    const sessionId = req.body.conversationId || uuidv4();

    const result = await analyzeDataWithAI(data, question, sessionId);

    res.json({ success: true, ...result });
  } catch (err) {
    if (req.file?.path) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/analyze/text', async (req, res) => {
  const { text, question, conversationId } = req.body;
  if (!text) return res.status(400).json({ success: false, error: 'No text' });

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.split('\n').map(line => ({ line }));
  }

  const sessionId = conversationId || uuidv4();
  const result = await analyzeDataWithAI(data, question || 'Analyze', sessionId);

  res.json({ success: true, ...result });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Data Examiner running on http://localhost:${PORT}`);
});