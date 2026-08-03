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
    tips: "https://pay.cloudtips.ru/p/ce29a1d6",

    /**
     * Boosty page if you want recurring support and a public profile.
     */
    boosty: "",

    /**
     * Ko-fi for international supporters (works best if you can receive via Stripe/PayPal).
     */
    kofi: "",
  },
};
