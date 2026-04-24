require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const MAILTESTER_API = 'https://happy.mailtester.ninja/ninja';
const MAILTESTER_KEY = (process.env.MAILTESTER_KEY || '').replace(/^[{]|[}]$/g, '');
const RATE_LIMIT_MS = 91; // ~11 emails per second for Pro plan (1000/91 ≈ 11)

// Initialize database connection check
async function initializeDatabase() {
  try {
    console.log('Checking database connection...');
    const { error } = await supabase.from('batches').select().limit(1);

    if (!error || error.code !== '42P01') {
      console.log('✓ Database connection successful');
    } else {
      console.log('⚠ Tables may not exist - please create them in Supabase SQL Editor');
    }
  } catch (error) {
    console.error('⚠ Database check failed:', error.message);
  }
}

// Helper: Extract emails from file
function extractEmailsFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const emails = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const email = row.email || Object.values(row)[0];
        if (email && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(email)) {
          emails.push(email);
        }
      })
      .on('end', () => resolve(emails))
      .on('error', reject);
  });
}

// Helper: Verify email with MailTester API
async function verifyEmail(email) {
  try {
    const response = await axios.get(MAILTESTER_API, {
      params: { email, key: MAILTESTER_KEY },
      family: 4,
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error(`Error verifying ${email}:`, error.message);
    return {
      email,
      code: 'error',
      message: error.message.substring(0, 100),
      user: '',
      domain: '',
      mx: ''
    };
  }
}

// Helper: Save results to CSV
async function saveResultsToCSV(results, outputPath) {
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'email', title: 'Email' },
      { id: 'code', title: 'Code' },
      { id: 'message', title: 'Message' },
      { id: 'user', title: 'User' },
      { id: 'domain', title: 'Domain' },
      { id: 'mx', title: 'MX' }
    ]
  });
  await csvWriter.writeRecords(results);
}

// Endpoint: Upload CSV and verify emails
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const uploadId = Date.now().toString();
  const inputPath = req.file.path;
  const outputPath = path.join('results', `${uploadId}_results.csv`);

  // Create results directory if it doesn't exist
  if (!fs.existsSync('results')) {
    fs.mkdirSync('results');
  }

  try {
    // Extract emails from uploaded file
    console.log(`[${uploadId}] Extracting emails from file...`);
    const emails = await extractEmailsFromFile(inputPath);
    console.log(`[${uploadId}] Found ${emails.length} emails to verify`);

    if (emails.length === 0) {
      return res.status(400).json({ error: 'No valid emails found in CSV' });
    }

    // Store batch info in Supabase
    const { data: batchData, error: batchError } = await supabase
      .from('batches')
      .insert({
        id: uploadId,
        total_emails: emails.length,
        status: 'processing'
      })
      .select();

    if (batchError) {
      console.error('Error creating batch:', batchError);
      return res.status(500).json({ error: 'Database error' });
    }

    // Return immediately with upload ID
    res.json({
      uploadId,
      totalEmails: emails.length,
      message: 'Processing started. Use uploadId to check status and download results.'
    });

    // Process emails in background
    (async () => {
      const results = [];
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        console.log(`[${uploadId}] Verifying ${i + 1}/${emails.length}: ${email}`);

        const result = await verifyEmail(email);
        results.push(result);

        // Store result in Supabase
        await supabase
          .from('email_results')
          .insert({
            batch_id: uploadId,
            email: result.email,
            code: result.code,
            message: result.message,
            user: result.user,
            domain: result.domain,
            mx: result.mx
          });

        // Rate limiting
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      }

      // Save results to CSV
      await saveResultsToCSV(results, outputPath);

      // Update batch status
      await supabase
        .from('batches')
        .update({ status: 'completed', completed_at: new Date() })
        .eq('id', uploadId);

      console.log(`[${uploadId}] Verification complete. Results saved to ${outputPath}`);
    })();

  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Check status
app.get('/status/:uploadId', async (req, res) => {
  const { uploadId } = req.params;

  try {
    const { data: batch, error } = await supabase
      .from('batches')
      .select('*')
      .eq('id', uploadId)
      .single();

    if (error || !batch) {
      return res.status(404).json({ error: 'Upload ID not found' });
    }

    res.json({
      uploadId,
      status: batch.status,
      totalEmails: batch.total_emails,
      completedAt: batch.completed_at
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Download results CSV
app.get('/download/:uploadId', async (req, res) => {
  const { uploadId } = req.params;
  const outputPath = path.join('results', `${uploadId}_results.csv`);

  try {
    // Check if file exists
    if (!fs.existsSync(outputPath)) {
      return res.status(404).json({ error: 'Results not ready or not found. Check /status/:uploadId' });
    }

    res.download(outputPath, `email-results-${uploadId}.csv`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDatabase();
});
