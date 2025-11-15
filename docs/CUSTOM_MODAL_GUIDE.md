# Custom Modal Component Guide

This guide explains how to use the `CustomModal` component and `useCustomModal` hook to replace `Alert.alert` throughout the CB-Pro-Proxy application.

## Overview

The CustomModal system provides a themed, animated modal component that integrates seamlessly with the app's design system. It supports multiple modal types with appropriate styling and behavior.

## Features

- ✅ **Theme Integration**: Automatically adapts to light/dark mode
- ✅ **Smooth Animations**: Fade and scale animations for professional UX
- ✅ **Multiple Types**: Success, Error, Warning, Info, and Confirm modals
- ✅ **TypeScript Support**: Fully typed for type safety
- ✅ **Customizable**: Flexible button configuration and callbacks
- ✅ **Accessible**: Follows React Native best practices
- ✅ **Responsive**: Handles long messages with scrolling

## Modal Types

### 1. Success Modal

Shows a green checkmark icon with success styling.

```typescript
modal.showSuccess("Success!", "Your profile has been saved successfully.");
```

### 2. Error Modal

Shows a red X icon with error styling.

```typescript
modal.showError(
  "Connection Failed",
  "Unable to connect to the proxy server. Please check your settings."
);
```

### 3. Warning Modal

Shows a yellow warning icon.

```typescript
modal.showWarning(
  "Cache Full",
  "Your cache is getting full. Consider clearing it soon."
);
```

### 4. Info Modal

Shows a blue info icon.

```typescript
modal.showInfo(
  "Privacy Notice",
  "Your connection data is encrypted and secure."
);
```

### 5. Confirm Modal

Shows a confirmation dialog with Cancel and Confirm buttons.

```typescript
modal.showConfirm(
  "Delete Profile",
  "Are you sure you want to delete this profile? This action cannot be undone.",
  () => {
    // User confirmed
    deleteProfile();
  },
  () => {
    // User cancelled (optional)
    console.log("Cancelled");
  }
);
```

## Basic Usage

### Step 1: Import the Hook and Component

```typescript
import { useCustomModal } from "../hooks/useCustomModal";
import { CustomModal } from "../components/CustomModal";
```

### Step 2: Initialize the Hook

```typescript
function MyScreen() {
  const modal = useCustomModal();

  // ... rest of component
}
```

### Step 3: Add the Modal Component

Add the `CustomModal` component to your screen's JSX, typically at the end:

```typescript
return (
  <View style={styles.container}>
    {/* Your screen content */}

    {/* Modal component */}
    <CustomModal
      visible={modal.visible}
      config={modal.config}
      onDismiss={modal.hideModal}
    />
  </View>
);
```

### Step 4: Show Modals

Call the appropriate method when needed:

```typescript
const handleSave = async () => {
  try {
    await saveProfile(profile);
    modal.showSuccess("Saved", "Profile saved successfully!");
  } catch (error) {
    modal.showError("Error", "Failed to save profile");
  }
};
```

## Advanced Usage

### Custom Button Text

```typescript
modal.showConfirm(
  "Clear Cache",
  "This will clear all cached data.",
  () => clearCache(),
  undefined,
  "Clear Now", // Custom confirm text
  "Keep Data" // Custom cancel text
);
```

### Custom Modal Configuration

For full control, use the `showModal` method:

```typescript
modal.showModal({
  type: "confirm",
  title: "Delete All",
  message: "Delete all profiles?",
  buttons: [
    {
      text: "Cancel",
      style: "cancel",
      onPress: () => console.log("Cancelled"),
    },
    {
      text: "Delete",
      style: "destructive",
      onPress: () => deleteAll(),
    },
  ],
  dismissable: false,
  onDismiss: () => console.log("Modal dismissed"),
});
```

### Button Styles

Three button styles are available:

- **`default`**: Primary action button (blue background)
- **`cancel`**: Secondary/cancel button (outlined)
- **`destructive`**: Destructive action (red background)

## Migration from Alert.alert

### Before (Alert.alert)

```typescript
Alert.alert("Delete Profile", "Are you sure?", [
  { text: "Cancel", style: "cancel" },
  { text: "Delete", style: "destructive", onPress: () => deleteProfile() },
]);
```

### After (CustomModal)

```typescript
modal.showConfirm("Delete Profile", "Are you sure?", () => deleteProfile());
```

## Complete Example

```typescript
import React from "react";
import { View, StyleSheet } from "react-native";
import { useCustomModal } from "../hooks/useCustomModal";
import { CustomModal } from "../components/CustomModal";
import { ThemedButton } from "../components/ThemedComponents";

export const ProfileScreen = () => {
  const modal = useCustomModal();

  const handleDelete = () => {
    modal.showConfirm(
      "Delete Profile",
      "This action cannot be undone.",
      async () => {
        try {
          await deleteProfile();
          modal.showSuccess("Deleted", "Profile deleted successfully");
        } catch (error) {
          modal.showError("Error", "Failed to delete profile");
        }
      }
    );
  };

  return (
    <View style={styles.container}>
      <ThemedButton
        title="Delete Profile"
        onPress={handleDelete}
        variant="secondary"
      />

      <CustomModal
        visible={modal.visible}
        config={modal.config}
        onDismiss={modal.hideModal}
      />
    </View>
  );
};
```

## API Reference

### useCustomModal Hook

Returns an object with the following properties and methods:

#### Properties

- `visible: boolean` - Whether the modal is currently visible
- `config: ModalConfig | null` - Current modal configuration

#### Methods

- `showSuccess(title, message, onPress?)` - Show success modal
- `showError(title, message, onPress?)` - Show error modal
- `showWarning(title, message, onPress?)` - Show warning modal
- `showInfo(title, message, onPress?)` - Show info modal
- `showConfirm(title, message, onConfirm, onCancel?, confirmText?, cancelText?)` - Show confirmation modal
- `showModal(config)` - Show modal with custom configuration
- `hideModal()` - Hide the current modal

### CustomModal Component Props

- `visible: boolean` - Whether the modal is visible
- `config: ModalConfig | null` - Modal configuration
- `onDismiss: () => void` - Callback when modal is dismissed

## Best Practices

1. **Always include the modal component** in your screen's JSX
2. **Use appropriate modal types** for the context
3. **Keep messages concise** but informative
4. **Provide clear button labels** that describe the action
5. **Handle callbacks** for important actions
6. **Use confirm modals** for destructive actions
7. **Test in both themes** to ensure visibility

## Notes

- Modals are automatically dismissed when a button is pressed
- Backdrop tap dismisses info/success/error modals by default
- Confirm modals require explicit button press
- Long messages automatically scroll
- Icons and colors adapt to the theme automatically

## See Also

- [CustomModalExample.tsx](../src/components/CustomModalExample.tsx) - Working examples of all modal types
- [Theme System](./FEATURE_DESIGN.md#theme-system) - Theme integration details
- [TypeScript Types](../src/types/modal.ts) - Complete type definitions
