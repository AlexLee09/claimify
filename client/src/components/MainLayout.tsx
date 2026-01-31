import { ReactNode, useEffect } from "react";
import { usePersona, Persona } from "@/contexts/PersonaContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  ClipboardList,
  UserCheck,
  Landmark,
  Building2,
} from "lucide-react";

interface MainLayoutProps {
  children: ReactNode;
}

const PERSONA_CONFIG: Record<
  Persona,
  { label: string; icon: typeof User; description: string; color: string }
> = {
  staff: {
    label: "Staff / Driver",
    icon: User,
    description: "Submit expense claims",
    color: "bg-blue-500",
  },
  admin: {
    label: "Dept. Admin",
    icon: ClipboardList,
    description: "Review & approve claims",
    color: "bg-emerald-500",
  },
  hod: {
    label: "Head of Dept.",
    icon: UserCheck,
    description: "Batch approval",
    color: "bg-purple-500",
  },
  finance: {
    label: "Finance Director",
    icon: Landmark,
    description: "Audit & disburse",
    color: "bg-amber-500",
  },
};

export default function MainLayout({ children }: MainLayoutProps) {
  const { persona, setPersona, departmentId, setDepartmentId } = usePersona();

  // Seed initial data on first load
  const seedMutation = trpc.seed.init.useMutation();
  const { data: departments, isLoading: loadingDepts } =
    trpc.department.list.useQuery();

  useEffect(() => {
    seedMutation.mutate();
  }, []);

  // Auto-select first department if none selected
  useEffect(() => {
    if (departments && departments.length > 0 && !departmentId) {
      setDepartmentId(departments[0].id);
    }
  }, [departments, departmentId, setDepartmentId]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar Navigation */}
      <aside className="w-72 bg-card border-r flex flex-col">
        {/* Logo/Brand */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-center">
            <img 
              src="/bok-seng-logo.png" 
              alt="Bok Seng Petty Cash System" 
              className="h-20 object-contain"
            />
          </div>
        </div>

        {/* Department Selector */}
        <div className="p-4 border-b">
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            Department
          </label>
          <Select
            value={departmentId?.toString() || ""}
            onValueChange={(v) => setDepartmentId(parseInt(v))}
            disabled={loadingDepts}
          >
            <SelectTrigger className="w-full">
              <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments?.map((dept) => (
                <SelectItem key={dept.id} value={dept.id.toString()}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Persona Navigation */}
        <nav className="flex-1 p-3">
          <p className="text-xs font-medium text-muted-foreground px-3 mb-2">
            Switch Persona
          </p>
          <div className="space-y-1">
            {(Object.keys(PERSONA_CONFIG) as Persona[]).map((p) => {
              const config = PERSONA_CONFIG[p];
              const Icon = config.icon;
              const isActive = persona === p;

              return (
                <button
                  key={p}
                  onClick={() => setPersona(p)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center",
                      isActive ? "bg-primary-foreground/20" : config.color
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-primary-foreground" : "text-white"
                      )}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        isActive
                          ? "text-primary-foreground"
                          : "text-foreground"
                      )}
                    >
                      {config.label}
                    </p>
                    <p
                      className={cn(
                        "text-xs truncate",
                        isActive
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {config.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Footer - removed hackathon demo text */}
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">{children}</main>
    </div>
  );
}
