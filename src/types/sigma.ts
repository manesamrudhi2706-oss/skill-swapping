export type LanguageId = 'typescript' | 'javascript' | 'python' | 'rust' | 'go' | 'sql';

export type AvailabilityStatus = 'Available now' | 'Open this week' | 'In session';

export type SkillTier = 'Beginner' | 'Junior' | 'Intermediate' | 'Senior' | 'Principal';

export interface DeveloperProject {
  id: string;
  name: string;
  summary: string;
  stack: string[];
  level: 'Starter' | 'Intermediate' | 'Production' | 'Systems';
  metrics?: string;
}

export interface DeveloperProfile {
  id: string;
  name: string;
  handle: string;
  role: string;
  skillTier: SkillTier;
  experienceLabel: string;
  location: string;
  timezone: string;
  avatarUrl: string;
  bio: string;
  offers: string[];
  seeks: string[];
  projects: DeveloperProject[];
  experienceYears: number;
  completedSwaps: number;
  hoursSwapped: number;
  availability: AvailabilityStatus;
  activeTopic: string;
  preferredLanguage: LanguageId;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  handle: string;
  role: string;
  skillTier: SkillTier;
  timezone: string;
  bio: string;
  offers: string[];
  seeks: string[];
  projects: DeveloperProject[];
  availability: AvailabilityStatus;
  hoursTaught: number;
  hoursLearned: number;
}

export type SwapStatus = 'pending' | 'active' | 'completed' | 'declined';

export interface SwapSession {
  id: string;
  roomId: string;
  title: string;
  requesterId: string;
  requesterName: string;
  requesterHandle: string;
  partnerId: string;
  partnerName: string;
  partnerHandle: string;
  offerSkill: string;
  seekSkill: string;
  durationMinutes: number;
  status: SwapStatus;
  isPrivate: boolean;
  scheduledLabel: string;
  goalNotes: string;
  createdAt: number;
  completedAt?: number;
}

export interface RoomFile {
  id: string;
  name: string;
  language: LanguageId;
  content: string;
}

export interface RoomParticipant {
  clientId: string;
  userId: string;
  name: string;
  handle: string;
  color: string;
  role: 'driver' | 'navigator';
  cursorLine: number;
  cursorCol: number;
  joinedAt: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderHandle: string;
  color: string;
  text: string;
  lineRef?: number;
  timestamp: number;
}

export interface LineAnnotation {
  id: string;
  fileId: string;
  line: number;
  authorName: string;
  authorHandle: string;
  color: string;
  text: string;
  resolved: boolean;
  createdAt: number;
}

export interface ExecutionResult {
  id: string;
  runnerName: string;
  language: LanguageId;
  stdout: string[];
  stderr: string[];
  returnValue?: string;
  durationMs: number;
  exitCode: number;
  timestamp: number;
}

export interface RoomTimerState {
  durationSeconds: number;
  elapsedBeforePause: number;
  startedAt: number | null;
  running: boolean;
}

export interface RoomState {
  roomId: string;
  ownerId: string;
  allowedUserIds: string[];
  isPrivate: boolean;
  title: string;
  offerSkill: string;
  seekSkill: string;
  language: LanguageId;
  files: RoomFile[];
  activeFileId: string;
  participants: RoomParticipant[];
  checklist: ChecklistItem[];
  notes: string;
  messages: ChatMessage[];
  annotations: LineAnnotation[];
  executionLogs: ExecutionResult[];
  timer: RoomTimerState;
  driverId: string | null;
  createdAt: number;
}
