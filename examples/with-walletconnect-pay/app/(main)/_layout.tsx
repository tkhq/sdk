import { Stack } from "expo-router";

export default function MainLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}```

Here we should be able to simply use Stack instead of adding the overhead of Tabs with a hidden bar since this is a single screen.
