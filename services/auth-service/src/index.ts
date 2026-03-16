import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
app.use(cookieParser());

// DEBUG: Log every single incoming request
app.use((req: any, res: any, next: any) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const PORT = process.env.PORT || 3000;

// Middleware to verify JWT
const verifyGateway = async (req: any, res: any, next: any) => {
  const { accessToken, refreshToken } = req.cookies;

  console.log(req.path);
  console.log('Gateway Middleware Triggered');
  // 1. Valid Access Token exists? Easy path.
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, ACCESS_SECRET) as { userId: string, role: string };
      req.headers['x-user-id'] = decoded.userId;
      req.headers['x-user-role'] = decoded.role;
      return next();
    } catch (err: any) {
      if (err.name !== 'TokenExpiredError') {
        return res.status(401).json({ message: "Invalid token" });
      }
      // If it's just expired, fall through to refresh logic below
    }
  }

  // 2. Refresh Logic
  if (refreshToken) {
    try {
      // Call User Service - It returns JSON, NOT a cookie
      const response = await axios.post('http://user-service:3001/auth/refresh', {
        refreshToken
      });

      const { newAccessToken, userId, role } = response.data;

      // 3. SET THE COOKIE HERE (On the actual response going to user)
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000
      });

      req.headers['x-user-id'] = userId;
      req.headers['x-user-role'] = role;
      return next();
    } catch (refreshErr) {
      return res.status(401).json({ message: "Session expired" });
    }
  }

  return res.status(401).json({ message: "Unauthorized: No tokens provided" });
};

// PROXY LOGIC

// New endpoint for frontend to logout and clear session cookies
app.post('/api/auth/logout', async (req: any, res: any) => {
  console.log('LOGOUT HANDLER HIT');
  console.log('Cookies received:', req.cookies);
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    try {
      await axios.post('http://user-service:3001/auth/logout', {
        refreshToken
      });
    } catch (err) {
      console.error('Failed to clear token in user-service', err);
    }
  }

  res.clearCookie('accessToken', {
    httpOnly: true,
    sameSite: 'lax',
  });

  res.clearCookie('refreshToken', {
    httpOnly: true,
    sameSite: 'lax',
  });

  return res.status(200).json({ message: "Logged out successfully" });
});

// New endpoint for frontend to verify session validity
app.get('/api/auth/verify', verifyGateway, (req: any, res: any) => {
  // If we reach here, verifyGateway has already validated the token 
  // and attached x-user-id and x-user-role headers.
  return res.status(200).json({
    userId: req.headers['x-user-id'],
    role: req.headers['x-user-role']
  });
});

app.use('/api/user', verifyGateway, createProxyMiddleware({
  target: 'http://user-service:3001',
  changeOrigin: true,
}));

// Route /api/questions to question-service
app.use('/api/questions', verifyGateway, createProxyMiddleware({
  target: 'http://question-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/questions': '/' },
}));

// If the path starts with /api/matching, send to matching-service
app.use('/matching', verifyGateway, createProxyMiddleware({
  target: 'http://matching-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/matching': '' },
}));

app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));
