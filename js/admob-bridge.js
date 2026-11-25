/* Neon Gem Merge — ads adapter.
 *
 * One small surface for the game: `AdBridge.showRewarded(placement)` resolves
 * with { rewarded, reason } and `AdBridge.showBanner()/hideBanner()` manage the
 * bottom banner. In a Capacitor build it calls @capacitor-community/admob; in a
 * browser/PWA it delegates to an in-app simulated ad (so the whole reward loop
 * can be reviewed before any store SDK is installed).
 *
 * Replace the TEST ids below with your production AdMob unit ids after the
 * AdMob account is approved. Keep `isTesting: true` while developing.
 */

export const AD_IDS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    rewarded: 'ca-app-pub-3940256099942544/5224354917'
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',
    rewarded: 'ca-app-pub-3940256099942544/1712485313'
  }
};

export class AdBridge {
  constructor(opts = {}) {
    this.mock = opts.mock || null;
    this.isTesting = opts.isTesting ?? true;
    this.ready = false;
    this.bannerVisible = false;
    this.rewardedReady = false;
    this.platform = 'web';
    this.failures = 0;
    this._admob = null;
    this._initPromise = null;
  }

  static isNative() {
    try {
      return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    } catch (e) { return false; }
  }

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = (async () => {
      if (!AdBridge.isNative()) {
        this.platform = 'web';
        this.ready = true;
        return false;
      }
      this.platform = window.Capacitor.getPlatform?.() || 'native';
      const plugin = window.Capacitor.Plugins?.AdMob;
      if (!plugin) {
        // The native shell is present but the plugin was not installed.
        this.platform = 'native-no-plugin';
        this.ready = true;
        return false;
      }
      this._admob = plugin;
      try {
        await plugin.initialize({
          requestTrackingAuthorization: false,
          testingDevices: [],
          initializeForTesting: this.isTesting
        });
        this.ready = true;
        return true;
      } catch (e) {
        this.ready = true;
        return false;
      }
    })();
    return this._initPromise;
  }

  ids() {
    if (this.platform === 'ios' || this.platform === 'ios-native') return AD_IDS.ios;
    return AD_IDS.android;
  }

  async prepareRewarded() {
    if (!this._admob) return false;
    try {
      await this._admob.prepareRewardVideoAd({ adId: this.ids().rewarded, isTesting: this.isTesting });
      this.rewardedReady = true;
      return true;
    } catch (e) {
      this.rewardedReady = false;
      return false;
    }
  }

  /**
   * @param {'bomb'|'swap'|'revive'} placement
   * @returns {Promise<{rewarded:boolean, reason?:string, source:string}>}
   */
  async showRewarded(placement) {
    await this.init();
    if (this._admob) {
      try {
        if (!this.rewardedReady) await this.prepareRewarded();
        await this._admob.showRewardVideoAd();
        this.rewardedReady = false;
        return { rewarded: true, source: 'admob' };
      } catch (e) {
        this.rewardedReady = false;
        return { rewarded: false, reason: 'load-failed', source: 'admob' };
      }
    }
    if (this.mock) {
      const ok = await this.mock(placement);
      return ok
        ? { rewarded: true, source: 'simulated' }
        : { rewarded: false, reason: 'closed-early', source: 'simulated' };
    }
    return { rewarded: false, reason: 'no-ad-provider', source: 'none' };
  }

  async showBanner() {
    await this.init();
    if (!this._admob) { this.bannerVisible = false; return false; }
    try {
      await this._admob.showBanner({
        adId: this.ids().banner,
        position: 'BOTTOM_CENTER',
        margin: 0,
        isTesting: this.isTesting
      });
      this.bannerVisible = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  async hideBanner() {
    if (!this._admob) return;
    try {
      await this._admob.removeBanner();
      this.bannerVisible = false;
    } catch (e) { /* noop */ }
  }
}
