import type { Express } from "express";
import { createServer, type Server } from "http";
import { isAuthenticated, login, logout } from './auth';
import { 
  getDashboardStats, 
  getAllVoters, 
  getRepresentativesPerformance,
  addRepresentative,
  updateRepresentative,
  deleteRepresentative,
  updateVoterNationalId
} from "./sheets-service";
import { streamImageFromWasabi, testWasabiConnection } from "./wasabi-service";
import { streamImageFromDrive } from "./drive-service";
import { extractDataFromIDCard } from "./ocr-service";
import { z } from 'zod';
import { insertRepresentativeSchema } from '@shared/schema';
import multer from 'multer';
export async function registerRoutes(app: Express): Promise<Server> {

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

  // Test Wasabi connection
  app.get("/api/test-storage", isAuthenticated, async (req, res) => {
    try {
      const result = await testWasabiConnection();
      if (result.success) {
        res.json(result);
      } else {
        res.status(500).json(result);
      }
    } catch (error: any) {
      console.error("Error testing Wasabi connection:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Failed to test Wasabi connection" 
      });
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

  // Voter management routes
  app.patch("/api/voters/:id/national-id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { nationalId } = req.body;
      
      if (!nationalId || typeof nationalId !== 'string') {
        return res.status(400).json({ error: "الرقم القومي مطلوب" });
      }

      if (nationalId.length !== 14 || !/^\d+$/.test(nationalId)) {
        return res.status(400).json({ error: "الرقم القومي يجب أن يكون 14 رقم" });
      }

      await updateVoterNationalId(id, nationalId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating voter national ID:", error);
      res.status(500).json({ error: error.message || "Failed to update national ID" });
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

  // Image proxy route - serves images from Wasabi or Google Drive (legacy)
  app.get("/api/voters/:id/card-image", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const voters = await getAllVoters();
      const voter = voters.find(v => v.id === id);
      
      if (!voter || !voter.idCardImageUrl) {
        return res.status(404).json({ error: "Image not found" });
      }
      
      // Check if it's a Google Drive URL (legacy) or Wasabi URL
      if (voter.idCardImageUrl.includes('drive.google.com')) {
        await streamImageFromDrive(voter.idCardImageUrl, res);
      } else {
        await streamImageFromWasabi(voter.idCardImageUrl, res);
      }
    } catch (error: any) {
      console.error("Error serving image:", error);
      res.status(500).json({ error: "Failed to load image" });
    }
  });

  // Bot status endpoint - helpful for debugging
  app.get("/api/bot/status", async (req, res) => {
    try {
      const TelegramBot = (await import('node-telegram-bot-api')).default;
      const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!BOT_TOKEN) {
        return res.json({
          status: 'error',
          message: 'TELEGRAM_BOT_TOKEN not configured',
          hasToken: false
        });
      }

      const bot = new TelegramBot(BOT_TOKEN);
      
      // Get webhook info
      const webhookInfo = await bot.getWebHookInfo();
      
      // Get bot info
      const botInfo = await bot.getMe();
      
      res.json({
        status: 'ok',
        hasToken: true,
        bot: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name
        },
        webhook: {
          url: webhookInfo.url || 'Not set (using polling)',
          has_custom_certificate: webhookInfo.has_custom_certificate,
          pending_update_count: webhookInfo.pending_update_count,
          last_error_date: webhookInfo.last_error_date,
          last_error_message: webhookInfo.last_error_message,
          max_connections: webhookInfo.max_connections
        },
        environment: {
          WEBHOOK_URL: process.env.WEBHOOK_URL ? 'Set' : 'Not set',
          RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL ? 'Set' : 'Not set',
          mode: webhookInfo.url ? 'webhook' : 'polling'
        }
      });
    } catch (error: any) {
      console.error("Error getting bot status:", error);
      res.status(500).json({ 
        status: 'error',
        message: error.message || "Failed to get bot status" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
