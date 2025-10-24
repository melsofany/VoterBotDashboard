import type { Express } from 'express';

// Simple in-memory token store
const tokenStore = new Map<string, { username: string; expiresAt: number }>();

function generateToken(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function setupAuth(app: Express) {
  // Trust the first proxy (Replit proxy)
  app.set('trust proxy', 1);
  
  // Middleware to check Authorization header
  app.use((req: any, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const session = tokenStore.get(token);
      
      if (session && session.expiresAt > Date.now()) {
        req.user = { username: session.username };
        req.isAuthenticated = () => true;
      } else {
        if (session) {
          tokenStore.delete(token);
        }
        req.isAuthenticated = () => false;
      }
    } else {
      req.isAuthenticated = () => false;
    }
    next();
  });
}

export function login(username: string, password: string): { success: boolean; token?: string; error?: string } {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUsername || !adminPassword) {
    return { success: false, error: 'Admin credentials not configured' };
  }

  if (username === adminUsername && password === adminPassword) {
    const token = generateToken();
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
    tokenStore.set(token, { username, expiresAt });
    
    return { success: true, token };
  }

  return { success: false, error: 'Invalid username or password' };
}

export function logout(token: string): boolean {
  return tokenStore.delete(token);
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}
