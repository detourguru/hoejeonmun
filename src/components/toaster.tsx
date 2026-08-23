import { Toaster as Sonner } from "sonner";

export const Toaster = () => (
  <Sonner
    position="top-center"
    richColors
    closeButton
    style={
      {
        "--border-radius": "var(--radius-xl)",
        "--normal-bg": "var(--color-surface)",
        "--normal-border": "var(--color-border)",
        "--normal-text": "var(--color-text)",
        "--success-bg": "var(--color-surface)",
        "--success-border": "var(--color-primary)",
        "--success-text": "var(--color-primary)",
        "--error-bg": "var(--color-surface)",
        "--error-border": "var(--color-destructive)",
        "--error-text": "var(--color-destructive)",
      } as React.CSSProperties
    }
  />
);
