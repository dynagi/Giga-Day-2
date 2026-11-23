import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PLANET_BY_ID } from '../data/planets';
import { uvToLocal } from '../state/runtime';
import { FEATURES } from '../data/features';
import { destinationFor, useCosmic } from '../state/store';
import type { Hotspot, PlanetId } from '../types';
import { sceneRefs } from './sceneRefs';

const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();

/** Does the segment camera → point pass through the sphere (centre c, radius r)? */
function occluded(cam: THREE.Vector3, point: THREE.Vector3, c: THREE.Vector3, r: number) {
  const d = tmpA.copy(point).sub(cam);
  const len = d.length();
  d.divideScalar(len);
  const oc = tmpB.copy(cam).sub(c);
  const b = oc.dot(d);
  const cc = oc.lengthSq() - r * r;
  const disc = b * b - cc;
  if (disc < 0) return false;
  const t = -b - Math.sqrt(disc);
  return t > 0 && t < len - 0.05;
}

interface MarkerProps {
  spot: Hotspot;
  index: number;
  /** Planet the marker belongs to. */
  planetId: PlanetId;
  active: boolean;
  onToggle: () => void;
}

/** A glowing, clickable point anchored on a planet, its pole, rings or a moon. */
function HotspotMarker({ spot, index, planetId, active, onToggle }: MarkerProps) {
  const group = useRef<THREE.Group>(null!);
  const el = useRef<HTMLButtonElement>(null);
  const camera = useThree((s) => s.camera);
  const destination = planetId;
  const planet = PLANET_BY_ID[destination];
  const r = planet.radius;

  // Fixed anchors are chosen once, relative to the camera at arrival.
  const fixed = useMemo(() => {
    const refs = sceneRefs.planets[destination];
    if (!refs) return new THREE.Vector3();
    const center = refs.group.getWorldPosition(new THREE.Vector3());
    const toCam = camera.position.clone().sub(center).normalize();
    switch (spot.anchor.type) {
      case 'limb': {
        const right = new THREE.Vector3().crossVectors(toCam, camera.up).normalize().negate();
        return right.multiplyScalar(r * 1.08).addScaledVector(camera.up, r * 0.35);
      }
      case 'subsolar': {
        const sun = center.clone().negate().normalize();
        return sun.multiplyScalar(0.55).addScaledVector(toCam, 0.6).addScaledVector(camera.up, -0.35).normalize().multiplyScalar(r * 1.02);
      }
      case 'ring': {
        // Sample the ring edge and pick the point that sits furthest right on screen,
        // away from the HUD and not hidden behind the planet.
        const ringR = r * (planet.rings?.outer ?? 2) * 0.98;
        let best = new THREE.Vector3(ringR, 0, 0);
        let bestScore = -Infinity;
        refs.tilt.updateWorldMatrix(true, false);
        for (let i = 0; i < 48; i++) {
          const a = (i / 48) * Math.PI * 2;
          const local = new THREE.Vector3(Math.cos(a) * ringR, 0, Math.sin(a) * ringR);
          const ndc = refs.tilt.localToWorld(local.clone()).project(camera);
          if (ndc.z > 1) continue;
          const score = ndc.x - Math.max(0, Math.abs(ndc.y) - 0.45) * 3;
          if (score > bestScore) {
            bestScore = score;
            best = local;
          }
        }
        return best;
      }
      default:
        return new THREE.Vector3();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, spot.id]);

  useFrame(() => {
    const refs = sceneRefs.planets[destination];
    if (!refs || !el.current) return;
    const center = refs.group.getWorldPosition(tmpC);
    const p = group.current.position;
    let surfaceNormalCheck = false;
    switch (spot.anchor.type) {
      case 'surface':
        refs.spin.localToWorld(uvToLocal(spot.anchor.u, spot.anchor.v, p).multiplyScalar(r * 1.01));
        surfaceNormalCheck = true;
        break;
      case 'pole':
        refs.tilt.localToWorld(p.set(0, r * 1.12, 0));
        break;
      case 'southPole':
        refs.tilt.localToWorld(p.set(0, -r * 1.12, 0));
        break;
      case 'ring':
        refs.tilt.localToWorld(p.copy(fixed));
        break;
      case 'moon': {
        const body = sceneRefs.bodies[spot.anchor.moonId];
        if (body) body.getWorldPosition(p).add(tmpA.set(0, r * 0.22 + 0.2, 0));
        break;
      }
      default:
        p.copy(center).add(fixed);
    }
    let visible = !occluded(camera.position, p, center, r * 0.985);
    if (surfaceNormalCheck) {
      const n = tmpA.copy(p).sub(center).normalize();
      const v = tmpB.copy(camera.position).sub(p).normalize();
      visible = n.dot(v) > 0.12;
    }
    el.current.style.opacity = visible ? '1' : '0';
    el.current.style.pointerEvents = visible ? 'auto' : 'none';
    el.current.tabIndex = visible ? 0 : -1;
  });

  return (
    <group ref={group}>
      <Html center zIndexRange={[21, 16]}>
        <button
          ref={el}
          type="button"
          className={`hotspot${active ? ' is-active' : ''}`}
          style={{ animationDelay: `${0.6 + index * 0.25}s` }}
          onClick={onToggle}
          aria-pressed={active}
          aria-label={`Explore: ${spot.title}`}
        >
          <span className="hotspot__dot" aria-hidden="true" />
          <span className="hotspot__label">{spot.title}</span>
        </button>
      </Html>
    </group>
  );
}

/** Clickable 3D exploration hotspots for the current destination (Day 1 story). */
export function Hotspots() {
  const phase = useCosmic((s) => s.phase);
  const destination = useCosmic((s) => s.destination);
  const hotspot = useCosmic((s) => s.hotspot);
  const open = useCosmic((s) => s.openHotspot);
  const dest = destinationFor(destination);
  if (phase !== 'explore' || !dest) return null;
  return (
    <>
      {dest.hotspots.map((h, i) => (
        <HotspotMarker
          key={`${dest.planet}-${h.id}`}
          spot={h}
          index={i}
          planetId={dest.planet}
          active={hotspot === h.id}
          onToggle={() => open(hotspot === h.id ? null : h.id)}
        />
      ))}
    </>
  );
}

/**
 * Feature markers on the planet she is exploring up close, shown once the
 * camera has arrived (the visual discovery comes first).
 */
export function FeatureMarkers() {
  const selected = useCosmic((s) => s.selected);
  const arrived = useCosmic((s) => s.cameraMode === 'INSPECT');
  const feature = useCosmic((s) => s.feature);
  const setFeature = useCosmic((s) => s.setFeature);
  const panel = useCosmic((s) => s.discoverOpen);
  // While she reads the science panel, the markers step back.
  if (!selected || !arrived || panel) return null;
  return (
    <>
      {(FEATURES[selected] ?? []).map((f, i) => (
        <HotspotMarker
          key={`${selected}-${f.id}`}
          spot={f}
          index={i}
          planetId={selected}
          active={feature === f.id}
          onToggle={() => setFeature(feature === f.id ? null : f.id)}
        />
      ))}
    </>
  );
}
