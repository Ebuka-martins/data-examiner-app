// API Client for Data Examiner
class DataExaminerAPI {
    constructor() {
        this.baseURL = window.location.origin;
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessingQueue = false;
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
                const error = await response.json();
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Cache the result
            this.cache.set(`file-${file.name}-${question}`, result);
            
            return result;
        } catch (error) {
            console.error('Error analyzing file:', error);
            
            // Check if we have a cached result
            const cacheKey = `file-${file.name}-${question}`;
            const cachedResult = this.cache.get(cacheKey);
            if (cachedResult) {
                console.log('Using cached result for file analysis');
                return cachedResult;
            }
            
            throw new Error(`Failed to analyze file: ${error.message}`);
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
                const error = await response.json();
                throw new Error(error.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            // Cache the result
            this.cache.set(`text-${hashString(text)}-${question}`, result);
            
            return result;
        } catch (error) {
            console.error('Error analyzing text:', error);
            
            // Check if we have a cached result
            const cacheKey = `text-${hashString(text)}-${question}`;
            const cachedResult = this.cache.get(cacheKey);
            if (cachedResult) {
                console.log('Using cached result for text analysis');
                return cachedResult;
            }
            
            throw new Error(`Failed to analyze text: ${error.message}`);
        }
    }

    async getHealth() {
        try {
            const response = await fetch(`${this.baseURL}/api/health`);
            
            if (!response.ok) {
                throw new Error(`Health check failed: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Health check error:', error);
            return { 
                success: false, 
                status: 'ERROR', 
                message: 'Server unreachable' 
            };
        }
    }

    // Queue system for offline support
    queueRequest(request) {
        this.requestQueue.push(request);
        
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
                this.requestQueue.shift(); // Remove successful request
            } catch (error) {
                console.error('Failed to process queued request:', error);
                break; // Stop processing if one fails
            }
        }
        
        this.isProcessingQueue = false;
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Get cache size
    getCacheSize() {
        return this.cache.size;
    }
}

// Helper function to create a simple hash of a string
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
}

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DataExaminerAPI;
}