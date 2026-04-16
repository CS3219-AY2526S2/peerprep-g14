// src/lib/prisma.ts
import pg from 'pg';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({ 
  connectionString,
  max: 2, // Reduced slightly to play nice with Supabase free tier limits
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000, // Increased to 5s to handle cold starts
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export default prisma;