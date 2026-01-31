import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";

export type Persona = "staff" | "admin" | "hod" | "finance";

interface PersonaContextType {
  persona: Persona;
  setPersona: (persona: Persona) => void;
  departmentId: number | null;
  setDepartmentId: (id: number | null) => void;
  staffId: number | null;
  setStaffId: (id: number | null) => void;
  staffName: string;
  setStaffName: (name: string) => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

const PERSONA_ROUTES: Record<Persona, string> = {
  staff: "/staff",
  admin: "/admin",
  hod: "/hod",
  finance: "/finance",
};

const ROUTE_TO_PERSONA: Record<string, Persona> = {
  "/": "staff",
  "/staff": "staff",
  "/admin": "admin",
  "/hod": "hod",
  "/finance": "finance",
};

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [persona, setPersonaState] = useState<Persona>(() => {
    return ROUTE_TO_PERSONA[location] || "staff";
  });
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [staffName, setStaffName] = useState<string>("");

  // Sync persona with route
  useEffect(() => {
    const routePersona = ROUTE_TO_PERSONA[location];
    if (routePersona && routePersona !== persona) {
      setPersonaState(routePersona);
    }
  }, [location]);

  const setPersona = (newPersona: Persona) => {
    setPersonaState(newPersona);
    setLocation(PERSONA_ROUTES[newPersona]);
  };

  return (
    <PersonaContext.Provider
      value={{
        persona,
        setPersona,
        departmentId,
        setDepartmentId,
        staffId,
        setStaffId,
        staffName,
        setStaffName,
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) {
    throw new Error("usePersona must be used within PersonaProvider");
  }
  return context;
}
