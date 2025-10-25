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
