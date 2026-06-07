import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  href?: string;
  size?: "default" | "small";
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  children,
  className,
  href,
  size = "default",
  variant = "primary",
  ...props
}: ButtonProps) {
  const classes = cn("button", `button-${variant}`, size === "small" && "button-small", className);

  if (href) {
    return (
      <Link className={classes} href={href}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}
