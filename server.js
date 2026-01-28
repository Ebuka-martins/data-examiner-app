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
// Static files
// ==========================
app.use(express.static(path.join(__dirname, 'assets')));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/icons', express.static(path.join(__dirname, 'assets/icons')));
app.use('/favicon', express.static(path.join(__dirname, 'assets/favicon')));

// ==========================
// Multer setup
// ==========================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
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
// AI Analysis
// ==========================
const analyzeDataWithAI = async (data, question, sessionId = null) => {
  try {
    const sample = Array.isArray(data) ? data.slice(0, 50) : data;

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
          messages: [
            {
              role: 'system',
              content: `You are Data Examiner, an expert data analyst.
Analyze the provided data sample.
Return your response in this exact structure:

1. A clear markdown summary with insights, stats, trends, outliers, recommendations.
2. If a chart makes sense, include a JSON object at the end with:
   - chartTitle: "Short descriptive title"
   - chartData: { labels: string[], datasets: [{label: string, data: number[]}] }

Be concise but informative. Use markdown formatting.`,
            },
            {
              role: 'user',
              content: `Question: ${question}

Data sample (first 50 rows):
${JSON.stringify(sample, null, 2)}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 4000,
        }),
      }
    );

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Groq HTTP ${response.status} – ${errBody}`);
    }

    const result = await response.json();
    const rawContent = result.choices[0].message.content;

    let analysis = rawContent;
    let chartData = null;
    let chartTitle = 'Data Visualization';

    // Extract JSON chart block if present
    const jsonMatch = rawContent.match(/```json\s*([\s\S]*?)\s*```$/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        analysis = rawContent.replace(jsonMatch[0], '').trim();

        if (parsed.chartData) {
          chartData = parsed.chartData;
          chartTitle = parsed.chartTitle || chartTitle;
        }
      } catch (e) {
        console.warn('AI returned invalid JSON for chart:', e);
      }
    }

    return {
      success: true,
      analysis,
      chartData,
      chartTitle,
      conversationId: sessionId || uuidv4(),
    };
  } catch (err) {
    console.error('AI ERROR:', err.message);
    return {
      success: false,
      analysis:
        'Sorry, AI analysis failed. Please try again or paste smaller data.',
      chartData: null,
      chartTitle: 'Error',
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

/**
 * ✅ UPDATED ROUTE
 * Supports follow-up questions without new text
 */
app.post('/api/analyze/text', async (req, res) => {
  const { text, question, conversationId } = req.body;

  // Require a question
  if (!question?.trim()) {
    return res
      .status(400)
      .json({ success: false, error: 'No question provided' });
  }

  // Fallback message for follow-ups
  const dataToSend = text?.trim()
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text.split('\n').map((line) => ({ line }));
        }
      })()
    : '[Continuing from previous analysis — no new raw data provided in this message]';

  const sessionId = conversationId || uuidv4();

  const result = await analyzeDataWithAI(
    dataToSend,
    question,
    sessionId
  );

  res.json(result);
});

// ==========================
// Health & SPA fallback
// ==========================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Data Examiner running on http://localhost:${PORT}`);
});
