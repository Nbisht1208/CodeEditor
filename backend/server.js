import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from './redisClient.js';

const app = express();

// CORS for your React frontend
app.use(cors({
  origin: 'http://localhost:5173'
}));

// Parse JSON requests
app.use(express.json({ limit: '1mb' }));

// POST endpoint: submit Python code
app.get('/result/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const output = await redisClient.get(`result:${jobId}`);

    if (!output) {
      return res.json({ jobId, status: 'pending' });
    }

    res.json({ jobId, status: 'done', output });
  } catch (err) {
    console.error('Error fetching result:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET endpoint: fetch result for a given jobId
// app.get('/result/:jobId', async (req, res) => {
//   try {
//     const { jobId } = req.params;
//     const output = await redisClient.get(`result:${jobId}`);

//     if (!output) {
//       return res.json({ jobId, status: 'pending' });
//     }

//     res.json({ jobId, status: 'done', output });
//   } catch (err) {
//     console.error('Error fetching result:', err);
//     res.status(500).json({ error: err.message || 'Server error' });
//   }
// });

// POST endpoint: submit Python code job
app.post('/run-python', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'No code provided' });
    }

    const jobId = uuidv4();

    // Create job object
    const job = { jobId, code };

    // Add job to Redis queue
    await redisClient.lPush('jobQueue', JSON.stringify(job));

    // Respond with jobId for polling
    res.json({ jobId });
  } catch (err) {
    console.error('Error submitting job:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});


// Start server
const port = 3001;
app.listen(port, () => {
  console.log(`Backend API listening at http://localhost:${port}`);
});
