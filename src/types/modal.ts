/**
 * Modal Type Definitions
 *
 * Defines TypeScript types for the custom modal system that replaces Alert.alert.
 * Supports different modal types (success, error, warning, info, confirm) with
 * customizable buttons and callbacks.
 *
 * @module types/modal
 */

/**
 * Modal type determines the visual style and default behavior
 */
export type ModalType = "success" | "error" | "warning" | "info" | "confirm";

/**
 * Button configuration for modal actions
 */
export interface ModalButton {
  /** Button text */
  text: string;
  /** Button press handler */
  onPress?: () => void;
  /** Button style variant */
  style?: "default" | "cancel" | "destructive";
}

/**
 * Modal configuration options
 */
export interface ModalConfig {
  /** Modal type (determines icon and colors) */
  type: ModalType;
  /** Modal title */
  title: string;
  /** Modal message/description */
  message: string;
  /** Array of buttons (1-2 buttons supported) */
  buttons?: ModalButton[];
  /** Callback when modal is dismissed by backdrop tap */
  onDismiss?: () => void;
  /** Whether to allow dismissing by tapping backdrop (default: true for info/success/error, false for confirm) */
  dismissable?: boolean;
}

/**
 * Internal modal state for the modal system
 */
export interface ModalState {
  /** Whether modal is currently visible */
  visible: boolean;
  /** Current modal configuration */
  config: ModalConfig | null;
}

/**
 * Convenience methods for showing different modal types
 */
export interface ModalMethods {
  /**
   * Show a success modal with a single OK button
   * @param title - Modal title
   * @param message - Success message
   * @param onPress - Optional callback when OK is pressed
   */
  showSuccess: (title: string, message: string, onPress?: () => void) => void;

  /**
   * Show an error modal with a single OK button
   * @param title - Modal title
   * @param message - Error message
   * @param onPress - Optional callback when OK is pressed
   */
  showError: (title: string, message: string, onPress?: () => void) => void;

  /**
   * Show a warning modal with a single OK button
   * @param title - Modal title
   * @param message - Warning message
   * @param onPress - Optional callback when OK is pressed
   */
  showWarning: (title: string, message: string, onPress?: () => void) => void;

  /**
   * Show an info modal with a single OK button
   * @param title - Modal title
   * @param message - Info message
   * @param onPress - Optional callback when OK is pressed
   */
  showInfo: (title: string, message: string, onPress?: () => void) => void;

  /**
   * Show a confirmation modal with Cancel and Confirm buttons
   * @param title - Modal title
   * @param message - Confirmation message
   * @param onConfirm - Callback when Confirm is pressed
   * @param onCancel - Optional callback when Cancel is pressed
   * @param confirmText - Optional custom text for confirm button (default: "Confirm")
   * @param cancelText - Optional custom text for cancel button (default: "Cancel")
   */
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText?: string,
    cancelText?: string
  ) => void;

  /**
   * Show a custom modal with full configuration
   * @param config - Complete modal configuration
   */
  showModal: (config: ModalConfig) => void;

  /**
   * Hide the currently visible modal
   */
  hideModal: () => void;
}
