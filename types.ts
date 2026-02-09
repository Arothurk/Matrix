export interface CameraDevice {
  deviceId: string;
  label: string;
}

export enum AppState {
  IDLE = 'IDLE',
  STREAMING = 'STREAMING',
  ANALYZING = 'ANALYZING',
  ERROR = 'ERROR'
}

export interface AnalysisResult {
  text: string;
  timestamp: number;
}
