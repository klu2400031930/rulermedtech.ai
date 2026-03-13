import { createContext, useContext, useEffect, useState } from 'react';
import { languageLocales, translations } from '../i18n/translations';

const safeGetItem = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeSetItem = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage might be unavailable (private mode, disabled, etc.)
    }
};

const safeParse = (value, fallback) => {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const AccessibilityContext = createContext();

export function useAccessibility() {
    return useContext(AccessibilityContext);
}

export default function AccessibilityProvider({ children }) {
    const [settings, setSettings] = useState(() => {
        const saved = safeGetItem('accessibility');
        const parsed = safeParse(saved, null);
        return parsed || {
            lowBandwidth: false,
            simplifiedUI: false,
            voiceGuidance: false,
            language: 'en',
            offlineMode: false
        };
    });

    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [offlineQueue, setOfflineQueue] = useState(() => {
        const queue = safeGetItem('offlineQueue');
        return safeParse(queue, []);
    });

    const t = (key, replacements = {}) => {
        const lang = settings.language || 'en';
        let text = translations[lang]?.[key] || translations.en[key] || key;

        Object.entries(replacements).forEach(([replacementKey, value]) => {
            text = text.replace(`{${replacementKey}}`, value);
        });

        return text;
    };

    const hasTranslation = (key) => {
        const lang = settings.language || 'en';
        return Boolean(translations[lang]?.[key] || translations.en[key]);
    };

    const translateEnum = (prefix, value) => {
        if (!value) return '';

        const normalized = String(value).toLowerCase().replace(/[\s-]+/g, '_');
        const key = `${prefix}_${normalized}`;

        if (hasTranslation(key)) {
            return t(key);
        }

        return String(value)
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (char) => char.toUpperCase());
    };

    const applyGoogleTranslate = (language) => {
        const combo = document.querySelector('.goog-te-combo');
        if (!combo) return false;

        combo.value = language;
        combo.dispatchEvent(new Event('change'));
        return true;
    };

    useEffect(() => {
        safeSetItem('accessibility', JSON.stringify(settings));
        document.documentElement.lang = languageLocales[settings.language] || 'en-IN';
    }, [settings]);

    useEffect(() => {
        if (window.googleTranslateElementInit) {
            return;
        }

        window.googleTranslateElementInit = () => {
            if (!window.google?.translate?.TranslateElement || !document.getElementById('google_translate_element')) {
                return;
            }

            // Hidden widget that lets us translate the live DOM on demand.
            new window.google.translate.TranslateElement(
                {
                    pageLanguage: 'en',
                    includedLanguages: 'en,hi,te',
                    autoDisplay: false,
                    layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
                },
                'google_translate_element'
            );
        };

        if (window.google?.translate?.TranslateElement) {
            window.googleTranslateElementInit();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        document.body.appendChild(script);
    }, []);

    useEffect(() => {
        let attempts = 0;

        const syncLanguage = () => {
            attempts += 1;
            const targetLanguage = settings.language === 'en' ? 'en' : settings.language;
            const updated = applyGoogleTranslate(targetLanguage);

            if (!updated && attempts < 20) {
                window.setTimeout(syncLanguage, 300);
            }
        };

        syncLanguage();
    }, [settings.language]);

    useEffect(() => {
        safeSetItem('offlineQueue', JSON.stringify(offlineQueue));
    }, [offlineQueue]);

    useEffect(() => {
        const goOnline = () => {
            setIsOnline(true);
            syncOfflineQueue();
        };
        const goOffline = () => setIsOnline(false);

        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
    }, []);

    const syncOfflineQueue = async () => {
        const queue = safeParse(safeGetItem('offlineQueue'), []);
        if (queue.length === 0) return;

        for (const item of queue) {
            try {
                const api = (await import('../utils/api')).default;
                await api.post('/diagnosis', item);
            } catch (error) {
                console.error('Sync failed for item:', error.message);
            }
        }

        safeSetItem('offlineQueue', '[]');
        setOfflineQueue([]);
    };

    const saveOffline = (data) => {
        setOfflineQueue((current) => [...current, { ...data, savedAt: new Date().toISOString() }]);
    };

    const speak = (text) => {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageLocales[settings.language] || 'en-IN';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    };

    const updateSetting = (key, value) => {
        setSettings((current) => ({ ...current, [key]: value }));
    };

    return (
        <AccessibilityContext.Provider
            value={{
                settings,
                updateSetting,
                isOnline,
                offlineQueue,
                saveOffline,
                speak,
                syncOfflineQueue,
                t,
                hasTranslation,
                translateEnum,
                locale: languageLocales[settings.language] || 'en-IN'
            }}
        >
            {children}
        </AccessibilityContext.Provider>
    );
}
