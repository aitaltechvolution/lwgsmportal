import React, { useEffect } from 'react';

// 1. Declare global types correctly by splitting the Instance and Static interface
declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        // This represents the static side (the class constructor + its static properties)
        TranslateElement: {
          new (
            options: {
              pageLanguage: string;
              layout?: any;
              autoDisplay?: boolean;
            },
            elementId: string
          ): any; // The constructor instance
          
          // Define the static property InlineLayout here
          InlineLayout: {
            SIMPLE: any;
            HORIZONTAL: any;
            VERTICAL: any;
          };
        };
      };
    };
  }
}

const GoogleTranslate: React.FC = () => {
  useEffect(() => {
    // 2. Define the initialization function that Google's script calls
    window.googleTranslateElementInit = () => {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          'google_translate_element'
        );
      }
    };

    // 3. Check if the script is already added to prevent duplicate injections
    const scriptId = 'google-translate-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'text/javascript';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    } else {
      if (window.googleTranslateElementInit) {
        window.googleTranslateElementInit();
      }
    }
  }, []);

  return (
    <div id="google_translate_element" className="google-translate-container" />
  );
};

export default GoogleTranslate;