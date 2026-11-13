import { GAP_NOTE } from "@/lib/copy";

export default function SourceFallback({
  title,
  detail,
  heading = "h2",
  polite = false,
  children,
}: {
  title: string;
  detail: string;
  heading?: "h1" | "h2" | "h3";
  polite?: boolean;
  children?: React.ReactNode;
}) {
  const Title = heading;
  return (
    <div className="source-fallback" role={polite ? "status" : "alert"}>
      <Title className={heading === "h1" ? "font-serif text-4xl font-semibold" : "font-serif text-2xl font-semibold"}>{title}</Title>
      <p className="mt-2">{detail}</p>
      <p className="mt-2">{GAP_NOTE}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
