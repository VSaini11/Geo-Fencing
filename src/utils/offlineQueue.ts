import AsyncStorage from '@react-native-async-storage/async-storage';
import { bgLog } from './bgLogger';

export const OFFLINE_EVENT_QUEUE_KEY = 'geo-checkin:offline_event_queue';

const fetchWithTimeout = async (url: string, options: any, timeoutMs = 8000) => {
  const controller = new AbortController();

  const fetchPromise = fetch(url, {
    ...options,
    signal: controller.signal,
  });

  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error('Timeout'));
    }, timeoutMs);
  });

  return Promise.race([fetchPromise, timeoutPromise]);
};

export async function pushOfflineEvent(event: any) {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_EVENT_QUEUE_KEY);
    const queue = queueStr ? JSON.parse(queueStr) : [];
    queue.push(event);
    await AsyncStorage.setItem(OFFLINE_EVENT_QUEUE_KEY, JSON.stringify(queue));
    bgLog.info(`📥 Queued offline event: ${event.type}`);
  } catch (e) {
    bgLog.warn(`Failed to queue offline event: ${e}`);
  }
}

export async function flushOfflineQueue(apiUrl?: string, token?: string) {
  try {
    const queueStr = await AsyncStorage.getItem(OFFLINE_EVENT_QUEUE_KEY);
    if (!queueStr) return false; // nothing to do

    let queue: any[] = JSON.parse(queueStr);
    if (queue.length === 0) return false;

    if (!apiUrl || !token) {
      const sessionStr = await AsyncStorage.getItem("geo-checkin:auth:v2");
      if (!sessionStr) return false;
      const session = JSON.parse(sessionStr);
      token = session.token;
      if (!token) return false;

      const savedUrl = await AsyncStorage.getItem("geo-checkin:api_url");
      apiUrl = (savedUrl && !savedUrl.includes('localhost') && !savedUrl.includes('127.0.0.1'))
        ? savedUrl
        : 'https://gca-50041716687.development.catalystappsail.in';
    }

    bgLog.info(`Flushing ${queue.length} offline events...`);
    let processedCount = 0;
    const newQueue = [...queue];

    for (const event of queue) {
      let url = '';
      let body = {};

      if (event.type === 'checkout') {
        url = `${apiUrl}/api/checkins/${event.id}/checkout`;
        body = { latitude: event.latitude, longitude: event.longitude, timestamp: event.timestamp };
      } else if (event.type === 'checkin') {
        url = `${apiUrl}/api/checkins`;
        body = {
          locationId: event.locationId,
          latitude: event.latitude,
          longitude: event.longitude,
          userName: event.userName,
          timestamp: event.timestamp
        };
      } else {
        // Unknown event type, drop it
        newQueue.shift();
        continue;
      }

      const res: any = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      }, 5000).catch(e => ({ ok: false, status: 'network_error' }));

      if (res.ok || (typeof res.status === 'number' && res.status >= 400 && res.status < 500)) {
        // 2xx success OR 4xx permanent failure (e.g., duplicate check-in or invalid id)
        // We drop it from the queue so it doesn't block future events.
        processedCount++;
        newQueue.shift();
      } else {
        // Network error, timeout, or 5xx server error. Stop flushing.
        bgLog.warn(`Stopping flush: Network/Server error on ${event.type}`);
        break;
      }
    }

    if (newQueue.length !== queue.length) {
      await AsyncStorage.setItem(OFFLINE_EVENT_QUEUE_KEY, JSON.stringify(newQueue));
      bgLog.info(`🚀 Flushed ${processedCount} offline events. Remaining: ${newQueue.length}`);
      return true; // We processed at least one successfully
    }
    return false;
  } catch (e) {
    bgLog.warn(`Failed to flush queue: ${e}`);
    return false;
  }
}

export async function fetchWithAbortTimeout(url: string, options: any, timeoutMs = 8000) {
  return fetchWithTimeout(url, options, timeoutMs);
}
