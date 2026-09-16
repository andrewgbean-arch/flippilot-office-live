import AnimatedRoutes from "./router/AnimatedRoutes";
import { TourProvider } from "./tour/TourProvider";

export default function App() {
  return (
    <TourProvider>
      <AnimatedRoutes />
    </TourProvider>
  );
}











