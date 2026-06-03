import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";

// Android only: expo-web-browser routes the OAuth redirect through Expo Router.
// Complete the pending auth session here, then hand off to the auth guard.
export default function OAuth2Redirect() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    router.replace("/");
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
