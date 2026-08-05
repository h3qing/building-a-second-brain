import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE = "secondbrain-session";
const SESSION_TTL_DAYS = 14;
const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

// In-memory rate limiting (resets on cold start, fine for single-user)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetIn: number;
} {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    return { allowed: true, remaining: MAX_ATTEMPTS, resetIn: 0 };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    const resetIn = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }

  return {
    allowed: true,
    remaining: MAX_ATTEMPTS - entry.count,
    resetIn: Math.ceil((entry.resetAt - now) / 1000),
  };
}

export function recordAttempt(ip: string): void {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  const updated = { ...entry, count: entry.count + 1 };
  if (updated.count >= MAX_ATTEMPTS) {
    updated.resetAt = now + LOCKOUT_MS;
  }
  loginAttempts.set(ip, updated);
}

export function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

// PIN verification — bcrypt (slow, runs once on login)
export async function verifyPin(pin: string): Promise<boolean> {
  const hash = process.env.AUTH_PIN_HASH;
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}

// Session token — HMAC with embedded expiry (fast, runs on every authenticated request)
function signToken(expiresAt: number): string {
  const pinHash = process.env.AUTH_PIN_HASH;
  if (!pinHash) {
    // Never sign with a guessable key: an empty-string HMAC key would let
    // anyone mint valid sessions if the env var is dropped in a deployment.
    throw new Error("AUTH_PIN_HASH is not configured");
  }
  const payload = `${expiresAt}:secondbrain-session-v2`;
  const signature = createHmac("sha256", pinHash).update(payload).digest("hex");
  return `${expiresAt}:${signature}`;
}

function verifyToken(token: string): boolean {
  if (!process.env.AUTH_PIN_HASH) return false;
  const colonIdx = token.indexOf(":");
  if (colonIdx === -1) return false;

  const expiresAt = parseInt(token.slice(0, colonIdx), 10);
  if (isNaN(expiresAt)) return false;

  // Check expiry
  if (Date.now() > expiresAt) return false;

  // Verify signature
  const expected = signToken(expiresAt);
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function verifySession(): Promise<boolean> {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE);
  if (!session) return false;
  return verifyToken(session.value);
}

export async function createSession(): Promise<void> {
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const token = signToken(expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}
