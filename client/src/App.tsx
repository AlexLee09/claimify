import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PersonaProvider } from "./contexts/PersonaContext";
import MainLayout from "./components/MainLayout";
import StaffView from "./pages/StaffView";
import AdminView from "./pages/AdminView";
import HodView from "./pages/HodView";
import FinanceView from "./pages/FinanceView";

function Router() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={StaffView} />
        <Route path="/staff" component={StaffView} />
        <Route path="/admin" component={AdminView} />
        <Route path="/hod" component={HodView} />
        <Route path="/finance" component={FinanceView} />
        <Route>
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Page not found</p>
          </div>
        </Route>
      </Switch>
    </MainLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <PersonaProvider>
          <TooltipProvider>
            <Toaster richColors position="top-right" />
            <Router />
          </TooltipProvider>
        </PersonaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
