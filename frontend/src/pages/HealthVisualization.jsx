import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float } from '@react-three/drei';
import { motion } from 'framer-motion';
import { Heart, Brain, Activity } from 'lucide-react';
import { useAccessibility } from '../components/AccessibilityProvider';

function HeartModel({ riskLevel }) {
    const meshRef = useRef();
    const [hovered, setHovered] = useState(false);

    const color = riskLevel === 'Emergency' ? '#EF4444' :
        riskLevel === 'Urgent' ? '#F59E0B' : '#10B981';

    useFrame(({ clock }) => {
        if (meshRef.current) {
            const t = clock.getElapsedTime();
            // Heartbeat-like pulsing
            const scale = 1 + Math.sin(t * 3) * 0.08;
            meshRef.current.scale.set(scale, scale, scale);
            meshRef.current.rotation.y = t * 0.3;
        }
    });

    return (
        <group>
            {/* Main heart sphere */}
            <Sphere
                ref={meshRef}
                args={[1.2, 64, 64]}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <MeshDistortMaterial
                    color={hovered ? '#3B82F6' : color}
                    distort={0.4}
                    speed={2}
                    roughness={0.2}
                    metalness={0.8}
                />
            </Sphere>

            {/* Orbiting particles */}
            {[...Array(8)].map((_, i) => (
                <OrbitingParticle key={i} index={i} color={color} />
            ))}

            {/* Inner glow */}
            <Sphere args={[0.8, 32, 32]}>
                <meshBasicMaterial color={color} transparent opacity={0.15} />
            </Sphere>
        </group>
    );
}

function OrbitingParticle({ index, color }) {
    const ref = useRef();
    const speed = 0.5 + index * 0.1;
    const radius = 1.8 + (index % 3) * 0.4;
    const offset = (index / 8) * Math.PI * 2;

    useFrame(({ clock }) => {
        if (ref.current) {
            const t = clock.getElapsedTime() * speed;
            ref.current.position.x = Math.cos(t + offset) * radius;
            ref.current.position.z = Math.sin(t + offset) * radius;
            ref.current.position.y = Math.sin(t * 2 + offset) * 0.5;
        }
    });

    return (
        <Sphere ref={ref} args={[0.06, 16, 16]}>
            <meshBasicMaterial color={color} />
        </Sphere>
    );
}

function HealthRings() {
    const groupRef = useRef();

    useFrame(({ clock }) => {
        if (groupRef.current) {
            groupRef.current.rotation.z = clock.getElapsedTime() * 0.2;
        }
    });

    return (
        <group ref={groupRef}>
            {[1.6, 2.0, 2.4].map((radius, i) => (
                <mesh key={i} rotation={[Math.PI / 2, 0, i * 0.5]}>
                    <torusGeometry args={[radius, 0.02, 16, 100]} />
                    <meshBasicMaterial
                        color={i === 0 ? '#2563EB' : i === 1 ? '#14B8A6' : '#F59E0B'}
                        transparent
                        opacity={0.4}
                    />
                </mesh>
            ))}
        </group>
    );
}

export default function HealthVisualization() {
    const { t, translateEnum, settings } = useAccessibility();
    const [riskLevel, setRiskLevel] = useState('Routine');
    const riskLabel = translateEnum('status', riskLevel);
    const isLowBandwidth = settings.lowBandwidth;
    const riskTone = riskLevel === 'Emergency' ? 'risk-emergency' : riskLevel === 'Urgent' ? 'risk-urgent' : 'risk-routine';
    const riskScoreDisplay = riskLevel === 'Emergency' ? 90 : riskLevel === 'Urgent' ? 55 : 25;

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            <motion.div variants={itemVariants}>
                <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                    <Heart className="text-emergency" size={24} /> {t('healthView')}
                </h1>
                <p className="text-text-secondary mt-1">{t('interactiveMedicalModel')}</p>
            </motion.div>

            {/* Risk Level Selector */}
            <motion.div variants={itemVariants} className="flex gap-3">
                {['Routine', 'Urgent', 'Emergency'].map((level) => (
                    <button
                        key={level}
                        onClick={() => setRiskLevel(level)}
                        className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${riskLevel === level
                                ? level === 'Emergency' ? 'bg-red-500 text-white shadow-lg'
                                    : level === 'Urgent' ? 'bg-amber-500 text-white shadow-lg'
                                        : 'bg-green-500 text-white shadow-lg'
                                : 'bg-slate-100 text-text-secondary hover:bg-slate-200'
                            }`}
                    >
                        {translateEnum('status', level)}
                    </button>
                ))}
            </motion.div>

            {/* 3D Canvas */}
            {isLowBandwidth ? (
                <motion.div variants={itemVariants} className="stat-card">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity size={18} className="text-teal" />
                        <h3 className="font-semibold text-text-primary">{t('lowBandwidthMode')}</h3>
                    </div>
                    <p className="text-sm text-text-secondary">{t('lowBandwidthVisualizationNotice')}</p>
                    <div className="mt-4 flex items-center gap-3">
                        <span className={`risk-badge ${riskTone}`}>{riskLabel}</span>
                        <span className="text-sm text-text-secondary">{t('riskScore')}: {riskScoreDisplay}%</span>
                    </div>
                </motion.div>
            ) : (
                <motion.div variants={itemVariants} className="stat-card overflow-hidden" style={{ height: '450px' }}>
                    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[5, 5, 5]} intensity={1} />
                        <pointLight position={[-5, -5, -5]} intensity={0.5} color="#2563EB" />
                        <pointLight position={[5, -5, 5]} intensity={0.3} color="#14B8A6" />

                        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
                            <HeartModel riskLevel={riskLevel} />
                        </Float>
                        <HealthRings />

                        <OrbitControls enableZoom={true} enablePan={false} autoRotate autoRotateSpeed={0.5} />
                    </Canvas>
                </motion.div>
            )}

            {/* Info Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat-card text-center">
                    <Heart size={28} className="mx-auto text-red-500 mb-2" />
                    <h3 className="font-semibold text-text-primary">{t('heartHealth')}</h3>
                    <p className="text-sm text-text-secondary mt-1">{t('healthPulseInfo')}</p>
                    <div className="mt-3 p-2 rounded-lg" style={{
                        background: riskLevel === 'Emergency' ? '#FEE2E2' : riskLevel === 'Urgent' ? '#FEF3C7' : '#D1FAE5',
                        color: riskLevel === 'Emergency' ? '#991B1B' : riskLevel === 'Urgent' ? '#92400E' : '#065F46'
                    }}>
                        <span className="text-sm font-medium">{riskLabel}</span>
                    </div>
                </div>

                <div className="stat-card text-center">
                    <Brain size={28} className="mx-auto text-blue-500 mb-2" />
                    <h3 className="font-semibold text-text-primary">{t('aiAnalysis')}</h3>
                    <p className="text-sm text-text-secondary mt-1">{t('colorAnimationRisk')}</p>
                    <div className="mt-3 text-xs text-text-light">{t('poweredByDecisionTree')}</div>
                </div>

                <div className="stat-card text-center">
                    <Activity size={28} className="mx-auto text-teal mb-2" />
                    <h3 className="font-semibold text-text-primary">{t('realtimeVitals')}</h3>
                    <p className="text-sm text-text-secondary mt-1">{t('orbitingParticlesMeaning')}</p>
                    <div className="mt-3 text-xs text-text-light">{t('dragRotateScrollZoom')}</div>
                </div>
            </motion.div>
        </motion.div>
    );
}



