import { useGLTF } from "@react-three/drei";
import { useMemo, useRef, useEffect, useState } from "react";
import { MeshBasicMaterial, Group } from "three";
import { useFrame } from "@react-three/fiber";
import { useModal } from "@turnkey/react-wallet-kit";
import { lerp } from "three/src/math/MathUtils";
import { logoColour } from "@/utils";
import { useTurnkeyConfig } from "@/providers/config/ConfigProvider";

interface TurnkeyLogoProps {
  position?: [number, number, number];
}

export function TurnkeyLogo(props: TurnkeyLogoProps) {
  const { position = [0, 0, 0] } = props;
  const { modalStack } = useModal();
  const { demoConfig, config } = useTurnkeyConfig();

  const url = "/3D/turnkey.glb";
  const { scene } = useGLTF(url);
  const groupRef = useRef<Group>(null);
  const [logoColor, setLogoColor] = useState<string>("gray");

  useEffect(() => {
    setLogoColor(
      demoConfig.ui
        ? config.ui?.darkMode
          ? demoConfig.ui?.dark?.background
            ? logoColour(demoConfig.ui.dark.background)
            : "gray"
          : demoConfig.ui?.light?.background
            ? logoColour(demoConfig.ui.light.background)
            : "gray"
        : "gray",
    );
  }, [demoConfig, config]);

  const defaultSpeed = 0.1; // Default rotation speed
  const burstSpeed = 10; // Speed during burst
  const lerpSpeed = 5; // How quickly to interpolate speed
  const burstDuration = 300; // Duration to burst speed

  const speedRef = useRef(defaultSpeed); // current speed
  const targetSpeedRef = useRef(defaultSpeed); // what we're lerping toward
  const previousModalLength = useRef<number>(modalStack.length);

  useFrame((_, delta) => {
    // Lerp current speed toward the target
    speedRef.current = lerp(
      speedRef.current,
      targetSpeedRef.current,
      lerpSpeed * delta,
    );

    // Rotate the model using interpolated speed
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * speedRef.current;
    }
  });

  // When modalStack changes, trigger burst
  useEffect(() => {
    if (modalStack.length !== previousModalLength.current) {
      // Accelerate
      targetSpeedRef.current = burstSpeed;

      // Then decelerate over time
      const timeout = setTimeout(() => {
        targetSpeedRef.current = defaultSpeed;
      }, burstDuration);

      previousModalLength.current = modalStack.length;

      return () => clearTimeout(timeout);
    }
  }, [modalStack.length]);

  // Make Turnkey logo wireframe.
  const wireframeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: logoColor, wireframe: true }),
    [logoColor],
  );

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as any).isMesh) {
        (child as any).material = wireframeMaterial;
      }
    });
    return clone;
  }, [scene, wireframeMaterial]);

  return (
    <group ref={groupRef} position={position}>
      <primitive object={model} />
    </group>
  );
}
