import React, { ReactNode, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

interface ParallaxScrollViewProps {
  headerImage: ReactNode;
  headerBackgroundColor: { dark: string; light: string };
  children: ReactNode;
}

export default function ParallaxScrollView({
  headerImage,
  headerBackgroundColor,
  children,
}: ParallaxScrollViewProps) {
  const ref = useRef(null);
  const { scrollY } = useScroll({ container: ref });

  // Parallax translate
  const translateY = useTransform(scrollY, [0, 250], [0, -125]);

  // Parallax scale
  const scale = useTransform(scrollY, [0, 250], [1, 1.3]);

  return (
    <div
      ref={ref}
      className="overflow-y-auto h-full w-full"
      style={{
        backgroundColor: headerBackgroundColor.light,
      }}
    >
      {/* Parallax Header */}
      <motion.div
        style={{
          height: 250,
          overflow: "hidden",
          transformOrigin: "center",
          backgroundColor: headerBackgroundColor.light,
          translateY,
          scale,
        }}
        className="relative"
      >
        {headerImage}
      </motion.div>

      {/* Content */}
      <div className="p-8 space-y-6">
        {children}
      </div>
    </div>
  );
}
