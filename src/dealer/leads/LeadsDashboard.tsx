import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SupernovaHeroHeader } from "../../components/supernova/SupernovaHeroHeader";
import { SupernovaGlowCard } from "../../components/supernova/SupernovaGlowCard";
import { SupernovaGlowButton } from "../../components/supernova/SupernovaGlowButton";
import { SupernovaInput } from "../../components/supernova/SupernovaInput";
import { SupernovaSectionDivider } from "../../components/supernova/SupernovaSectionDivider";
import { SupernovaMetricBar } from "../../components/supernova/SupernovaMetricBar";

export default function AddLead() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    source: "",
    phone: "",
    email: "",
    notes: "",
  });

  const [score, setScore] = useState(0);

  const updateField = (key: string, value: string) => {
    const updated = { ...form, [key]: value };
    setForm(updated);

    // AI Lead Score Preview (simple logic)
    const base =
      (updated.name.length > 2 ? 20 : 0) +
      (updated.phone.length >= 10 ? 30 : 0) +
      (updated.email.includes("@") ? 30 : 0) +
      (updated.source.length > 0 ? 20 : 0);

    setScore(Math.min(base, 100));
  };

  const handleSubmit = () => {
    console.log("Lead submitted:", form);
    navigate("/dealer/leads");
  };

  return (
    <div className="animate-fadeIn p-10 text-white relative z-10">

      <SupernovaHeroHeader
        title="Add New Lead"
        subtitle="Create a new customer lead and let AI estimate conversion potential."
      />

      <SupernovaSectionDivider label="Lead Information" />

      <SupernovaGlowCard className="space-y-6">

        <SupernovaInput
          label="Full Name"
          placeholder="Enter lead name"
          value={form.name}
          onChange={(value) => updateField("name", value)}
        />

        <SupernovaInput
          label="Lead Source"
          placeholder="AutoTrader, Facebook Ads, Walk-In..."
          value={form.source}
          onChange={(value) => updateField("source", value)}
        />

        <SupernovaInput
          label="Phone Number"
          placeholder="07..."
          value={form.phone}
          onChange={(value) => updateField("phone", value)}
        />

        <SupernovaInput
          label="Email Address"
          placeholder="example@email.com"
          value={form.email}
          onChange={(value) => updateField("email", value)}
        />

        <SupernovaInput
          label="Notes"
          placeholder="Additional details about the lead..."
          value={form.notes}
          onChange={(value) => updateField("notes", value)}
          multiline
        />
      </SupernovaGlowCard>

      <SupernovaSectionDivider label="AI Lead Score Preview" />

      <SupernovaGlowCard>
        <SupernovaMetricBar
          label="Predicted Lead Score"
          value={score}
          accent={score >= 85 ? "yellow" : score >= 60 ? "blue" : "red"}
        />

        <p className="text-white/70 mt-3">
          This score is generated automatically based on the information you’ve entered.
        </p>
      </SupernovaGlowCard>

      <div className="flex justify-end mt-10">
        <SupernovaGlowButton onClick={handleSubmit}>
          🚀 Save Lead
        </SupernovaGlowButton>
      </div>
    </div>
  );
}
