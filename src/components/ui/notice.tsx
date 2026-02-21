import { cn } from "@/src/lib/utils/cn";

export function Notice({
  message,
  tone = "neutral",
  className,
}: {
  message: string;
  tone?: "neutral" | "error" | "success";
  className?: string;
}) {
  return (
    <p
      className={cn(
        "rounded-paper border px-3 py-2 text-sm",
        tone === "neutral" && "border-paper-border text-paper-softInk",
        tone === "error" && "border-paper-danger text-paper-danger",
        tone === "success" && "border-paper-accent text-paper-softInk",
        className,
      )}
    >
      {message}
    </p>
  );
}
