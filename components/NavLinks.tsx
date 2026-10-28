"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ items }: { items: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav className="nav">
      {items.map((i) => {
        const cur = i.href === "/app" ? path === "/app" : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} aria-current={cur ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
