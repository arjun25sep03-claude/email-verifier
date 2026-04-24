-- Create batches table to track verification jobs
CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  total_emails INT NOT NULL,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Create email_results table to store verification results
CREATE TABLE email_results (
  id BIGSERIAL PRIMARY KEY,
  batch_id TEXT NOT NULL REFERENCES batches(id),
  email TEXT NOT NULL,
  code TEXT,
  message TEXT,
  user TEXT,
  domain TEXT,
  mx TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_batch_id ON email_results(batch_id);
CREATE INDEX idx_email ON email_results(email);
CREATE INDEX idx_batch_status ON batches(status);
