class DataExaminerAPI {
  constructor() {
    this.baseURL = window.location.origin;
    this.cache = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.sessionId = null;
  }

  async analyzeFile(file, question = 'Analyze this data and create visualizations', conversationId = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);
    if (conversationId) formData.append('conversationId', conversationId);

    try {
      const response = await fetch(`${this.baseURL}/api/analyze/file`, {
        method: 'POST',
        body: formData
      });

      const result = await this.handleResponse(response);
      
      // Store session ID for conversation continuity
      if (result.conversationId) {
        this.sessionId = result.conversationId;
      }
      
      return result;
    } catch (error) {
      console.error('File analysis error:', error);
      throw error;
    }
  }

  async analyzeText(text, question = 'Analyze this data and create visualizations', conversationId = null) {
    try {
      const response = await fetch(`${this.baseURL}/api/analyze/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text,
          question: question,
          conversationId: conversationId
        })
      });

      const result = await this.handleResponse(response);
      
      if (result.conversationId) {
        this.sessionId = result.conversationId;
      }
      
      return result;
    } catch (error) {
      console.error('Text analysis error:', error);
      throw error;
    }
  }

  async chatFollowup(data) {
    try {
      const response = await fetch(`${this.baseURL}/api/chat/followup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: data.question,
          conversationId: data.conversationId || this.sessionId
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('Chat follow-up error:', error);
      throw error;
    }
  }

  async getConversation(sessionId) {
    try {
      const response = await fetch(`${this.baseURL}/api/conversation/${sessionId}`);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Get conversation error:', error);
      throw error;
    }
  }

  async clearConversation(sessionId) {
    try {
      const response = await fetch(`${this.baseURL}/api/conversation/${sessionId}`, {
        method: 'DELETE'
      });
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Clear conversation error:', error);
      throw error;
    }
  }

  async handleResponse(response) {
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: `HTTP error! status: ${response.status}` };
      }
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Request failed');
    }
    
    return result;
  }

  // Queue system for offline support
  queueRequest(request) {
    this.requestQueue.push({
      ...request,
      timestamp: Date.now(),
      id: Math.random().toString(36).substr(2, 9)
    });
    
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  async processQueue() {
    if (this.requestQueue.length === 0 || !navigator.onLine) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0 && navigator.onLine) {
      const request = this.requestQueue[0];
      
      try {
        await request.fn();
        this.requestQueue.shift();
      } catch (error) {
        console.error('Failed to process queued request:', error);
        break;
      }
    }
    
    this.isProcessingQueue = false;
  }

  clearCache() {
    this.cache.clear();
  }

  getCacheSize() {
    return this.cache.size;
  }
}