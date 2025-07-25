import { Canvas } from "@react-three/fiber";
import { TurnkeyLogo } from "./TurnkeyLogo";
import { Stars } from "./Stars";

export function ThreeDimensionalBackground() {
  return (
    <div className="absolute inset-0 w-full overflow-hidden pointer-events-none bg-background-light dark:bg-background-dark">
      <Canvas>
        <ambientLight intensity={0.1} />
        <directionalLight position={[0, 0, 5]} color="red" />
        <Stars position={[0, 0, 3]} />
        <TurnkeyLogo position={[1, -2, 3]} />
      </Canvas>
    </div>
  );
}
