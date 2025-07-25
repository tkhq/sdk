import { useGLTF } from "@react-three/drei";
import { useMemo, useRef } from "react";
import { MeshBasicMaterial, Group } from "three";
import { useFrame } from "@react-three/fiber";

interface TurnkeyLogoProps {
  position?: [number, number, number];
}

export function TurnkeyLogo(props: TurnkeyLogoProps) {
  const { position = [0, 0, 0] } = props;
  const url = "/3D/turnkey.glb";
  const { scene } = useGLTF(url);
  const groupRef = useRef<Group>(null);

  // Animate rotation synced to time
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.getElapsedTime() * 0.5;
    }
  });

  // Create shared wireframe material
  const wireframeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "gray", wireframe: true }),
    [],
  );

  // Clone and apply material
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
    <group ref={groupRef} position={position} rotation={[0, 0, 0.15]}>
      <primitive object={model} />
    </group>
  );
}
