export interface DemoConfig {
  backgroundEnabled: boolean;
  ui?:
    | {
        light?:
          | {
              background: string;
              text: string;
              panelBackground: string;
              draggableBackground: string;
            }
          | undefined;
        dark?:
          | {
              background: string;
              text: string;
              panelBackground: string;
              draggableBackground: string;
            }
          | undefined;
      }
    | undefined;
}
