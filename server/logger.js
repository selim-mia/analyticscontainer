// server/logger.js — Winston-based logging system
import winston from "winston";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, "..", "logs");

// Custom format for better readability
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if exists
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: customFormat,
  transports: [
    // Console output with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        customFormat
      )
    }),
    
    // File output for errors
    new winston.transports.File({
      filename: path.join(LOG_DIR, "error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    
    // File output for all logs
    new winston.transports.File({
      filename: path.join(LOG_DIR, "combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// Helper functions for common logging patterns
export const log = {
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, error = null, meta = {}) => {
    if (error instanceof Error) {
      logger.error(message, { ...meta, error: error.message, stack: error.stack });
    } else {
      logger.error(message, meta);
    }
  },
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  // Shopify-specific helpers
  shopify: {
    apiCall: (method, endpoint, shop) => 
      logger.info(`Shopify API: ${method} ${endpoint}`, { shop }),
    
    apiError: (method, endpoint, shop, error) =>
      logger.error(`Shopify API Error: ${method} ${endpoint}`, { 
        shop, 
        error: error.message,
        stack: error.stack 
      }),
    
    oauth: (shop, action) =>
      logger.info(`OAuth: ${action}`, { shop }),
    
    webhook: (topic, shop) =>
      logger.info(`Webhook: ${topic}`, { shop }),
  },
  
  // HTTP request logging
  http: (method, path, statusCode, duration) =>
    logger.info(`HTTP ${method} ${path}`, { statusCode, duration: `${duration}ms` }),
};

export default logger;
