/**
 * NEXUS SCENE — visual 3D imersivo do assistente (Three.js via
 * @react-three/fiber, já usado no projeto pelo JarvisOrb). Diferente do
 * JarvisOrb (pensado pra um espaço pequeno, admin-only), esta cena ocupa a
 * tela toda: núcleo reativo maior, campo de partículas flutuantes, anéis
 * holográficos em múltiplas camadas e um plano de dados no horizonte —
 * pensado pro padrão visual "parceiro de IA" que o produto pede aqui, não
 * um indicador de status discreto.
 *
 * Reage a três coisas em tempo real, sem nenhum dado fabricado:
 *  - status (idle/listening/thinking/speaking) — muda cor/velocidade.
 *  - nível de áudio real da voz neural (getNexusVoiceLevel, useNexusVoice)
 *    — pulsa o núcleo em sincronia com a fala de verdade, não um timer.
 *  - severidade dos alertas proativos reais (nexus_alerts) — health.
 */
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sphere, Sparkles, Ring, Icosahedron } from '@react-three/drei';
import * as THREE from 'three';
import { getNexusVoiceLevel } from './useNexusVoice';

export type NexusStatus = 'idle' | 'listening' | 'thinking' | 'speaking';
export type NexusHealth = 'normal' | 'warning' | 'critical';

const HEALTH_COLOR: Record<NexusHealth, string> = {
  normal: '#06b6d4',
  warning: '#f59e0b',
  critical: '#ef4444',
};

function Core({ status, health }: { status: NexusStatus; health: NexusHealth }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[health];

  const targetSpeed = useMemo(() => {
    switch (status) {
      case 'listening': return 3.4;
      case 'speaking': return 2.6;
      case 'thinking': return 1.8;
      default: return 0.5;
    }
  }, [status]);

  const targetDistort = useMemo(() => {
    switch (status) {
      case 'listening': return 0.6;
      case 'speaking': return 0.5;
      case 'thinking': return 0.32;
      default: return 0.16;
    }
  }, [status]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * 0.22;
    meshRef.current.rotation.x += delta * 0.06;

    const audioLevel = status === 'speaking' ? getNexusVoiceLevel() : 0;
    const basePulse =
      status === 'listening' || status === 'speaking'
        ? 1 + Math.sin(state.clock.elapsedTime * 6) * 0.05
        : 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.02;
    const voicePulse = 1 + audioLevel * 0.35;
    meshRef.current.scale.setScalar(basePulse * voicePulse);
  });

  return (
    <Sphere ref={meshRef} args={[1.55, 160, 160]}>
      <MeshDistortMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.75}
        roughness={0.1}
        metalness={0.5}
        distort={targetDistort}
        speed={targetSpeed}
      />
    </Sphere>
  );
}

function HoloRings({ health, status }: { health: NexusHealth; status: NexusStatus }) {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  const r3 = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[health];
  const speedMul = status === 'idle' ? 1 : 2.4;

  useFrame((_s, delta) => {
    if (r1.current) r1.current.rotation.z += delta * 0.3 * speedMul;
    if (r2.current) r2.current.rotation.z -= delta * 0.18 * speedMul;
    if (r3.current) r3.current.rotation.y += delta * 0.22 * speedMul;
  });

  return (
    <group>
      <group rotation={[Math.PI / 2.3, 0, 0]}>
        <Ring ref={r1} args={[2.25, 2.29, 128]}>
          <meshBasicMaterial color={color} transparent opacity={0.4} side={THREE.DoubleSide} />
        </Ring>
        <Ring ref={r2} args={[2.55, 2.58, 128]} rotation={[0.5, 0, 0]}>
          <meshBasicMaterial color={color} transparent opacity={0.2} side={THREE.DoubleSide} />
        </Ring>
      </group>
      <Ring ref={r3} args={[3.0, 3.02, 96]} rotation={[Math.PI / 1.7, 0.3, 0]}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.08} side={THREE.DoubleSide} />
      </Ring>
    </group>
  );
}

function FloatingShards({ health }: { health: NexusHealth }) {
  const color = HEALTH_COLOR[health];
  const shards = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => ({
        pos: [
          Math.cos((i / 7) * Math.PI * 2) * (3.6 + (i % 3) * 0.4),
          Math.sin(i * 1.7) * 1.4,
          Math.sin((i / 7) * Math.PI * 2) * (3.6 + (i % 2) * 0.5),
        ] as [number, number, number],
        scale: 0.08 + (i % 3) * 0.05,
        speed: 0.2 + (i % 4) * 0.08,
      })),
    []
  );

  return (
    <>
      {shards.map((s, i) => (
        <FloatingShard key={i} pos={s.pos} scale={s.scale} speed={s.speed} color={color} />
      ))}
    </>
  );
}

function FloatingShard({
  pos,
  scale,
  speed,
  color,
}: {
  pos: [number, number, number];
  scale: number;
  speed: number;
  color: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const offset = useMemo(() => Math.random() * Math.PI * 2, []);
  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.x += delta * speed;
    ref.current.rotation.y += delta * speed * 0.7;
    ref.current.position.y = pos[1] + Math.sin(state.clock.elapsedTime * speed + offset) * 0.3;
  });
  return (
    <Icosahedron ref={ref} args={[scale, 0]} position={pos}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.3} metalness={0.6} wireframe />
    </Icosahedron>
  );
}

function DataHorizon({ health }: { health: NexusHealth }) {
  const gridRef = useRef<THREE.GridHelper>(null);
  useFrame((_s, delta) => {
    if (gridRef.current) gridRef.current.position.z = (gridRef.current.position.z + delta * 0.5) % 1;
  });
  const color = new THREE.Color(HEALTH_COLOR[health]);
  return (
    <gridHelper ref={gridRef} args={[16, 32, color, color]} position={[0, -2.6, 0]} material-opacity={0.1} material-transparent />
  );
}

interface NexusSceneProps {
  status: NexusStatus;
  health: NexusHealth;
  className?: string;
}

export function NexusScene({ status, health, className }: NexusSceneProps) {
  const color = HEALTH_COLOR[health];
  return (
    <div className={className} style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [0, 0.3, 6.5], fov: 42 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 4, 4]} intensity={1.4} color={color} />
        <pointLight position={[-4, -2, -3]} intensity={0.6} color="#ffffff" />
        <Core status={status} health={health} />
        <HoloRings health={health} status={status} />
        <FloatingShards health={health} />
        <DataHorizon health={health} />
        <Sparkles count={90} scale={9} size={2.2} speed={0.35} color={color} opacity={0.55} />
        <fog attach="fog" args={['#000000', 4.5, 11]} />
      </Canvas>
    </div>
  );
}
