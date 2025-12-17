/**
 * Next.js App Component
 */

import { useEffect } from 'react';
import '@/styles/globals.css';

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ensure chatbot container exists globally
    const ensureContainer = () => {
      if (!document.getElementById('edu-bot-container')) {
        const container = document.createElement('div');
        container.id = 'edu-bot-container';
        document.body.appendChild(container);
      }
    };

    const loadScript = (onReady) => {
      // If already loaded, just run callback
      if (window.EDUCORE_BOT_LOADED && window.initializeEducoreBot) {
        onReady();
        return;
      }

      const existing = document.querySelector('script[data-edu-bot="true"]');
      if (existing) {
        existing.addEventListener('load', onReady);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://rag-production-3a4c.up.railway.app/embed/bot.js';
      script.async = true;
      script.dataset.eduBot = 'true';
      script.onload = () => {
        window.EDUCORE_BOT_LOADED = true;
        onReady();
      };
      document.head.appendChild(script);
    };

    const initChatbotWithRetry = () => {
      let attempts = 0;
      const MAX_ATTEMPTS = 30;

      const tryInit = () => {
        attempts += 1;

        const userId = window.localStorage.getItem('userId');
        const token = window.localStorage.getItem('auth_token') || 'demo-token';
        const tenantId = window.localStorage.getItem('tenant_id') || 'default';

        if (userId && window.initializeEducoreBot) {
          window.initializeEducoreBot({
            microservice: 'SKILLS_ENGINE',
            userId,
            token,
            tenantId,
          });
          return;
        }

        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryInit, 500);
        }
      };

      tryInit();
    };

    ensureContainer();
    loadScript(initChatbotWithRetry);
  }, []);

  return <Component {...pageProps} />;
}

