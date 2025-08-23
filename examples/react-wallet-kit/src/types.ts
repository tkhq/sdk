export interface DemoConfig {
  backgroundEnabled: boolean;
  ui?: {
    light?: {
      background: string;
      text: string;
      panelBackground: string;
      draggableBackground: string;
    };
    dark?: {
      background: string;
      text: string;
      panelBackground: string;
      draggableBackground: string;
    };
  };
}
