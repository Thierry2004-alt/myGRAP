import { useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import type { RidePosition } from './useRideLocationTracking';

interface RouteStep {
  distance: number;
  name: string;
  maneuver: {
    type: string;
    modifier?: string;
    exit?: number;
    location: [number, number];
  };
}

interface UseTurnByTurnNavigationOptions {
  enabled: boolean;
  destination: RidePosition | null;
  position: RidePosition | null;
  language: string;
}

function distanceBetween(a: RidePosition, b: RidePosition) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6371000;
  const latDistance = radians(b.lat - a.lat);
  const lngDistance = radians(b.lng - a.lng);
  const haversine =
    Math.sin(latDistance / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(lngDistance / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function describeManeuver(step: RouteStep, language: string) {
  const { type, modifier, exit } = step.maneuver;
  const street = step.name ? (language === 'fr' ? ` sur ${step.name}` : ` onto ${step.name}`) : '';

  if (language === 'fr') {
    if (type === 'arrive') return 'Vous êtes arrivé à destination.';
    if (type === 'roundabout' || type === 'rotary') return `Au rond-point, prenez la sortie ${exit || 1}${street}.`;
    if (type === 'depart' || type === 'continue' || type === 'new name') return `Continuez tout droit${street}.`;
    if (type === 'merge') return `Rejoignez la voie${street}.`;
    return `Tournez ${modifier === 'left' ? 'à gauche' : modifier === 'right' ? 'à droite' : 'tout droit'}${street}.`;
  }

  if (type === 'arrive') return 'You have arrived at your destination.';
  if (type === 'roundabout' || type === 'rotary') return `At the roundabout, take exit ${exit || 1}${street}.`;
  if (type === 'depart' || type === 'continue' || type === 'new name') return `Continue straight${street}.`;
  if (type === 'merge') return `Merge${street}.`;
  if (type === 'fork') return `Keep ${modifier || 'straight'}${street}.`;
  return `Turn ${modifier || 'ahead'}${street}.`;
}

export function useTurnByTurnNavigation({
  enabled,
  destination,
  position,
  language,
}: UseTurnByTurnNavigationOptions) {
  const [steps, setSteps] = useState<RouteStep[]>([]);
  const [nextInstruction, setNextInstruction] = useState('');
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [arrowRotation, setArrowRotation] = useState(0);
  const positionRef = useRef(position);
  const stepsRef = useRef<RouteStep[]>([]);
  const stepIndexRef = useRef(0);
  const announcedRef = useRef(new Set<string>());

  positionRef.current = position;
  stepsRef.current = steps;

  useEffect(() => {
    stepIndexRef.current = 0;
    announcedRef.current.clear();
    setSteps([]);
    setNextInstruction('');
    setNavigationError(null);
    setArrowRotation(0);
    Speech.stop();
  }, [destination?.lat, destination?.lng]);

  useEffect(() => {
    if (!enabled || !destination) {
      setSteps([]);
      setNextInstruction('');
      setNavigationError(null);
      setArrowRotation(0);
      Speech.stop();
      return;
    }

    let active = true;
    let requestController: AbortController | null = null;

    const loadRoute = async () => {
      const currentPosition = positionRef.current;
      if (!currentPosition) return;

      requestController?.abort();
      const controller = new AbortController();
      requestController = controller;
      try {
        const url =
          `https://router.project-osrm.org/route/v1/driving/` +
          `${currentPosition.lng},${currentPosition.lat};${destination.lng},${destination.lat}` +
          '?steps=true&overview=full&geometries=geojson';
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Routing service returned ${response.status}`);
        const data = await response.json();
        const routeSteps = data.routes?.[0]?.legs?.[0]?.steps;
        if (!Array.isArray(routeSteps) || routeSteps.length === 0) {
          throw new Error('No driving directions were returned for this route.');
        }
        if (!active) return;
        stepIndexRef.current = 0;
        setSteps(routeSteps);
        setNavigationError(null);
      } catch (error) {
        if (controller.signal.aborted || !active) return;
        console.error('Unable to load turn-by-turn directions:', error);
        setNavigationError('Turn-by-turn directions are temporarily unavailable.');
      }
    };

    loadRoute();
    const interval = setInterval(loadRoute, 30000);
    return () => {
      active = false;
      clearInterval(interval);
      requestController?.abort();
      Speech.stop();
    };
  }, [destination, enabled]);

  useEffect(() => {
    if (!enabled || !position || steps.length === 0) {
      setNextInstruction('');
      return;
    }

    while (stepIndexRef.current < steps.length - 1) {
      const step = steps[stepIndexRef.current];
      const location = { lat: step.maneuver.location[1], lng: step.maneuver.location[0] };
      if (distanceBetween(position, location) >= 25) break;
      stepIndexRef.current += 1;
    }

    const step = steps[stepIndexRef.current];
    if (!step) return;
    const location = { lat: step.maneuver.location[1], lng: step.maneuver.location[0] };
    const distance = distanceBetween(position, location);
    const instruction = describeManeuver(step, language);
    const modifier = step.maneuver.modifier || '';
    const rotations: Record<string, number> = {
      left: -90,
      'slight left': -45,
      'sharp left': -135,
      right: 90,
      'slight right': 45,
      'sharp right': 135,
      uturn: 180,
    };
    setArrowRotation(rotations[modifier] ?? 0);
    const roundedLocation = step.maneuver.location.map((coordinate) => coordinate.toFixed(4)).join(',');
    const stepKey = `${step.maneuver.type}:${step.maneuver.modifier || ''}:${step.name}:${roundedLocation}`;
    const distanceLabel = Math.max(50, Math.round(distance / 50) * 50);

    setNextInstruction(
      distance <= 30
        ? instruction
        : language === 'fr'
        ? `Dans ${distanceLabel} mètres, ${instruction.charAt(0).toLowerCase()}${instruction.slice(1)}`
        : `In ${distanceLabel} meters, ${instruction.charAt(0).toLowerCase()}${instruction.slice(1)}`
    );

    const cue = distance <= 30 ? 'now' : distance <= 110 ? 'approach' : '';
    const cueKey = `${stepKey}:${cue}`;
    if (cue && !announcedRef.current.has(cueKey)) {
      announcedRef.current.add(cueKey);
      const speech = cue === 'now' ? instruction : `${language === 'fr' ? `Dans ${distanceLabel} mètres, ` : `In ${distanceLabel} meters, `}${instruction}`;
      Speech.stop();
      Speech.speak(speech, {
        language: language === 'fr' ? 'fr-FR' : 'en-US',
        rate: 0.95,
        onError: (error) => console.error('Unable to speak turn instruction:', error),
      });
    }
  }, [enabled, language, position, steps]);

  return { nextInstruction, navigationError, arrowRotation };
}
