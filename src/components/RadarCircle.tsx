import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import Svg, { Circle, Line, G } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

type RadarCircleProps = {
  size?: number;
  radiusMeters: number;
  distanceMeters?: number | null;
  bearingDeg?: number | null;
  isInside?: boolean;
  pulse?: boolean;
  centerLabel?: string;
};

export function RadarCircle({
  size = 220,
  radiusMeters,
  distanceMeters = null,
  bearingDeg = null,
  isInside = false,
  pulse = false,
  centerLabel,
}: RadarCircleProps) {
  const colors = useColors();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pulse) {
      const loop = Animated.loop(
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        })
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [pulse]);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;

  // Scale: outer ring always represents the fence radius.
  // If we have a real distance and it's further than the radius, compress it
  // so the dot still fits on the radar (capped visually), but stays outside the ring.
  let dotDistancePx = 0;
  let dotVisible = distanceMeters != null && bearingDeg != null;
  if (dotVisible) {
    const ratio = distanceMeters! / radiusMeters;
    const cappedRatio = Math.min(ratio, 1.6); // cap so it never flies off the radar
    dotDistancePx = cappedRatio * outerR;
  }

  const angleRad = ((bearingDeg ?? 0) - 90) * (Math.PI / 180);
  const dotX = cx + dotDistancePx * Math.cos(angleRad);
  const dotY = cy + dotDistancePx * Math.sin(angleRad);

  const ringColor = isInside ? colors.primary : colors.mutedForeground;
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        <G>
          <Circle cx={cx} cy={cy} r={outerR} stroke={ringColor} strokeWidth={2} fill={isInside ? colors.primary + "1a" : "transparent"} strokeDasharray={isInside ? undefined : "6 6"} />
          <Circle cx={cx} cy={cy} r={outerR * 0.66} stroke={colors.border} strokeWidth={1} fill="transparent" />
          <Circle cx={cx} cy={cy} r={outerR * 0.33} stroke={colors.border} strokeWidth={1} fill="transparent" />
          <Line x1={cx} y1={4} x2={cx} y2={size - 4} stroke={colors.border} strokeWidth={1} />
          <Line x1={4} y1={cy} x2={size - 4} y2={cy} stroke={colors.border} strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={6} fill={colors.foreground} />
        </G>
      </Svg>

      {isInside && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseDot,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: colors.primary,
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      )}

      {dotVisible && (
        <View
          pointerEvents="none"
          style={[
            styles.dot,
            {
              left: dotX - 7,
              top: dotY - 7,
              backgroundColor: isInside ? colors.primary : colors.destructive,
              borderColor: colors.background,
            },
          ]}
        />
      )}

      <View pointerEvents="none" style={styles.centerLabelWrap}>
        <Text style={[styles.centerLabel, { color: colors.mutedForeground, top: cy + 12 }]}>
          {centerLabel ?? "Location"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  pulseDot: {
    position: "absolute",
    borderWidth: 2,
  },
  centerLabelWrap: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
  },
  centerLabel: {
    position: "absolute",
    fontSize: 11,
    fontWeight: "600",
  },
});
