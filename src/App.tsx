import { useState } from "react";
import { LandingPage } from "./Landingpage";
import { SafeCopilot } from "./SafeCopilot";

export default function App() {
  const [launched, setLaunched] = useState(false);

  if (launched) {
    return <SafeCopilot />;
  }

  return <LandingPage onLaunch={() => setLaunched(true)} />;
}