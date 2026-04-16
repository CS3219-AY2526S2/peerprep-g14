import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import translateRouter from './routes/translate.js';
import explainRouter from './routes/explain.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (req: any, res: any) => {
  return res.status(200).send('OK');
});

// Routes
app.use('/translate', translateRouter);
app.use('/explain', explainRouter);

app.listen(PORT, () => {
  console.log(`AI Service running on port ${PORT}`);
});
