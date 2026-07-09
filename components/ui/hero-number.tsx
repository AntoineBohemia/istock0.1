"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

interface HeroNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

export function HeroNumber({ value, format, className }: HeroNumberProps) {
  const shouldReduceMotion = useReducedMotion();
  const motionValue = useMotionValue(shouldReduceMotion ? value : 0);
  const spring = useSpring(motionValue, {
    duration: shouldReduceMotion ? 0 : 0.8,
    bounce: 0,
  });
  const display = useTransform(spring, (v) => {
    const rounded = Math.round(v);
    return format ? format(rounded) : rounded.toLocaleString("fr-FR");
  });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return (
    <motion.span className={cn("tabular-nums font-heading", className)}>{display}</motion.span>
  );
}
