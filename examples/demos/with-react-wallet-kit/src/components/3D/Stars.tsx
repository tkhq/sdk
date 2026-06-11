import { useFrame } from "@react-three/fiber";
import { useRef, useMemo, useState, useEffect } from "react";
import * as THREE from "three";
import { useTurnkeyConfig } from "@/providers/config/ConfigProvider";
import { logoColour } from "@/utils";

interface StarsProps {
  position?: [number, number, number];
}

export function Stars({ position = [0, 0, 0] }: StarsProps) {
  const ref = useRef<THREE.LineSegments>(null);
  const { demoConfig, config } = useTurnkeyConfig();

  const [color, setColor] = useState<string>("gray");

  useEffect(() => {
    setColor(
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

  const radius = 1;
  const widthSegments = 32;
  const heightSegments = 16;

  const geometry = useMemo(() => {
    const sphere = new THREE.SphereGeometry(
      radius,
      widthSegments,
      heightSegments,
    );
    return new THREE.WireframeGeometry(sphere);
  }, [radius, widthSegments, heightSegments]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.getElapsedTime() * 0.1;
    }
  });

  return (
    <group rotation={[0, 0, 0]} position={position}>
      <lineSegments ref={ref} geometry={geometry}>
        <lineBasicMaterial color={color} transparent opacity={0.1} />
      </lineSegments>
    </group>
  );
}
