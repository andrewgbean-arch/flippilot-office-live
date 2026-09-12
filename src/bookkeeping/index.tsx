import { BookkeepingProvider } from "./BookkeepingProvider";
import BookkeepingScreen from "./BookkeepingScreen";

export default function BookkeepingPage() {
  return (
    <BookkeepingProvider>
      <BookkeepingScreen />
    </BookkeepingProvider>
  );
}

