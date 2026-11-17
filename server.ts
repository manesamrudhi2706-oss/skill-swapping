import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  ChatMessage,
  LanguageId,
  LineAnnotation,
  RoomFile,
  RoomParticipant,
} from './src/types/sigma.ts';
import {
  createSigmaApp,
  executeCodeSafely,
  makeDefaultRoom,
} from './server/app.ts';

const PORT = Number(process.env.PORT || 3000);
const PARTICIPANT_COLORS = ['#2563EB', '#16A34A', '#D97706', '#9333EA', '#0D9488', '#DC2626'];

interface ClientSocket extends WebSocket {
  clientId?: string;
  userId?: string;
  roomId?: string;
  isAlive?: boolean;
}

const roomSockets = new Map<string, Set<ClientSocket>>();

function broadcastToRoom(roomId: string, payload: unknown, excludeClientId?: string) {
  const clients = roomSockets.get(roomId);
  if (!clients) return;
  const serialized = JSON.stringify(payload);
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN && (!excludeClientId || ws.clientId !== excludeClientId)) {
      ws.send(serialized);
    }
  }
}

async function startServer() {
  const { app, state, getAuthenticatedAccount, schedulePersist } = createSigmaApp({
    onRoomPrivacyUpdated: (roomId, isPrivate) => {
      broadcastToRoom(roomId, { type: 'room:privacy_updated', isPrivate });
    },
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ClientSocket, req) => {
    const urlObj = new URL(req.url || '/ws', 'http://localhost');
    const queryToken = urlObj.searchParams.get('token') || undefined;
    const authAccount = getAuthenticatedAccount(
      req.headers.cookie,
      req.headers.authorization,
      queryToken
    );
    if (!authAccount) {
      ws.send(JSON.stringify({ type: 'room:error', message: 'Authentication required.' }));
      ws.close(4401, 'Authentication required');
      return;
    }

    ws.userId = authAccount.id;
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', async (rawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawData.toString()) as Record<string, unknown>;
      } catch {
        return;
      }

      const type = String(msg.type || '');

      if (type === 'room:join') {
        const roomId = String(msg.roomId || '').trim().toUpperCase();
        if (!roomId) {
          ws.send(JSON.stringify({ type: 'room:error', message: 'Room ID is required.' }));
          return;
        }

        let room = state.rooms[roomId];
        if (!room) {
          room = makeDefaultRoom(roomId, authAccount.id, { isPrivate: false });
          state.rooms[roomId] = room;
          schedulePersist();
        }

        if (room.isPrivate && room.ownerId !== authAccount.id) {
          ws.send(
            JSON.stringify({
              type: 'room:error',
              message: 'Access denied: this workspace is set to Private by its owner.',
            })
          );
          return;
        }

        if (!room.allowedUserIds.includes(authAccount.id)) {
          room.allowedUserIds.push(authAccount.id);
          schedulePersist();
        }

        const clientId = String(msg.clientId || `c_${Date.now()}`);
        const name = authAccount.profile.name;
        const handle = authAccount.profile.handle;

        if (ws.roomId && ws.roomId !== roomId) {
          const prevRoom = state.rooms[ws.roomId];
          if (prevRoom) {
            prevRoom.participants = prevRoom.participants.filter((p) => p.clientId !== ws.clientId);
            if (prevRoom.driverId === ws.clientId) {
              prevRoom.driverId = prevRoom.participants[0]?.clientId || null;
              if (prevRoom.participants[0]) prevRoom.participants[0].role = 'driver';
            }
            broadcastToRoom(ws.roomId, {
              type: 'room:presence',
              participants: prevRoom.participants,
              driverId: prevRoom.driverId,
            });
          }
          roomSockets.get(ws.roomId)?.delete(ws);
        }

        ws.clientId = clientId;
        ws.roomId = roomId;

        if (!roomSockets.has(roomId)) {
          roomSockets.set(roomId, new Set());
        }
        roomSockets.get(roomId)!.add(ws);

        const existingIdx = room.participants.findIndex((p) => p.clientId === clientId);
        const color = PARTICIPANT_COLORS[room.participants.length % PARTICIPANT_COLORS.length];

        if (!room.driverId) {
          room.driverId = clientId;
        }
        const role: 'driver' | 'navigator' = room.driverId === clientId ? 'driver' : 'navigator';

        const participant: RoomParticipant = {
          clientId,
          userId: authAccount.id,
          name,
          handle,
          color: existingIdx >= 0 ? room.participants[existingIdx].color : color,
          role,
          cursorLine: 1,
          cursorCol: 1,
          joinedAt: Date.now(),
        };

        if (existingIdx >= 0) {
          room.participants[existingIdx] = participant;
        } else {
          room.participants.push(participant);
        }

        ws.send(JSON.stringify({ type: 'room:state', room }));
        broadcastToRoom(
          roomId,
          {
            type: 'room:presence',
            participants: room.participants,
            driverId: room.driverId,
          },
          clientId
        );
        return;
      }

      const roomId = ws.roomId;
      const clientId = ws.clientId;
      if (!roomId || !clientId) return;
      const room = state.rooms[roomId];
      if (!room) return;

      if (type === 'code:update') {
        const fileId = String(msg.fileId || room.activeFileId);
        const content = String(msg.content ?? '');
        const file = room.files.find((f) => f.id === fileId);
        if (file) {
          file.content = content;
          schedulePersist();
          broadcastToRoom(
            roomId,
            { type: 'code:updated', fileId, content, senderId: clientId },
            clientId
          );
        }
        return;
      }

      if (type === 'file:switch') {
        const fileId = String(msg.fileId || '');
        if (room.files.some((f) => f.id === fileId)) {
          room.activeFileId = fileId;
          broadcastToRoom(roomId, { type: 'file:switched', fileId, senderId: clientId });
        }
        return;
      }

      if (type === 'file:create') {
        const name = String(msg.name || 'untitled.ts').trim().slice(0, 48);
        const language = (msg.language as LanguageId) || room.language;
        const newFile: RoomFile = {
          id: `file_${Date.now()}`,
          name,
          language,
          content: `// ${name}\n`,
        };
        if (!room.files.some((f) => f.name === name)) {
          room.files.push(newFile);
          room.activeFileId = newFile.id;
          schedulePersist();
          broadcastToRoom(roomId, { type: 'room:state', room });
        }
        return;
      }

      if (type === 'language:change') {
        const language = (msg.language as LanguageId) || 'typescript';
        room.language = language;
        const active = room.files.find((f) => f.id === room.activeFileId);
        if (active) active.language = language;
        schedulePersist();
        broadcastToRoom(roomId, { type: 'language:updated', language, fileId: room.activeFileId });
        return;
      }

      if (type === 'template:load') {
        const title = String(msg.title || room.title);
        const language = (msg.language as LanguageId) || 'typescript';
        const fileName = String(msg.fileName || 'main.ts');
        const code = String(msg.code || '');
        const checklistTexts = Array.isArray(msg.checklist)
          ? msg.checklist.map((t) => String(t))
          : [];

        room.title = title;
        room.language = language;
        if (room.files[0]) {
          room.files[0].name = fileName;
          room.files[0].language = language;
          room.files[0].content = code;
          room.activeFileId = room.files[0].id;
        }
        if (checklistTexts.length > 0) {
          room.checklist = checklistTexts.map((text, idx) => ({
            id: `chk_${Date.now()}_${idx}`,
            text,
            done: false,
          }));
        }
        schedulePersist();
        broadcastToRoom(roomId, { type: 'room:state', room });
        return;
      }

      if (type === 'cursor:move') {
        const line = Math.max(1, Number(msg.line) || 1);
        const col = Math.max(1, Number(msg.col) || 1);
        const participant = room.participants.find((p) => p.clientId === clientId);
        if (participant) {
          participant.cursorLine = line;
          participant.cursorCol = col;
          broadcastToRoom(roomId, { type: 'cursor:moved', clientId, line, col }, clientId);
        }
        return;
      }

      if (type === 'role:claim_driver') {
        const targetId = String(msg.targetId || clientId);
        room.driverId = targetId;
        room.participants = room.participants.map((p) => ({
          ...p,
          role: p.clientId === targetId ? 'driver' : 'navigator',
        }));
        broadcastToRoom(roomId, {
          type: 'room:presence',
          participants: room.participants,
          driverId: room.driverId,
        });
        return;
      }

      if (type === 'checklist:toggle') {
        const itemId = String(msg.itemId || '');
        const item = room.checklist.find((c) => c.id === itemId);
        if (item) {
          item.done = !item.done;
          schedulePersist();
          broadcastToRoom(roomId, { type: 'checklist:updated', checklist: room.checklist });
        }
        return;
      }

      if (type === 'checklist:add') {
        const text = String(msg.text || '').trim().slice(0, 120);
        if (text) {
          const itemId = String(msg.itemId || `chk_${Date.now()}`);
          if (!room.checklist.some((c) => c.id === itemId)) {
            room.checklist.push({ id: itemId, text, done: false });
            schedulePersist();
          }
          broadcastToRoom(roomId, { type: 'checklist:updated', checklist: room.checklist });
        }
        return;
      }

      if (type === 'notes:update') {
        room.notes = String(msg.notes ?? '');
        schedulePersist();
        broadcastToRoom(
          roomId,
          { type: 'notes:updated', notes: room.notes, senderId: clientId },
          clientId
        );
        return;
      }

      if (type === 'annotation:add') {
        const annotationId = String(msg.id || `ann_${Date.now()}`);
        if (!room.annotations.some((a) => a.id === annotationId)) {
          const sender = room.participants.find((p) => p.clientId === clientId);
          const ann: LineAnnotation = {
            id: annotationId,
            fileId: String(msg.fileId || room.activeFileId),
            line: Math.max(1, Number(msg.line) || 1),
            authorName: sender?.name || authAccount.profile.name,
            authorHandle: sender?.handle || authAccount.profile.handle,
            color: sender?.color || '#2563EB',
            text: String(msg.text || '').trim().slice(0, 300),
            resolved: false,
            createdAt: Date.now(),
          };
          if (ann.text) {
            room.annotations.push(ann);
            schedulePersist();
            broadcastToRoom(roomId, { type: 'annotations:updated', annotations: room.annotations });
          }
        }
        return;
      }

      if (type === 'annotation:resolve') {
        const annotationId = String(msg.id || '');
        const ann = room.annotations.find((a) => a.id === annotationId);
        if (ann) {
          ann.resolved = !ann.resolved;
          schedulePersist();
          broadcastToRoom(roomId, { type: 'annotations:updated', annotations: room.annotations });
        }
        return;
      }

      if (type === 'chat:send') {
        const msgId = String(msg.id || `msg_${Date.now()}`);
        const text = String(msg.text || '').trim().slice(0, 1000);
        if (!text) return;
        if (room.messages.some((m) => m.id === msgId)) return;

        const sender = room.participants.find((p) => p.clientId === clientId);
        const chatMsg: ChatMessage = {
          id: msgId,
          senderId: clientId,
          senderName: sender?.name || authAccount.profile.name,
          senderHandle: sender?.handle || authAccount.profile.handle,
          color: sender?.color || '#2563EB',
          text,
          lineRef: msg.lineRef ? Number(msg.lineRef) : undefined,
          timestamp: Date.now(),
        };
        room.messages.push(chatMsg);
        if (room.messages.length > 150) {
          room.messages = room.messages.slice(-150);
        }
        schedulePersist();
        broadcastToRoom(roomId, { type: 'chat:message', message: chatMsg });
        return;
      }

      if (type === 'timer:control') {
        const action = String(msg.action || '');
        const now = Date.now();
        if (action === 'start' && !room.timer.running) {
          room.timer.startedAt = now;
          room.timer.running = true;
        } else if (action === 'pause' && room.timer.running) {
          if (room.timer.startedAt) {
            room.timer.elapsedBeforePause += Math.floor((now - room.timer.startedAt) / 1000);
          }
          room.timer.startedAt = null;
          room.timer.running = false;
        } else if (action === 'reset') {
          room.timer.elapsedBeforePause = 0;
          room.timer.startedAt = room.timer.running ? now : null;
        }
        schedulePersist();
        broadcastToRoom(roomId, { type: 'timer:updated', timer: room.timer });
        return;
      }

      if (type === 'execute:run') {
        const activeFile = room.files.find((f) => f.id === room.activeFileId) || room.files[0];
        const sender = room.participants.find((p) => p.clientId === clientId);
        const code = String(msg.code ?? activeFile?.content ?? '');
        const lang = (msg.language as LanguageId) || activeFile?.language || room.language;
        const result = await executeCodeSafely(
          code,
          lang,
          sender?.name || authAccount.profile.name
        );
        room.executionLogs.unshift(result);
        room.executionLogs = room.executionLogs.slice(0, 20);
        schedulePersist();
        broadcastToRoom(roomId, { type: 'execute:result', result });
      }
    });

    ws.on('close', () => {
      const roomId = ws.roomId;
      const clientId = ws.clientId;
      if (roomId) {
        roomSockets.get(roomId)?.delete(ws);
        const room = state.rooms[roomId];
        if (room && clientId) {
          room.participants = room.participants.filter((p) => p.clientId !== clientId);
          if (room.driverId === clientId) {
            room.driverId = room.participants[0]?.clientId || null;
            if (room.participants[0]) {
              room.participants[0].role = 'driver';
            }
          }
          broadcastToRoom(roomId, {
            type: 'room:presence',
            participants: room.participants,
            driverId: room.driverId,
          });
        }
      }
    });
  });

  const interval = setInterval(() => {
    for (const client of wss.clients as Set<ClientSocket>) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Sigma server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Sigma server:', err);
  process.exit(1);
});
