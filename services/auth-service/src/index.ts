import express from 'express';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import axios from 'axios';
import { createProxyMiddleware } from 'http-proxy-middleware';

dotenv.config();

const app = express();
app.use(cookieParser());

const ACCESS_SECRET = process.env.ACCESS_SECRET_TOKEN!;
const PORT = process.env.PORT || 3000;

// Middleware to verify JWT
const verifyGateway = async (req: any, res: any, next: any) => {
  const { accessToken, refreshToken } = req.cookies;

  console.log('Gateway Middleware Triggered');
  // 1. Valid Access Token exists? Easy path.
  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, ACCESS_SECRET) as { userId: string };
      req.headers['x-user-id'] = decoded.userId;
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

      const { newAccessToken, userId } = response.data;

      // 3. SET THE COOKIE HERE (On the actual response going to user)
      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60 * 1000 
      });

      req.headers['x-user-id'] = userId;
      return next();
    } catch (refreshErr) {
      return res.status(401).json({ message: "Session expired" });
    }
  }
};

// PROXY LOGIC
// If the path starts with /api/users, send to user-service
app.use('/users', verifyGateway, createProxyMiddleware({
  target: 'http://user-service:3001',
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' }, // Clean path for the target service
}));

// If the path starts with /api/matching, send to matching-service
app.use('/matching', verifyGateway, createProxyMiddleware({
  target: 'http://matching-service:3002',
  changeOrigin: true,
  pathRewrite: { '^/api/matching': '' },
}));

app.listen(PORT, () => console.log(`Auth Service running on port ${PORT}`));