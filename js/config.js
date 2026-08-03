/**
 * Runtime config for donations and product links.
 *
 * Fill these URLs when your accounts are ready.
 * Leave empty to show a “not connected yet” toast in the UI.
 */
window.NAFS_CONFIG = {
  donations: {
    /**
     * Best default for Russian users:
     * a personal SBP / bank transfer page or a static QR landing page.
     * Examples: T-Bank collect link, YooMoney wallet link, or your own page with QR.
     */
    sbp: "",

    /**
     * CloudTips / Sber Tips style page.
     * Easy to open, good for one-tap support.
     */
    /**
     * CloudTips tip page — primary donation method for launch.
     */
    tips: "https://pay.cloudtips.ru/p/ce29a1d6",

    // Reserved for later:
    sbp: "",
    boosty: "",
    kofi: "",
  },
};
