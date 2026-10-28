"use client";

import { switchOrg } from "@/app/actions";

export function OrgSwitch({ orgs, current }: { orgs: { id: string; name: string }[]; current: string }) {
  return (
    <form action={switchOrg}>
      <select
        className="orgsel"
        name="org"
        defaultValue={current}
        aria-label="Company"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </form>
  );
}
