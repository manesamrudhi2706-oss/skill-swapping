import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckSquare,
  Copy,
  FileCode2,
  Lock,
  MessageSquare,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Send,
  Square,
  Terminal,
  Unlock,
  Users,
} from 'lucide-react';
import type {
  ChatMessage,
  ChecklistItem,
  ExecutionResult,
  LanguageId,
  LineAnnotation,
  RoomParticipant,
  RoomState,
  RoomTimerState,
  UserProfile,
} from '../types/sigma.ts';
import { CHALLENGE_PRESETS, LANGUAGE_LABELS } from '../data/presets.ts';
import { apiFetch, getAuthToken, safeJson } from '../lib/api.ts';

interface PairStudioViewProps {
  roomId: string;
  userProfile: UserProfile;
  clientId: string;
  onCompleteSwapRoom: (roomId: string) => Promise<void>;
  onBackToSwaps: () => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'serverless';
type RightTab = 'chat' | 'notes' | 'annotations';
type MobilePane = 'editor' | 'workspace' | 'collab';

function buildLocalFallbackRoom(roomId: string, userProfile: UserProfile, clientId: string): RoomState {
  const preset = CHALLENGE_PRESETS[0];
  return {
    roomId,
    ownerId: userProfile.id,
    allowedUserIds: [userProfile.id],
    isPrivate: false,
    title: preset.title,
    offerSkill: userProfile.offers[0] || 'TypeScript',
    seekSkill: userProfile.seeks[0] || 'System Design',
    language: preset.language,
    files: [
      {
        id: 'file_main',
        name: preset.fileName,
        language: preset.language,
        content: preset.code,
      },
      {
        id: 'file_notes',
        name: 'pairing_plan.md',
        language: 'typescript',
        content: `// Session Notes & Pairing Plan\n// 1. Align on constraints and edge cases\n// 2. Write and run test cases in Shared Output Console\n`,
      },
    ],
    activeFileId: 'file_main',
    participants: [
      {
        clientId,
        userId: userProfile.id,
        name: userProfile.name,
        handle: userProfile.handle,
        color: '#2563EB',
        role: 'driver',
        cursorLine: 1,
        cursorCol: 1,
        joinedAt: Date.now(),
      },
    ],
    checklist: preset.checklist.map((text, idx) => ({
      id: `chk_${idx}_${Date.now()}`,
      text,
      done: idx === 0,
    })),
    notes: 'Focus areas:\n- Keep functions pure where possible for unit testing\n- Benchmark latency and edge cases before finalizing',
    messages: [
      {
        id: `msg_sys_${Date.now()}`,
        senderId: 'system',
        senderName: 'Session Host',
        senderHandle: '@sigma',
        color: '#475569',
        text: `Room ${roomId} ready in serverless workspace mode.`,
        timestamp: Date.now(),
      },
    ],
    annotations: [],
    executionLogs: [],
    timer: {
      durationSeconds: 45 * 60,
      elapsedBeforePause: 0,
      startedAt: null,
      running: false,
    },
    driverId: clientId,
    createdAt: Date.now(),
  };
}

export function PairStudioView({
  roomId,
  userProfile,
  clientId,
  onCompleteSwapRoom,
  onBackToSwaps,
}: PairStudioViewProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>('connecting');
  const [rightTab, setRightTab] = useState<RightTab>('chat');
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');
  const [copiedInvite, setCopiedInvite] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [chatLineRef, setChatLineRef] = useState<number | undefined>(undefined);
  const [newTaskText, setNewTaskText] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);

  const [annotatingLine, setAnnotatingLine] = useState<number | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState('');

  const [runningCode, setRunningCode] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [swapCompletedNotice, setSwapCompletedNotice] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const serverlessActiveRef = useRef(false);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const gutterRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const roomStorageKey = `sigma_room_${roomId}_${userProfile.id}`;

  const persistServerlessRoom = (nextRoom: RoomState) => {
    try {
      localStorage.setItem(roomStorageKey, JSON.stringify(nextRoom));
    } catch {
      // Ignore storage quota errors
    }
    try {
      broadcastRef.current?.postMessage({ senderClientId: clientId, room: nextRoom });
    } catch {
      // Ignore BroadcastChannel errors
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      apiFetch(`/api/rooms/${encodeURIComponent(roomId)}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: nextRoom.title,
          offerSkill: nextRoom.offerSkill,
          seekSkill: nextRoom.seekSkill,
          files: nextRoom.files,
          activeFileId: nextRoom.activeFileId,
          language: nextRoom.language,
          notes: nextRoom.notes,
          checklist: nextRoom.checklist,
          annotations: nextRoom.annotations,
          messages: nextRoom.messages,
          executionLogs: nextRoom.executionLogs,
          timer: nextRoom.timer,
        }),
      }).catch(() => undefined);
    }, 450);
  };

  const applyLocalRoomMutation = (updater: (prev: RoomState) => RoomState) => {
    setRoom((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      if (serverlessActiveRef.current) {
        persistServerlessRoom(next);
      }
      return next;
    });
  };

  useEffect(() => {
    let closedByEffect = false;
    let attempt = 0;
    let handshakeResolved = false;
    serverlessActiveRef.current = false;
    setRoomError(null);
    setRoom(null);

    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(`sigma_room_${roomId}`);
      broadcastRef.current = channel;
      channel.onmessage = (ev) => {
        const msg = ev.data as { senderClientId?: string; room?: RoomState } | null;
        if (!msg?.room || msg.senderClientId === clientId) return;
        if (serverlessActiveRef.current) {
          setRoom((prev) => {
            if (!prev) return msg.room!;
            const myEntry = prev.participants.find((p) => p.clientId === clientId);
            const others = (msg.room!.participants || []).filter((p) => p.clientId !== clientId);
            return {
              ...msg.room!,
              participants: myEntry ? [myEntry, ...others] : msg.room!.participants,
            };
          });
        }
      };
    }

    async function activateServerlessFallback() {
      if (closedByEffect || serverlessActiveRef.current) return;
      serverlessActiveRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // Ignore close error
        }
        wsRef.current = null;
      }
      setConnStatus('serverless');

      let hydrated: RoomState | null = null;
      try {
        const res = await apiFetch(`/api/rooms/${encodeURIComponent(roomId)}`);
        if (res.status === 403) {
          const errData = await safeJson<{ error?: string }>(res);
          if (!closedByEffect) {
            setRoomError(errData?.error || 'This workspace is private to its owner.');
          }
          return;
        }
        if (res.ok) {
          const data = await safeJson<{ room?: RoomState }>(res);
          if (data?.room) hydrated = data.room;
        }
      } catch {
        // Offline or unreachable fallback below
      }

      if (closedByEffect) return;

      let localCached: RoomState | null = null;
      try {
        const raw = localStorage.getItem(roomStorageKey);
        if (raw) localCached = JSON.parse(raw) as RoomState;
      } catch {
        localCached = null;
      }

      let finalRoom: RoomState;
      if (hydrated && localCached) {
        const serverLooksFresh =
          hydrated.messages.length <= 1 &&
          hydrated.executionLogs.length === 0 &&
          hydrated.annotations.length === 0 &&
          localCached.files.length > 0;
        finalRoom = serverLooksFresh
          ? { ...localCached, isPrivate: hydrated.isPrivate, ownerId: hydrated.ownerId }
          : hydrated;
      } else {
        finalRoom = hydrated || localCached || buildLocalFallbackRoom(roomId, userProfile, clientId);
      }

      const selfParticipant: RoomParticipant = {
        clientId,
        userId: userProfile.id,
        name: userProfile.name,
        handle: userProfile.handle,
        color: '#2563EB',
        role: finalRoom.driverId && finalRoom.driverId !== clientId ? 'navigator' : 'driver',
        cursorLine: 1,
        cursorCol: 1,
        joinedAt: Date.now(),
      };
      const others = (finalRoom.participants || []).filter((p) => p.clientId !== clientId);
      finalRoom = {
        ...finalRoom,
        driverId: finalRoom.driverId || clientId,
        participants: [selfParticipant, ...others],
      };

      setRoom(finalRoom);
      setRoomError(null);
      try {
        localStorage.setItem(roomStorageKey, JSON.stringify(finalRoom));
      } catch {
        // Ignore storage error
      }
    }

    // If WebSocket never delivers room:state within 2200ms (typical on Vercel), switch smoothly to serverless mode
    const fallbackTimeout = setTimeout(() => {
      if (!handshakeResolved && !closedByEffect) {
        activateServerlessFallback();
      }
    }, 2200);

    function connect() {
      if (closedByEffect || serverlessActiveRef.current) return;
      setConnStatus(attempt === 0 ? 'connecting' : 'reconnecting');

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = getAuthToken();
      const wsQuery = token ? `?token=${encodeURIComponent(token)}` : '';
      let socket: WebSocket;
      try {
        socket = new WebSocket(`${proto}//${window.location.host}/ws${wsQuery}`);
      } catch {
        activateServerlessFallback();
        return;
      }
      wsRef.current = socket;

      socket.onopen = () => {
        if (serverlessActiveRef.current) {
          socket.close();
          return;
        }
        attempt = 0;
        setConnStatus('connected');
        socket.send(
          JSON.stringify({
            type: 'room:join',
            roomId,
            clientId,
          })
        );
      };

      socket.onmessage = (event) => {
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(event.data as string) as Record<string, unknown>;
        } catch {
          return;
        }

        const type = String(data.type || '');

        if (type === 'room:error') {
          handshakeResolved = true;
          setRoomError(String(data.message || 'Unable to access this workspace.'));
          return;
        }

        if (type === 'room:state' && data.room) {
          handshakeResolved = true;
          setRoom(data.room as RoomState);
          setRoomError(null);
          return;
        }

        if (type === 'room:privacy_updated') {
          const isPrivate = Boolean(data.isPrivate);
          setRoom((prev) => (prev ? { ...prev, isPrivate } : prev));
          return;
        }

        if (type === 'room:presence') {
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  participants: data.participants as RoomParticipant[],
                  driverId: (data.driverId as string | null) ?? null,
                }
              : prev
          );
          return;
        }

        if (type === 'code:updated') {
          const senderId = String(data.senderId || '');
          if (senderId === clientId) return;
          const fileId = String(data.fileId || '');
          const content = String(data.content ?? '');
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  files: prev.files.map((f) => (f.id === fileId ? { ...f, content } : f)),
                }
              : prev
          );
          return;
        }

        if (type === 'file:switched') {
          const fileId = String(data.fileId || '');
          setRoom((prev) => (prev ? { ...prev, activeFileId: fileId } : prev));
          return;
        }

        if (type === 'language:updated') {
          const language = data.language as LanguageId;
          const fileId = String(data.fileId || '');
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  language,
                  files: prev.files.map((f) => (f.id === fileId ? { ...f, language } : f)),
                }
              : prev
          );
          return;
        }

        if (type === 'cursor:moved') {
          const peerId = String(data.clientId || '');
          const line = Number(data.line) || 1;
          const col = Number(data.col) || 1;
          setRoom((prev) =>
            prev
              ? {
                  ...prev,
                  participants: prev.participants.map((p) =>
                    p.clientId === peerId ? { ...p, cursorLine: line, cursorCol: col } : p
                  ),
                }
              : prev
          );
          return;
        }

        if (type === 'checklist:updated') {
          setRoom((prev) =>
            prev ? { ...prev, checklist: data.checklist as ChecklistItem[] } : prev
          );
          return;
        }

        if (type === 'notes:updated') {
          const senderId = String(data.senderId || '');
          if (senderId === clientId) return;
          setRoom((prev) => (prev ? { ...prev, notes: String(data.notes ?? '') } : prev));
          return;
        }

        if (type === 'annotations:updated') {
          setRoom((prev) =>
            prev ? { ...prev, annotations: data.annotations as LineAnnotation[] } : prev
          );
          return;
        }

        if (type === 'chat:message' && data.message) {
          const msg = data.message as ChatMessage;
          setRoom((prev) => {
            if (!prev) return prev;
            if (prev.messages.some((m) => m.id === msg.id)) return prev;
            return { ...prev, messages: [...prev.messages, msg] };
          });
          return;
        }

        if (type === 'timer:updated' && data.timer) {
          setRoom((prev) => (prev ? { ...prev, timer: data.timer as RoomTimerState } : prev));
          return;
        }

        if (type === 'execute:result' && data.result) {
          const res = data.result as ExecutionResult;
          setRunningCode(false);
          setRoom((prev) => {
            if (!prev) return prev;
            if (prev.executionLogs.some((l) => l.id === res.id)) return prev;
            return { ...prev, executionLogs: [res, ...prev.executionLogs].slice(0, 20) };
          });
        }
      };

      socket.onclose = (ev) => {
        if (closedByEffect || ev.code === 4401 || serverlessActiveRef.current) return;
        attempt += 1;
        // If we haven't established a WS handshake after 1 retry, switch to Vercel serverless fallback immediately
        if (!handshakeResolved && attempt >= 2) {
          activateServerlessFallback();
          return;
        }
        setConnStatus('reconnecting');
        const backoff = Math.min(2000, 600 * attempt);
        reconnectTimerRef.current = setTimeout(connect, backoff);
      };
    }

    connect();

    return () => {
      closedByEffect = true;
      clearTimeout(fallbackTimeout);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      if (broadcastRef.current) {
        broadcastRef.current.close();
        broadcastRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [roomId, clientId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages.length]);

  const sendWs = (payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
      return true;
    }
    return false;
  };

  const activeFile = useMemo(() => {
    if (!room) return null;
    return room.files.find((f) => f.id === room.activeFileId) || room.files[0] || null;
  }, [room]);

  const lines = useMemo(() => {
    return (activeFile?.content || '').split('\n');
  }, [activeFile?.content]);

  const myParticipant = room?.participants.find((p) => p.clientId === clientId);
  const remoteParticipants = room?.participants.filter((p) => p.clientId !== clientId) || [];
  const isDriver = room?.driverId === clientId;
  const isOwner = room?.ownerId === userProfile.id;

  const elapsedSeconds = useMemo(() => {
    if (!room) return 0;
    const base = room.timer.elapsedBeforePause;
    if (room.timer.running && room.timer.startedAt) {
      return base + Math.max(0, Math.floor((nowTick - room.timer.startedAt) / 1000));
    }
    return base;
  }, [room, nowTick]);

  const remainingSeconds = Math.max(0, (room?.timer.durationSeconds || 2700) - elapsedSeconds);
  const mins = String(Math.floor(remainingSeconds / 60)).padStart(2, '0');
  const secs = String(remainingSeconds % 60).padStart(2, '0');

  const handleTogglePrivacy = async () => {
    if (!room || !isOwner) return;
    const res = await apiFetch(`/api/rooms/${encodeURIComponent(room.roomId)}/privacy`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPrivate: !room.isPrivate }),
    });
    if (res.ok) {
      const data = await safeJson<{ isPrivate: boolean }>(res);
      if (data) {
        applyLocalRoomMutation((prev) => ({ ...prev, isPrivate: data.isPrivate }));
      }
    }
  };

  const handleCodeChange = (nextContent: string) => {
    if (!activeFile) return;
    applyLocalRoomMutation((prev) => ({
      ...prev,
      files: prev.files.map((f) =>
        f.id === activeFile.id ? { ...f, content: nextContent } : f
      ),
    }));
    sendWs({ type: 'code:update', fileId: activeFile.id, content: nextContent });
  };

  const updateCursorPosition = () => {
    const el = editorRef.current;
    if (!el) return;
    const pos = el.selectionStart || 0;
    const upToCursor = el.value.slice(0, pos);
    const split = upToCursor.split('\n');
    const line = split.length;
    const col = split[split.length - 1].length + 1;
    if (!sendWs({ type: 'cursor:move', line, col })) {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              participants: prev.participants.map((p) =>
                p.clientId === clientId ? { ...p, cursorLine: line, cursorCol: col } : p
              ),
            }
          : prev
      );
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const nextValue = el.value.slice(0, start) + '  ' + el.value.slice(end);
      handleCodeChange(nextValue);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.selectionStart = start + 2;
          editorRef.current.selectionEnd = start + 2;
          updateCursorPosition();
        }
      });
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRunCode();
    }
  };

  const handleRunCode = async () => {
    if (!activeFile || runningCode) return;
    setRunningCode(true);
    const sent = sendWs({
      type: 'execute:run',
      code: activeFile.content,
      language: activeFile.language,
    });
    if (!sent) {
      try {
        const res = await apiFetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: activeFile.content,
            language: activeFile.language,
          }),
        });
        const data = await safeJson<{ result?: ExecutionResult }>(res);
        if (data?.result) {
          const result = data.result;
          applyLocalRoomMutation((prev) => ({
            ...prev,
            executionLogs: [result, ...prev.executionLogs].slice(0, 20),
          }));
        }
      } finally {
        setRunningCode(false);
      }
    }
  };

  const handleCopyInvite = () => {
    const url = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 1800);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sent = sendWs({
      type: 'chat:send',
      id: msgId,
      text,
      lineRef: chatLineRef,
    });
    if (!sent) {
      const msg: ChatMessage = {
        id: msgId,
        senderId: userProfile.id,
        senderName: userProfile.name,
        senderHandle: userProfile.handle,
        color: '#2563EB',
        text,
        lineRef: chatLineRef,
        timestamp: Date.now(),
      };
      applyLocalRoomMutation((prev) => ({
        ...prev,
        messages: [...prev.messages, msg].slice(-150),
      }));
    }
    setChatInput('');
    setChatLineRef(undefined);
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;
    const itemId = `chk_${Date.now()}`;
    if (!sendWs({ type: 'checklist:add', itemId, text })) {
      applyLocalRoomMutation((prev) => ({
        ...prev,
        checklist: [...prev.checklist, { id: itemId, text, done: false }],
      }));
    }
    setNewTaskText('');
  };

  const handleToggleChecklistItem = (itemId: string) => {
    if (!sendWs({ type: 'checklist:toggle', itemId })) {
      applyLocalRoomMutation((prev) => ({
        ...prev,
        checklist: prev.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)),
      }));
    }
  };

  const handleCreateFile = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFileName.trim();
    if (!name) return;
    const language = room?.language || 'typescript';
    if (!sendWs({ type: 'file:create', name, language })) {
      const newId = `file_${Date.now()}`;
      applyLocalRoomMutation((prev) => ({
        ...prev,
        activeFileId: newId,
        files: [
          ...prev.files,
          { id: newId, name, language, content: `// ${name}\n` },
        ],
      }));
    }
    setNewFileName('');
    setShowNewFileInput(false);
  };

  const handleAddAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annotatingLine || !annotationDraft.trim() || !activeFile) return;
    const annId = `ann_${Date.now()}`;
    const text = annotationDraft.trim();
    if (
      !sendWs({
        type: 'annotation:add',
        id: annId,
        fileId: activeFile.id,
        line: annotatingLine,
        text,
      })
    ) {
      const newAnn: LineAnnotation = {
        id: annId,
        fileId: activeFile.id,
        line: annotatingLine,
        authorName: userProfile.name,
        authorHandle: userProfile.handle,
        color: '#2563EB',
        text,
        resolved: false,
        createdAt: Date.now(),
      };
      applyLocalRoomMutation((prev) => ({
        ...prev,
        annotations: [newAnn, ...prev.annotations],
      }));
    }
    setAnnotationDraft('');
    setAnnotatingLine(null);
    setRightTab('annotations');
  };

  const handleResolveAnnotation = (annId: string) => {
    if (!sendWs({ type: 'annotation:resolve', id: annId })) {
      applyLocalRoomMutation((prev) => ({
        ...prev,
        annotations: prev.annotations.map((a) =>
          a.id === annId ? { ...a, resolved: !a.resolved } : a
        ),
      }));
    }
  };

  const handleTimerControl = (action: 'start' | 'pause' | 'reset') => {
    if (!sendWs({ type: 'timer:control', action })) {
      applyLocalRoomMutation((prev) => {
        const t = prev.timer;
        if (action === 'start' && !t.running) {
          return {
            ...prev,
            timer: { ...t, running: true, startedAt: Date.now() },
          };
        }
        if (action === 'pause' && t.running && t.startedAt) {
          const delta = Math.max(0, Math.floor((Date.now() - t.startedAt) / 1000));
          return {
            ...prev,
            timer: {
              ...t,
              elapsedBeforePause: t.elapsedBeforePause + delta,
              startedAt: null,
              running: false,
            },
          };
        }
        if (action === 'reset') {
          return {
            ...prev,
            timer: { ...t, elapsedBeforePause: 0, startedAt: null, running: false },
          };
        }
        return prev;
      });
    }
  };

  const handleClaimDriver = () => {
    if (!sendWs({ type: 'role:claim_driver', targetId: clientId })) {
      applyLocalRoomMutation((prev) => ({
        ...prev,
        driverId: clientId,
        participants: prev.participants.map((p) => ({
          ...p,
          role: p.clientId === clientId ? 'driver' : 'navigator',
        })),
      }));
    }
  };

  const handleLanguageChange = (language: LanguageId) => {
    if (!sendWs({ type: 'language:change', language })) {
      applyLocalRoomMutation((prev) => ({
        ...prev,
        language,
        files: prev.files.map((f) =>
          f.id === prev.activeFileId ? { ...f, language } : f
        ),
      }));
    }
  };

  const jumpToLine = (lineNum: number) => {
    setHighlightedLine(lineNum);
    setMobilePane('editor');
    if (editorRef.current) {
      const lineHeight = 22;
      editorRef.current.scrollTop = Math.max(0, (lineNum - 4) * lineHeight);
      if (gutterRef.current) {
        gutterRef.current.scrollTop = editorRef.current.scrollTop;
      }
    }
    setTimeout(() => setHighlightedLine(null), 2200);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = CHALLENGE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    if (
      !sendWs({
        type: 'template:load',
        title: preset.title,
        language: preset.language,
        fileName: preset.fileName,
        code: preset.code,
        checklist: preset.checklist,
      })
    ) {
      applyLocalRoomMutation((prev) => ({
        ...prev,
        title: preset.title,
        language: preset.language,
        activeFileId: prev.files[0]?.id || 'file_main',
        files:
          prev.files.length > 0
            ? prev.files.map((f, idx) =>
                idx === 0
                  ? { ...f, name: preset.fileName, language: preset.language, content: preset.code }
                  : f
              )
            : [
                {
                  id: 'file_main',
                  name: preset.fileName,
                  language: preset.language,
                  content: preset.code,
                },
              ],
        checklist: preset.checklist.map((text, idx) => ({
          id: `chk_${idx}_${Date.now()}`,
          text,
          done: false,
        })),
      }));
    }
  };

  if (roomError) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="text-center space-y-3 max-w-md">
          <Lock className="w-6 h-6 text-slate-400 mx-auto" />
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Private Workspace
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{roomError}</p>
          <button
            type="button"
            onClick={onBackToSwaps}
            className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
          >
            Back to Your Swaps &amp; Rooms
          </button>
        </div>
      </div>
    );
  }

  if (!room || !activeFile) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Connecting to Pair Studio ({roomId})...
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Verifying workspace permissions and syncing code state.
          </p>
        </div>
      </div>
    );
  }

  const latestExec = room.executionLogs[0];
  const activeFileAnnotations = room.annotations.filter((a) => a.fileId === activeFile.id);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] min-h-[600px] gap-3">
      {/* Studio Top Control Bar */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50 truncate max-w-[260px] sm:max-w-sm">
                {room.title}
              </h1>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {room.roomId}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    connStatus === 'connected'
                      ? 'bg-emerald-600'
                      : connStatus === 'serverless'
                        ? 'bg-blue-600'
                        : connStatus === 'connecting'
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                  }`}
                />
                {connStatus === 'connected'
                  ? `Live · ${room.participants.length} ${room.participants.length === 1 ? 'peer' : 'peers'}`
                  : connStatus === 'serverless'
                    ? 'Serverless · Local & Multi-tab Sync'
                    : connStatus === 'connecting'
                      ? 'Connecting...'
                      : 'Reconnecting...'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {room.offerSkill} ↔ {room.seekSkill}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Privacy indicator / toggle for owner */}
          {isOwner ? (
            <button
              type="button"
              onClick={handleTogglePrivacy}
              title={
                room.isPrivate
                  ? 'Private to your account. Click to allow invite link pairing.'
                  : 'Invite-link pairing enabled. Click to lock private.'
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {room.isPrivate ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Private
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Pair Invite
                </>
              )}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-500">
              <Users className="w-3.5 h-3.5" />
              Shared Session
            </span>
          )}

          {/* Shared Timer */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs">
            <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {mins}:{secs}
            </span>
            <button
              type="button"
              onClick={() => handleTimerControl(room.timer.running ? 'pause' : 'start')}
              aria-label={room.timer.running ? 'Pause timer' : 'Start timer'}
              className="p-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {room.timer.running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => handleTimerControl('reset')}
              aria-label="Reset timer"
              className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleClaimDriver}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              isDriver
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {isDriver ? 'Role: Driver' : 'Role: Navigator · Claim Driver'}
          </button>

          <select
            value={activeFile.language}
            onChange={(e) => handleLanguageChange(e.target.value as LanguageId)}
            aria-label="Editor language"
            className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200"
          >
            {(Object.keys(LANGUAGE_LABELS) as LanguageId[]).map((lang) => (
              <option key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </option>
            ))}
          </select>

          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                handleLoadPreset(e.target.value);
                e.target.value = '';
              }
            }}
            aria-label="Load starter challenge"
            className="hidden sm:block px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300"
          >
            <option value="" disabled>
              Load Challenge...
            </option>
            {CHALLENGE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>

          {!room.isPrivate && (
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedInvite ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Link Copied
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Invite Pair
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={handleRunCode}
            disabled={runningCode}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {runningCode ? 'Running...' : 'Run Code'}
          </button>

          <button
            type="button"
            onClick={async () => {
              await onCompleteSwapRoom(room.roomId);
              setSwapCompletedNotice(true);
              setTimeout(() => setSwapCompletedNotice(false), 2500);
            }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {swapCompletedNotice ? 'Logged Swap!' : 'End & Log Swap'}
          </button>
        </div>
      </div>

      {/* Mobile Pane Switcher */}
      <div className="flex lg:hidden items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
        {(
          [
            { id: 'editor', label: 'Code & Console' },
            { id: 'workspace', label: `Files & Peers (${room.participants.length})` },
            { id: 'collab', label: 'Chat & Notes' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobilePane(tab.id)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
              mobilePane === tab.id
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main 3-Pane IDE Grid */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Rail */}
        <aside
          className={`${
            mobilePane === 'workspace' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-3 xl:col-span-2 flex-col gap-3 min-h-0 overflow-y-auto`}
        >
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Workspace Files
              </span>
              <button
                type="button"
                onClick={() => setShowNewFileInput((v) => !v)}
                aria-label="New file"
                className="p-1 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {showNewFileInput && (
              <form onSubmit={handleCreateFile} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="helpers.ts"
                  className="flex-1 min-w-0 px-2 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="px-2 py-1 text-xs font-medium bg-blue-600 text-white rounded cursor-pointer"
                >
                  Add
                </button>
              </form>
            )}

            <div className="space-y-1">
              {room.files.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => {
                    applyLocalRoomMutation((prev) => ({ ...prev, activeFileId: file.id }));
                    sendWs({ type: 'file:switch', fileId: file.id });
                  }}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono rounded-lg text-left transition-colors cursor-pointer ${
                    file.id === activeFile.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-medium'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Active Peers
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {room.participants.length}
              </span>
            </div>

            <div className="space-y-2">
              {room.participants.map((p) => (
                <div key={p.clientId} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.color }}
                    />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
                        {p.name} {p.clientId === clientId ? '(You)' : ''}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {p.role === 'driver' ? 'Driver' : 'Navigator'} · Ln {p.cursorLine}, Col{' '}
                        {p.cursorCol}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" />
                Session Goals
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {room.checklist.filter((c) => c.done).length}/{room.checklist.length}
              </span>
            </div>

            <div className="space-y-1.5">
              {room.checklist.map((item) => (
                <label key={item.id} className="flex items-start gap-2 text-xs cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => handleToggleChecklistItem(item.id)}
                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 cursor-pointer"
                  />
                  <span
                    className={`leading-snug ${
                      item.done
                        ? 'line-through text-slate-400 dark:text-slate-500'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {item.text}
                  </span>
                </label>
              ))}
            </div>

            <form onSubmit={handleAddChecklistItem} className="pt-2 flex items-center gap-1.5">
              <input
                type="text"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder="Add goal..."
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Add
              </button>
            </form>
          </div>
        </aside>

        {/* Center Editor + Console */}
        <section
          className={`${
            mobilePane === 'editor' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-6 xl:col-span-7 flex-col min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden`}
        >
          <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="font-mono font-medium text-slate-200 truncate">
                {activeFile.name}
              </span>
              <span className="text-slate-500 truncate">
                {LANGUAGE_LABELS[activeFile.language]} · Click any line number to pin a note
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0 font-mono text-[11px] text-slate-400 tabular-nums">
              {remoteParticipants.map((peer) => (
                <span key={peer.clientId} style={{ color: peer.color }}>
                  {peer.handle} @ Ln {peer.cursorLine}
                </span>
              ))}
              {myParticipant && (
                <span>
                  Ln {myParticipant.cursorLine}, Col {myParticipant.cursorCol}
                </span>
              )}
            </div>
          </div>

          {annotatingLine !== null && (
            <form
              onSubmit={handleAddAnnotation}
              className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center gap-2"
            >
              <span className="text-xs font-mono text-blue-400 shrink-0">
                Line {annotatingLine} note:
              </span>
              <input
                type="text"
                autoFocus
                value={annotationDraft}
                onChange={(e) => setAnnotationDraft(e.target.value)}
                placeholder="Ask a question or suggest a refactor on this line..."
                className="flex-1 px-2.5 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3 py-1 text-xs font-medium bg-blue-600 text-white rounded cursor-pointer"
              >
                Pin Note
              </button>
              <button
                type="button"
                onClick={() => setAnnotatingLine(null)}
                className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </form>
          )}

          <div className="relative flex-1 min-h-0 flex overflow-hidden">
            <div
              ref={gutterRef}
              className="w-14 shrink-0 py-3 bg-slate-950 border-r border-slate-800/80 overflow-hidden select-none text-right font-mono text-xs leading-[22px] text-slate-500 tabular-nums"
            >
              {lines.map((_, idx) => {
                const lineNum = idx + 1;
                const peerOnLine = remoteParticipants.find((p) => p.cursorLine === lineNum);
                const hasNote = activeFileAnnotations.some(
                  (a) => a.line === lineNum && !a.resolved
                );
                const isHighlighted = highlightedLine === lineNum;
                return (
                  <button
                    key={lineNum}
                    type="button"
                    onClick={() => setAnnotatingLine(lineNum)}
                    title={`Pin review note on line ${lineNum}`}
                    className={`w-full px-2.5 flex items-center justify-end gap-1 hover:text-blue-400 cursor-pointer transition-colors ${
                      isHighlighted
                        ? 'bg-blue-500/20 text-blue-300'
                        : peerOnLine
                          ? 'bg-slate-900 text-slate-200'
                          : ''
                    }`}
                  >
                    {hasNote && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"
                        aria-label="Has annotation"
                      />
                    )}
                    {peerOnLine && (
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: peerOnLine.color }}
                        aria-label={`${peerOnLine.name} cursor`}
                      />
                    )}
                    <span>{lineNum}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              ref={editorRef}
              value={activeFile.content}
              onChange={(e) => {
                handleCodeChange(e.target.value);
                updateCursorPosition();
              }}
              onClick={updateCursorPosition}
              onKeyUp={updateCursorPosition}
              onKeyDown={handleEditorKeyDown}
              onScroll={(e) => {
                if (gutterRef.current) {
                  gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              aria-label="Shared pair programming code editor"
              className="flex-1 w-full h-full p-3 bg-slate-950 text-slate-100 font-mono text-[13px] leading-[22px] resize-none focus:outline-none overflow-auto whitespace-pre"
            />
          </div>

          <div className="h-44 shrink-0 border-t border-slate-800 bg-slate-900/95 flex flex-col">
            <div className="px-4 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-medium">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <span>Shared Output Console</span>
              </div>
              {latestExec && (
                <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-slate-400">
                  <span>Run by {latestExec.runnerName}</span>
                  <span>{latestExec.durationMs}ms</span>
                  <span className={latestExec.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}>
                    exit {latestExec.exitCode}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1">
              {!latestExec ? (
                <div className="text-slate-500">
                  Press Run Code (or Cmd/Ctrl + Enter) to execute and broadcast output.
                </div>
              ) : (
                <>
                  {latestExec.stdout.map((line, i) => (
                    <div key={`out-${i}`} className="text-slate-200 whitespace-pre-wrap">
                      {line}
                    </div>
                  ))}
                  {latestExec.stderr.map((line, i) => (
                    <div key={`err-${i}`} className="text-red-400 whitespace-pre-wrap">
                      {line}
                    </div>
                  ))}
                  {latestExec.returnValue !== undefined && (
                    <div className="text-blue-400">→ {latestExec.returnValue}</div>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* Right Panel */}
        <aside
          className={`${
            mobilePane === 'collab' ? 'flex' : 'hidden lg:flex'
          } lg:col-span-3 flex-col min-h-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden`}
        >
          <div className="p-1.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 bg-slate-50 dark:bg-slate-950">
            {(
              [
                { id: 'chat', label: 'Chat' },
                { id: 'notes', label: 'Scratchpad' },
                {
                  id: 'annotations',
                  label: `Line Notes (${activeFileAnnotations.filter((a) => !a.resolved).length})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRightTab(tab.id)}
                className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  rightTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {rightTab === 'chat' && (
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
                {room.messages.map((msg) => (
                  <div key={msg.id} className="space-y-1 text-xs">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold" style={{ color: msg.color }}>
                        {msg.senderName}{' '}
                        <span className="font-normal font-mono text-slate-400">
                          {msg.senderHandle}
                        </span>
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed break-words">
                      {msg.text}
                    </p>
                    {msg.lineRef && (
                      <button
                        type="button"
                        onClick={() => jumpToLine(msg.lineRef!)}
                        className="text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Jump to Line {msg.lineRef}
                      </button>
                    )}
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              <form
                onSubmit={handleSendChat}
                className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2"
              >
                {myParticipant && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() =>
                        setChatLineRef((prev) => (prev ? undefined : myParticipant.cursorLine))
                      }
                      className="hover:text-blue-600 dark:hover:text-blue-400 font-mono cursor-pointer"
                    >
                      {chatLineRef
                        ? `Attached @Line ${chatLineRef} (click to clear)`
                        : `+ Reference Line ${myParticipant.cursorLine}`}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message your pair..."
                    className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shrink-0 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {rightTab === 'notes' && (
            <div className="flex-1 flex flex-col p-3.5 gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Shared architecture scratchpad — edits sync live across all peers.
              </div>
              <textarea
                value={room.notes}
                onChange={(e) => {
                  const next = e.target.value;
                  applyLocalRoomMutation((prev) => ({ ...prev, notes: next }));
                  sendWs({ type: 'notes:update', notes: next });
                }}
                placeholder="Write architecture tradeoffs, benchmarks, or follow-up links..."
                className="flex-1 w-full p-3 text-xs font-mono leading-relaxed rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-600/30"
              />
            </div>
          )}

          {rightTab === 'annotations' && (
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {activeFileAnnotations.length === 0 ? (
                <div className="py-8 text-center space-y-2 text-xs text-slate-500 dark:text-slate-400">
                  <MessageSquare className="w-5 h-5 mx-auto text-slate-400" />
                  <p>No line notes pinned on {activeFile.name} yet.</p>
                  <p>Click any line number in the editor gutter to pin feedback.</p>
                </div>
              ) : (
                activeFileAnnotations.map((ann) => (
                  <div
                    key={ann.id}
                    className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                      ann.resolved
                        ? 'border-slate-100 dark:border-slate-800/60 opacity-60'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => jumpToLine(ann.line)}
                        className="font-mono font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        Line {ann.line}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResolveAnnotation(ann.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {ann.resolved ? (
                          'Reopen'
                        ) : (
                          <>
                            <Square className="w-3 h-3" />
                            Resolve
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{ann.text}</p>
                    <div className="text-[11px] text-slate-400">
                      {ann.authorName} ({ann.authorHandle})
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
