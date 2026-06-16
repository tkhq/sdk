import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { useTurnkey } from "@turnkey/react-native-wallet-kit";

export function DeleteSubOrg() {
  const { session, logout, deleteSubOrganization } = useTurnkey();
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    if (!session?.organizationId) return;
    Alert.alert(
      "Delete account",
      "This permanently deletes your sub-organization and all associated wallets. It cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, delete my account",
          style: "destructive",
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteSubOrganization({
                organizationId: session.organizationId,
                deleteWithoutExport: true,
              });
              await logout();
            } catch (e: unknown) {
              setDeleting(false);
              Alert.alert(
                "Error",
                e instanceof Error ? e.message : "Failed to delete account.",
              );
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onDelete} disabled={deleting}>
        <Text style={styles.label}>
          {deleting ? "Deleting…" : "Delete account"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  label: {
    fontSize: 13,
    color: "#ef4444",
    textDecorationLine: "underline",
  },
});
