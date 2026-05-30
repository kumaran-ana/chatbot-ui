import 'dotenv/config';
import crypto from 'node:crypto';
import cors from 'cors';
import express from 'express';
import {
  appendChatMessages,
  getUserBySession,
  initDb,
  upsertUserLocation,
} from './db.js';
import { buildBotReply } from './chatbot.js';

const allowedClientOrigins = new Set([
  'https://chatbot-ui-beta-umber.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://chatbot-ui-939800561122.asia-south1.run.app'
]);
let dbReadyPromise;

function ensureDbReady() {
  if (!dbReadyPromise) {
    dbReadyPromise = initDb();
  }

  return dbReadyPromise;
}

function normalizeSessionId(sessionId) {
  return typeof sessionId === 'string' && sessionId.trim().length > 0
    ? sessionId.trim().slice(0, 100)
    : '';
}

function parseOptionalNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLocation(body) {
  return {
    latitude: parseOptionalNumber(body.latitude),
    longitude: parseOptionalNumber(body.longitude),
    locationAccuracy: parseOptionalNumber(body.locationAccuracy),
    exactLocation:
      typeof body.exactLocation === 'string'
        ? body.exactLocation.trim().slice(0, 240)
        : '',
  };
}

function normalizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value;
}

function getClientIp(request) {
  if (request.ip) {
    return request.ip;
  }

  return request.socket?.remoteAddress || '';
}

function getRequestHeadersForStorage(headers) {
  const keysToStore = [
    'user-agent',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'accept-language',
    'origin',
    'referer',
    'host',
    'x-forwarded-for',
  ];

  return keysToStore.reduce((acc, key) => {
    const value = headers[key];
    if (typeof value === 'string' && value.trim()) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function buildAdditionalInformation(request, body) {
  const fromClient = normalizeObject(body.additionalInformation);

  return {
    client: fromClient,
    request: {
      ipAddress: getClientIp(request),
      headers: getRequestHeadersForStorage(request.headers),
      capturedAt: new Date().toISOString(),
    },
  };
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  return {
    sessionId: user.session_id,
    latitude: user.latitude,
    longitude: user.longitude,
    locationAccuracy: user.location_accuracy,
    exactLocation: user.exact_location,
    cookies: user.cookies || {},
    additionalInformation: user.additional_information || {},
    chatHistory: user.chat_history || [],
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
}

export function createApp() {
  const app = express();
  const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  for (const origin of configuredOrigins) {
    allowedClientOrigins.add(origin);
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedClientOrigins.has(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error('Not allowed by CORS'));
      },
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(async (_request, _response, next) => {
    try {
      await ensureDbReady();
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, service: 'SearchSomething API' });
  });

  app.get('/api/chat/:sessionId', async (request, response, next) => {
    try {
      const sessionId = normalizeSessionId(request.params.sessionId);

      if (!sessionId) {
        response.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const user = await getUserBySession(sessionId);
      response.json({
        user: toPublicUser(user),
        chatHistory: user?.chat_history || [],
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/location', async (request, response, next) => {
    try {
      const sessionId = normalizeSessionId(request.body.sessionId);

      if (!sessionId) {
        response.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const user = await upsertUserLocation({
        sessionId,
        ...normalizeLocation(request.body),
        cookies: normalizeObject(request.body.cookies),
        additionalInformation: buildAdditionalInformation(request, request.body),
      });

      response.json({ user: toPublicUser(user) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/chat', async (request, response, next) => {
    try {
      const sessionId = normalizeSessionId(request.body.sessionId);
      const message =
        typeof request.body.message === 'string'
          ? request.body.message.trim().slice(0, 2000)
          : '';

      if (!sessionId || !message) {
        response
          .status(400)
          .json({ error: 'sessionId and message are required' });
        return;
      }

      const userBeforeReply = await upsertUserLocation({
        sessionId,
        ...normalizeLocation(request.body),
        cookies: normalizeObject(request.body.cookies),
        additionalInformation: buildAdditionalInformation(request, request.body),
      });

      const now = new Date().toISOString();
      const userMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: message,
        createdAt: now,
      };
      const botMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: buildBotReply(message, userBeforeReply),
        createdAt: now,
      };

      const user = await appendChatMessages(sessionId, [
        userMessage,
        botMessage,
      ]);

      response.status(201).json({
        user: toPublicUser(user),
        messages: [userMessage, botMessage],
        chatHistory: user.chat_history,
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    response.status(500).json({
      error: 'Server error',
      detail:
        process.env.NODE_ENV === 'production' ? undefined : error.message,
    });
  });

  return app;
}

export async function initAppDb() {
  await ensureDbReady();
}
