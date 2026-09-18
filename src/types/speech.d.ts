// Minimal ambient types for the Web Speech API's SpeechRecognition —
// not part of TypeScript's standard DOM lib since it's still a
// non-standard, webkit-prefixed-only API. Only the parts this app
// actually uses (PilotBrainChat.tsx's mic input) are declared.
interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  0: SpeechRecognitionResultItem;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  results: { 0: SpeechRecognitionResult; length: number };
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface Window {
  SpeechRecognition?: { new (): SpeechRecognition };
  webkitSpeechRecognition?: { new (): SpeechRecognition };
}
