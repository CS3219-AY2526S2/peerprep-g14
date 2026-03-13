// Separating the runtime 'express' from the 'type' definitions
import express, { type Request, type Response, type Application } from 'express';
import cors, { type CorsOptions } from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

import prisma from './prisma.js';
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// 1. Define your options with the CorsOptions type
const corsOptions: CorsOptions = {
  origin: 'http://localhost:5173', // Your Vite dev server
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,               // Allow cookies/sessions
  optionsSuccessStatus: 200        // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
app.use(cookieParser());

// Middleware to parse JSON bodies
app.use(express.json());

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// A sample route
app.get('/user/hello', (req: Request, res: Response) => {
  res.send('TypeScript Backend is running! 🚀');
});

// 1. Initial trigger: Redirects user to GitHub
app.get('/user/auth/github', (req, res) => {
  const rootUrl = 'https://github.com/login/oauth/authorize';
  const options = {
    client_id: process.env.GITHUB_CLIENT_ID!,
    // IMPORTANT: This must match what is registered in GitHub Developer Settings
    redirect_uri: 'http://localhost/user/user/login',
    scope: 'user:email',
  };

  const queryString = new URLSearchParams(options).toString();
  res.redirect(`${rootUrl}?${queryString}`);
});

app.get('/user/user/login', async (req, res) => {
  const { code } = req.query;

  try {
    // 1. Exchange code for Access Token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      })
    });

    const { access_token } = await tokenResponse.json();

    // 2. Get General Profile (contains 'name')
    const userResponse = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const userData = await userResponse.json();

    // 3. Get Emails (needed if their email is private)
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const emails = await emailResponse.json();

    // Find the primary, verified email
    const primaryEmail = emails.find((e: { primary: any; verified: any; }) => e.primary && e.verified)?.email || emails[0]?.email;

    // The data you wanted:
    const name = userData.name || userData.login; // Fallback to username if name is blank
    const email = primaryEmail;

    // Find if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    });

    let user;
    let isNewUser = false;

    if (!existingUser) {
      // Brand new user, create them and flag them
      user = await prisma.user.create({
        data: {
          email: email,
          name: name,
          authProvider: 'github',
          providerId: userData.id.toString(),
        },
      });
      isNewUser = true;
    } else {
      user = existingUser;
      isNewUser = false;
    }

    const accessToken = jwt.sign({ userId: user.id, role: user.role }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: user.id, role: user.role }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: '7d' });

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const token = await prisma.user_refresh_token.create({
      data: {
        userId: user.id,
        token_hash: tokenHash,
        expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiry
      }
    });

    console.log(`Authenticated: Userid:${user.id} Name:${user.name} Email:${user.email} IsNewUser:${isNewUser}`);

    res.cookie('accessToken', accessToken, {
      httpOnly: true,    // Prevents JavaScript from accessing the cookie (No XSS)
      sameSite: 'lax', // Prevents the cookie from being sent in cross-site requests (No CSRF)
      maxAge: 15 * 60 * 1000 // 15 minutes in milliseconds
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
    });

    // Redirect back to frontend
    // Use the port Vite runs on (5173 by default)
    if (isNewUser) {
      res.redirect(`http://localhost/profile-setup?userId=${user.id}`);
    } else {
      res.redirect(`http://localhost/dashboard`);
    }

  } catch (err) {
    console.error('GitHub OAuth Login Error:', err);
    res.status(500).json({ error: `Failed to retrieve user data: ${(err as Error).message}`, details: err });
  }
});

app.put('/api/user/profile', async (req, res) => {
  const userId = req.body.userId; // Alternatively read from authenticated session/cookie
  const { bio, experienceLevel } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        bio,
        experienceLevel,
      },
    });

    res.status(200).json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Profile Setup Error:", error);
    res.status(500).json({ message: "Failed to update profile", error });
  }
});

app.post('/user/admin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  console.log(`Admin Login Attempt: Email:${email}`);

  try {
    // 1. Find the user by email and ensure they are an ADMIN
    const admin = await prisma.user.findUnique({
      where: { email },
    });

    if (!admin || admin.role !== 'ADMIN' || !admin.password) {
      // Use a generic message to prevent account enumeration
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 2. Compare the hashed password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3. Generate tokens
    const accessToken = jwt.sign({ userId: admin.id, role: admin.role }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '15m' });
    const refreshToken = jwt.sign({ userId: admin.id, role: admin.role }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: '7d' });

    // 4. Hash the refresh token for the DB
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // 5. Store the refresh token in the database
    // We set the expiry to 7 days from now
    await prisma.user_refresh_token.create({
      data: {
        userId: admin.id,
        token_hash: refreshTokenHash,
        expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // 6. Set HTTP-Only cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 mins
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      message: "Login successful",
      user: {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        name: admin.name
      }
    });

  } catch (error) {
    console.error("Admin Login Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/auth/refresh', async (req, res) => {
  // 1. Get the raw JWT from the HttpOnly cookie
  const rawRefreshToken = req.cookies?.refreshToken;

  if (!rawRefreshToken) {
    return res.status(401).json({ message: 'Refresh token missing' });
  }

  try {
    // 2. Hash the incoming token to prepare for DB lookup
    const incomingHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

    // 3. Find the hash in Prisma
    const storedToken = await prisma.user_refresh_token.findUnique({
      where: { token_hash: incomingHash },
    });

    // Check if token exists or has expired in your DB
    if (!storedToken || storedToken.expire_at < new Date()) {
      return res.status(403).json({ message: 'Token revoked or expired' });
    }

    // 4. Verify the JWT signature and expiration
    // We do this after the DB check to avoid unnecessary CPU work if the hash is missing
    const payload = jwt.verify(rawRefreshToken, process.env.REFRESH_TOKEN_SECRET as string) as { userId: string, role: string };

    if (payload.userId !== storedToken.userId) {
      return res.status(403).json({ message: 'Token user mismatch' });
    }

    // 5. Generate a fresh Access Token
    const accessToken = jwt.sign({ userId: payload.userId, role: payload.role }, process.env.ACCESS_TOKEN_SECRET as string, { expiresIn: '15m' });

    return res.json({
      newAccessToken: accessToken,
      userId: payload.userId
    });
  } catch (error) {
    console.error('Refresh Error:', error);
    return res.status(403).json({ message: 'Invalid refresh token' });
  }
});