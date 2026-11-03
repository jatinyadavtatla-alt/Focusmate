import React from "react";
import { Pressable, StyleProp, StyleSheet, Switch, Text, TextStyle, View, ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ThemeColors } from "../theme/colors";
import { Icon, IconName } from "./Icons";

export function Card({
  colors,
  children,
  style,
}: {
  colors: ThemeColors;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[ui.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

export function Overline({ colors, children, style }: { colors: ThemeColors; children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[ui.overline, { color: colors.subtle }, style]}>{children}</Text>;
}

export function SectionTitle({
  colors,
  overline,
  title,
  right,
}: {
  colors: ThemeColors;
  overline?: string;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={ui.sectionHeader}>
      <View style={{ flex: 1 }}>
        {overline ? <Overline colors={colors}>{overline}</Overline> : null}
        <Text style={[ui.sectionTitle, { color: colors.ink }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

export function Button({
  colors,
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  style,
  accessibilityLabel,
}: {
  colors: ThemeColors;
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const bg =
    variant === "primary" ? colors.accent : variant === "danger" ? "transparent" : variant === "secondary" ? colors.surfaceSoft : "transparent";
  const fg = variant === "primary" ? colors.accentInk : variant === "danger" ? colors.red : colors.ink;
  const border = variant === "danger" ? colors.red : variant === "secondary" ? colors.borderStrong : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: "rgba(255,255,255,0.12)" }}
      style={({ pressed }) => [
        ui.button,
        { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={[ui.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  colors,
  options,
  value,
  onChange,
}: {
  colors: ThemeColors;
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={[ui.segmented, { backgroundColor: colors.surfaceSoft, borderColor: colors.border }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={[ui.segment, selected && { backgroundColor: colors.accent }]}
          >
            {o.icon ? <Icon name={o.icon} size={14} color={selected ? colors.accentInk : colors.muted} /> : null}
            <Text style={[ui.segmentLabel, { color: selected ? colors.accentInk : colors.ink2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ colors, value, onChange, label, hint, disabled }: { colors: ThemeColors; value: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <View style={ui.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[ui.toggleLabel, { color: colors.ink }]}>{label}</Text>
        {hint ? <Text style={[ui.toggleHint, { color: colors.muted }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: colors.surfaceSoft, true: colors.accentStrong }}
        thumbColor={value ? colors.accent : colors.subtle}
      />
    </View>
  );
}

export function Stepper({
  colors,
  label,
  value,
  unit,
  min,
  max,
  step = 1,
  onChange,
}: {
  colors: ThemeColors;
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={ui.stepperRow}>
      <Text style={[ui.toggleLabel, { color: colors.ink, flex: 1 }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Decrease ${label}`}
        onPress={dec}
        disabled={value <= min}
        style={[ui.stepBtn, { borderColor: colors.borderStrong, opacity: value <= min ? 0.35 : 1 }]}
      >
        <Text style={[ui.stepGlyph, { color: colors.ink }]}>–</Text>
      </Pressable>
      <Text style={[ui.stepValue, { color: colors.ink }]}>
        {value} {unit}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Increase ${label}`}
        onPress={inc}
        disabled={value >= max}
        style={[ui.stepBtn, { borderColor: colors.borderStrong, opacity: value >= max ? 0.35 : 1 }]}
      >
        <Text style={[ui.stepGlyph, { color: colors.ink }]}>+</Text>
      </Pressable>
    </View>
  );
}

export function ProgressRing({
  size,
  stroke,
  progress,
  trackColor,
  color,
  children,
}: {
  size: number;
  stroke: number;
  /** 0..1 */
  progress: number;
  trackColor: string;
  color: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, Math.max(0, progress));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={c * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function StatusPill({ colors, label, tone }: { colors: ThemeColors; label: string; tone: "good" | "warn" | "neutral" }) {
  const fg = tone === "good" ? colors.accent : tone === "warn" ? colors.peach : colors.muted;
  const bg = tone === "good" ? colors.accentSoft : tone === "warn" ? "rgba(239,180,147,0.14)" : colors.surfaceSoft;
  return (
    <View style={[ui.pill, { backgroundColor: bg }]}>
      <View style={[ui.pillDot, { backgroundColor: fg }]} />
      <Text style={[ui.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export const ui = StyleSheet.create({
  card: { padding: 16, borderRadius: 16, borderWidth: 1 },
  overline: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "600", letterSpacing: -0.3, marginTop: 2 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonLabel: { fontSize: 14, fontWeight: "700" },
  segmented: { flexDirection: "row", padding: 4, borderRadius: 12, borderWidth: 1, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segmentLabel: { fontSize: 13, fontWeight: "600" },
  toggleRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, minHeight: 52 },
  toggleLabel: { fontSize: 14, fontWeight: "500" },
  toggleHint: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  stepGlyph: { fontSize: 20, fontWeight: "500", marginTop: -2 },
  stepValue: { minWidth: 64, textAlign: "center", fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, alignSelf: "flex-start" },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
});

/** Purely visual switch for rows that are themselves the touch target. */
export function Switch2({ colors, value }: { colors: ThemeColors; value: boolean }) {
  return (
    <View
      pointerEvents="none"
      style={{
        width: 46,
        height: 26,
        borderRadius: 13,
        padding: 3,
        backgroundColor: value ? colors.accentStrong : colors.surfaceSoft,
        borderWidth: 1,
        borderColor: value ? "transparent" : colors.borderStrong,
        alignItems: value ? "flex-end" : "flex-start",
        justifyContent: "center",
      }}
    >
      <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: value ? colors.accentInk : colors.subtle }} />
    </View>
  );
}
