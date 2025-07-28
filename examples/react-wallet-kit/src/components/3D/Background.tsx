import { Canvas } from "@react-three/fiber";
import { TurnkeyLogo } from "./TurnkeyLogo";
import { Stars } from "./Stars";
import { PerspectiveCamera, useProgress } from "@react-three/drei";
import { Suspense, useEffect, useState } from "react";
import clsx from "clsx";
import { useScreenSize } from "@/utils";

function FadeInWrapper(props: { children: React.ReactNode }) {
  const { children } = props;
  const { progress } = useProgress(); // This tracks loading progress of async assets like the Turnkey glb model
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (progress === 100) {
      const timeout = setTimeout(() => setVisible(true), 50); // Fade in after a short delay
      return () => clearTimeout(timeout);
    }
  }, [progress]);

  return (
    <div
      className={clsx(
        "absolute inset-0 w-full overflow-hidden pointer-events-none bg-background-light dark:bg-background-dark transition-opacity duration-1000",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      {children}
    </div>
  );
}

export function ThreeDimensionalBackground() {
  const { isMobile } = useScreenSize();

  return (
    <FadeInWrapper>
      <Canvas>
        <Suspense fallback={null}>
          <PerspectiveCamera
            makeDefault
            position={[isMobile ? 0.5 : 0, 0, isMobile ? 5 : 4.5]}
            rotation={[-0.2, -0.1, -0.2]}
            near={0.1}
            far={1000}
          />
          <ambientLight intensity={0.1} />
          <Stars position={[0, 0, 4.5]} />
          <TurnkeyLogo position={[1, -2.5, 2]} />
        </Suspense>
      </Canvas>
    </FadeInWrapper>
  );
}
