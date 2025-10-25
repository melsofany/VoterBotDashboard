import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated, login, logout } from './auth';
import { 
  getDashboardStats, 
  getAllVoters, 
  getRepresentativesPerformance,
  addRepresentative,
  updateRepresentative,
  deleteRepresentative
} from "./sheets-service";
import { streamImageFromDrive } from "./drive-service";
import { extractDataFromIDCard } from "./ocr-service";
import { z } from 'zod';
import { insertRepresentativeSchema } from '@shared/schema';
import multer from 'multer';
import { getAuthUrl, getTokensFromCode, setOAuthCredentials } from './google-services';

let oauthTokens: any = null;

export async function registerRoutes(app: Express): Promise<Server> {
  // Google OAuth routes
  app.get("/auth/google", (req, res) => {
    try {
      const authUrl = getAuthUrl();
      res.redirect(authUrl);
    } catch (error: any) {
      console.error('Error generating auth URL:', error);
      res.status(500).send('Failed to initiate Google authentication');
    }
  });

  app.get("/auth/google/callback", async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) {
        return res.status(400).send('Authorization code not provided');
      }

      const tokens = await getTokensFromCode(code);
      oauthTokens = tokens;
      setOAuthCredentials(tokens);
      
      console.log('✅ Google OAuth authentication successful!');
      res.send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>تم التسجيل بنجاح</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }
            .success-box {
              background: white;
              padding: 3rem;
              border-radius: 1rem;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
              max-width: 400px;
            }
            h1 {
              color: #10b981;
              font-size: 2rem;
              margin-bottom: 1rem;
            }
            p {
              color: #6b7280;
              font-size: 1.1rem;
              line-height: 1.6;
            }
            .checkmark {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="success-box">
            <div class="checkmark">✅</div>
            <h1>تم التسجيل بنجاح!</h1>
            <p>تم الربط مع Google Drive بنجاح</p>
            <p>يمكنك الآن إغلاق هذه النافذة</p>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Error in OAuth callback:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>خطأ في التسجيل</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              margin: 0;
              background: #fee;
            }
            .error-box {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 40px rgba(0,0,0,0.2);
              text-align: center;
            }
            h1 { color: #ef4444; }
          </style>
        </head>
        <body>
          <div class="error-box">
            <h1>❌ حدث خطأ</h1>
            <p>${error.message}</p>
          </div>
        </body>
        </html>
      `);
    }
  });

  app.get("/api/oauth/status", (req, res) => {
    res.json({ 
      authenticated: !!oauthTokens,
      hasCredentials: !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
    });
  });

  // Auth routes
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password required' });
    }

    const result = login(username, password);
    
    if (result.success) {
      console.log('✅ User logged in successfully:', username);
      return res.json({ 
        success: true, 
        token: result.token,
        user: { username } 
      });
    } else {
      return res.status(401).json({ message: result.error || 'Invalid credentials' });
    }
  });

  app.post("/api/logout", (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      logout(token);
    }
    res.json({ success: true });
  });

  app.get("/api/me", (req: any, res) => {
    if (req.isAuthenticated && req.isAuthenticated()) {
      res.json({ user: req.user });
    } else {
      res.status(401).json({ message: 'Not authenticated' });
    }
  });

  // Protected dashboard routes
  app.get("/api/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  app.get("/api/voters", isAuthenticated, async (req, res) => {
    try {
      const voters = await getAllVoters();
      res.json(voters);
    } catch (error) {
      console.error("Error fetching voters:", error);
      res.status(500).json({ error: "Failed to fetch voters" });
    }
  });

  app.get("/api/representatives", isAuthenticated, async (req, res) => {
    try {
      const representatives = await getRepresentativesPerformance();
      res.json(representatives);
    } catch (error) {
      console.error("Error fetching representatives:", error);
      res.status(500).json({ error: "Failed to fetch representatives" });
    }
  });

  // Representative management routes
  app.post("/api/representatives", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertRepresentativeSchema.parse(req.body);
      await addRepresentative(validatedData.userId, validatedData.name || undefined);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error adding representative:", error);
      if (error.name === 'ZodError') {
        res.status(400).json({ error: "Invalid data", details: error.errors });
      } else {
        res.status(500).json({ error: error.message || "Failed to add representative" });
      }
    }
  });

  app.put("/api/representatives/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: "Name is required" });
      }

      await updateRepresentative(userId, name);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating representative:", error);
      res.status(500).json({ error: error.message || "Failed to update representative" });
    }
  });

  app.delete("/api/representatives/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId } = req.params;
      await deleteRepresentative(userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting representative:", error);
      res.status(500).json({ error: error.message || "Failed to delete representative" });
    }
  });

  // OCR endpoint for Mini App
  const upload = multer({ storage: multer.memoryStorage() });
  app.post("/api/ocr/extract", upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      console.log('📸 Processing image from Mini App...');
      const ocrResult = await extractDataFromIDCard(req.file.buffer);

      res.json({
        nationalId: ocrResult.nationalId,
        fullName: ocrResult.fullName,
        address: ocrResult.address
      });
    } catch (error: any) {
      console.error("Error in OCR extraction:", error);
      res.status(500).json({ error: error.message || "Failed to extract data from image" });
    }
  });

  // Image proxy route - serves images from Google Drive
  app.get("/api/voters/:id/card-image", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const voters = await getAllVoters();
      const voter = voters.find(v => v.id === id);
      
      if (!voter || !voter.idCardImageUrl) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      await streamImageFromDrive(voter.idCardImageUrl, res);
    } catch (error: any) {
      console.error("Error serving image:", error);
      res.status(500).json({ error: "Failed to load image" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
