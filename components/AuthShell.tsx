import { Logo } from "./Logo";
import { LangSwitch } from "./LangSwitch";

export function AuthShell({ children, back }: { children: React.ReactNode; back: string }) {
  return (
    <main className="wrap auth">
      <div className="auth-card">
        <div className="brandmark">
          <Logo height={26} />
          <span style={{ marginLeft: "auto" }}>
            <LangSwitch back={back} />
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
