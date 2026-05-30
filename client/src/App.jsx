import { useEffect, useRef, useState } from 'react';
import {
  Check,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  Send,
} from 'lucide-react';

const SESSION_KEY = 'searchsomething_session_id';
let autoLocationBootstrapped = false;

const welcomeMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi, I am SearchSomething. What can I help you find nearby?',
  createdAt: new Date().toISOString(),
};

function makeSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getSessionId() {
  const existing = localStorage.getItem(SESSION_KEY);

  if (existing) {
    return existing;
  }

  const sessionId = makeSessionId();
  localStorage.setItem(SESSION_KEY, sessionId);
  return sessionId;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://chatbot-api-939800561122.asia-south1.run.app';

async function apiFetch(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function withWelcome(history = []) {
  return [welcomeMessage, ...history];
}

function readCookies() {
  const sensitiveCookiePattern = /(token|auth|session|secret|jwt|password|key)/i;

  return document.cookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex === -1) {
        return cookies;
      }

      const key = decodeURIComponent(entry.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(entry.slice(separatorIndex + 1).trim());
      if (key) {
        cookies[key] = sensitiveCookiePattern.test(key) ? '[REDACTED]' : value;
      }
      return cookies;
    }, {});
}

function getBrowserAdditionalInformation() {
  return {
    userAgent: navigator.userAgent || '',
    platform: navigator.platform || '',
    language: navigator.language || '',
    languages: navigator.languages || [],
    cookieEnabled: navigator.cookieEnabled ?? null,
    online: navigator.onLine ?? null,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: navigator.deviceMemory ?? null,
    maxTouchPoints: navigator.maxTouchPoints ?? null,
  };
}

function getDeviceAccessData() {
  return {
    cookies: readCookies(),
    additionalInformation: getBrowserAdditionalInformation(),
  };
}

export default function App() {
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([welcomeMessage]);
  const [input, setInput] = useState('');
  const [coords, setCoords] = useState(null);
  const [exactLocation, setExactLocation] = useState('');
  const [locationStatus, setLocationStatus] = useState('idle');
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState('');
  const messagesEndRef = useRef(null);
  const locationRef = useRef({ coords: null, exactLocation: '' });

  useEffect(() => {
    locationRef.current = { coords, exactLocation };
  }, [coords, exactLocation]);

  function getLocationPayload(nextCoords = locationRef.current.coords) {
    return {
      latitude: nextCoords?.latitude ?? null,
      longitude: nextCoords?.longitude ?? null,
      locationAccuracy: nextCoords?.accuracy ?? null,
      exactLocation: locationRef.current.exactLocation,
    };
  }

  function getActiveSessionId() {
    const storedSessionId = localStorage.getItem(SESSION_KEY);

    if (storedSessionId) {
      return storedSessionId;
    }

    const nextSessionId = sessionId || makeSessionId();
    localStorage.setItem(SESSION_KEY, nextSessionId);
    setSessionId(nextSessionId);
    return nextSessionId;
  }

  useEffect(() => {
    const browserSessionId = getSessionId();
    setSessionId(browserSessionId);

    apiFetch(`/api/chat/${browserSessionId}`)
      .then((data) => {
        setMessages(withWelcome(data.chatHistory || []));

        if (data.user) {
          const savedExactLocation = data.user.exactLocation || '';
          setExactLocation(savedExactLocation);
          if (data.user.latitude !== null && data.user.longitude !== null) {
            const savedCoords = {
              latitude: Number(data.user.latitude),
              longitude: Number(data.user.longitude),
              accuracy: Number(data.user.locationAccuracy || 0),
            };

            locationRef.current = {
              coords: savedCoords,
              exactLocation: savedExactLocation,
            };
            setCoords(savedCoords);
          } else {
            locationRef.current = {
              coords: null,
              exactLocation: savedExactLocation,
            };
          }
        }
      })
      .catch(() => {
        setNotice('Backend is not connected yet.');
      })
      .finally(() => {
        if (!autoLocationBootstrapped) {
          autoLocationBootstrapped = true;
          window.setTimeout(() => requestLocation(), 250);
        }
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function saveLocation(nextCoords = coords) {
    const activeSessionId = getActiveSessionId();

    if (!activeSessionId) {
      return;
    }

    const payload = {
      sessionId: activeSessionId,
      ...getLocationPayload(nextCoords),
      ...getDeviceAccessData(),
    };

    await apiFetch('/api/location', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setNotice('Location is not available in this browser.');
      return;
    }

    setLocationStatus('loading');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const nextCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };

        locationRef.current = {
          coords: nextCoords,
          exactLocation: locationRef.current.exactLocation,
        };
        setCoords(nextCoords);

        try {
          await saveLocation(nextCoords);
          setLocationStatus('saved');
          setNotice('');
        } catch (error) {
          setLocationStatus('error');
          setNotice(error.message);
        }
      },
      () => {
        setLocationStatus('error');
        setNotice('Location permission was not granted.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }

  async function handleSaveLocation() {
    try {
      setLocationStatus('loading');
      await saveLocation();
      setLocationStatus('saved');
      setNotice('');
    } catch (error) {
      setLocationStatus('error');
      setNotice(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmed = input.trim();

    if (!trimmed || isSending) {
      return;
    }

    const optimisticMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    setInput('');
    setIsSending(true);
    setNotice('');
    setMessages((current) => [...current, optimisticMessage]);

    try {
      const activeSessionId = getActiveSessionId();
      const data = await apiFetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: activeSessionId,
          message: trimmed,
          ...getLocationPayload(),
          ...getDeviceAccessData(),
        }),
      });

      setMessages(withWelcome(data.chatHistory || []));
    } catch (error) {
      setNotice(error.message);
      setMessages((current) => [
        ...current,
        {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: 'I could not save that message. Please check the server.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function startNewChat() {
    const nextSessionId = makeSessionId();
    localStorage.setItem(SESSION_KEY, nextSessionId);
    locationRef.current = { coords: null, exactLocation: '' };
    setSessionId(nextSessionId);
    setMessages([welcomeMessage]);
    setCoords(null);
    setExactLocation('');
    setNotice('');
    setLocationStatus('idle');
  }

  return (
    <div className="app-shell">
      <section className="chat-shell" aria-label="SearchSomething chatbot">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Search size={21} strokeWidth={2.4} />
            </span>
            <span>SearchSomething</span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={startNewChat}
            aria-label="Start new chat"
            title="Start new chat"
          >
            <RefreshCcw size={18} />
          </button>
        </header>

        <div className="location-strip">
          <button
            className="location-button"
            type="button"
            onClick={requestLocation}
            disabled={locationStatus === 'loading'}
          >
            {locationStatus === 'loading' ? (
              <Loader2 className="spin" size={17} />
            ) : (
              <Crosshair size={17} />
            )}
            <span>{coords ? 'Precise saved' : 'Use precise location'}</span>
          </button>

          <label className="location-field">
            <MapPin size={17} aria-hidden="true" />
            <input
              value={exactLocation}
              onChange={(event) => {
                const nextExactLocation = event.target.value;
                locationRef.current = {
                  coords: locationRef.current.coords,
                  exactLocation: nextExactLocation,
                };
                setExactLocation(nextExactLocation);
              }}
              placeholder="Exact area or landmark"
              aria-label="Exact area or landmark"
            />
          </label>

          <button
            className="icon-button save-button"
            type="button"
            onClick={handleSaveLocation}
            aria-label="Save location"
            title="Save location"
            disabled={locationStatus === 'loading'}
          >
            <Check size={18} />
          </button>
        </div>

        <main className="messages" aria-live="polite">
          {messages.map((message) => (
            <article
              className={`message ${message.role}`}
              key={message.id}
            >
              <p>{message.content}</p>
            </article>
          ))}

          {isSending && (
            <article className="message assistant typing">
              <span />
              <span />
              <span />
            </article>
          )}
          <div ref={messagesEndRef} />
        </main>

        {notice && <div className="notice">{notice}</div>}

        <form className="composer" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Message SearchSomething"
            aria-label="Message SearchSomething"
          />
          <button
            type="submit"
            className="send-button"
            disabled={!input.trim() || isSending}
            aria-label="Send message"
            title="Send message"
          >
            {isSending ? <Loader2 className="spin" size={19} /> : <Send size={19} />}
          </button>
        </form>
      </section>
    </div>
  );
}
