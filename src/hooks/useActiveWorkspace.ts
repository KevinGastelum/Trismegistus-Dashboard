import { useState, useEffect } from "react";

export function useActiveWorkspace() {
  const [activeProject, setActiveProject] = useState(() => 
    localStorage.getItem("trismegistus-active-project") || "Trismegistus-Dashboard"
  );
  const [activeDevice, setActiveDevice] = useState(() => 
    localStorage.getItem("trismegistus-active-device") || "Hermes-MacBook"
  );

  useEffect(() => {
    const handleProject = () => {
      setActiveProject(localStorage.getItem("trismegistus-active-project") || "Trismegistus-Dashboard");
    };
    const handleDevice = () => {
      setActiveDevice(localStorage.getItem("trismegistus-active-device") || "Hermes-MacBook");
    };
    window.addEventListener("trismegistus-project-changed", handleProject);
    window.addEventListener("trismegistus-device-changed", handleDevice);
    return () => {
      window.removeEventListener("trismegistus-project-changed", handleProject);
      window.removeEventListener("trismegistus-device-changed", handleDevice);
    };
  }, []);

  return { activeProject, activeDevice };
}
