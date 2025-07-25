import { PointMaterial, Points } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

import { useRef, useState } from "react";
import * as THREE from "three";
import { random } from "maath";

interface StarsProps {
  position?: [number, number, number];
}
export function Stars(props: StarsProps) {
  const { position = [0, 0, 0] } = props;
  const ref = useRef<THREE.Points>(null);
  const [sphere] = useState(() =>
    random.inSphere(new Float32Array(5001), { radius: 3 }),
  );

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.x -= delta / 10;
      ref.current.rotation.y -= delta / 15;
    }
  });

  return (
    <group rotation={[0, 0, Math.PI / 4]} position={position}>
      <Points
        ref={ref}
        positions={sphere as Float32Array}
        stride={3}
        frustumCulled
      >
        <PointMaterial
          transparent
          color="gray"
          size={0.002}
          sizeAttenuation={true}
          depthWrite={true}
        />
      </Points>
    </group>
  );
}
