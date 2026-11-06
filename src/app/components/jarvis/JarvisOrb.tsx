import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Sparkles, Ring } from '@react-three/drei';
import * as THREE from 'three';

export type JarvisOrbStatus = 'idle' | 'listening' | 'speaking' | 'thinking';
export type JarvisOrbHealth = 'normal' | 'warning' | 'critical';

const HEALTH_COLOR: Record<JarvisOrbHealth, string> = {
  normal: '#06b6d4',
  warning: '#f59e0b',
  critical: '#ef4444',
};

function OrbitRings({ health }: { health: JarvisOrbHealth }) {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[health];

  useFrame((_state, delta) => {
    if (ring1.current) ring1.current.rotation.z += delta * 0.35;
    if (ring2.current) ring2.current.rotation.z -= delta * 0.22;
  });

  return (
    <group rotation={[Math.PI / 2.3, 0, 0]}>
      <Ring ref={ring1} args={[2.05, 2.08, 96]}>
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </Ring>
      <Ring ref={ring2} args={[2.3, 2.32, 96]} rotation={[0.4, 0, 0]}>
        <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
}

function ScanGrid({ health }: { health: JarvisOrbHealth }) {
  const gridRef = useRef<THREE.GridHelper>(null);
  useFrame((_state, delta) => {
    if (gridRef.current) gridRef.current.position.z = (gridRef.current.position.z + delta * 0.4) % 1;
  });
  const color = new THREE.Color(HEALTH_COLOR[health]);
  return (
    <gridHelper
      ref={gridRef}
      args={[10, 20, color, color]}
      position={[0, -1.9, 0]}
      material-opacity={0.12}
      material-transparent
    />
  );
}

function OrbMesh({ status, health }: { status: JarvisOrbStatus; health: JarvisOrbHealth }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[health];

  const targetSpeed = useMemo(() => {
    switch (status) {
      case 'listening': return 3.2;
      case 'speaking': return 2.4;
      case 'thinking': return 1.6;
      default: return 0.5;
    }
  }, [status]);

  const targetDistort = useMemo(() => {
    switch (status) {
      case 'listening': return 0.55;
      case 'speaking': return 0.45;
      case 'thinking': return 0.3;
      default: return 0.18;
    }
  }, [status]);

  useFrame((_state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.25;
    meshRef.current.rotation.x += delta * 0.08;

    const pulse = status === 'listening' || status === 'speaking'
      ? 1 + Math.sin(_state.clock.elapsedTime * 6) * 0.06
      : 1 + Math.sin(_state.clock.elapsedTime * 1.2) * 0.02;
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <Sphere ref={meshRef} args={[1.4, 128, 128]}>
      <MeshDistortMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
        roughness={0.15}
        metalness={0.4}
        distort={targetDistort}
        speed={targetSpeed}
      />
    </Sphere>
  );
}

interface JarvisOrbProps {
  status: JarvisOrbStatus;
  health: JarvisOrbHealth;
  className?: string;
}

export function JarvisOrb({ status, health, className }: JarvisOrbProps) {
  return (
    <div className={className} style={{ width: '100%', height: '100%', minHeight: 260 }}>
      <Canvas camera={{ position: [0, 0, 4.2], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.4} />
        <pointLight position={[3, 3, 3]} intensity={1.2} color={HEALTH_COLOR[health]} />
        <pointLight position={[-3, -2, -2]} intensity={0.5} color="#ffffff" />
        <OrbMesh status={status} health={health} />
        <OrbitRings health={health} />
        <ScanGrid health={health} />
        <Sparkles count={40} scale={4} size={2} speed={0.3} color={HEALTH_COLOR[health]} opacity={0.5} />
        <fog attach="fog" args={['#000000', 3, 8]} />
      </Canvas>
    </div>
  );
}
