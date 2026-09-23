import { cn } from "@/lib/utils";

// 입력이 둘 이상이면(날짜 범위 등) label이 첫 입력에만 묶이므로 as="div"로 두고
// 각 입력에 aria-label을 준다
export const Field = ({
  label,
  required = false,
  hint,
  error,
  as = "label",
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  as?: "label" | "div";
  className?: string;
  children: React.ReactNode;
}) => {
  const Tag = as;

  return (
    <Tag className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-text-muted text-xs font-bold">
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden>
            *
          </span>
        )}
        {required && <span className="sr-only">(필수)</span>}
      </span>

      {children}

      {hint && !error && (
        <span className="text-text-muted text-xs">{hint}</span>
      )}
      {error && (
        <span role="alert" className="text-destructive text-xs">
          {error}
        </span>
      )}
    </Tag>
  );
};
