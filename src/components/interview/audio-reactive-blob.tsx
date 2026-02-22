import { cn } from "@/src/lib/utils/cn";

export function AudioReactiveBlob({
  level,
  listening,
  className,
}: {
  level: number;
  listening: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(level, 1));
  const outerScale = 0.96 + clamped * 0.76 + (listening ? 0.04 : 0);
  const innerScale = 0.84 + clamped * 0.62;
  const outerOpacity = 0.56 + clamped * 0.22;
  const innerOpacity = 0.38 + clamped * 0.2;
  const outerBlur = 0.9 + clamped * 1.6;
  const innerBlur = 1.4 + clamped * 1.8;
  const outerBrightness = 1 + clamped * 0.12;
  const innerBrightness = 1 + clamped * 0.1;
  const glowOpacity = 0.12 + clamped * 0.14;
  const glowRadius = 16 + clamped * 24;

  return (
    <div
      className={cn("relative h-56 w-56", className)}
      style={{
        filter: `drop-shadow(0 0 ${glowRadius}px rgba(152, 227, 255, ${glowOpacity}))`,
      }}
    >
      <div
        className="zen-blob-layer"
        style={{
          transform: `scale(${outerScale})`,
          opacity: outerOpacity,
          filter: `blur(${outerBlur}px) brightness(${outerBrightness})`,
          boxShadow: `0 0 ${28 + clamped * 34}px rgba(129, 211, 255, ${0.24 + clamped * 0.26})`,
        }}
      />
      <div
        className="zen-blob-layer zen-blob-layer-alt"
        style={{
          transform: `scale(${innerScale})`,
          opacity: innerOpacity,
          filter: `blur(${innerBlur}px) brightness(${innerBrightness})`,
          boxShadow: `0 0 ${20 + clamped * 30}px rgba(174, 232, 255, ${0.2 + clamped * 0.24})`,
        }}
      />
      <div className="zen-blob-center" />
    </div>
  );
}
