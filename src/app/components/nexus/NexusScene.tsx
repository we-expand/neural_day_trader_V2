/**
 * NEXUS SCENE — HUD holográfico (Three.js via @react-three/fiber, já usado
 * no projeto pelo JarvisOrb). Pedido explícito do Cleber (2026-08-25): não
 * quer "uma bola" orgânica — quer estética de HUD tecnológico tipo
 * Homem de Ferro, com uma onda/equalizador de voz de verdade.
 *
 * Composição:
 *  - Núcleo pequeno (icosaedro wireframe) — fonte de energia central.
 *  - Equalizador radial: anel de barras finas ao redor do núcleo, cada
 *    barra reage à frequência REAL do áudio (getNexusVoiceSpectrum) — nunca
 *    uma animação fabricada quando está falando. Em repouso, pulso leve
 *    senoidal (idle), não plano.
 *  - Dois anéis HUD finos com ticks (como mira/retículo), girando em
 *    velocidades opostas.
 *  - Sem "bola" de distorção orgânica — tudo geometria fina, precisa,
 *    digital.
 */
import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Icosahedron, Ring } from '@react-three/drei';
import * as THREE from 'three';
import { getNexusVoiceSpectrum } from './useNexusVoice';

export type NexusStatus = 'idle' | 'listening' | 'thinking' | 'speaking';
export type NexusHealth = 'normal' | 'warning' | 'critical';

const HEALTH_COLOR: Record<NexusHealth, string> = {
  normal: '#06b6d4',
  warning: '#f59e0b',
  critical: '#ef4444',
};

const BAR_COUNT = 32;

function Core({ status, health }: { status: NexusStatus; health: NexusHealth }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = HEALTH_COLOR[health];
  const spinSpeed = status === 'listening' ? 1.4 : status === 'speaking' ? 1.0 : status === 'thinking' ? 0.7 : 0.25;

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * spinSpeed;
    meshRef.current.rotation.x += delta * spinSpeed * 0.4;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2) * (status === 'idle' ? 0.03 : 0.08);
    meshRef.current.scale.setScalar(pulse);
  });

  return (
    <Icosahedron ref={meshRef} args={[1.65, 1]}>
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.1} wireframe roughness={0.2} metalness={0.8} />
    </Icosahedron>
  );
}

function RadialEqualizer({ status, health }: { status: NexusStatus; health: NexusHealth }) {
  const groupRef = useRef<THREE.Group>(null);
  const barsRef = useRef<THREE.Mesh[]>([]);
  const color = HEALTH_COLOR[health];

  const layout = useMemo(
    () =>
      Array.from({ length: BAR_COUNT }, (_, i) => {
        const angle = (i / BAR_COUNT) * Math.PI * 2;
        const radius = 3.0;
        return { angle, x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, phase: (i / BAR_COUNT) * Math.PI * 2 };
      }),
    []
  );

  useFrame((state, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.06;

    const isLive = status === 'speaking';
    const spectrum = isLive ? getNexusVoiceSpectrum(BAR_COUNT) : null;

    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      let h: number;
      if (spectrum) {
        h = 0.08 + spectrum[i] * 0.9;
      } else {
        // Idle/listening/thinking: pulso senoidal leve, nunca plano, nunca fabricando "fala".
        const base = status === 'listening' ? 0.18 : status === 'thinking' ? 0.12 : 0.06;
        h = base + Math.sin(state.clock.elapsedTime * 3 + layout[i].phase) * base * 0.6;
      }
      bar.scale.y = Math.max(0.05, h);
      bar.position.y = h / 2;
    });
  });

  return (
    <group ref={groupRef}>
      {layout.map((bar, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el;
          }}
          position={[bar.x, 0, bar.z]}
          rotation={[0, -bar.angle, 0]}
        >
          <boxGeometry args={[0.105, 1, 0.105]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function HudRings({ health, status }: { health: NexusHealth; status: NexusStatus }) {
  const outerRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const color = HEALTH_COLOR[health];
  const speedMul = status === 'idle' ? 1 : 2.2;

  useFrame((_s, delta) => {
    if (outerRef.current) outerRef.current.rotation.z += delta * 0.18 * speedMul;
    if (innerRef.current) innerRef.current.rotation.z -= delta * 0.32 * speedMul;
  });

  const ticks = useMemo(() => Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2), []);

  return (
    <group rotation={[Math.PI / 2.15, 0, 0]}>
      <group ref={outerRef}>
        <Ring args={[4.65, 4.74, 96]}>
          <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
        </Ring>
        {ticks.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * 4.86, Math.sin(a) * 4.86, 0]} rotation={[0, 0, a]}>
            <planeGeometry args={[0.15, i % 4 === 0 ? 0.42 : 0.21]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <group ref={innerRef}>
        <Ring args={[3.96, 4.02, 96]}>
          <meshBasicMaterial color="#ffffff" transparent opacity={0.15} side={THREE.DoubleSide} />
        </Ring>
      </group>
    </group>
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
      <Canvas camera={{ position: [0, 4.2, 10.2], fov: 38 }} dpr={[1, 1.75]}>
        <ambientLight intensity={0.3} />
        <pointLight position={[2, 2, 2]} intensity={1.6} color={color} />
        <pointLight position={[-2, -1, -1]} intensity={0.4} color="#ffffff" />
        <Core status={status} health={health} />
        <RadialEqualizer status={status} health={health} />
        <HudRings health={health} status={status} />
        <fog attach="fog" args={['#000000', 7.8, 16.5]} />
      </Canvas>
    </div>
  );
}
