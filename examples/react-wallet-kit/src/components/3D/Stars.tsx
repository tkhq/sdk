import { useFrame } from "@react-three/fiber";
import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useTurnkey } from "@turnkey/react-wallet-kit";

interface StarsProps {
  position?: [number, number, number];
}

export function Stars({ position = [0, 0, 0] }: StarsProps) {
  const { config } = useTurnkey();
  const ref = useRef<THREE.LineSegments>(null);

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

  const color = !config?.ui?.darkMode
    ? config?.ui?.colors?.light?.primary
    : config?.ui?.colors?.dark?.primary;

  return (
    <group rotation={[0, 0, 0]} position={position}>
      <lineSegments ref={ref} geometry={geometry}>
        <lineBasicMaterial color={"gray"} transparent opacity={0.1} />
      </lineSegments>
    </group>
  );
}
