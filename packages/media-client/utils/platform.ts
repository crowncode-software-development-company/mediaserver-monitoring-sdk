export class PlatformUtils {
    static getUserAgent(): string {
        return navigator.userAgent;
    }

    static getVendor(): string {
        return navigator.vendor || '';
    }

    static isTouchDevice(): boolean {
        return 'ontouchend' in document;
    }

    static isChromeBrowser(): boolean {
        const ua = PlatformUtils.getUserAgent();
        return /Chrome/.test(ua) && !/Chromium|Edge|Edg|OPR|Opera|Samsung|Mobile Safari|Firefox/.test(ua);
    }

    static isSafariBrowser(): boolean {
        const ua = this.getUserAgent();
        const vendor = this.getVendor();
        return /Safari/.test(ua) && /Apple Computer/.test(vendor) && !/Chrome|Chromium|Edge|Edg|OPR|Opera|Samsung|Firefox/.test(ua);
    }

    static isChromeMobileBrowser(): boolean {
        const ua = this.getUserAgent();
        return /Chrome/.test(ua) && /Mobile/.test(ua) && !/Edge|Edg|OPR|Opera|Samsung|Firefox/.test(ua);
    }

    static isFirefoxBrowser(): boolean {
        const ua = this.getUserAgent();
        return /Firefox/.test(ua) && !/Seamonkey/.test(ua);
    }

    static isFirefoxMobileBrowser(): boolean {
        const ua = this.getUserAgent();
        return (/Firefox/.test(ua) && /Mobile/.test(ua)) || /FxiOS/.test(ua);
    }

    static isOperaBrowser(): boolean {
        const ua = this.getUserAgent();
        return /OPR|Opera/.test(ua) && !/Mobile/.test(ua);
    }

    static isOperaMobileBrowser(): boolean {
        const ua = this.getUserAgent();
        return /OPR|Opera/.test(ua) && /Mobile/.test(ua);
    }

    static isEdgeBrowser(): boolean {
        const ua = this.getUserAgent();
        return /Edg/.test(ua) && !/Mobile/.test(ua);
    }

    static isEdgeMobileBrowser(): boolean {
        const ua = this.getUserAgent();
        return /Edg/.test(ua) && /Mobile/.test(ua);
    }

    static isAndroidBrowser(): boolean {
        const ua = this.getUserAgent();
        return /Android/.test(ua) && /Version\/[\d.]+/.test(ua) && !/Chrome|Firefox|Opera|Samsung/.test(ua);
    }

    static isElectron(): boolean {
        const ua = this.getUserAgent();
        return /Electron/.test(ua);
    }

    static isSamsungBrowser(): boolean {
        const ua = this.getUserAgent();
        return /SamsungBrowser|Samsung Internet/.test(ua);
    }

    static isMotorolaEdgeDevice(): boolean {
        const ua = this.getUserAgent();
        return /motorola edge/i.test(ua);
    }

    static isIPhoneOrIPad(): boolean {
        const ua = this.getUserAgent();
        const isTouchable = this.isTouchDevice();
        const isIPad = /Macintosh/.test(ua) && isTouchable;
        const isIPhone = /iPhone/.test(ua) && /Mobile/.test(ua) && isTouchable;
        return isIPad || isIPhone;
    }

    static isIOSWithSafari(): boolean {
        const ua = this.getUserAgent();
        const vendor = this.getVendor();
        return (
            this.isIPhoneOrIPad() &&
            /Apple Computer/.test(vendor) &&
            /Safari/.test(ua) &&
            !/CriOS/.test(ua) &&
            !/FxiOS/.test(ua)
        );
    }

    static isIonicIos(): boolean {
        return this.isIPhoneOrIPad() && !/Safari/.test(this.getUserAgent());
    }

    static isIonicAndroid(): boolean {
        const ua = this.getUserAgent();
        return /Android/.test(ua) && this.isAndroidBrowser();
    }

    static isMobileDevice(): boolean {
        const ua = this.getUserAgent();
        return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/.test(ua);
    }

    static isReactNative(): boolean {
        return false;
    }

    static isChromium(): boolean {
        return (
            this.isChromeBrowser() ||
            this.isChromeMobileBrowser() ||
            this.isOperaBrowser() ||
            this.isOperaMobileBrowser() ||
            this.isEdgeBrowser() ||
            this.isEdgeMobileBrowser() ||
            this.isSamsungBrowser() ||
            this.isIonicAndroid() ||
            this.isIonicIos() ||
            this.isElectron() ||
            this.isMotorolaEdgeDevice()
        );
    }

    static canScreenShare(): boolean {
        if (this.isMobileDevice()) {
            return false;
        }

        const ua = this.getUserAgent();
        const safariVersion = this.getSafariVersion();

        return (
            this.isChromeBrowser() ||
            this.isFirefoxBrowser() ||
            this.isOperaBrowser() ||
            this.isElectron() ||
            this.isEdgeBrowser() ||
            (this.isSafariBrowser() && safariVersion >= 13)
        );
    }

    static getName(): string {
        const ua = this.getUserAgent();
        if (this.isChromeBrowser()) return 'Chrome';
        if (this.isChromeMobileBrowser()) return 'Chrome Mobile';
        if (this.isSafariBrowser()) return 'Safari';
        if (this.isFirefoxBrowser()) return 'Firefox';
        if (this.isFirefoxMobileBrowser()) return /FxiOS/.test(ua) ? 'Firefox for iOS' : 'Firefox Mobile';
        if (this.isOperaBrowser()) return 'Opera';
        if (this.isOperaMobileBrowser()) return 'Opera Mobile';
        if (this.isEdgeBrowser()) return 'Microsoft Edge';
        if (this.isEdgeMobileBrowser()) return 'Microsoft Edge';
        if (this.isAndroidBrowser()) return 'Android Browser';
        if (this.isElectron()) return 'Electron';
        if (this.isSamsungBrowser()) return 'Samsung Internet';
        return 'Unknown';
    }

    static getVersion(): string {
        const ua = this.getUserAgent();

        // Chrome
        const chromeMatch = ua.match(/Chrome\/([\d.]+)/);
        if (chromeMatch && this.isChromeBrowser()) return chromeMatch[1];

        // Safari
        const safariMatch = ua.match(/Version\/([\d.]+).*Safari/);
        if (safariMatch && this.isSafariBrowser()) return safariMatch[1];

        // Firefox
        const firefoxMatch = ua.match(/Firefox\/([\d.]+)/);
        if (firefoxMatch && this.isFirefoxBrowser()) return firefoxMatch[1];

        // Edge
        const edgeMatch = ua.match(/Edg\/([\d.]+)/);
        if (edgeMatch && this.isEdgeBrowser()) return edgeMatch[1];

        // Opera
        const operaMatch = ua.match(/(OPR|Opera)\/([\d.]+)/);
        if (operaMatch && (this.isOperaBrowser() || this.isOperaMobileBrowser())) return operaMatch[2];

        return '';
    }

    static getFamily(): string {
        const ua = this.getUserAgent();

        if (/Android/.test(ua)) return 'Android';
        if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
        if (/Windows/.test(ua)) return 'Windows';
        if (/Mac/.test(ua)) return 'macOS';
        if (/Linux/.test(ua)) return 'Linux';

        return 'Unknown';
    }

    static getDescription(): string {
        return this.getUserAgent();
    }

    static getSafariVersion(): number {
        const version = this.getVersion();
        return version ? parseFloat(version) : -1;
    }
}
