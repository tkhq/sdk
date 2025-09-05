import { useEffect, useState } from "react";

export default function LottiePlayerWrapper(props: {
  style?: React.CSSProperties;
  src: string;
  autoplay?: boolean;
  loop?: boolean;
}) {
  const [PlayerComponent, setPlayerComponent] =
    useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("./Dynamic").then(async (mod) => {
        const Player = await mod.getLottiePlayer();
        //@ts-ignore
        setPlayerComponent(() => Player);
      });
    }
  }, []);

  if (!PlayerComponent) return null;
  return <PlayerComponent {...props} />;
}
