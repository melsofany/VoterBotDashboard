import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import type { Express } from 'express';
import session from 'express-session';
import MemoryStore from 'memorystore';

const MemoryStoreSession = MemoryStore(session);

export function setupAuth(app: Express) {
  // Session configuration
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'voter-management-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      store: new MemoryStoreSession({
        checkPeriod: 86400000, // 24 hours
      }),
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
      },
    })
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport Local Strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const adminUsername = process.env.ADMIN_USERNAME;
      const adminPassword = process.env.ADMIN_PASSWORD;

      if (!adminUsername || !adminPassword) {
        return done(null, false, { message: 'Admin credentials not configured' });
      }

      if (username === adminUsername && password === adminPassword) {
        return done(null, { username: adminUsername });
      }

      return done(null, false, { message: 'Invalid username or password' });
    })
  );

  // Serialize user
  passport.serializeUser((user: any, done) => {
    done(null, user.username);
  });

  // Deserialize user
  passport.deserializeUser((username: string, done) => {
    done(null, { username });
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: 'Unauthorized' });
}
