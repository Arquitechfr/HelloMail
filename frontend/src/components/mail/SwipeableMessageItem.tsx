"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { MailOpen, Archive, Star, Trash2, AlertOctagon } from "lucide-react";
import type { SwipeAction } from "@/lib/types/display";

interface SwipeableMessageItemProps {
  children: React.ReactNode;
  swipeRightAction: SwipeAction;
  swipeLeftAction: SwipeAction;
  onTriggerAction: (action: SwipeAction) => void;
  disabled?: boolean;
}

const ACTION_CONFIG: Record<
  Exclude<SwipeAction, "none">,
  { label: string; icon: typeof MailOpen; bgColor: string }
> = {
  toggle_read: { label: "Lu / Non-lu", icon: MailOpen, bgColor: "bg-emerald-600 text-white" },
  archive: { label: "Archiver", icon: Archive, bgColor: "bg-indigo-600 text-white" },
  star: { label: "Important", icon: Star, bgColor: "bg-amber-500 text-white" },
  trash: { label: "Corbeille", icon: Trash2, bgColor: "bg-rose-600 text-white" },
  junk: { label: "Indésirable", icon: AlertOctagon, bgColor: "bg-orange-600 text-white" },
};

const SWIPE_THRESHOLD = 80;

export function SwipeableMessageItem({
  children,
  swipeRightAction,
  swipeLeftAction,
  onTriggerAction,
  disabled = false,
}: SwipeableMessageItemProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const vibratedRef = useRef(false);
  const x = useMotionValue(0);

  useEffect(() => {
    const isTouch =
      typeof window !== "undefined" &&
      ("ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches);
    setIsTouchDevice(isTouch);
  }, []);

  const rightOpacity = useTransform(x, [0, 30, SWIPE_THRESHOLD], [0, 0.4, 1]);
  const rightScale = useTransform(x, [0, 30, SWIPE_THRESHOLD], [0.7, 0.85, 1.1]);

  const leftOpacity = useTransform(x, [0, -30, -SWIPE_THRESHOLD], [0, 0.4, 1]);
  const leftScale = useTransform(x, [0, -30, -SWIPE_THRESHOLD], [0.7, 0.85, 1.1]);

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const currentX = info.offset.x;
    const isOverThreshold =
      (currentX >= SWIPE_THRESHOLD && swipeRightAction !== "none") ||
      (currentX <= -SWIPE_THRESHOLD && swipeLeftAction !== "none");

    if (isOverThreshold && !vibratedRef.current) {
      vibratedRef.current = true;
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(15);
        } catch {
          // Ignore haptic errors on unsupported devices
        }
      }
    } else if (!isOverThreshold && vibratedRef.current) {
      vibratedRef.current = false;
    }
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    vibratedRef.current = false;
    const currentX = info.offset.x;

    if (currentX >= SWIPE_THRESHOLD && swipeRightAction !== "none") {
      onTriggerAction(swipeRightAction);
    } else if (currentX <= -SWIPE_THRESHOLD && swipeLeftAction !== "none") {
      onTriggerAction(swipeLeftAction);
    }
  };

  const rightConfig = swipeRightAction !== "none" ? ACTION_CONFIG[swipeRightAction] : null;
  const leftConfig = swipeLeftAction !== "none" ? ACTION_CONFIG[swipeLeftAction] : null;

  if (disabled || !isTouchDevice || (swipeRightAction === "none" && swipeLeftAction === "none")) {
    return <div className="relative w-full overflow-hidden">{children}</div>;
  }

  const RightIcon = rightConfig?.icon;
  const LeftIcon = leftConfig?.icon;

  return (
    <div className="relative w-full overflow-hidden select-none" style={{ touchAction: "pan-y" }}>
      {/* Arrière-plan glissement vers la droite */}
      {rightConfig && RightIcon && (
        <motion.div
          style={{ opacity: rightOpacity }}
          className={`absolute inset-y-0 left-0 right-1/2 flex items-center justify-start pl-5 ${rightConfig.bgColor}`}
          aria-hidden="true"
        >
          <motion.div style={{ scale: rightScale }} className="flex items-center gap-2">
            <RightIcon className="size-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">{rightConfig.label}</span>
          </motion.div>
        </motion.div>
      )}

      {/* Arrière-plan glissement vers la gauche */}
      {leftConfig && LeftIcon && (
        <motion.div
          style={{ opacity: leftOpacity }}
          className={`absolute inset-y-0 right-0 left-1/2 flex items-center justify-end pr-5 ${leftConfig.bgColor}`}
          aria-hidden="true"
        >
          <motion.div style={{ scale: leftScale }} className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider">{leftConfig.label}</span>
            <LeftIcon className="size-5" />
          </motion.div>
        </motion.div>
      )}

      {/* Élément glissant principal */}
      <motion.div
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="relative z-10 w-full bg-background"
      >
        {children}
      </motion.div>
    </div>
  );
}
