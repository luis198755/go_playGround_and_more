export interface EditorSettings {
  fontSize: number;
  theme: string;
  minimap: boolean;
  wordWrap: 'on' | 'off';
  isSettingsOpen: boolean;
}

export interface Tab {
  id: string;
  title: string;
  code: string;
  isExample: boolean;
  exampleKey?: string;
}

export interface CodeExample {
  name: string;
  code: string;
  mode: 'go' | 'json';
}

export type EditorMode = 'go' | 'json';

export interface TerminalOutputProps {
  output: string;
  isLoading: boolean;
  onClear: () => void;
}

export interface UserManualProps {
  isVisible: boolean;
}