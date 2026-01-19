class API {
  constructor() {
    this.baseURL = window.location.origin;
  }

  async analyzeFile(file, question = 'Analyze this data') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);

    try {
      const response = await fetch(`${this.baseURL}/api/analyze/file`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing file:', error);
      throw error;
    }
  }

  async analyzeText(text, question = 'Analyze this data') {
    try {
      const response = await fetch(`${this.baseURL}/api/analyze/text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          question: question
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error analyzing text:', error);
      throw error;
    }
  }

  async sendChatMessage(message, context = null) {
    try {
      const response = await fetch(`${this.baseURL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message,
          context: context
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }
  }

  // Check if API is available
  async checkHealth() {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Store data locally for offline use
  async storeOfflineAnalysis(data) {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported');
      return false;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open('DataAnalyzerDB', 1);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = (event) => {
        const db = event.target.result;
        
        const transaction = db.transaction(['analyses'], 'readwrite');
        const store = transaction.objectStore('analyses');
        
        const analysisData = {
          ...data,
          id: Date.now(),
          timestamp: new Date().toISOString(),
          synced: false
        };

        const addRequest = store.add(analysisData);
        
        addRequest.onsuccess = () => resolve(true);
        addRequest.onerror = () => reject(new Error('Failed to store analysis'));
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('analyses')) {
          const store = db.createObjectStore('analyses', { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('synced', 'synced', { unique: false });
        }
      };
    });
  }
}

export default API;